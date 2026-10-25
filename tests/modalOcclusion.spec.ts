import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 500, height: 400, name: "500x400" },
  { width: 630, height: 400, name: "630x400" },
];

for (const vp of VIEWPORTS) {
  test.describe(`Modal Occlusion Suite at ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test("Walkthrough modal is not occluded by main or header", async ({ page }) => {
      await page.goto("/workbench");
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Wait for focus trap initialization timer (50ms)
      await page.waitForTimeout(150);

      // Check hit elements with elementFromPoint
      const occlusionCheck = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        if (!d) return { success: false, reason: "No dialog" };

        const interactive = Array.from(d.querySelectorAll('button, [href], input, [tabindex="0"]')) as HTMLElement[];
        for (const el of interactive) {
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
            const hit = document.elementFromPoint(cx, cy);
            if (!hit) continue;
            if (!d.contains(hit)) {
              return {
                success: false,
                element: el.tagName + (el.textContent ? ` (${el.textContent.trim().slice(0, 20)})` : ""),
                hitTag: hit.tagName,
                hitClass: hit.className,
                hitText: hit.textContent?.trim().slice(0, 30),
              };
            }
          }
        }
        return { success: true };
      });

      expect(occlusionCheck.success).toBe(true);

      // Verify activeElement is inside dialog
      const isActiveInside = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        return d ? d.contains(document.activeElement) : false;
      });
      expect(isActiveInside).toBe(true);

      // Verify Tab key cycles only within dialog
      await page.keyboard.press("Tab");
      const tabActiveInside = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        return d ? d.contains(document.activeElement) : false;
      });
      expect(tabActiveInside).toBe(true);
    });

    test("Funding modal is not occluded by main or header", async ({ page }) => {
      // Set tour dismissed in localStorage before navigation
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });

      await page.goto("/workbench");
      await page.waitForLoadState("domcontentloaded");

      // Verify no dialog is open initially
      await expect(page.locator('div[role="dialog"]')).toHaveCount(0);

      const fundingBtn = page.locator('button[aria-label="Get Test Funds & Gas Guide"]');
      await fundingBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(150);

      const occlusionCheck = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        if (!d) return { success: false, reason: "No dialog" };

        const interactive = Array.from(d.querySelectorAll('button, [href], input, [tabindex="0"]')) as HTMLElement[];
        for (const el of interactive) {
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
            const hit = document.elementFromPoint(cx, cy);
            if (!hit) continue;
            if (!d.contains(hit)) {
              return {
                success: false,
                element: el.tagName + (el.textContent ? ` (${el.textContent.trim().slice(0, 20)})` : ""),
                hitTag: hit.tagName,
                hitClass: hit.className,
                hitText: hit.textContent?.trim().slice(0, 30),
              };
            }
          }
        }
        return { success: true };
      });

      expect(occlusionCheck.success).toBe(true);

      const isActiveInside = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        return d ? d.contains(document.activeElement) : false;
      });
      expect(isActiveInside).toBe(true);
    });

    test("Wallet modal is not occluded by main or header", async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });

      await page.goto("/workbench");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator('div[role="dialog"]')).toHaveCount(0);

      const walletBtn = page.locator('header button:has(span.font-mono)');
      await walletBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(150);

      const occlusionCheck = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        if (!d) return { success: false, reason: "No dialog" };

        const interactive = Array.from(d.querySelectorAll('button, [href], input, [tabindex="0"]')) as HTMLElement[];
        for (const el of interactive) {
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
            const hit = document.elementFromPoint(cx, cy);
            if (!hit) continue;
            if (!d.contains(hit)) {
              return {
                success: false,
                element: el.tagName + (el.textContent ? ` (${el.textContent.trim().slice(0, 20)})` : ""),
                hitTag: hit.tagName,
                hitClass: hit.className,
                hitText: hit.textContent?.trim().slice(0, 30),
              };
            }
          }
        }
        return { success: true };
      });

      expect(occlusionCheck.success).toBe(true);

      const isActiveInside = await page.evaluate(() => {
        const d = document.querySelector('div[role="dialog"]');
        return d ? d.contains(document.activeElement) : false;
      });
      expect(isActiveInside).toBe(true);
    });
  });
}
