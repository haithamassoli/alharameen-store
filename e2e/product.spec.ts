import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PRODUCT_IDS = [
  "ha-6506bw",
  "ha-6506ww",
  "ha-6502gbw",
  "ha-6314fgw",
  "ha-6208fsw",
  "ha-6506kw",
  "ha-1013",
  "ha-4010sw",
] as const;

test("every product has a page", async ({ request }) => {
  const statuses = await Promise.all(
    PRODUCT_IDS.map(async (id) => {
      const response = await request.get(`/watches/${id}/`);

      return [id, response.status()] as const;
    })
  );

  expect(statuses).toEqual(PRODUCT_IDS.map((id) => [id, 200]));
});

test("product page shows details and a direct WhatsApp order", async ({
  page,
}) => {
  await page.goto("/watches/ha-6506bw/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ساعة الحرمين الرياضية باللون الأسود"
  );
  await expect(page.locator(".summary__model")).toContainText("HA-6506BW");
  await expect(page.locator("table th[scope=row]").first()).toBeVisible();

  const href =
    (await page
      .getByRole("link", { name: /اطلب مباشرة عبر واتساب/u })
      .getAttribute("href")) ?? "";

  expect(href.startsWith("https://wa.me/962776193666?text=")).toBe(true);
  expect(decodeURIComponent(href)).toContain("HA-6506BW");

  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await expect(page.locator(".site-header [data-cart-count]")).toHaveAttribute(
    "data-count",
    "1"
  );
});

test("thumbnails switch the gallery image", async ({ page }) => {
  await page.goto("/watches/ha-4010sw/");
  const slides = page.locator(".gallery__slide");
  await expect(slides.nth(0)).toBeVisible();
  await expect(slides.nth(1)).toBeHidden();

  await page.locator(".gallery__thumb").nth(1).click();
  await expect(slides.nth(1)).toBeVisible();
  await expect(slides.nth(0)).toBeHidden();
});

test("product page has no accessibility violations", async ({ page }) => {
  await page.goto("/watches/ha-4010sw/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("unknown pages show the Arabic 404", async ({ page }) => {
  const response = await page.goto("/watches/does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "لم نجد هذه الصفحة"
  );
});

test("404 page has no accessibility violations", async ({ page }) => {
  await page.goto("/watches/does-not-exist/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
