import json
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

from backend.core import catalog, plan_to_schedule

load_dotenv(Path(__file__).parent / ".env")

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

SYSTEM_PROMPT = """You are an experienced UC Berkeley EECS academic advisor.
You are helping a prospective student plan their entire undergraduate degree.

You can edit the student's plan directly:
- When the student asks you to change, fix, lighten, rearrange, or improve the plan
  (for example "make it easier" or "move CS 70 later"), make the edits yourself in
  `changes` and explain them in `answer`. Don't just tell them what they could do.
- When they only ask a question, leave `changes` empty.

Rules for changes:
- action is "move", "add", or "remove". Use course codes exactly as in the catalog (e.g. "CS70").
- to_term must be one of the plan's semesters, exactly as written (e.g. "Year 2 Fall").
  The plan only has Fall and Spring semesters, no summer.
- A course must come after all of its prerequisites, only in a term it's offered,
  and every semester must stay at or under the student's unit limit.
- Never remove a required course (category core, hss, or ethics); move it instead.
- Keep at least 12 units per semester when you can.

Only use information from the plan and catalog. Be concise, accurate, and friendly."""


class PlanChange(BaseModel):
    action: Literal["move", "add", "remove"]
    course: str
    to_term: str = ""


class AdvisorReply(BaseModel):
    answer: str
    changes: list[PlanChange]


def build_prompt(plan, question, settings, issues, history):
    schedule = {term: codes for term, codes in plan_to_schedule(plan)}
    past = "\n".join(f"{m['role']}: {m['text']}" for m in history[-6:]) or "(none)"

    return f"""Student settings: max {settings.get('maxUnits', 16)} units per semester.

Current degree plan (semester -> courses):
{json.dumps(schedule, indent=2)}

Current problems with the plan:
{json.dumps(issues) if issues else "(none)"}

Course catalog (code, title, units, category, prerequisites, terms offered):
{json.dumps(catalog())}

Earlier conversation:
{past}

Student question:
{question}"""


def get_ai_advice(plan, question, settings, issues, history):
    """Returns an AdvisorReply, or an error message string."""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=build_prompt(plan, question, settings, issues, history),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=AdvisorReply,
            ),
        )

        return response.parsed or f"Gemini Error: couldn't read the reply ({response.text})"

    except Exception as e:
        return f"Gemini Error: {e}"
