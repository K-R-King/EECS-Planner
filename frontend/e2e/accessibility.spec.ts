import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated accessibility check (axe): fails on serious or critical problems such as
// unreadable contrast, controls without labels, or broken ARIA.

async function problems(page: Page) {
  // let fade-ins finish first: half-faded text would fail the contrast check (looping animations never end)
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)),
  );
  const results = await new AxeBuilder({ page })
    // the floating course tags in the header are decorative and hidden from screen readers
    .exclude("header .pointer-events-none")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`);
}

async function withPlan(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Generate my 4-year plan/ }).click();
  await expect(page.getByText("Units toward graduation")).toBeVisible();
}

test("the start page has no serious accessibility problems", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Plan settings")).toBeVisible();
  expect(await problems(page)).toEqual([]);
});

test("a plan has no serious accessibility problems", async ({ page }) => {
  await withPlan(page);
  expect(await problems(page)).toEqual([]);
});

test("dark mode has no serious accessibility problems", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await withPlan(page);
  expect(await problems(page)).toEqual([]);
});
