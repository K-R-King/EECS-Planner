"""
Refresh backend/offerings.json from the EECS department's course pages.

Each page at https://www2.eecs.berkeley.edu/Courses/<CODE>/ lists:
  - "Formats": the terms a course is approved for (Fall / Spring / Summer)
  - "Class Schedule (<Term> <Year>)": terms it's actually scheduled
  - "Prerequisites": the official prerequisite text
A course counts as offered in a term if either list includes it. Courses without a page
(math, physics, brand-new courses) keep the defaults in curriculum.py.

Usage (from the repo root):  python scripts/update_offerings.py
"""

import datetime
import html
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.curriculum import COURSES  # noqa: E402

OUTPUT = Path(__file__).resolve().parents[1] / "backend" / "offerings.json"
PAGE = "https://www2.eecs.berkeley.edu/Courses/{}/"
SEASONS = ("Fall", "Spring", "Summer")

# our code prefix -> the department's
PREFIXES = {"CS": "COMPSCI", "EECS": "EECS", "ELENG": "ELENG"}

# the department's course names -> our codes (old names included)
ALIASES = {"EECS16A": "ELENG66", "EECS16B": "ELENG64", "DATAC100": "DATA100", "PHYSICS7A": "PHYS7A", "PHYSICS7B": "PHYS7B"}


# Prerequisites written as prose ("programming experience equivalent to CS 61A") that the parser
# can't read. Each entry quotes the page's wording.
MANUAL_PREREQS = {
    "CS70": ["CS61A"],  # "programming experience equivalent to that gained with COMPSCI 61A"
}


def page_code(code):
    for ours, theirs in PREFIXES.items():
        if code.startswith(ours) and code[len(ours)].isdigit():
            return theirs + code[len(ours):]
    return None


def our_code(dept, number):
    joined = (dept + number).replace(" ", "").upper()
    joined = joined.replace("COMPSCI", "CS", 1) if joined.startswith("COMPSCI") else joined
    return ALIASES.get(joined, joined)


COURSE_REF = re.compile(r"\b(COMPSCI|EECS|ELENG|MATH|PHYSICS|STAT|DATA)\s+(C?\d+[A-Z]*)")


def parse_prereqs(text):
    """
    Official prerequisite text -> our format: a list where each item is a required code,
    or a list of codes where any one is enough. Courses we don't track (e.g. STAT 134) only
    count as alternatives; a requirement made entirely of untracked courses is dropped.
    """
    text = re.split(r"Credit Restrictions|Formats:|Terms offered", text)[0]
    text = re.sub(r"[^.;]*(recommended|preferred)[^.;]*", "", text)
    text = re.sub(r",?\s*or consent of (the )?instructor", "", text, flags=re.I)

    prereqs = []
    for clause in re.split(r";|\band\b|,", text):
        codes = [our_code(d, n) for d, n in COURSE_REF.findall(clause)]
        if not codes:
            continue
        known = [c for c in codes if c in COURSES]
        if " or " in clause:
            if len(known) == len(codes) and len(known) > 1:
                prereqs.append(known)           # any of these
            elif known:
                prereqs.append(known[0] if len(known) == 1 else known)
        else:
            prereqs.extend(known)
    # drop duplicates, keep order
    seen, unique = set(), []
    for p in prereqs:
        key = json.dumps(p)
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def course_page(dept_code):
    """(terms offered, prerequisite text) from the page, or None if there's no usable page."""
    try:
        with urllib.request.urlopen(PAGE.format(dept_code), timeout=20) as response:
            text = response.read().decode("utf-8", "replace")
    except Exception:
        return None

    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)))
    formats = re.search(r"Formats:(.*?)(Grading [Bb]asis|$)", text)
    if not formats:
        return None

    terms = {t for t in SEASONS if f"{t}:" in formats.group(1)}
    terms |= {season for season, _ in re.findall(r"Class Schedule \((Fall|Spring|Summer) (\d{4})\)", text)}
    prereq = re.search(r"Prerequisites?:(.*?)(Credit Restrictions|Formats:)", text)
    return [t for t in SEASONS if t in terms], (prereq.group(1).strip() if prereq else "")


def main():
    offerings = {}
    for code in COURSES:
        dept_code = page_code(code)
        page = course_page(dept_code) if dept_code else None
        if not page or not page[0]:
            print(f"{code:10} no page, keeping defaults")
            continue
        terms, prereq_text = page
        prereqs = MANUAL_PREREQS.get(code, parse_prereqs(prereq_text))
        print(f"{code:10} {', '.join(terms):22} prereqs {prereqs}   <- {prereq_text[:90]!r}")
        offerings[code] = {
            "terms": terms,
            "prereqs": prereqs,
            "prereq_text": prereq_text,
            "source": PAGE.format(dept_code),
        }

    OUTPUT.write_text(json.dumps({
        "checked": datetime.date.today().isoformat(),
        "courses": offerings,
    }, indent=2) + "\n")
    print(f"\nWrote {len(offerings)} courses to {OUTPUT}")


if __name__ == "__main__":
    main()
