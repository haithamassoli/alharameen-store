import { expect, test } from "@playwright/test";

const SITE = "https://alharameen.assoli.site";

test("product page has canonical, share tags and Product JSON-LD", async ({
  page,
}) => {
  await page.goto("/watches/ha-6506bw/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${SITE}/watches/ha-6506bw/`
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    `${SITE}/og/ha-6506bw.jpg`
  );

  const card = await page.request.get("/og/ha-6506bw.jpg");
  expect(card.headers()["content-type"]).toBe("image/jpeg");

  const raw = await page
    .locator('script[type="application/ld+json"]')
    .textContent();

  const jsonLd: unknown = JSON.parse(raw ?? "{}");

  expect(jsonLd).toMatchObject({
    "@type": "Product",
    offers: { price: "26.000", priceCurrency: "JOD" },
  });
});

test("home page shares the 1200×630 store card", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    `${SITE}/og-image.jpg`
  );

  const response = await page.request.get("/og-image.jpg");
  expect(response.headers()["content-type"]).toBe("image/jpeg");
});

test("sitemap lists every product and robots points to it", async ({
  request,
}) => {
  const sitemapResponse = await request.get("/sitemap.xml");
  const sitemap = await sitemapResponse.text();
  expect(sitemap.match(/<loc>/gu)).toHaveLength(10);
  expect(sitemap).toContain(`${SITE}/watches/ha-1013/`);
  expect(sitemap).toContain(`${SITE}/guides/`);

  const robotsResponse = await request.get("/robots.txt");
  const robots = await robotsResponse.text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("404 page is kept out of the index", async ({ page }) => {
  await page.goto("/watches/does-not-exist/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex"
  );
});
