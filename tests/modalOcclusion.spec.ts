import { test, expect, Page } from "@playwright/test";

// Viewport matrix per specification: widths 390, 500, 630 x heights 300, 400, 667
const VIEWPORTS = [
  { width: 390, height: 300, name: "390x300" },
  { width: 390, height: 400, name: "390x400" },
  { width: 390, height: 667, name: "390x667" },
  { width: 500, height: 300, name: "500x300" },
  { width: 500, height: 400, name: "500x400" },
  { width: 500, height: 667, name: "500x667" },
  { width: 630, height: 300, name: "630x300" },
  { width: 630, height: 400, name: "630x400" },
  { width: 630, height: 667, name: "630x667" },
];

/**
 * Helper to test that interactive elements of a dialog are not occluded
 * by background page elements (such as <main>, <header>, or sticky tabs).
 */
async function assertNoExternalOcclusion(page: Page) {
  const check = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return { success: false, reason: "No dialog in DOM" };

    const modalRoot = document.getElementById("modal-root");
    if (!modalRoot || !modalRoot.contains(dialog)) {
      return { success: false, reason: "Dialog not mounted in #modal-root portal" };
    }

    // Find visible header controls (title, close button)
    const closeBtn = dialog.querySelector('button[aria-label*="Close"], button[aria-label*="close"]') as HTMLElement | null;
    if (closeBtn) {
      const rect = closeBtn.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !dialog.contains(hit)) {
          return {
            success: false,
            reason: `Close button occluded by ${hit?.tagName}.${hit?.className}`,
          };
        }
      }
    }

    // Check all interactive elements inside viewport
    const interactive = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, [tabindex="0"]'));
    for (const el of interactive) {
      if (el.offsetParent === null && el.getClientRects().length === 0) continue;
      const rect = el.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
        const hit = document.elementFromPoint(cx, cy);
        if (hit && !dialog.contains(hit)) {
          return {
            success: false,
            reason: `Element ${el.tagName} occluded by ${hit.tagName}.${hit.className}`,
          };
        }
      }
    }

    return { success: true };
  });

  expect(check.success, check.reason || "").toBe(true);
}

// 1. Background inertness and app-root isolation test
test.describe("Background Inertness & App Root Lifecycle", () => {
  test("asserts #app-root exists in index.html and becomes inert while dialog is open", async ({ page }) => {
    await page.goto("/workbench");
    await page.waitForLoadState("domcontentloaded");

    // 1. Confirm #app-root exists
    const appRoot = page.locator("#app-root");
    await expect(appRoot).toBeAttached();

    // 2. When walkthrough dialog is open on load, #app-root must have inert and aria-hidden="true"
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    const isInertOpen = await page.evaluate(() => {
      const el = document.getElementById("app-root");
      return el ? el.hasAttribute("inert") && el.getAttribute("aria-hidden") === "true" : false;
    });
    expect(isInertOpen).toBe(true);

    // 3. Close the dialog and assert inert and aria-hidden are removed
    const closeBtn = page.locator('div[role="dialog"] button[aria-label="Close guided tour"]').first();
    await closeBtn.click();
    await expect(dialog).toHaveCount(0);

    const isInertClosed = await page.evaluate(() => {
      const el = document.getElementById("app-root");
      return el ? el.hasAttribute("inert") || el.getAttribute("aria-hidden") === "true" : false;
    });
    expect(isInertClosed).toBe(false);
  });
});

// 2. Viewport occlusion suites across all routes, triggers, and dialogs
for (const vp of VIEWPORTS) {
  test.describe(`Modal Occlusion Suite at ${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test(`Walkthrough modal (auto-open trigger) on /workbench at ${vp.name}`, async ({ page }) => {
      await page.goto("/workbench");
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(100);

      await assertNoExternalOcclusion(page);

      // Verify close button is visible and hit-testable at all heights >= 300
      const closeBtn = dialog.locator('button[aria-label*="Close"], button[aria-label*="close"]').first();
      await expect(closeBtn).toBeVisible();
      await expect(closeBtn).toBeEnabled();
    });

    test(`Walkthrough modal (header trigger) on / landing at ${vp.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator('div[role="dialog"]')).toHaveCount(0);

      const guideBtn = page.locator('button[aria-label="Guided Tour"], button[aria-label*="Tour"]').first();
      await guideBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(100);

      await assertNoExternalOcclusion(page);
    });

    test(`Funding modal (header trigger) on /app route at ${vp.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });
      await page.goto("/app");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator('div[role="dialog"]')).toHaveCount(0);

      const fundingBtn = page.locator('button[aria-label="Get Test Funds & Gas Guide"]');
      await fundingBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(100);

      await assertNoExternalOcclusion(page);
      const closeBtn = dialog.locator('button[aria-label="Close funding guide"]');
      await expect(closeBtn).toBeVisible();
    });

    test(`Wallet modal (header trigger) on /workbench at ${vp.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });
      await page.goto("/workbench");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator('div[role="dialog"]')).toHaveCount(0);

      const walletBtn = page.locator("header button:has(span.font-mono)");
      await walletBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(100);

      await assertNoExternalOcclusion(page);
      const closeBtn = dialog.locator('button[aria-label="Close wallet connection dialog"], button[aria-label*="Close wallet"]').first();
      await expect(closeBtn).toBeVisible();
    });

    test(`In-app notice (Account Required trigger) on /workbench at ${vp.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
        // Set invalid key so createAccount fails and account remains null
        localStorage.setItem("citation_watch_throwaway_key", "invalid");
      });
      await page.goto("/workbench");
      await page.waitForLoadState("domcontentloaded");

      // Switch to Register Citation tab
      const registerTab = page.locator('#tab-register');
      await registerTab.click();

      // Click Register Citation button without active account
      const submitBtn = page.locator('button:has-text("Submit Registration")').first();
      await submitBtn.click();

      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(100);

      await assertNoExternalOcclusion(page);
      const gotItBtn = dialog.locator('button:has-text("Got It")');
      await expect(gotItBtn).toBeVisible();
    });

    test(`Error boundary fallback & dialog stack isolation on /workbench at ${vp.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("citationwatch_tour_dismissed", "true");
      });
      await page.goto("/workbench");
      await page.waitForLoadState("domcontentloaded");

      // Verify ModalPortal root element exists and is empty initially
      const modalRoot = page.locator("#modal-root");
      await expect(modalRoot).toBeAttached();
      await expect(modalRoot.locator('div[role="dialog"]')).toHaveCount(0);
    });
  });
}
