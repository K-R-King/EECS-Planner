import json
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.core import (
    ap_exam_list, apply_changes, build_degree_plan, catalog, focus_list, picks_of, plan_to_schedule, review_plan,
)
from backend.ai import get_ai_advice, known_rating, rate_semesters, semester_key, stream_ai_advice
from backend.schemas import AdvisorRequest, PlanRequest, RatingRequest, ReviewRequest

app = FastAPI()

# ---------------- CORS ----------------
# comma-separated list, e.g. "https://my-planner.vercel.app"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- RATE LIMIT ----------------
# every advisor question costs a Gemini request, so cap them per visitor; so does rating a new semester,
# counted separately so that editing a plan doesn't use up someone's advisor questions
ADVISOR_LIMIT = int(os.environ.get("ADVISOR_REQUESTS_PER_MINUTE", "10"))
RATING_LIMIT = int(os.environ.get("RATING_REQUESTS_PER_MINUTE", "6"))
RATE_LIMIT_MESSAGE = "You're asking questions faster than the advisor can keep up. Please wait a minute and try again."
WINDOW = 60  # seconds

# Behind a proxy, every request comes from the proxy's address, so the visitor's own address has to be
# read from a header the proxy sets and the visitor can't: "true-client-ip" on Render (set by its
# Cloudflare edge) or "x-real-ip" on Vercel. Never use X-Forwarded-For here: visitors can write their own.
CLIENT_IP_HEADER = os.environ.get("CLIENT_IP_HEADER", "").strip().lower()

_advisor_calls: dict[str, deque] = defaultdict(deque)
_rating_calls: dict[str, deque] = defaultdict(deque)
_calls_lock = threading.Lock()
_last_sweep = 0.0


def client_ip(request: Request) -> str:
    if CLIENT_IP_HEADER:
        forwarded = request.headers.get(CLIENT_IP_HEADER, "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "unknown"


def _forget_idle_visitors(now: float):
    """Drop visitors with no requests in the last minute, so the table doesn't grow forever."""
    global _last_sweep
    if now - _last_sweep < WINDOW:
        return
    _last_sweep = now
    for table in (_advisor_calls, _rating_calls):
        for ip in [ip for ip, calls in table.items() if not calls or now - calls[-1] > WINDOW]:
            del table[ip]


def within_limit(table: dict[str, deque], limit: int, request: Request) -> bool:
    ip = client_ip(request)
    now = time.monotonic()
    with _calls_lock:
        _forget_idle_visitors(now)
        calls = table[ip]
        while calls and now - calls[0] > WINDOW:
            calls.popleft()
        if len(calls) >= limit:
            return False
        calls.append(now)
        return True


def advisor_allowed(request: Request) -> bool:
    return within_limit(_advisor_calls, ADVISOR_LIMIT, request)


# ---------------- ROUTES ----------------

@app.get("/courses")
def courses():
    return catalog()


@app.get("/ap-exams")
def ap_exams():
    return ap_exam_list()


@app.get("/focus-tracks")
def focus_tracks():
    return focus_list()


@app.post("/generate-plan")
def generate_plan(req: PlanRequest):
    return build_degree_plan(
        completed_courses=req.completed_courses,
        settings=req.settings.model_dump()
    )


@app.post("/review-plan")
def review(req: ReviewRequest):
    return review_plan([s.model_dump() for s in req.plan], req.settings.model_dump())


@app.post("/rate-semesters")
def rate(req: RatingRequest, request: Request):
    """Each semester's difficulty out of 10 from Gemini: {term: rating}, or null if it couldn't be rated."""
    picks = picks_of(req.settings.model_dump())
    schedule = plan_to_schedule([s.model_dump() for s in req.plan])
    semesters = {term: semester_key(codes, picks) for term, codes in schedule if codes}
    unrated = [key for key in semesters.values() if known_rating(key) is None]
    if unrated and within_limit(_rating_calls, RATING_LIMIT, request):
        rate_semesters(unrated)
    return {"ratings": {term: known_rating(key) for term, key in semesters.items()}}


def advisor_context(req: AdvisorRequest):
    plan = [s.model_dump() for s in req.plan]
    settings = req.settings.model_dump()
    current = review_plan(plan, settings)
    already_done = current["ap_credit"] + current["completed"]
    args = (plan, req.question, settings, current["issues"], [h.model_dump() for h in req.history], already_done)
    return plan, settings, current, args


def proposal(reply, plan, settings, current):
    """
    The advisor's answer plus, if it suggested edits, the plan with them applied, and the problems
    those edits introduce. The edits are only a proposal: the student accepts or rejects them in the page.
    """
    if not reply.changes:
        return {"answer": reply.answer, "error": False, "changes": [], "skipped": [], "result": None}, []

    schedule, applied, skipped = apply_changes(
        plan, [c.model_dump() for c in reply.changes], current["ap_credit"], current["completed"]
    )
    proposed = review_plan([{"term": term, "courses": codes} for term, codes in schedule], settings)
    new_problems = [i["message"] for i in proposed["issues"] if i not in current["issues"]]
    new_problems += [w for w in proposed["warnings"] if w not in current["warnings"]]

    payload = {"answer": reply.answer, "error": False, "changes": applied, "skipped": skipped,
               "result": proposed if applied else None}
    return payload, new_problems


def checked_proposal(reply, plan, settings, current, args):
    """
    If the advisor's edits break a rule, ask it once to correct them (one extra Gemini call, only
    when needed) and keep whichever version has fewer problems.
    """
    payload, problems = proposal(reply, plan, settings, current)
    if not problems:
        return payload

    retry = get_ai_advice(*args, feedback=(reply, problems))
    if isinstance(retry, str):
        return payload
    retry_payload, retry_problems = proposal(retry, plan, settings, current)
    return retry_payload if len(retry_problems) < len(problems) else payload


def error_reply(message):
    return {"answer": message, "error": True, "changes": [], "skipped": [], "result": None}


@app.post("/advisor")
def advisor(req: AdvisorRequest, request: Request):
    if not advisor_allowed(request):
        return error_reply(RATE_LIMIT_MESSAGE)

    plan, settings, current, args = advisor_context(req)
    reply = get_ai_advice(*args)
    return error_reply(reply) if isinstance(reply, str) else checked_proposal(reply, plan, settings, current, args)


@app.post("/advisor/stream")
def advisor_stream(req: AdvisorRequest, request: Request):
    """
    Same as /advisor, streamed as newline-delimited JSON:
    {"type": "delta", "text": ...} while the answer is written, {"type": "status", "text": ...} if the
    advisor is correcting its edits, then {"type": "done", ...the /advisor reply}.
    """
    allowed = advisor_allowed(request)

    def events():
        if not allowed:
            yield json.dumps({"type": "done", **error_reply(RATE_LIMIT_MESSAGE)}) + "\n"
            return

        plan, settings, current, args = advisor_context(req)
        for kind, value in stream_ai_advice(*args):
            if kind == "delta":
                yield json.dumps({"type": "delta", "text": value}) + "\n"
            elif kind == "error":
                yield json.dumps({"type": "done", **error_reply(value)}) + "\n"
            else:
                payload, problems = proposal(value, plan, settings, current)
                if problems:
                    yield json.dumps({"type": "status", "text": "Double-checking those changes…"}) + "\n"
                    payload = checked_proposal(value, plan, settings, current, args)
                yield json.dumps({"type": "done", **payload}) + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")