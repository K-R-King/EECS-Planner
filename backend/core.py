from math import ceil

from backend.curriculum import AP_CREDIT, COURSES, TOTAL_UNITS

FULL_TIME_UNITS = 12


def scheduling_passes(hss_per_term):
    """Categories to fill, in priority order: (category, max courses of that category in this pass)."""
    return [
        ("hss", hss_per_term),  # spread breadth courses evenly instead of piling them at the end
        ("core", None),
        ("ethics", None),
        ("elective", None),
        ("hss", None),          # extra breadth if there's still room
    ]


# ---------- HELPERS ----------
def can_take(course, completed, season, year):
    info = COURSES[course]
    return (
        season in info["terms"]
        and year >= info.get("min_year", 1)
        and all(p in completed for p in info["prereqs"])
    )


def build_terms(timeline_years: float):
    """
    Converts:
    4.0 -> 8 semesters
    3.5 -> 7 semesters
    3.0 -> 6 semesters
    """

    semesters = int(timeline_years * 2)

    base_terms = [
        "Year 1 Fall", "Year 1 Spring",
        "Year 2 Fall", "Year 2 Spring",
        "Year 3 Fall", "Year 3 Spring",
        "Year 4 Fall", "Year 4 Spring",
    ]

    return base_terms[:semesters]


def course_info(code):
    info = COURSES[code]
    return {
        "code": code,
        "title": info["title"],
        "units": info["units"],
        "category": info["category"],
    }


# ---------- MAIN ENGINE ----------
def build_degree_plan(completed_courses, settings=None):
    if settings is None:
        settings = {}

    timeline = float(settings.get("timeline", 4))
    max_units = int(settings.get("maxUnits", 16))

    completed = set(completed_courses)

    ap_credit = []
    for exam in settings.get("ap", []):
        for course in AP_CREDIT.get(exam, []):
            if course == "HSS":
                course = next(
                    (c for c in COURSES if COURSES[c]["category"] == "hss"
                     and c.startswith("HSS") and c not in completed),
                    None,
                )
            if course and course not in completed:
                completed.add(course)
                ap_credit.append(course)

    units_done = sum(COURSES[c]["units"] for c in completed if c in COURSES)
    terms = build_terms(timeline)
    plan = []

    for i, term in enumerate(terms):
        year = i // 2 + 1
        season = term.split()[-1]  # "Year 1 Fall" -> "Fall"

        # spread the remaining units evenly over the remaining semesters
        terms_left = len(terms) - i
        target = ceil((TOTAL_UNITS - units_done) / terms_left)
        target = min(max_units, max(FULL_TIME_UNITS, target))

        hss_left = sum(1 for c in COURSES if COURSES[c]["category"] == "hss" and c not in completed)
        hss_per_term = ceil(hss_left / terms_left)

        semester_courses = []
        units = 0

        for category, limit in scheduling_passes(hss_per_term):
            added = 0
            for course in COURSES:
                if units >= target or (limit is not None and added >= limit):
                    break
                if (
                    COURSES[course]["category"] != category
                    or course in completed
                    or course in semester_courses
                    or not can_take(course, completed, season, year)
                ):
                    continue

                course_units = COURSES[course]["units"]
                if units + course_units <= max_units:
                    semester_courses.append(course)
                    units += course_units
                    added += 1

        # mark completed
        completed.update(semester_courses)
        units_done += units

        plan.append({
            "term": term,
            "courses": [course_info(c) for c in semester_courses],
            "units": units
        })

    warnings = []

    missing = [c for c in COURSES if COURSES[c]["category"] != "elective" and c not in completed]
    if missing:
        warnings.append(
            f"Required courses that didn't fit: {', '.join(missing)}. "
            "Try a higher unit limit or a longer timeline."
        )
    if units_done < TOTAL_UNITS:
        warnings.append(
            f"This plan reaches {units_done} of the {TOTAL_UNITS} units needed to graduate. "
            "Try a higher unit limit or a longer timeline."
        )

    return {
        "plan": plan,
        "total_units": units_done,
        "ap_credit": ap_credit,
        "warnings": warnings,
    }
