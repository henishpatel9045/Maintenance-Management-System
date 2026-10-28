import { test, expect } from "@playwright/test";

test.describe("Service Worker & PWA Navigation Resilience", () => {
  test("reloads dashboard multiple times and reopens tab without ERR_FAILED", async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Log in as Admin
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@seva.local");
    await page.fill('input[type="password"]', "AdminSeva2026!ChangeMe");
    await page.click('button[type="submit"]');

    // 2. Initial dashboard render
    await expect(page).toHaveURL(/\/(seva|contractors|dashboard)?$/);
    await expect(page.locator("body")).toBeVisible();

    // Give service worker time to register and activate
    await page.waitForTimeout(1000);

    // 3. Reload 3 times consecutively (simple F5 style reload)
    for (let i = 1; i <= 3; i++) {
      await page.reload();
      await expect(page).toHaveURL(/\/(seva|contractors|dashboard)?$/);
      await expect(page.locator("body")).toBeVisible();
      // Ensure no navigation failure page
      const content = await page.textContent("body");
      expect(content).not.toContain("This site can’t be reached");
      expect(content).not.toContain("ERR_FAILED");
    }

    // 4. Close page and reopen in the same browser context
    await page.close();
    const newPage = await context.newPage();
    const newPageErrors: string[] = [];
    newPage.on("console", (msg) => {
      if (msg.type() === "error") newPageErrors.push(msg.text());
    });

    await newPage.goto("/");
    await expect(newPage).toHaveURL(/\/(seva|contractors|dashboard)?$/);
    await expect(newPage.locator("body")).toBeVisible();

    // Verify no FetchEvent respondWith or redirect-handling errors in console
    const criticalErrors = [...consoleErrors, ...newPageErrors].filter((err) =>
      /FetchEvent\.respondWith|ERR_FAILED|redirected response was used/i.test(err)
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("activates safe service worker and purges legacy caches", async ({ page }) => {
    await page.goto("/login");

    // Manually simulate a legacy cache from previous broken version
    const simulatedLegacyCache = await page.evaluate(async () => {
      if ("caches" in window) {
        const cache = await caches.open("seva-cache-v1");
        await cache.put(
          new Request("/"),
          new Response("legacy-stale-content", { headers: { "content-type": "text/html" } })
        );
        return await caches.has("seva-cache-v1");
      }
      return false;
    });

    expect(simulatedLegacyCache).toBe(true);

    // Wait for the service worker to activate and purge caches
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) {
          // Trigger activate event / message or await cache cleanup
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    });

    // Check that legacy cache was purged or deleted
    const cacheStillExists = await page.evaluate(async () => {
      if ("caches" in window) {
        return await caches.has("seva-cache-v1");
      }
      return false;
    });

    // Cache should either be deleted or cleared
    expect(cacheStillExists).toBe(false);
  });
});
