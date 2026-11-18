import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

// The header is lacquer in both themes, so the browser chrome never changes.
const THEME_COLOR = "#0e110f";

const html = (page: Page) => page.locator("html");

const toggle = (page: Page) =>
  page.locator(".site-header").getByRole("button", { name: "الوضع الداكن" });

const themeColor = (page: Page) => page.locator('meta[name="theme-color"]');

// Axe should judge the settled palette, not a frame of the cross-fade.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("day theme is the default, even when the OS prefers dark", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html(page)).not.toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(themeColor(page)).toHaveAttribute("content", THEME_COLOR);
});

test("the toggle switches to night and the choice survives a reload", async ({
  page,
}) => {
  await page.goto("/");
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(themeColor(page)).toHaveAttribute("content", THEME_COLOR);

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(themeColor(page)).toHaveAttribute("content", THEME_COLOR);

  await toggle(page).click();
  await expect(html(page)).not.toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html(page)).not.toHaveAttribute("data-theme", "dark");
});

test("home page has no accessibility violations in the night theme", async ({
  page,
}) => {
  await page.goto("/");
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute("data-theme", "dark");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("open cart has no accessibility violations in the night theme", async ({
  page,
}) => {
  await page.goto("/");
  await toggle(page).click();
  await page.locator('#watches [data-add-to-cart="ha-6314fgw"]').click();
  await page.locator(".site-header [data-cart-open]").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
