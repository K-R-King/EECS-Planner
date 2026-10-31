import { expect, test, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8000";

// tall enough that neighbouring years fit on screen together while dragging
test.use({ viewport: { width: 1440, height: 1600 } });

async function generate(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Generate my 4-year plan/ }).click();
  await expect(page.getByText("Units toward graduation")).toBeVisible();
}

const course = (page: Page, code: string) => page.locator(`[data-course="${code}"]`);
const semester = (page: Page, term: string) => page.locator(`[data-term="${term}"]`);

/**
 * Drags like a person does: press, move in steps, pause over the target, release.
 * (Chrome only fires `drop` after a `dragover` at the final position, and sends those on a timer.)
 * Both ends must be on screen, so drag between nearby semesters.
 */
async function drag(page: Page, code: string, term: string) {
  await course(page, code).scrollIntoViewIfNeeded();
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
  await drag(page, "CS170", "Year 3 Spring");
  await expect(semester(page, "Year 3 Spring").locator('[data-course="CS170"]')).toBeVisible();

  // into the same semester as CS 70, which CS 170 needs first
  await drag(page, "CS170", "Year 2 Spring");
  await expect(semester(page, "Year 2 Spring").getByText(/CS170 needs/)).toBeVisible();
});

test("move-to menu and undo", async ({ page }) => {
  await generate(page);
  const from = await course(page, "CS188").evaluate((el) => el.closest("[data-term]")!.getAttribute("data-term"));

  await course(page, "CS188").locator("select").selectOption("Year 4 Fall");
  await expect(semester(page, "Year 4 Fall").locator('[data-course="CS188"]')).toBeVisible();

  await page.getByRole("button", { name: "↶ Undo" }).first().click();
  await expect(semester(page, from!).locator('[data-course="CS188"]')).toBeVisible();
});

test("the plan survives a refresh", async ({ page }) => {
  await generate(page);
  await course(page, "CS188").locator("select").selectOption("Year 4 Fall");
  await page.reload();
  await expect(semester(page, "Year 4 Fall").locator('[data-course="CS188"]')).toBeVisible();
});

test("a share link opens the same plan", async ({ page, browser }) => {
  await generate(page);
  await course(page, "CS188").locator("select").selectOption("Year 4 Fall");
  await page.getByRole("button", { name: /Share link/ }).click();
  await expect(page.getByRole("button", { name: /Link copied/ })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // a fresh browser with nothing saved
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(semester(other, "Year 4 Fall").locator('[data-course="CS188"]')).toBeVisible();
});

test("asks before a settings change throws away edits", async ({ page }) => {
  await generate(page);
  await course(page, "CS188").locator("select").selectOption("Year 4 Fall");

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /3 years/ }).click();
  await expect(page.locator("[data-term]")).toHaveCount(8);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /3 years/ }).click();
  await expect(page.locator("[data-term]")).toHaveCount(6);
});

test("advisor streams its answer and only changes the plan when accepted", async ({ page, request }) => {
  const settings = { timeline: 4, maxUnits: 16, summer: false, ap: {}, focus: "balanced", completed: [] };
  const { plan } = await (await request.post(`${API}/generate-plan`, { data: { settings } })).json();
  const moved = plan.map((s: { term: string; courses: { code: string }[] }) => ({
    term: s.term,
    courses: [...s.courses.map((c) => c.code).filter((c) => c !== "CS188"), ...(s.term === "Year 4 Fall" ? ["CS188"] : [])],
  }));
  const proposal = await (await request.post(`${API}/review-plan`, { data: { plan: moved, settings } })).json();

  // fake Gemini at the API boundary
  await page.route("**/advisor/stream", (route) => route.fulfill({
    contentType: "application/x-ndjson",
    body: [
      { type: "delta", text: "Moving CS 188 " },
      { type: "delta", text: "to Year 4 Fall." },
      { type: "done", answer: "Moving CS 188 to Year 4 Fall.", error: false, changes: ["Moved CS188 → Year 4 Fall"], skipped: [], result: proposal },
    ].map((e) => JSON.stringify(e)).join("\n") + "\n",
  }));

  await generate(page);
  await page.getByLabel("Ask the advisor").fill("move CS 188 later");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Moving CS 188 to Year 4 Fall.")).toBeVisible();

  // nothing changes until the student approves
  await expect(semester(page, "Year 4 Fall").locator('[data-course="CS188"]')).toHaveCount(0);
  await page.getByRole("button", { name: "✓ Apply changes" }).click();
  await expect(semester(page, "Year 4 Fall").locator('[data-course="CS188"]')).toBeVisible();
});

test("dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
});
