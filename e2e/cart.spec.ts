import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const WHATSAPP_CHAT = "https://wa.me/962776193666";
const WATCH_PRICE = 26_000;
const DEVICE_PRICE = 7000;
const AMMAN_FEE = 3000;
const OUTSIDE_AMMAN_FEE = 5000;

// Same formatting as src/lib/money.ts, run in the page so the ICU data matches.
const formatInPage = async (page: Page, fils: number): Promise<string> =>
  await page.evaluate((amount) => {
    const FILS_PER_DINAR = 1000;
    const whole = amount % FILS_PER_DINAR === 0;

    const formatter = new Intl.NumberFormat("ar-JO", {
      currency: "JOD",
      minimumFractionDigits: whole ? 0 : 3,
      style: "currency",
    });

    return formatter.format(amount / FILS_PER_DINAR);
  }, fils);

const headerCount = (page: Page) =>
  page.locator(".site-header [data-cart-count]");

const addToCart = async (page: Page, id: string): Promise<void> => {
  await page.locator(`#watches [data-add-to-cart="${id}"]`).click();
};

test("adding a watch updates the cart badge", async ({ page }) => {
  await page.goto("/");
  await expect(headerCount(page)).toHaveAttribute("data-count", "0");

  await addToCart(page, "ha-6506bw");
  await expect(headerCount(page)).toHaveAttribute("data-count", "1");

  await addToCart(page, "ha-6506bw");
  await expect(headerCount(page)).toHaveAttribute("data-count", "2");

  // The cart survives a reload (localStorage).
  await page.reload();
  await expect(headerCount(page)).toHaveAttribute("data-count", "2");
});

test("checkout opens WhatsApp with the order and the right total", async ({
  context,
  page,
}) => {
  // Never leave the test server: answer the wa.me request locally.
  await context.route("https://wa.me/**", async (route) => {
    await route.fulfill({ body: "ok", contentType: "text/plain" });
  });

  await page.goto("/");
  await addToCart(page, "ha-6506bw");
  await addToCart(page, "ha-1013");
  await expect(headerCount(page)).toHaveAttribute("data-count", "2");

  await page.locator(".site-header [data-cart-open]").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const subtotal = WATCH_PRICE + DEVICE_PRICE;
  const total = dialog.locator("[data-cart-total]");
  await expect(dialog.locator("[data-cart-subtotal]")).toHaveText(
    await formatInPage(page, subtotal)
  );

  await dialog.getByRole("radio", { name: /داخل عمّان/u }).check();
  await expect(total).toHaveText(
    await formatInPage(page, subtotal + AMMAN_FEE)
  );

  await dialog.getByRole("radio", { name: /خارج عمّان/u }).check();
  const grandTotal = await formatInPage(page, subtotal + OUTSIDE_AMMAN_FEE);
  await expect(total).toHaveText(grandTotal);

  await dialog.getByLabel("الاسم الكامل").fill("محمد أحمد");
  await dialog.getByLabel("رقم الهاتف").fill("0791234567");
  await dialog.getByLabel("المدينة والعنوان").fill("إربد، شارع الجامعة");

  const popupPromise = context.waitForEvent("page");
  await dialog.getByRole("button", { name: "إتمام الطلب عبر واتساب" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/^https:\/\/wa\.me\//u);

  const url = new URL(popup.url());
  expect(`${url.origin}${url.pathname}`).toBe(WHATSAPP_CHAT);

  const text = url.searchParams.get("text") ?? "";
  expect(text).toContain("HA-6506BW");
  expect(text).toContain("HA-1013");
  expect(text).toContain("خارج عمّان");
  expect(text).toContain(`الإجمالي: ${grandTotal}`);
  expect(text).toContain("محمد أحمد");
});

test("open cart has no accessibility violations", async ({ page }) => {
  // Scan the settled dialog, not a frame of its slide-in or the toast fade.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await addToCart(page, "ha-6314fgw");
  await page.locator(".site-header [data-cart-open]").click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
