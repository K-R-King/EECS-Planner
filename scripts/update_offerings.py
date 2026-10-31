"""
Refresh backend/offerings.json from the EECS department's course pages.

Each page at https://www2.eecs.berkeley.edu/Courses/<CODE>/ has a "Formats" section
listing the terms a course is approved for (Fall / Spring / Summer). Courses without
a page (e.g. math, physics, brand-new courses) keep the defaults in curriculum.py.

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

# our code prefix -> the department's
PREFIXES = {"CS": "COMPSCI", "EECS": "EECS", "ELENG": "ELENG"}


def page_code(code):
    for ours, theirs in PREFIXES.items():
        if code.startswith(ours) and code[len(ours)].isdigit():
            return theirs + code[len(ours):]
    return None


def formats(code):
    """Terms listed in the page's Formats section, or None if there's no usable page."""
    try:
        with urllib.request.urlopen(PAGE.format(code), timeout=20) as response:
            text = response.read().decode("utf-8", "replace")
    except Exception:
        return None

    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)))
    section = re.search(r"Formats:(.*?)(Grading [Bb]asis|$)", text)
    if not section:
        return None
    terms = [t for t in ("Fall", "Spring", "Summer") if f"{t}:" in section.group(1)]
    return terms or None


def main():
    offerings = {}
    for code in COURSES:
        dept_code = page_code(code)
        terms = formats(dept_code) if dept_code else None
        status = ", ".join(terms) if terms else "no page, keeping default"
        print(f"{code:10} {status}")
        if terms:
            offerings[code] = {"terms": terms, "source": PAGE.format(dept_code)}

    OUTPUT.write_text(json.dumps({
        "checked": datetime.date.today().isoformat(),
        "courses": offerings,
    }, indent=2) + "\n")
    print(f"\nWrote {len(offerings)} courses to {OUTPUT}")


if __name__ == "__main__":
    main()
