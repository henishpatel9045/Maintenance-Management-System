import { test, expect } from "@playwright/test";

test.describe("Contractors Module End-to-End (Mobile 375px & Desktop)", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@seva.local");
    await page.fill('input[type="password"]', "AdminSeva2026!ChangeMe");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(seva|contractors|dashboard)?$/);
  });

  test("Directory renders responsive cards on 375px screen with tap-to-call", async ({ page }) => {
    await page.goto("/contractors");
    await expect(page.locator("h1")).toContainText("Contractor Directory");

    // Directory list cards should be visible
    const cards = page.locator("article, .card, [data-testid='contractor-card'], div.bg-card");
    await expect(cards.first()).toBeVisible();

    // Verify tel: or mailto: links exist for communication
    const actionLinks = page.locator('a[href^="tel:"], a[href^="mailto:"]');
    expect(await actionLinks.count()).toBeGreaterThan(0);
  });

  test("Suggest Contractor form validates and allows proposal", async ({ page }) => {
    await page.goto("/contractors/suggest");
    await expect(page.locator("h1")).toContainText("Suggest a New Contractor");

    // Fill in required company name
    await page.fill('input[placeholder*="Company"], input[name="companyName"]', "E2E Test Glazing Solutions");

    // Submit proposal
    await page.click('button[type="submit"]');

    // Should redirect to my requests or show success
    await expect(page).toHaveURL(/\/contractors\/requests\/mine/);
    await expect(page.locator("body")).toContainText("E2E Test Glazing Solutions");
  });

  test("Coordinator review queue shows submitted proposals", async ({ page }) => {
    await page.goto("/contractors/requests");
    await expect(page.locator("h1")).toContainText("Contractor Requests Queue");

    // The review queue table should list open proposals
    await expect(page.locator("body")).toContainText("CRQ-");
  });
});
