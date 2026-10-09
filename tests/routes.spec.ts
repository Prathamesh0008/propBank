import { test, expect } from "@playwright/test";

const protectedPaths = [
  "/admin", "/search?q=home&type=rent", "/manage-property", "/select-property-type", "/add-property?type=residential",
  "/property/test", "/edit-property/test?mode=renewal", "/add-tenant/test?mode=view", "/request-services/test",
  "/inspection-report/test", "/review/test", "/legal-services/test", "/other-services/test", "/attach-documents/test",
  "/renew-agreement/test", "/terminate-agreement/test", "/visit-planner", "/archived-properties",
];

test("all protected URLs redirect guests, including direct loads and refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const url of protectedPaths) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { name: "Welcome to Propbank" })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome to Propbank" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`public pages and assets render at ${viewport.width}px`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("img").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/landing-${viewport.width}.png`, fullPage: true });
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Welcome to Propbank" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/auth-${viewport.width}.png`, fullPage: true });
    for (const asset of ["/assets/hero-realestate.jpg", "/icons/icon-512.png", "/manifest.webmanifest", "/sw.js"]) {
      expect((await request.get(asset)).status()).toBe(200);
    }
    expect(errors).toEqual([]);
  });
}

test("unknown URLs preserve the not-found page", async ({ page }) => {
  const response = await page.goto("/missing-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await page.getByRole("link", { name: "Return to Home" }).click();
  await expect(page).toHaveURL("http://localhost:8080/");
});
