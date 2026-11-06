import json
import logging
import os
import re
import time
from functools import cache
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from backend.core import catalog, course_info, plan_to_schedule
from backend.curriculum import FOCUS_TRACKS

load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger("uvicorn.error")

# set GEMINI_MODEL to switch models (e.g. when Google retires this one) without changing the code
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

_client = None


def get_client():
    """The Gemini client, made on first use; None without an API key (the rest of the planner still works)."""
    global _client
    if _client is None and os.environ.get("GEMINI_API_KEY"):
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client

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
  Only use summer sessions if the plan already has them (e.g. "Year 1 Summer");
  summers have no 12-unit minimum. Likewise winter breaks ("Year 1 Winter"), which are community
  college intersessions: only lower-division core or H/SS courses can go there.
- A course must come after all of its prerequisites, only in a term it's offered,
  and every semester must stay at or under the student's unit limit.
- Never remove a required course (category core, hss, or ethics); move it instead.
- Courses covered by AP credit or taken before Berkeley are already done. Don't add them,
  and don't say they're missing.
- At least 2 of the H/SS courses must be upper-division (the HSS3 and HSS4 slots).
- When choosing electives, prefer ones that fit the student's focus if they have one.
- Reading & Composition A must be done by the end of Year 1 and B by the end of Year 2.
- Keep at least 20 units of upper-division EECS courses and at least one design course
  (catalog field design=true).
- Every Fall/Spring semester must have at least 12 units (the full-time minimum). To lighten a
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


def first_sentence(text):
    match = re.match(r"(.+?[.!?])(\s|$)", text or "")
    return match.group(1) if match else (text or "")


@cache
def prompt_catalog():
    """
    The catalog as the advisor sees it: no empty fields and only the first sentence of each description,
    which keeps the prompt about 40% smaller (it's sent with every question).
    """
    courses = []
    for course in catalog():
        slim = {k: v for k, v in course.items()
                if k not in ("description", "prereqs_verified", "class_hours") and v not in ([], False, None, "")}
        if course["description"]:
            slim["about"] = first_sentence(course["description"])
        courses.append(slim)
    return json.dumps(courses, separators=(",", ":"))


def build_prompt(plan, question, settings, issues, history, already_done, feedback=None):
    schedule = {term: codes for term, codes in plan_to_schedule(plan)}
    past = "\n".join(f"{m['role']}: {m['text']}" for m in history[-6:]) or "(none)"
    focus = FOCUS_TRACKS.get(settings.get("focus", "balanced"), FOCUS_TRACKS["balanced"])["label"]
    picks = settings.get("picks") or {}
    chosen = settings.get("electives") or []

    retry = ""
    if feedback:
        earlier, problems = feedback
        retry = f"""

IMPORTANT: your previous answer proposed these changes:
{json.dumps([c.model_dump() for c in earlier.changes])}
Applied to the current plan, they caused these problems:
{json.dumps(problems)}
Give a corrected answer. Its changes (applied to the current plan above, not on top of your previous
changes) must not cause any of these problems."""

    return f"""Student settings: max {settings.get('maxUnits', 16)} units per semester. Focus: {focus}.
Student's choices for placeholder slots (these change units): {json.dumps(picks) if picks else "(none)"}
Electives the student picked (keep them in the plan unless asked otherwise): {", ".join(chosen) if chosen else "(none)"}

Already done through AP credit or courses taken before Berkeley (count these as completed before Year 1;
never add them to the plan):
{", ".join(already_done) if already_done else "(none)"}

Current degree plan (semester -> courses):
{json.dumps(schedule, indent=2)}

Current problems with the plan:
{json.dumps(issues) if issues else "(none)"}

Course catalog (code, title, units, category, prerequisites, terms offered; design and upper_eecs
appear only when true):
{prompt_catalog()}

Earlier conversation:
{past}

Student question:
{question}{retry}"""


RETRY_DELAYS = [1, 3]  # seconds to wait before retrying when Gemini is overloaded

BUSY_MESSAGE = "The advisor is getting a lot of questions right now. Please try again in a moment."
LIMIT_MESSAGE = "The advisor has hit its usage limit for now. Please wait a minute and try again."
SETUP_MESSAGE = "The advisor isn't set up correctly. Check the GEMINI_API_KEY setting (backend/.env locally)."
OFFLINE_MESSAGE = "Couldn't reach the advisor. Check your internet connection and try again."
GENERIC_MESSAGE = "Something went wrong with the advisor. Please try again."


def gemini_config():
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=AdvisorReply,
    )


def friendly_error(e):
    """Map a Gemini failure to (message for the student, worth retrying)."""
    if isinstance(e, errors.ServerError):
        # 500/503: usually a temporary demand spike
        logger.warning("Gemini server error: %s", e)
        return BUSY_MESSAGE, True
    if isinstance(e, errors.ClientError):
        logger.error("Gemini client error: %s", e)
        if e.code == 429:
            return LIMIT_MESSAGE, False
        if e.code in (400, 401, 403):
            return SETUP_MESSAGE, False
        return GENERIC_MESSAGE, False
    if isinstance(e, httpx.TransportError):
        logger.error("Couldn't reach Gemini: %s", e)
        return OFFLINE_MESSAGE, False
    logger.exception("Unexpected advisor error", exc_info=e)
    return GENERIC_MESSAGE, False


