# UC Berkeley EECS Planner

Generates a semester-by-semester course roadmap for incoming UC Berkeley EECS students, then lets you reshape it by dragging courses around or by asking an AI advisor (Gemini) to change it for you. Part of the [EECS Hub](https://eecs-hub.vercel.app).

![Hero](docs/screenshots/hero.png)

![Plan](docs/screenshots/plan.png)

<details>
<summary>Dark mode</summary>

![Plan in dark mode](docs/screenshots/plan-dark.png)

</details>

## Features

- **Full degree plan:** every requirement for 2026–27 entering EECS students (lower-division math, physics, CS, ELENG 64/66, natural science, Reading & Composition, H/SS breadth, ethics, and upper-division electives) spread across 3, 3.5, or 4 years, with optional summer sessions and winter breaks (Berkeley has no winter session, so winters are for lower-division community college intersession courses).
- **AP credit by score:** all AP exams, following the College of Engineering chart, including unit caps and the 2-course H/SS limit.
- **Requirement checks:** prerequisites, term offerings (real Fall/Spring/Summer offerings from the EECS department's course pages), unit limits, the 12-unit full-time minimum, R&C deadlines, 20 upper-division EECS units, 2 upper-division H/SS courses, and the design course.
- **Focus tracks:** pick AI/ML, Systems, Theory, Hardware, or Security and the electives follow.
- **Courses already taken:** courses taken earlier count as done. For a community college course, type it ("ENGL C1000") and pick the Berkeley course it counts as; the page links to [ASSIST](https://assist.org) to check, since equivalencies differ by college. Search accepts codes with or without spaces.
- **Semester difficulty:** each semester shows Gemini's rating out of 10 next to its units, asked for all new semesters at once after edits stop, against a fixed scale of example semesters and alongside the rest of the plan. Ratings are kept per set of courses in the browser and in the server's memory, so repeat visits cost no requests; a server restart forgets its copy. Without a Gemini key, or past the limit, the rating is just left out.
- **Seminars, special topics and DeCals:** add them with "+ Add course" (e.g. "eleng 39", "cs 198"). They're marked *Extra*: they count toward a semester's units and the 120 total, but fill no requirement, and you pick their units on the card. The planner never adds them on its own.
- **Your electives:** electives picked on [EECS Electives](https://eecs-electives.vercel.app) (or passed as `?electives=CS189.CS162`) are scheduled before the focus track's, still following every rule; one that doesn't fit is flagged in the settings.
- **Real choices:** pick the actual natural science course and H/SS category for each placeholder slot.
- **Edit freely:** drag and drop (or "Move to…" on phones), add from the course catalog, remove, undo. Hover a course to see what it needs first and what it unlocks.
- **AI advisor:** answers questions as it writes (streamed), and proposes plan edits ("make Year 2 lighter") that you accept or reject.
- **Keep it:** plans are saved in your browser, can be shared as a link, and print cleanly to PDF.
- **Light and dark mode**, keyboard focus rings, and accessible contrast.

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
python -m pytest                    # backend: planner rules, AP credit, validation, advisor

cd frontend
npx playwright test                 # browser: drag and drop, undo, saving, share links, advisor approval, dark mode, accessibility
```

The backend tests build a plan for every combination of timeline, unit limit, AP credit, and summer setting and check it against every rule. The browser tests drive the real page against the real backend; Gemini is faked in both, so no API key is needed (without one, the planner works and only the advisor is off). Locally, Playwright reuses running servers and your installed Chrome. GitHub Actions runs everything, plus the frontend typecheck, lint, and build, on every push.

## Updating course offerings

```bash
python scripts/update_offerings.py
```

Re-reads each course's Fall/Spring/Summer formats, actual scheduled terms, and official prerequisites from the EECS department's course pages into `backend/offerings.json`. Run it once a year, and check its printout: prerequisites written as prose need an entry in `MANUAL_PREREQS`.

## Measuring the AI advisor

```bash
python scripts/eval_advisor.py
```

Sends 10 typical requests ("make Year 2 lighter", "add CS 182 somewhere", …) to the real advisor and scores whether its suggested edits break any rule, before and after its automatic correction step. It uses your Gemini key (10–20 requests) and is paced for Gemini's free tier, which allows 5 requests per minute.

## Deploying (free)

Everything runs on free tiers: Vercel for the frontend, Render for the backend, and Gemini's free API tier.

**1. Backend on Render**
1. Sign in at [render.com](https://render.com) with GitHub, then **New → Blueprint** and pick this repo. It reads `render.yaml`.
2. When asked, enter your `GEMINI_API_KEY`. Leave `ALLOWED_ORIGINS` blank for now.
3. When it's live, copy its URL (e.g. `https://eecs-planner-api.onrender.com`).

**2. Frontend on Vercel**
1. Sign in at [vercel.com](https://vercel.com) with GitHub, **Add New → Project**, pick this repo, and set **Root Directory** to `frontend`.
2. Add environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | your Render URL from step 1 |
| `NEXT_PUBLIC_FEEDBACK_URL` | optional: a Google Form link, which adds a "Send feedback" button |
| `NEXT_PUBLIC_PREREQS_URL`, `NEXT_PUBLIC_ELECTIVES_URL`, `NEXT_PUBLIC_LINKS_URL`, `NEXT_PUBLIC_HUB_URL` | optional: where the links to the sister EECS Prereqs, EECS Electives, EECS Links and EECS Hub sites point (default their `*.vercel.app` addresses, or `localhost:3002`, `3003`, `3001` and `3004` locally) |

3. Deploy, and copy the site's URL (e.g. `https://eecs-planner.vercel.app`). Visits are counted with [Vercel Web Analytics](https://vercel.com/docs/analytics) (no cookies); turn it on under the project's **Analytics** tab.

**3. Connect them:** in Render, set `ALLOWED_ORIGINS` to your Vercel URL and redeploy.

**Or: backend on Vercel too.** Instead of Render, the backend can be its own Vercel project deployed from the repo root (`vercel.json` and `app.py` set it up). Add `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, and `CLIENT_IP_HEADER=x-real-ip` (so the advisor limit is per visitor) as its environment variables. `.vercelignore` replaces `.gitignore` for these uploads, so it also keeps `.env` files out. Vercel runs several short-lived copies of the backend, so the per-visitor advisor limit applies per copy.

Things to know about the free tiers:
- **Render sleeps** after about 15 idle minutes; the next visitor waits up to a minute (the page says so).
- **Switching models:** the advisor uses `gemini-2.5-flash`. Set `GEMINI_MODEL` to use another one (for example when Google retires it), no code change needed.
- **Gemini's free tier allows 5 advisor requests per minute for everyone combined.** Past that, students see "the advisor has hit its usage limit, wait a minute". Each visitor is also limited to `ADVISOR_REQUESTS_PER_MINUTE` (default 10), counted by the address in `CLIENT_IP_HEADER` (`render.yaml` sets it to `true-client-ip`). Rating semesters the server hasn't seen shares Gemini's limit, and has its own per-visitor cap, `RATING_REQUESTS_PER_MINUTE` (default 6).

## Keeping course data fresh

A GitHub Action (`.github/workflows/refresh-course-data.yml`) re-reads the EECS course pages on the 1st of every month and, if anything changed, opens a pull request with the test results. To let it open pull requests, enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**. You can also run it any time from the Actions tab.

## Across the EECS sites

Courses marked as taken on EECS Prereqs or EECS Electives travel with the links between the sites (`?taken=CS61A.EE64`) and are added to **Courses already taken**; the planner translates the Prereqs codes (EE64 → ELENG64). `frontend/lib/handoff.ts` and `frontend/components/SuiteLinks.tsx` are the same in all five sites, so change them in all five. The site also has a link preview image (`frontend/app/opengraph-image.tsx`), a sitemap and a robots file.

## API

| Method | Path             | Body                                         | Does                                           |
| ------ | ---------------- | -------------------------------------------- | ---------------------------------------------- |
| GET    | `/courses`       |                                              | Full course catalog                            |
| GET    | `/ap-exams`      |                                              | AP exams and the credit each score earns       |
| GET    | `/focus-tracks`  |                                              | Focus tracks, and when offerings were checked  |
| POST   | `/generate-plan` | `{ completed_courses: [], settings }`        | Builds a plan                                  |
| POST   | `/review-plan`   | `{ plan, settings }`                         | Re-checks an edited plan for problems          |
| POST   | `/advisor`       | `{ plan, question, settings, history }`      | Answers, and proposes plan edits when asked    |
| POST   | `/advisor/stream`| same as `/advisor`                           | Same, streamed as newline-delimited JSON       |

`settings` is `{ timeline, maxUnits, summer, focus, completed: [codes], ap: { examKey: score }, picks: { slot: option }, electives: [codes] }`. Malformed requests get a 422 explaining what's wrong.

## Curriculum

Course data lives in `backend/curriculum.py`, based on:

- [Berkeley Engineering: EECS major requirements (2026–27)](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/)
- [EECS department: lower-division requirements](https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-lowerdiv-2/)
- [Berkeley Engineering: AP/IB exam credit](https://engineering.berkeley.edu/students/undergraduate-guide/exams/)
- [Berkeley Engineering: H/SS requirement](https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/humanities-and-social-sciences/)
- [EECS department course pages](https://www2.eecs.berkeley.edu/Courses/) for term offerings (`backend/offerings.json`)

Prerequisites come from the EECS department's current course pages (the `CS168`-style addresses; the older `COMPSCI168` pages show outdated prerequisites). A few are written by hand in `scripts/update_offerings.py` to match [EECS Prereqs](https://eecs-prereqs.vercel.app), which checks them against the Berkeley catalog: CS 70 (no course prerequisite), EECS 106A (the EECS page is out of date), Data 100 (Data 8 first, plus linear algebra scheduled first since the planner has no corequisites; Data 8 is only planned when you mark it taken, add it, or pick Data 100), and CS 61C and CS 152 (written without subject names). CS 191's page has none, so its catalog prerequisites are in `backend/curriculum.py`. The H/SS page lists accepted categories rather than individual courses, so the H/SS slots offer categories; confirm specific courses with the Class Schedule. Units for ENGIN 125, ENGIN 185, PHILOS 121 and DATA C104 aren't on the EECS page and are assumed to be 3. This is an unofficial planning tool, so always confirm with an EECS advisor.
