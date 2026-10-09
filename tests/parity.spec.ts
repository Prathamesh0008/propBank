import { test, expect } from "@playwright/test";

test("legacy and Next public layouts match at desktop, tablet and mobile widths", async ({ browser }) => {
  test.skip(!process.env.LEGACY_ORIGIN, "Set LEGACY_ORIGIN to the running preserved Vite frontend.");
  const next = await browser.newPage();
  const legacy = await browser.newPage();
  // Deterministic empty API responses let us compare the same fallback UI.
  for (const page of [next, legacy]) {
    await page.route(/\/api\//, route => route.fulfill({
      status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ success: true, properties: [], siteSettings: {}, settings: {} }),
    }));
  }
  const selectors = ["header", "h1", "img", "footer"];
  for (const width of [1440, 768, 390]) {
    for (const page of [next, legacy]) await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/auth"]) {
      await Promise.all([next.goto(`http://localhost:8080${path}`), legacy.goto(`${process.env.LEGACY_ORIGIN}${path}`)]);
      await Promise.all([next.evaluate(() => document.fonts.ready), legacy.evaluate(() => document.fonts.ready)]);
      for (const selector of selectors) {
        const n = next.locator(selector).first();
        const l = legacy.locator(selector).first();
        if (!(await n.count()) && !(await l.count())) continue;
        await expect(n).toBeVisible(); await expect(l).toBeVisible();
        const nb = await n.boundingBox(); const lb = await l.boundingBox();
        for (const key of ["x", "y", "width", "height"] as const) {
          expect(Math.abs(nb![key] - lb![key]), `${width}px ${path} ${selector} ${key}`).toBeLessThanOrEqual(2);
        }
      }
    }
  }
  await next.close(); await legacy.close();
});
