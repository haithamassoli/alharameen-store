import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("guides page lists every official how-to video", async ({ page }) => {
  await page.goto("/guides/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "شروحات الاستعمال"
  );
  await expect(page.locator("#wrist-watches iframe")).toHaveCount(24);
  await expect(page.locator("#desk-clocks iframe")).toHaveCount(12);

  // The facade links to the YouTube player instead of loading it up front.
  const play = page
    .locator("#wrist-watches iframe")
    .first()
    .contentFrame()
    .getByRole("link");

  await expect(play).toHaveAttribute(
    "href",
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?autoplay=1/u
  );
});

test("product page previews its family's videos", async ({ page }) => {
  await page.goto("/watches/ha-6506bw/");
  const guide = page.locator(".guide");
  await expect(guide.locator("iframe")).toHaveCount(6);
  await expect(guide.getByRole("link", { name: /كل شروحات/u })).toHaveAttribute(
    "href",
    "/guides/#wrist-watches"
  );
});

test("products without videos skip the section", async ({ page }) => {
  await page.goto("/watches/ha-1013/");
  await expect(page.locator(".guide")).toHaveCount(0);
});

test("guides page has no accessibility violations", async ({ page }) => {
  await page.goto("/guides/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
