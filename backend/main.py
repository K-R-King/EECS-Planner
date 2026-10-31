import json
import os
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.core import ap_exam_list, apply_changes, build_degree_plan, catalog, focus_list, review_plan
from backend.ai import get_ai_advice, stream_ai_advice
from backend.schemas import AdvisorRequest, PlanRequest, ReviewRequest

app = FastAPI()

# ---------------- CORS ----------------
# comma-separated list, e.g. "https://my-planner.vercel.app"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- RATE LIMIT ----------------
# every advisor question costs a Gemini request, so cap them per visitor
ADVISOR_LIMIT = int(os.environ.get("ADVISOR_REQUESTS_PER_MINUTE", "10"))
RATE_LIMIT_MESSAGE = "You're asking questions faster than the advisor can keep up. Please wait a minute and try again."
_advisor_calls: dict[str, deque] = defaultdict(deque)


def advisor_allowed(request: Request) -> bool:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    calls = _advisor_calls[client_ip]
    while calls and now - calls[0] > 60:
        calls.popleft()
    if len(calls) >= ADVISOR_LIMIT:
        return False
    calls.append(now)
    return True


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