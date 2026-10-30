from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core import build_degree_plan
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

class AdvisorRequest(BaseModel):
    plan: list = []
    question: str = ""


# ---------------- ROUTES ----------------

@app.post("/generate-plan")
def generate_plan(req: PlanRequest):
    return build_degree_plan(
        completed_courses=req.completed_courses,
        settings=req.settings
    )


@app.post("/advisor")
def advisor(req: AdvisorRequest):
    answer = get_ai_advice(req.plan, req.question)
    return {"answer": answer}
