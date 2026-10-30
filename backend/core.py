from backend.curriculum import COURSES

# ---------- HELPERS ----------
def can_take(course, completed, season):
    info = COURSES[course]
    return season in info["terms"] and all(p in completed for p in info["prereqs"])


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


# ---------- MAIN ENGINE ----------
def build_degree_plan(completed_courses, settings=None):
    if settings is None:
        settings = {}

    timeline = float(settings.get("timeline", 4))
    max_units = int(settings.get("maxUnits", 16))

    completed = set(completed_courses)
    plan = []

    terms = build_terms(timeline)

    for term in terms:
        season = term.split()[-1]  # "Year 1 Fall" -> "Fall"
        semester_courses = []
        units = 0

        for course in COURSES:
            if course not in completed and can_take(course, completed, season):
                course_units = COURSES[course]["units"]

                if units + course_units <= max_units:
                    semester_courses.append(course)
                    units += course_units

        # mark completed
        for c in semester_courses:
            completed.add(c)

        plan.append({
            "term": term,
            "courses": semester_courses,
            "units": units
        })

    return plan