import { expect, test, type Page } from "@playwright/test";

// Tests find courses and semesters on the page instead of assuming where the planner puts them,
// so they keep passing when the course data (prerequisites, offerings) changes.

const API = "http://127.0.0.1:8000";

async function generate(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Generate my 4-year plan/ }).click();
  await expect(page.getByText("Units toward graduation")).toBeVisible();
}

const course = (page: Page, code: string) => page.locator(`[data-course="${code}"]`);
const semester = (page: Page, term: string) => page.locator(`[data-term="${term}"]`);
const moveMenu = (page: Page, code: string) => course(page, code).locator('select[aria-label^="Move"]');

/** The semester a course is currently in. */
function termOf(page: Page, code: string) {
  return course(page, code).evaluate((el) => el.closest("[data-term]")!.getAttribute("data-term")!);
}

/** Any semester other than the one `code` is in (taken from its own "Move to…" menu). */
async function otherTerm(page: Page, code: string): Promise<string> {
  return (await moveMenu(page, code).locator("option:not([disabled])").first().getAttribute("value"))!;
}

/**
 * Drags like a person does: press, move in steps, pause over the target, release.
 * Chrome only fires `drop` after a `dragover` at the final position, and both ends must be on
 * screen, so the window is made as tall as the page first.
 */
async function drag(page: Page, code: string, term: string) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 1440, height: Math.min(height, 8000) });
  await page.evaluate(() => window.scrollTo(0, 0));

  const from = (await course(page, code).boundingBox())!;
  const to = (await semester(page, term).boundingBox())!;
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 25 });
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(100);
    await page.mouse.move(to.x + to.width / 2 + i, to.y + to.height / 2);
  }
  await page.mouse.up();
}

test("generates a full 4-year plan", async ({ page }) => {
  await generate(page);
  await expect(page.locator("[data-term]")).toHaveCount(8);
  for (const term of await page.locator("[data-term]").all()) {
    await expect(term.locator("[data-course]").first()).toBeVisible();
  }
  await expect(page.getByText("✓ Yes")).toBeVisible();  // design course
});

test("changing the timeline updates the plan right away", async ({ page }) => {
  await generate(page);
  await page.getByRole("button", { name: /3 years/ }).click();
  await expect(page.locator("[data-term]")).toHaveCount(6);
});

test("drag and drop moves a course, and problems are flagged", async ({ page }) => {
  await generate(page);
  const target = await otherTerm(page, "CS188");
  await drag(page, "CS188", target);
  await expect(semester(page, target).locator('[data-course="CS188"]')).toBeVisible();

  // into the same semester as one of its prerequisites
  await drag(page, "CS170", await termOf(page, "CS70"));
  await expect(page.getByText(/CS170 needs/).first()).toBeVisible();
});

test("move-to menu and undo", async ({ page }) => {
  await generate(page);
  const from = await termOf(page, "CS188");
  const to = await otherTerm(page, "CS188");

  await moveMenu(page, "CS188").selectOption(to);
  await expect(semester(page, to).locator('[data-course="CS188"]')).toBeVisible();

  await page.getByRole("button", { name: "↶ Undo" }).first().click();
  await expect(semester(page, from).locator('[data-course="CS188"]')).toBeVisible();
});

test("the plan survives a refresh", async ({ page }) => {
  await generate(page);
  const to = await otherTerm(page, "CS188");
  await moveMenu(page, "CS188").selectOption(to);
  await page.reload();
  await expect(semester(page, to).locator('[data-course="CS188"]')).toBeVisible();
});

