# UC Berkeley EECS Planner

Generates a semester-by-semester course roadmap for incoming UC Berkeley EECS students, with an AI advisor (Gemini) you can ask questions about your plan.

- **Backend:** FastAPI (`backend/`). Builds the plan from course prerequisites, unit caps, and Fall/Spring offerings.
- **Frontend:** Next.js + Tailwind (`frontend/`)

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

Open `http://localhost:3000`. To point at a different backend, set `NEXT_PUBLIC_API_URL`.

## API

| Method | Path             | Body                                         | Does                                           |
| ------ | ---------------- | -------------------------------------------- | ---------------------------------------------- |
| GET    | `/courses`       |                                              | Full course catalog                            |
| POST   | `/generate-plan` | `{ completed_courses: [], settings }`        | Builds a plan                                  |
| POST   | `/review-plan`   | `{ plan, settings }`                         | Re-checks an edited plan for problems          |
| POST   | `/advisor`       | `{ plan, question, settings, history }`      | Answers, and edits the plan when asked to      |

`settings` is `{ timeline, maxUnits, ap: [exam keys] }`.

## Curriculum

Course data lives in `backend/curriculum.py`. Each course lists its prerequisites, units, and the terms it's offered.
