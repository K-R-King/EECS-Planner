"""Request models: anything malformed is rejected with a clear 422 instead of crashing the planner."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from backend.curriculum import AP_EXAMS, COURSES, FOCUS_TRACKS

Term = Annotated[str, StringConstraints(pattern=r"^Year [1-4] (Fall|Spring|Summer)$")]
CourseCode = Annotated[str, StringConstraints(min_length=1, max_length=20)]


def normalize(code: str) -> str:
    return code.replace(" ", "").upper()


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    timeline: Literal[3, 3.5, 4] = 4
    maxUnits: int = Field(16, ge=12, le=20)
    summer: bool = False
    ap: dict[str, Annotated[int, Field(ge=1, le=5)]] = {}
    focus: str = "balanced"
    completed: list[CourseCode] = Field(default=[], max_length=60)

    @field_validator("ap")
    @classmethod
    def known_exams(cls, ap):
        unknown = [exam for exam in ap if exam not in AP_EXAMS]
        if unknown:
            raise ValueError(f"unknown AP exams: {', '.join(unknown)}")
        return ap

    @field_validator("focus")
    @classmethod
    def known_focus(cls, focus):
        if focus not in FOCUS_TRACKS:
            raise ValueError(f"focus must be one of: {', '.join(FOCUS_TRACKS)}")
        return focus

    @field_validator("completed")
    @classmethod
    def known_courses(cls, completed):
        codes = [normalize(c) for c in completed]
        unknown = [c for c in codes if c not in COURSES]
        if unknown:
            raise ValueError(f"unknown courses: {', '.join(unknown)}")
        return codes


class CourseRef(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: CourseCode


class SemesterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    term: Term
    courses: list[CourseRef | CourseCode] = Field(default=[], max_length=12)


class ChatTurn(BaseModel):
    role: Literal["student", "advisor"]
    text: Annotated[str, StringConstraints(max_length=4000)]


class PlanRequest(BaseModel):
    completed_courses: list[CourseCode] = []
    settings: Settings = Settings()


class ReviewRequest(BaseModel):
    plan: list[SemesterIn] = Field(default=[], max_length=12)
    settings: Settings = Settings()


class AdvisorRequest(BaseModel):
    plan: list[SemesterIn] = Field(default=[], max_length=12)
    question: Annotated[str, StringConstraints(min_length=1, max_length=1000)]
    settings: Settings = Settings()
    history: list[ChatTurn] = Field(default=[], max_length=40)
