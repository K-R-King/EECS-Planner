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

test("choosing a course for a slot updates its units", async ({ page }) => {
  await generate(page);
  await course(page, "PHYS7A").locator('select[aria-label^="Choose"]').selectOption("PHYSICS 5A");
  await expect(course(page, "PHYS7A")).toContainText("3u");
  // 5A has to be followed by 5B + 5BL
  await expect(page.getByText("Physics 5A must be followed by Physics 5B + 5BL.").first()).toBeVisible();
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
