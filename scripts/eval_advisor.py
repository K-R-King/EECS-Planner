"""
Measure the AI advisor against real Gemini: how often its suggested edits are valid,
before and after the automatic correction step, and how long it takes.

Uses your GEMINI_API_KEY (about 10-20 requests per run). Requests are spaced out to stay under
the Gemini free tier's 5 requests per minute, so a run takes a few minutes. From the repo root:
    python scripts/eval_advisor.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.ai import get_ai_advice  # noqa: E402
from backend.core import build_degree_plan, review_plan  # noqa: E402
from backend.main import checked_proposal, proposal  # noqa: E402

BASE = {"timeline": 4, "maxUnits": 16, "summer": False, "ap": {}, "focus": "balanced", "completed": [], "picks": {}}

# (question, settings changes, whether the student wants the plan changed)
CASES = [
    ("Make my plan easier", {}, True),
    ("Make year 2 lighter", {}, True),
    ("Move CS 70 to Year 1 Spring", {}, True),
    ("Add CS 182 somewhere", {}, True),
    ("Move CS 162 as early as possible", {}, True),
    ("Take one course over the summer so Year 3 is lighter", {"summer": True}, True),
    ("Make year 1 lighter", {"ap": {"calcBC": 5, "englishLang": 4}}, True),
    ("Add another hardware elective", {"focus": "hardware"}, True),
    ("What does CS 170 cover?", {}, False),
    ("Which semester looks hardest?", {}, False),
]


def run(question, settings, wants_change):
    plan = build_degree_plan([], settings)["plan"]
    current = review_plan(plan, settings)
    args = (plan, question, settings, current["issues"], [], current["ap_credit"] + current["completed"])

    start = time.time()
    reply = get_ai_advice(*args)
    if isinstance(reply, str):
        return {"error": reply, "seconds": time.time() - start}

    first, first_problems = proposal(reply, plan, settings, current)
    final = checked_proposal(reply, plan, settings, current, args)
    _, final_problems = proposal_for(final, plan, settings, current)
    changed = bool(final["changes"])

    return {
        "seconds": time.time() - start,
        "first_valid": not first_problems,
        "final_valid": not final_problems,
        "repaired": (final["answer"], final["changes"]) != (first["answer"], first["changes"]),
        "did_what_was_asked": changed == wants_change,
        "changes": final["changes"],
        "problems": final_problems,
    }


def proposal_for(payload, plan, settings, current):
    """Problems in an already-built payload (re-checked against the current plan)."""
    if not payload["result"]:
        return payload, []
    result = payload["result"]
    problems = [i["message"] for i in result["issues"] if i not in current["issues"]]
    problems += [w for w in result["warnings"] if w not in current["warnings"]]
    return payload, problems


SECONDS_BETWEEN_CASES = 25  # a case can take 2 requests; the free tier allows 5 per minute


def main():
    results = []
    for i, (question, overrides, wants_change) in enumerate(CASES):
        if i:
            time.sleep(SECONDS_BETWEEN_CASES)
        result = run(question, {**BASE, **overrides}, wants_change)
        results.append(result)
        if "error" in result:
            print(f"ERROR  {question!r}: {result['error']}")
            continue
        status = "ok " if result["final_valid"] and result["did_what_was_asked"] else "BAD"
        fixed = " (corrected)" if result["repaired"] else ""
        print(f"{status} {result['seconds']:5.1f}s  {question!r}{fixed}")
        print(f"      changes: {result['changes']}")
        for p in result["problems"]:
            print(f"      problem: {p}")

    done = [r for r in results if "error" not in r]
    if not done:
        return
    n = len(done)
    print(f"\n{n} answered, {len(results) - n} errors")
    print(f"valid on the first try:   {sum(r['first_valid'] for r in done)}/{n}")
    print(f"valid after correction:   {sum(r['final_valid'] for r in done)}/{n}")
    print(f"did what was asked:       {sum(r['did_what_was_asked'] for r in done)}/{n}")
    print(f"average time:             {sum(r['seconds'] for r in done) / n:.1f}s")


if __name__ == "__main__":
    main()
