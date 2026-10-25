import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const APP_URL = process.env.APP_URL || "http://localhost:4173";
const OUT_DIR = "docs/milestones/m1/fix3/after";
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEY_VIEWPORTS = [
  { width: 500, height: 400, name: "w500_h400" },
  { width: 630, height: 400, name: "w630_h400" },
  { width: 500, height: 700, name: "w500_h700" },
  { width: 390, height: 844, name: "w390_h844" },
  { width: 320, height: 568, name: "w320_h568" },
  { width: 768, height: 900, name: "w768_h900" },
  { width: 1440, height: 900, name: "w1440_h900" },
];

const SCENARIOS = [
  { id: "walkthrough_auto_workbench", route: "/workbench", trigger: "auto" },
  { id: "funding_header_workbench", route: "/workbench", trigger: "funding" },
  { id: "wallet_header_workbench", route: "/workbench", trigger: "wallet" },
  { id: "walkthrough_auto_landing", route: "/", trigger: "auto" },
  { id: "funding_header_landing", route: "/", trigger: "funding" },
  { id: "funding_inline_workbench", route: "/workbench", trigger: "inline_funding" },
];

async function main() {
  const browser = await chromium.launch();

  for (const vp of KEY_VIEWPORTS) {
    for (const sc of SCENARIOS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await context.addInitScript((dismissTour) => {
        if (dismissTour) {
          localStorage.setItem("citationwatch_tour_dismissed", "true");
        }
      }, sc.trigger !== "auto");

      const page = await context.newPage();
      await page.goto(`${APP_URL}${sc.route}`);
      await page.waitForLoadState("domcontentloaded");

      if (sc.trigger === "funding") {
        const btn = page.locator('header button[aria-label="Get Test Funds & Gas Guide"]');
        if (await btn.isVisible()) await btn.click();
      } else if (sc.trigger === "wallet") {
        const btn = page.locator('header button:has(span.font-mono)');
        if (await btn.isVisible()) await btn.click();
      } else if (sc.trigger === "inline_funding") {
        const tabBtn = page.locator('nav[role="tablist"] button:has-text("Register")');
        if (await tabBtn.isVisible()) await tabBtn.click();
        await page.waitForTimeout(100);
        const helper = page.locator('button:has-text("Gas & Funds Guide")').first();
        if (await helper.isVisible()) await helper.click();
      }

      await page.waitForTimeout(200);

      const fname = `chromium_${sc.id}_${vp.name}_scroll_top.png`;
      const fpath = path.join(OUT_DIR, fname);
      await page.screenshot({ path: fpath });
      console.log(`Captured comparison: ${fname}`);
      await context.close();
    }
  }

  await browser.close();
}

main();