def get_ai_advice(plan, question, settings, issues, history, already_done, feedback=None):
    """
    Returns an AdvisorReply, or a friendly error message string.
    feedback: (earlier reply, problems its changes caused), to ask for a corrected answer.
    """
    client = get_client()
    if client is None:
        logger.error("GEMINI_API_KEY isn't set, so the advisor is off")
        return SETUP_MESSAGE

    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=build_prompt(plan, question, settings, issues, history, already_done, feedback),
                config=gemini_config(),
            )

            if response.parsed:
                return response.parsed
            logger.warning("Gemini reply couldn't be parsed: %s", response.text)
            return GENERIC_MESSAGE

        except Exception as e:
            message, retry = friendly_error(e)
            if retry and attempt < len(RETRY_DELAYS):
                time.sleep(RETRY_DELAYS[attempt])
                continue
            return message


# ---------- SEMESTER DIFFICULTY ----------
RATING_PROMPT = """You rate how hard semesters are for a UC Berkeley EECS major.
For each semester, give one whole number from 1 to 10 for how hard its full course load is, counting
how demanding the courses are, how much work they take together, and the number of units.

Use this fixed scale, comparing each semester to these examples:
2: Reading & Composition, two Humanities/Social Sciences breadth courses (12 units)
3: Reading & Composition, two breadth courses, Engineering Ethics (13 units)
5: Reading & Composition, Calculus I, CS 61A, a Natural Science course (16 units)
6: a breadth course, Math 54, CS 61B, Physics 7A (16 units)
6: a breadth course, CS 61C, CS 162 (12 units); few units of hard courses is still a real load
7: a breadth course, Math 53, Math 54, CS 61C (16 units)
8: a breadth course, CS 70, CS 162, EECS 16A (16 units)
10: CS 162, CS 170, CS 189, EECS 151 (17 units); keep 9 and 10 for loads this extreme

A semester with one course fewer is never harder: removing a course lowers the rating or leaves it
the same, and adding one raises it or leaves it the same."""


class SemesterRating(BaseModel):
    semester: int
    difficulty: int


class RatingReply(BaseModel):
    ratings: list[SemesterRating]


# A semester's rating is kept for as long as the server runs: it stays the same however many times it's
# shown, and a plan someone else already had rated costs no Gemini request.
RATINGS_KEPT = 5000
_ratings = {}


def semester_key(codes, picks):
    """What's being rated: the semester's courses, in any order, as Gemini is told about them."""
    return tuple(sorted(f"{c['code']}: {c['title']} ({c['units']} units)" for c in (course_info(code, picks) for code in codes)))


def known_rating(key):
    return _ratings.get(key)


def rate_semesters(keys, rated=()):
    """
    Asks Gemini to rate these semesters, in one request. Any it can't rate just stay unrated.
    rated: [(key, rating)] for the plan's other semesters, so new ratings fit alongside them.
    """
    client = get_client()
    if client is None:
        logger.error("GEMINI_API_KEY isn't set, so semesters aren't rated")
        return

    keys = list(dict.fromkeys(keys))
    prompt = "Rate these semesters of an EECS major:\n\n"
    prompt += "\n\n".join(f"Semester {i}:\n" + "\n".join(key) for i, key in enumerate(keys))
    if rated:
        prompt += "\n\nThe rest of this plan, already rated. Don't rate these, but stay consistent with them:\n\n"
        prompt += "\n\n".join(f"Rated {rating}:\n" + "\n".join(key) for key, rating in rated)
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=RATING_PROMPT,
                    response_mime_type="application/json",
                    response_schema=RatingReply,
                    temperature=0,
                ),
            )
            if not response.parsed:
                logger.warning("Gemini's ratings couldn't be parsed: %s", response.text)
                return
            if len(_ratings) >= RATINGS_KEPT:
                _ratings.clear()
            for rating in response.parsed.ratings:
                if 0 <= rating.semester < len(keys) and 1 <= rating.difficulty <= 10:
                    _ratings[keys[rating.semester]] = rating.difficulty
            return

        except Exception as e:
            _, retry = friendly_error(e)
            # nobody is waiting on an answer here, so a dropped connection is worth another try too
            if (retry or isinstance(e, httpx.TransportError)) and attempt < len(RETRY_DELAYS):
                time.sleep(RETRY_DELAYS[attempt])
                continue
            return


ANSWER_SO_FAR = re.compile(r'"answer"\s*:\s*"((?:[^"\\]|\\.)*)')


def partial_answer(raw):
    """The `answer` text from a JSON reply that's still arriving, decoded as far as possible."""
    match = ANSWER_SO_FAR.search(raw)
    if not match:
        return ""
    text = match.group(1)
    # drop a trailing escape that hasn't fully arrived yet (e.g. a lone backslash or "\u00")
    text = re.sub(r"\\(u[0-9a-fA-F]{0,3})?$", "", text)
    try:
        return json.loads(f'"{text}"')
    except json.JSONDecodeError:
        return ""


def stream_ai_advice(plan, question, settings, issues, history, already_done):
    """
    Yields ("delta", text) as the answer is written, then ("done", AdvisorReply)
    or ("error", friendly message).
    """
    client = get_client()
    if client is None:
        logger.error("GEMINI_API_KEY isn't set, so the advisor is off")
        yield "error", SETUP_MESSAGE
        return

    for attempt in range(len(RETRY_DELAYS) + 1):
        raw = ""
        sent = ""
        try:
            for chunk in client.models.generate_content_stream(
                model=MODEL,
                contents=build_prompt(plan, question, settings, issues, history, already_done),
                config=gemini_config(),
            ):
                raw += chunk.text or ""
                answer = partial_answer(raw)
                if len(answer) > len(sent):
                    yield "delta", answer[len(sent):]
                    sent = answer

            yield "done", AdvisorReply.model_validate_json(raw)
            return

        except Exception as e:
            message, retry = friendly_error(e)
            # only retry if the student hasn't seen any of the answer yet
            if retry and not sent and attempt < len(RETRY_DELAYS):
                time.sleep(RETRY_DELAYS[attempt])
                continue
            yield "error", message
            return