test("a share link opens the same plan", async ({ page, browser }) => {
  await generate(page);
  const to = await otherTerm(page, "CS188");
  await moveMenu(page, "CS188").selectOption(to);
  await page.getByRole("button", { name: /Share link/ }).click();
  await expect(page.getByRole("button", { name: /Link copied/ })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // a fresh browser with nothing saved
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(semester(other, to).locator('[data-course="CS188"]')).toBeVisible();
});

test("a share link that can't be opened keeps the plan this browser saved", async ({ page }) => {
  await generate(page);
  const shared = await otherTerm(page, "CS188");
  await moveMenu(page, "CS188").selectOption(shared);
  await page.getByRole("button", { name: /Share link/ }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // this browser's own plan moves on, then the backend fails while the link opens
  const own = await otherTerm(page, "CS188");
  await moveMenu(page, "CS188").selectOption(own);
  await expect(semester(page, own).locator('[data-course="CS188"]')).toBeVisible();
  await page.route(`${API}/review-plan`, (route) => route.fulfill({ status: 500 }));
  const alerted = page.waitForEvent("dialog").then(async (d) => { const m = d.message(); await d.dismiss(); return m; });
  await page.goto("about:blank");  // only the #hash differs, so leave first to really load the link
  await page.goto(link);
  expect(await alerted).toContain("Couldn't open the shared plan");
  await expect(semester(page, own).locator('[data-course="CS188"]')).toBeVisible();
  expect(page.url()).toContain("#plan=");

  // once the backend is back, a refresh opens the shared plan
  await page.unroute(`${API}/review-plan`);
  await page.reload();
  await expect(semester(page, shared).locator('[data-course="CS188"]')).toBeVisible();
});

test("courses marked as taken on a sister site are filled in", async ({ page }) => {
  // EE64 is the Prereqs site's name for ELENG 64; MATH55 isn't in the planner, so it's passed along
  await page.goto("/?taken=CS61A.EE64.MATH55");
  await expect(page.getByText("2 taken")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("button", { name: /Courses already taken/ }).click();
  await expect(page.getByRole("button", { name: "Remove CS61A from courses taken" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove ELENG64 from courses taken" })).toBeVisible();
  const remembered = await page.evaluate(() => JSON.parse(localStorage.getItem("eecs-suite:taken") ?? "[]"));
  expect(remembered.sort()).toEqual(["CS61A", "EE64", "MATH55"]);
});

test("electives picked on EECS Electives are planned first", async ({ page }) => {
  // CSC182 is the Prereqs/Electives name for CS 182; MATH110 isn't one of the planner's electives
  await page.goto("/?electives=CS186.CSC182.MATH110");
  await expect(page.getByText("Units toward graduation")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await expect(course(page, "CS186")).toBeVisible();
  await expect(course(page, "CS182")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove CS186 from your electives" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "MATH110 isn't in the planner's elective list" })).toBeVisible();

  // removing a pick rebuilds the plan without it
  await page.getByRole("button", { name: "Remove CS186 from your electives" }).click();
  await expect(page.getByRole("button", { name: "Remove CS186 from your electives" })).toHaveCount(0);
  await expect(course(page, "CS182")).toBeVisible();
});

test("add course finds codes typed with a space, and slot choices like ENGIN 125", async ({ page }) => {
  await generate(page);
  const target = await otherTerm(page, "ETHICS");
  const addIn = async (term: string, query: string) => {
    await semester(page, term).getByRole("button", { name: "+ Add course" }).click();
    await semester(page, term).getByPlaceholder(/Search courses/).fill(query);
  };

  // "CS 172" (with a space) finds CS172
  await addIn(target, "cs 172");
  await semester(page, target).getByRole("button", { name: /^CS172/ }).click();
  await expect(semester(page, target).locator('[data-course="CS172"]')).toBeVisible();

  // ENGIN 125 isn't a course of its own: it fills the Ethics slot, which moves here and becomes 3 units
  await addIn(target, "engin 125");
  await semester(page, target).getByRole("button", { name: /ENGIN 125.*Ethics slot.*also upper-div H\/SS/ }).click();
  const ethics = semester(page, target).locator('[data-course="ETHICS"]');
  await expect(ethics).toBeVisible();
  await expect(ethics.getByRole("combobox", { name: /Choose a course for/ })).toHaveValue("ENGIN 125");
  await expect(ethics).toContainText("3u");
});

test("a community college course counts as the Berkeley course the student picks", async ({ page }) => {
  await generate(page);
  await expect(course(page, "R1A")).toBeVisible();
  await page.getByRole("button", { name: /Courses already taken/ }).click();

  // the search also finds codes typed with a space
  await page.getByLabel("Search courses you've already taken").fill("cs 61a");
  await expect(page.getByRole("button", { name: /^CS61A/ })).toBeVisible();
  await page.getByLabel("Search courses you've already taken").fill("");

  await page.getByLabel("Community college course").fill("ENGL C1000");
  await page.getByLabel("Berkeley course it counts as").selectOption("R1A");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove R1A from courses taken" })).toHaveText(/ENGL C1000 → R1A/);
  await expect(course(page, "R1A")).toHaveCount(0);

  // it's saved with the plan
  await page.reload();
  await page.getByRole("button", { name: /Courses already taken/ }).click();
  await expect(page.getByRole("button", { name: "Remove R1A from courses taken" })).toHaveText(/ENGL C1000 → R1A/);

  // removing it puts R1A back
  await page.getByRole("button", { name: "Remove R1A from courses taken" }).click();
  await expect(course(page, "R1A")).toBeVisible();
});

test("seminars and DeCals can be added for units only", async ({ page }) => {
  await generate(page);
  const term = (await page.locator("[data-term]").nth(1).getAttribute("data-term"))!;
  const total = async () => Number((await page.getByText("Units toward graduation").locator("xpath=..").innerText()).match(/(\d+)\s*\/\s*120/)![1]);
  const before = await total();

  await semester(page, term).getByRole("button", { name: "+ Add course" }).click();
  await semester(page, term).getByPlaceholder(/Search courses/).fill("eleng 39");
  await semester(page, term).getByRole("button", { name: /^ELENG39/ }).click();
  const seminar = semester(page, term).locator('[data-course="ELENG39"]');
  await expect(seminar).toContainText("Extra 1u");
  await expect.poll(total).toBe(before + 1);
  await expect(seminar).not.toHaveClass(/bg-red-50/);  // no requirement problem

  // a DeCal's units can be changed (2 by default)
  await semester(page, term).getByRole("button", { name: "+ Add course" }).click();
  await semester(page, term).getByPlaceholder(/Search courses/).fill("cs 198");
  await semester(page, term).getByRole("button", { name: /^CS198/ }).click();
  await expect.poll(total).toBe(before + 3);
  await semester(page, term).locator('[data-course="CS198"]').getByRole("combobox", { name: /Choose a course for/ }).selectOption("4 units");
  await expect.poll(total).toBe(before + 5);
});

test("winter breaks hold lower-division courses only", async ({ page }) => {
  await generate(page);
  await page.getByLabel(/Include winter breaks/).check();
  const winter = semester(page, "Year 1 Winter");
  await expect(winter).toBeVisible();
  await expect(winter.locator("[data-course]")).toHaveCount(0);  // starts empty
  await expect(winter).toContainText("Berkeley has no winter session");

  // a breadth course can go there (no 12-unit minimum)...
  await moveMenu(page, "HSS1").selectOption("Year 1 Winter");
  await expect(winter.locator('[data-course="HSS1"]')).toBeVisible();
  await expect(winter.locator('[data-course="HSS1"]')).not.toHaveClass(/bg-red-50/);
  await expect(winter).not.toHaveClass(/ring-red-300/);

  // ...but an upper-division elective can't
  const elective = await page.locator("[data-course]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-course")!).find((c) => /^CS1\d\d/.test(c))!);
  await moveMenu(page, elective).selectOption("Year 1 Winter");
  await expect(winter.locator(`[data-course="${elective}"]`)).toContainText("winter");
});

test("ENGIN 157AC can fill an upper-division H/SS slot", async ({ page }) => {
  await generate(page);
  const term = await termOf(page, "HSS3");
  await semester(page, term).getByRole("button", { name: "+ Add course" }).click();
  await semester(page, term).getByPlaceholder(/Search courses/).fill("engin 157ac");
  await semester(page, term).getByRole("button", { name: /ENGIN 157AC.*Upper-Division H\/SS Breadth slot/ }).click();
  await expect(course(page, "HSS3").getByRole("combobox", { name: /Choose a course for/ })).toHaveValue("ENGIN 157AC");
});

test("choosing a course for a slot updates its units", async ({ page }) => {
  await generate(page);
  await course(page, "PHYS7A").locator('select[aria-label^="Choose"]').selectOption("PHYSICS 5A");
  await expect(course(page, "PHYS7A")).toContainText("3u");
  // 5A has to be followed by 5B + 5BL
  await expect(page.getByText("Physics 5A must be followed by Physics 5B + 5BL.").first()).toBeVisible();
});

test("each semester shows Gemini's difficulty next to its units, and only new semesters are rated", async ({ page }) => {
  // fake Gemini at the API boundary: the first request rates everything 6, later ones 9
  const asked: string[][] = [];
  await page.route("**/rate-semesters", (route) => {
    const terms: string[] = route.request().postDataJSON().plan.map((s: { term: string }) => s.term);
    const rating = asked.length ? 9 : 6;
    asked.push(terms);
    return route.fulfill({ json: { ratings: Object.fromEntries(terms.map((t) => [t, rating])) } });
  });

  await generate(page);
  await expect(page.getByText("Difficulty 6/10")).toHaveCount(8);
  expect(asked).toHaveLength(1);  // one request for the whole plan

  await moveMenu(page, "CS188").selectOption(await otherTerm(page, "CS188"));
  await expect(page.getByText("Difficulty 9/10")).toHaveCount(2);
  expect(asked[1]).toHaveLength(8);  // the whole plan goes along, but only the 2 changed semesters take the new rating

  // undo brings back semesters already rated, with no new request
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.getByText("Difficulty 6/10")).toHaveCount(8);
  expect(asked).toHaveLength(2);
});

test("ratings are remembered across a refresh, without asking again", async ({ page }) => {
  let requests = 0;
  await page.route("**/rate-semesters", (route) => {
    requests++;
    const terms: string[] = route.request().postDataJSON().plan.map((s: { term: string }) => s.term);
    return route.fulfill({ json: { ratings: Object.fromEntries(terms.map((t) => [t, 6])) } });
  });

  await generate(page);
  await expect(page.getByText("Difficulty 6/10")).toHaveCount(8);
  await page.reload();
  await expect(page.getByText("Difficulty 6/10")).toHaveCount(8);
  await page.waitForTimeout(1500);
  expect(requests).toBe(1);
});

test("a failed rating is tried again after a refresh", async ({ page }) => {
  let fail = true;
  await page.route("**/rate-semesters", (route) => {
    if (fail) return route.fulfill({ status: 500 });
    const terms: string[] = route.request().postDataJSON().plan.map((s: { term: string }) => s.term);
    return route.fulfill({ json: { ratings: Object.fromEntries(terms.map((t) => [t, 6])) } });
  });

  await generate(page);
  await expect(page.getByText(/^Difficulty/)).toHaveCount(0, { timeout: 8000 });
  fail = false;
  await page.reload();
  await expect(page.getByText("Difficulty 6/10")).toHaveCount(8);
});

test("a semester Gemini can't rate just leaves the rating out", async ({ page }) => {
  await page.route("**/rate-semesters", (route) => route.fulfill({ status: 500 }));
  await generate(page);
  await expect(page.getByText("Difficulty …/10").first()).toBeVisible();
  await expect(page.getByText(/^Difficulty/)).toHaveCount(0);
});

test("asks before a settings change throws away edits", async ({ page }) => {
  await generate(page);
  await moveMenu(page, "CS188").selectOption(await otherTerm(page, "CS188"));

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /3 years/ }).click();
  await expect(page.locator("[data-term]")).toHaveCount(8);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /3 years/ }).click();
  await expect(page.locator("[data-term]")).toHaveCount(6);
});

test("advisor streams its answer and only changes the plan when accepted", async ({ page, request }) => {
  await generate(page);
  const target = await otherTerm(page, "CS188");

  const settings = { timeline: 4, maxUnits: 16, summer: false, ap: {}, focus: "balanced", completed: [], picks: {} };
  const { plan } = await (await request.post(`${API}/generate-plan`, { data: { settings } })).json();
  const moved = plan.map((s: { term: string; courses: { code: string }[] }) => ({
    term: s.term,
    courses: [...s.courses.map((c) => c.code).filter((c) => c !== "CS188"), ...(s.term === target ? ["CS188"] : [])],
  }));
  const proposal = await (await request.post(`${API}/review-plan`, { data: { plan: moved, settings } })).json();

  // fake Gemini at the API boundary
  await page.route("**/advisor/stream", (route) => route.fulfill({
    contentType: "application/x-ndjson",
    body: [
      { type: "delta", text: "Moving CS 188 " },
      { type: "delta", text: "for you." },
      { type: "done", answer: "Moving CS 188 for you.", error: false, changes: [`Moved CS188 → ${target}`], skipped: [], result: proposal },
    ].map((e) => JSON.stringify(e)).join("\n") + "\n",
  }));

  await page.getByLabel("Ask the advisor").fill("move CS 188");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Moving CS 188 for you.")).toBeVisible();

  // nothing changes until the student approves
  await expect(semester(page, target).locator('[data-course="CS188"]')).toHaveCount(0);
  await page.getByRole("button", { name: "✓ Apply changes" }).click();
  await expect(semester(page, target).locator('[data-course="CS188"]')).toBeVisible();
});

test("dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
});
