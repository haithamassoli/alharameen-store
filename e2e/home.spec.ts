import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page is Arabic RTL and installable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest"
  );

  const swReady = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;

    return Boolean(registration.active);
  });

  expect(swReady).toBe(true);
});

test("home page lists all eight products", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#watches article")).toHaveCount(8);
  await expect(page.locator("#watches [data-add-to-cart]")).toHaveCount(8);
  await expect(page.locator("#features li")).toHaveCount(5);
});

// Covers template a11y (alt text, labels, contrast) that static linting can't see in .astro.
test("home page has no accessibility violations", async ({ page }) => {
  // Scan the static, fully annotated drawing, not a frame of the scroll story.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
