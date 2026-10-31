import os
import time
from collections import defaultdict, deque

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core import ap_exam_list, apply_changes, build_degree_plan, catalog, review_plan
from backend.ai import get_ai_advice

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
_advisor_calls: dict[str, deque] = defaultdict(deque)


def advisor_allowed(client_ip: str) -> bool:
    now = time.monotonic()
    calls = _advisor_calls[client_ip]
    while calls and now - calls[0] > 60:
        calls.popleft()
    if len(calls) >= ADVISOR_LIMIT:
        return False
    calls.append(now)
    return True


# ---------------- MODELS ----------------
class PlanRequest(BaseModel):
    completed_courses: list[str] = []
    settings: dict = {}

class ReviewRequest(BaseModel):
    plan: list[dict] = []
    settings: dict = {}

class AdvisorRequest(BaseModel):
    plan: list[dict] = []
    question: str = ""
    settings: dict = {}
    history: list[dict] = []


# ---------------- ROUTES ----------------

@app.get("/courses")
def courses():
    return catalog()


@app.get("/ap-exams")
def ap_exams():
    return ap_exam_list()


@app.post("/generate-plan")
def generate_plan(req: PlanRequest):
    return build_degree_plan(
        completed_courses=req.completed_courses,
        settings=req.settings
    )


@app.post("/review-plan")
def review(req: ReviewRequest):
    return review_plan(req.plan, req.settings)


@app.post("/advisor")
def advisor(req: AdvisorRequest, request: Request):
    no_changes = {"changes": [], "skipped": [], "result": None}

    if not advisor_allowed(request.client.host if request.client else "unknown"):
        return {"answer": "You're asking questions faster than the advisor can keep up. Please wait a minute and try again.",
                "error": True, **no_changes}

    current = review_plan(req.plan, req.settings)
    reply = get_ai_advice(
        req.plan, req.question, req.settings, current["issues"], req.history, current["ap_credit"]
    )

    if isinstance(reply, str):
        return {"answer": reply, "error": True, **no_changes}

    if not reply.changes:
        return {"answer": reply.answer, "error": False, **no_changes}

    schedule, applied, skipped = apply_changes(
        req.plan, [c.model_dump() for c in reply.changes], current["ap_credit"]
    )
    updated = review_plan(
        [{"term": term, "courses": codes} for term, codes in schedule],
        req.settings,
    )

    return {"answer": reply.answer, "error": False, "changes": applied, "skipped": skipped, "result": updated}
