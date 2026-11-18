import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The /1…/7 home-page style explorations: same catalog, different design.
const STYLES = ["1", "2", "3", "4", "5", "6", "7"] as const;
const PRODUCT_COUNT = 8;

for (const style of STYLES) {
  test(`style /${style} renders every product and passes axe`, async ({
    page,
  }) => {
    // Scan the settled layout: mid-fade text fails contrast for reasons a
    // reader never sees, and each style promises this final state.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${style}/`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveCount(1);

    const productLinks = page.locator('main a[href^="/watches/"]');

    const uniqueHrefs = new Set(
      await productLinks.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href"))
      )
    );

    expect(uniqueHrefs.size).toBe(PRODUCT_COUNT);

    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );

    expect(hasHorizontalOverflow).toBe(false);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
