import json
import logging
import os
import time
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from backend.core import catalog, plan_to_schedule

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("uvicorn.error")

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
- Courses covered by AP credit are already done. Don't add them, and don't say they're missing.
- Every semester must have at least 12 units (the full-time minimum). To lighten a
  semester, swap a demanding course for a lighter one (e.g. a breadth course) instead
  of just removing units.

Only use information from the plan and catalog. Be concise, accurate, and friendly."""


class PlanChange(BaseModel):
    action: Literal["move", "add", "remove"]
    course: str
    to_term: str = ""


class AdvisorReply(BaseModel):
    answer: str
    changes: list[PlanChange]


def build_prompt(plan, question, settings, issues, history, ap_credit):
    schedule = {term: codes for term, codes in plan_to_schedule(plan)}
    past = "\n".join(f"{m['role']}: {m['text']}" for m in history[-6:]) or "(none)"

    return f"""Student settings: max {settings.get('maxUnits', 16)} units per semester.

Already satisfied by AP credit (count these as completed before Year 1; never add them to the plan):
{", ".join(ap_credit) if ap_credit else "(none)"}

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


RETRY_DELAYS = [1, 3]  # seconds to wait before retrying when Gemini is overloaded

BUSY_MESSAGE = "The advisor is getting a lot of questions right now. Please try again in a moment."
LIMIT_MESSAGE = "The advisor has hit its usage limit for now. Please wait a minute and try again."
SETUP_MESSAGE = "The advisor isn't set up correctly. Check the Gemini API key in backend/.env."
OFFLINE_MESSAGE = "Couldn't reach the advisor. Check your internet connection and try again."
GENERIC_MESSAGE = "Something went wrong with the advisor. Please try again."


def get_ai_advice(plan, question, settings, issues, history, ap_credit):
    """Returns an AdvisorReply, or a friendly error message string."""
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=build_prompt(plan, question, settings, issues, history, ap_credit),
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=AdvisorReply,
                ),
            )

            if response.parsed:
                return response.parsed
            logger.warning("Gemini reply couldn't be parsed: %s", response.text)
            return GENERIC_MESSAGE

        except errors.ServerError as e:
            # 500/503: usually a temporary demand spike, so retry a couple of times
            logger.warning("Gemini server error (attempt %d): %s", attempt + 1, e)
            if attempt < len(RETRY_DELAYS):
                time.sleep(RETRY_DELAYS[attempt])
                continue
            return BUSY_MESSAGE

        except errors.ClientError as e:
            logger.error("Gemini client error: %s", e)
            if e.code == 429:
                return LIMIT_MESSAGE
            if e.code in (400, 401, 403):
                return SETUP_MESSAGE
            return GENERIC_MESSAGE

        except httpx.TransportError as e:
            logger.error("Couldn't reach Gemini: %s", e)
            return OFFLINE_MESSAGE

        except Exception:
            logger.exception("Unexpected advisor error")
            return GENERIC_MESSAGE
