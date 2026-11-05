"""
Refresh backend/offerings.json from the EECS department's course pages.

Each page at https://www2.eecs.berkeley.edu/Courses/<CODE>/ lists:
  - "Formats": the terms a course is approved for (Fall / Spring / Summer)
  - "Class Schedule (<Term> <Year>)": terms it's actually scheduled
  - "Prerequisites": the official prerequisite text
  - "Catalog Description" and the weekly class hours in each format
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

# our code prefix -> the department's page names. (Pages named COMPSCI168 etc. also exist but show
# older prerequisites; the CS168-style pages match the Berkeley catalog.)
PREFIXES = {"CS": "CS", "EECS": "EECS", "ELENG": "EE"}
# cross-listed courses whose page is under another name
PAGE_CODES = {"CS182": "CSC182", "CS191": "CSC191", "DATA100": "CSC100", "EECS106A": "EEC106A"}

# the department's course names -> our codes (old names included)
ALIASES = {"EECS16A": "ELENG66", "EECS16B": "ELENG64", "DATAC100": "DATA100", "PHYSICS7A": "PHYS7A", "PHYSICS7B": "PHYS7B"}


# Prerequisites the parser can't read from the page, matching EECS Prereqs (which checks them
# against the Berkeley catalog). Each entry notes the official wording.
MANUAL_PREREQS = {
    # "sophomore mathematical maturity, and programming experience equivalent to ... 3 or AP CS A"
    "CS70": [],
    # catalog: "linear algebra at the level of ELENG 64/ELENG 66 or Math 54 ... python at the level of
    # COMPSCI 61A"; the EECS page still says ELENG 120
    "EECS106A": [["ELENG64", "ELENG66", "MATH54"], "CS61A"],
    # "61A, along with either 61B or 61BL, or programming experience ..." (no subject named)
    "CS61C": ["CS61A", "CS61B"],
    # "61C."
    "CS152": ["CS61C"],
    # "DATA C8 or STAT 20; and COMPSCI 61A, C88C, or ENGIN 7; Corequisite: MATH 54, 56, 110, ELENG 66 ...";
    # STAT 20 isn't in the planner, and it has no corequisites, so linear algebra is scheduled first
    "DATA100": ["DATA8", "CS61A", ["MATH54", "ELENG66"]],
}


def page_code(code):
    if code in PAGE_CODES:
        return PAGE_CODES[code]
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


def description_of(text):
    """The catalog description, trimmed to whole sentences (about 300 characters)."""
    match = re.search(r"Catalog Description:(.*?)(Units:|Course Objectives|Prerequisites?:|$)", text)
    if not match:
        return ""
    description = match.group(1).strip()
    if len(description) <= 300:
        return description
    cut = description[:300].rsplit(". ", 1)[0]
    return cut + "." if len(cut) > 80 else description[:297] + "..."


def class_hours(formats_text):
    """Hours per week in class during a regular semester (lecture + discussion + lab), e.g. 4.0."""
    match = re.search(r"(?:Fall|Spring):(.*?)per week", formats_text)
    if not match:
        return None
    hours = sum(float(h) for h in re.findall(r"(\d+(?:\.\d+)?) hours?", match.group(1)))
    return hours or None


def course_page(dept_code):
    """(terms offered, prerequisite text, description, class hours) from the page, or None."""
    try:
        with urllib.request.urlopen(PAGE.format(dept_code), timeout=20) as response:
            text = response.read().decode("utf-8", "replace")
    except Exception:
        return None

    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)))
    # some pages (e.g. CS 70) list no formats, only the terms the course is scheduled
    formats = re.search(r"Formats:(.*?)(Grading [Bb]asis|$)", text)
    terms = {t for t in SEASONS if formats and f"{t}:" in formats.group(1)}
    terms |= {season for season, _ in re.findall(r"Class Schedule \((Fall|Spring|Summer) (\d{4})\)", text)}
    if not terms:
        return None

    prereq = re.search(r"Prerequisites?:(.*?)(Credit Restrictions|Formats:|Grading [Bb]asis)", text)
    return (
        [t for t in SEASONS if t in terms],
        prereq.group(1).strip() if prereq else "",
        description_of(text),
        class_hours(formats.group(1)) if formats else None,
    )


def main():
    offerings = {}
    for code in COURSES:
        dept_code = page_code(code)
        page = course_page(dept_code) if dept_code else None
        if not page or not page[0]:
            print(f"{code:10} no page, keeping defaults")
            continue
        terms, prereq_text, description, hours = page
        prereqs = MANUAL_PREREQS.get(code, parse_prereqs(prereq_text))
        print(f"{code:10} {', '.join(terms):22} prereqs {prereqs}   <- {prereq_text[:90]!r}")
        offerings[code] = {
            "terms": terms,
            "prereqs": prereqs,
            "prereq_text": prereq_text,
            "description": description,
            "class_hours": hours,
            "source": PAGE.format(dept_code),
        }

    # only touch the file when the data changed, so the monthly refresh doesn't open empty pull requests
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    if previous.get("courses") == offerings:
        print(f"\nNo changes since {previous.get('checked')}")
        return

    OUTPUT.write_text(json.dumps({
        "checked": datetime.date.today().isoformat(),
        "courses": offerings,
    }, indent=2) + "\n")
    print(f"\nWrote {len(offerings)} courses to {OUTPUT}")


if __name__ == "__main__":
    main()
