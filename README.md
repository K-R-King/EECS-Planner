# UC Berkeley EECS Planner

Generates a semester-by-semester course roadmap for incoming UC Berkeley EECS students, then lets you reshape it by dragging courses around or by asking an AI advisor (Gemini) to change it for you.

![Hero](docs/screenshots/hero.png)

![Plan](docs/screenshots/plan.png)

## Features

- **Full degree plan:** every requirement for 2026–27 entering EECS students (lower-division math, physics, CS, ELENG 64/66, natural science, Reading & Composition, H/SS breadth, ethics, and upper-division electives) spread across 3, 3.5, or 4 years, with optional summer sessions.
- **AP credit by score:** all AP exams, following the College of Engineering chart, including unit caps and the 2-course H/SS limit.
- **Requirement checks:** prerequisites, term offerings, unit limits, the 12-unit full-time minimum, R&C deadlines, 20 upper-division EECS units, and the design course.
- **Edit freely:** drag and drop (or "Move to…" on phones), add from the course catalog, remove, undo.
- **AI advisor:** answers questions, and edits the plan when you ask it to ("make Year 2 lighter").
- **Keep it:** plans are saved in your browser, can be shared as a link, and print cleanly to PDF.

## Running locally

### Backend

```bash
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then add your Gemini API key
uvicorn backend.main:app --reload       # run from the repo root
```

The API runs at `http://127.0.0.1:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests

```bash
pip install -r backend/requirements-dev.txt
python -m pytest
```

The tests build a plan for every combination of timeline, unit limit, AP credit, and summer setting and check it against every rule, and they cover the advisor's edits and error handling (Gemini is faked, so no API key is needed). GitHub Actions runs them, plus the frontend typecheck, lint, and build, on every push.

## Deploying

The frontend and backend deploy separately, e.g. the frontend on [Vercel](https://vercel.com) and the backend on [Render](https://render.com).

**Backend** (start command `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, from the repo root), environment variables:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini key for the AI advisor |
| `ALLOWED_ORIGINS` | Your frontend's URL, e.g. `https://my-planner.vercel.app` (comma-separated for several) |
| `ADVISOR_REQUESTS_PER_MINUTE` | Optional, default 10 per visitor, protects your Gemini usage |

**Frontend** (root directory `frontend/`), environment variable:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Your backend's URL, e.g. `https://my-planner-api.onrender.com` |

## API

| Method | Path             | Body                                         | Does                                           |
| ------ | ---------------- | -------------------------------------------- | ---------------------------------------------- |
| GET    | `/courses`       |                                              | Full course catalog                            |
| GET    | `/ap-exams`      |                                              | AP exams and the credit each score earns       |
| POST   | `/generate-plan` | `{ completed_courses: [], settings }`        | Builds a plan                                  |
| POST   | `/review-plan`   | `{ plan, settings }`                         | Re-checks an edited plan for problems          |
| POST   | `/advisor`       | `{ plan, question, settings, history }`      | Answers, and edits the plan when asked to      |

`settings` is `{ timeline, maxUnits, summer, ap: { examKey: score } }`.

## Curriculum

Course data lives in `backend/curriculum.py`, based on:

- [Berkeley Engineering: EECS major requirements (2026–27)](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/)
- [EECS department: lower-division requirements](https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-lowerdiv-2/)
- [Berkeley Engineering: AP/IB exam credit](https://engineering.berkeley.edu/students/undergraduate-guide/exams/)

Requirements that allow a choice (the natural science elective, H/SS courses) are single placeholder slots. Upper-division prerequisites are simplified, and summer offerings vary by year. This is an unofficial planning tool, so always confirm with an EECS advisor.
