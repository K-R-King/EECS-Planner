from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core import apply_changes, build_degree_plan, catalog, review_plan
from backend.ai import get_ai_advice

app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def advisor(req: AdvisorRequest):
    current = review_plan(req.plan, req.settings)
    reply = get_ai_advice(req.plan, req.question, req.settings, current["issues"], req.history)

    if isinstance(reply, str):
        return {"answer": reply, "changes": [], "skipped": [], "result": None}

    if not reply.changes:
        return {"answer": reply.answer, "changes": [], "skipped": [], "result": None}

    schedule, applied, skipped = apply_changes(req.plan, [c.model_dump() for c in reply.changes])
    updated = review_plan(
        [{"term": term, "courses": codes} for term, codes in schedule],
        req.settings,
    )

    return {"answer": reply.answer, "changes": applied, "skipped": skipped, "result": updated}
