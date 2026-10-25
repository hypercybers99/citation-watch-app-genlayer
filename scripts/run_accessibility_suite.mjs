import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";

const APP_URL = process.env.APP_URL || "http://localhost:4173";
const VIEWPORTS = [
  { name: "desktop_1440", width: 1440, height: 900 },
  { name: "tablet_500", width: 500, height: 700 },
  { name: "mobile_390", width: 390, height: 844 },
  { name: "short_500x400", width: 500, height: 400 },
];

const SCENARIOS = [
  {
    id: "route_landing",
    route: "/",
    dismissTour: true,
  },
  {
    id: "route_app",
    route: "/app",
    dismissTour: true,
  },
  {
    id: "route_workbench",
    route: "/workbench",
    dismissTour: true,
  },
  {
    id: "modal_walkthrough",
    route: "/workbench",
    dismissTour: false, // auto opens
  },
  {
    id: "modal_funding",
    route: "/workbench",
    dismissTour: true,
    setup: async (page) => {
      await page.locator('header button[aria-label="Get Test Funds & Gas Guide"]').click();
      await page.waitForTimeout(200);
    },
  },
  {
    id: "modal_wallet",
    route: "/workbench",
    dismissTour: true,
    setup: async (page) => {
      await page.locator('header button:has(span.font-mono)').click();
      await page.waitForTimeout(200);
    },
  },
  {
    id: "modal_notice",
    route: "/workbench",
    dismissTour: true,
    setup: async (page) => {
      // Clear wallet from localStorage to trigger account required notice
      await page.evaluate(() => localStorage.removeItem("citation_watch_preview_wallet_v1"));
      const regTab = page.locator('nav[role="tablist"] button:has-text("Register")');
      if (await regTab.isVisible()) await regTab.click();
      await page.waitForTimeout(100);
      const submitBtn = page.locator('form button[type="submit"]:has-text("Register")').first();
      if (await submitBtn.isVisible()) await submitBtn.click();
      await page.waitForTimeout(200);
    },
  },
];

async function run() {
  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    for (const sc of SCENARIOS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addInitScript((dismiss) => {
        if (dismiss) {
          localStorage.setItem("citationwatch_tour_dismissed", "true");
        }
      }, sc.dismissTour);

      const page = await context.newPage();
      try {
        await page.goto(`${APP_URL}${sc.route}`);
        await page.waitForLoadState("domcontentloaded");
        if (sc.setup) await sc.setup(page);

        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const violations = accessibilityScanResults.violations;
        const critical = violations.filter((v) => v.impact === "critical").length;
        const serious = violations.filter((v) => v.impact === "serious").length;
        const moderate = violations.filter((v) => v.impact === "moderate").length;
        const minor = violations.filter((v) => v.impact === "minor").length;

        results.push({
          scenario: sc.id,
          viewport: vp.name,
          width: vp.width,
          height: vp.height,
          totalViolations: violations.length,
          critical,
          serious,
          moderate,
          minor,
          violations: violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodesCount: v.nodes.length,
          })),
        });

        console.log(`[PASS] ${sc.id} @ ${vp.name}: ${violations.length} violations (critical: ${critical}, serious: ${serious})`);
      } catch (err) {
        console.error(`[FAIL] ${sc.id} @ ${vp.name}:`, err.message);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  fs.mkdirSync("docs/milestones/m1/fix3", { recursive: true });
  fs.writeFileSync(
    "docs/milestones/m1/fix3/accessibility_audit.json",
    JSON.stringify(results, null, 2),
    "utf8"
  );
  console.log("Saved audit results to docs/milestones/m1/fix3/accessibility_audit.json");
}

run();
