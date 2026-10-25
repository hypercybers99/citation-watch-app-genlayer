import { chromium, firefox, webkit } from "playwright";
import fs from "fs";
import path from "path";

const PROD_URL = process.env.APP_URL || "https://citation-watch-app-genlayer.vercel.app";
const OUT_DIR = process.env.OUT_DIR || "docs/milestones/m1/fix3/before";
const JSON_FILE = process.env.JSON_FILE || "docs/milestones/m1/fix3/matrix_before.json";

fs.mkdirSync(OUT_DIR, { recursive: true });

const WIDTHS = [320, 360, 390, 414, 500, 630, 768, 1024, 1440];
const HEIGHTS = [300, 400, 568, 667, 740, 900];

// The core required scenarios covering all dialogs, triggers, and routes:
const SCENARIOS = [
  { id: "walkthrough_auto_workbench", route: "/workbench", trigger: "auto" },
  { id: "funding_header_workbench", route: "/workbench", trigger: "header_funding" },
  { id: "wallet_header_workbench", route: "/workbench", trigger: "header_wallet" },
  { id: "funding_inline_workbench", route: "/workbench", trigger: "inline_funding" },
  { id: "walkthrough_auto_landing", route: "/", trigger: "auto" },
  { id: "funding_header_landing", route: "/", trigger: "header_funding" },
  { id: "walkthrough_header_app", route: "/app", trigger: "header_tour" },
];

async function runOcclusionCheck(page) {
  return await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return { found: false, error: "No dialog element found" };

    const title = dialog.querySelector('h2, [id*="title"], .font-bold');
    const closeBtn = dialog.querySelector('button[aria-label*="close" i], button[aria-label*="skip" i], button:has(svg)');
    const bodyEl = dialog.querySelector('p, ul, .space-y-4, .rounded-xl');
    const footerBtns = Array.from(dialog.querySelectorAll('button')).filter((b) => {
      const txt = (b.textContent || "").trim().toLowerCase();
      return (
        txt.includes("next") ||
        txt.includes("finish") ||
        txt.includes("done") ||
        txt.includes("back") ||
        txt.includes("skip") ||
        txt.includes("import")
      );
    });

    const targets = [
      { name: "title", el: title },
      { name: "closeBtn", el: closeBtn },
      { name: "bodyEl", el: bodyEl },
      ...footerBtns.map((b, idx) => ({ name: `footerBtn_${idx}_${b.textContent?.trim().slice(0, 10)}`, el: b })),
    ].filter((t) => t.el !== null);

    const probed = [];
    let isOccluded = false;
    let worstCover = null;

    for (const t of targets) {
      const rect = t.el.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);

      const insideVp = cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight;
      if (!insideVp) {
        probed.push({
          target: t.name,
          insideVp: false,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          covered: true,
          reason: "outside_viewport",
        });
        isOccluded = true;
        if (!worstCover) worstCover = { target: t.name, reason: "outside_viewport" };
        continue;
      }

      const hitEl = document.elementFromPoint(cx, cy);
      const isDescendant = hitEl && (dialog.contains(hitEl) || hitEl === dialog);

      const targetHit = {
        target: t.name,
        point: { x: cx, y: cy },
        insideVp: true,
        hitTag: hitEl ? hitEl.tagName : null,
        hitClass: hitEl ? hitEl.className : null,
        hitText: hitEl ? hitEl.textContent?.slice(0, 40) : null,
        isDescendant,
        covered: !isDescendant,
      };

      if (!isDescendant && hitEl) {
        isOccluded = true;
        const ancestors = [];
        let curr = hitEl;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          const comp = window.getComputedStyle(curr);
          ancestors.push({
            tag: curr.tagName,
            id: curr.id,
            className: curr.className?.slice ? curr.className.slice(0, 50) : "",
            position: comp.position,
            zIndex: comp.zIndex,
            transform: comp.transform,
            filter: comp.filter,
            backdropFilter: comp.backdropFilter,
            isolation: comp.isolation,
            contain: comp.contain,
            willChange: comp.willChange,
          });
          curr = curr.parentElement;
        }
        targetHit.coveringElementAncestors = ancestors;
        if (!worstCover) {
          worstCover = {
            target: t.name,
            tag: hitEl.tagName,
            class: hitEl.className,
            text: hitEl.textContent?.slice(0, 50),
            ancestors: ancestors.slice(0, 4),
          };
        }
      }

      probed.push(targetHit);
    }

    return {
      found: true,
      isOccluded,
      worstCover,
      probed,
    };
  });
}

async function triggerModal(page, scenario) {
  if (scenario.trigger === "auto") {
    // Already opened on load
    return;
  }

  // Dismiss auto-opened walkthrough modal if present so it doesn't block the trigger
  const skipBtn = page.locator('button[aria-label="Skip guided tour"]');
  if (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(100);
  }

  if (scenario.trigger === "header_tour") {
    const btn = page.locator('header button[aria-label="Guided Tour"]');
    if (await btn.isVisible()) await btn.click();
  } else if (scenario.trigger === "header_funding") {
    const btn = page.locator('header button[aria-label="Get Test Funds & Gas Guide"]');
    if (await btn.isVisible()) await btn.click();
  } else if (scenario.trigger === "header_wallet") {
    const btn = page.locator('header button[aria-label="Open Throwaway Wallet Modal"]');
    if (await btn.isVisible()) await btn.click();
  } else if (scenario.trigger === "inline_funding") {
    const tabBtn = page.locator('nav[role="tablist"] button:has-text("Register")');
    if (await tabBtn.isVisible()) await tabBtn.click();
    await page.waitForTimeout(100);
    const helperBtn = page.locator('button:has-text("Need preview tokens? Read the Gas & Funds Guide")').first();
    if (await helperBtn.isVisible()) await helperBtn.click();
  }
  await page.waitForTimeout(200);
}

async function main() {
  console.log(`Running occlusion benchmark against: ${PROD_URL}`);
  console.log(`Writing output to: ${OUT_DIR} and ${JSON_FILE}`);

  const results = [];
  const browsers = [
    { name: "chromium", launcher: chromium },
    { name: "firefox", launcher: firefox },
    { name: "webkit", launcher: webkit },
  ];

  let totalTests = 0;
  let occludedCount = 0;

  const baseViewports = [];
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      baseViewports.push({ width: w, height: h, label: `w${w}_h${h}` });
    }
  }
  baseViewports.push({ width: 667, height: 375, label: "landscape_667x375" });
  baseViewports.push({ width: 1280, height: 800, zoom: 2, label: "zoom_200_1280x800" });
  baseViewports.push({ width: 1280, height: 800, zoom: 4, label: "zoom_400_1280x800" });

  for (const { name: engineName, launcher } of browsers) {
    console.log(`\n========================================`);
    console.log(`Starting engine: ${engineName.toUpperCase()}`);
    console.log(`========================================`);

    let browser;
    try {
      browser = await launcher.launch({ headless: true });
    } catch (e) {
      console.error(`Could not launch ${engineName}:`, e.message);
      continue;
    }

    for (const scenario of SCENARIOS) {
      console.log(`  Scenario: ${scenario.id}`);

      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
      });
      const page = await context.newPage();

      await page.addInitScript((s) => {
        try {
          if (s.trigger === "auto") {
            localStorage.removeItem("citationwatch_tour_dismissed");
          } else {
            localStorage.setItem("citationwatch_tour_dismissed", "true");
          }
        } catch {}
      }, scenario);

      try {
        await page.goto(`${PROD_URL}${scenario.route}`, { waitUntil: "networkidle", timeout: 20000 });
      } catch {
        await page.goto(`${PROD_URL}${scenario.route}`, { waitUntil: "load", timeout: 20000 });
      }

      await triggerModal(page, scenario);

      for (const vp of baseViewports) {
        for (const scrollPos of ["top", "middle", "bottom"]) {
          if (scrollPos !== "top" && vp.height !== 400 && vp.height !== 667) continue;

          totalTests++;
          const cellId = `${engineName}_${scenario.id}_${vp.label}_scroll_${scrollPos}`;

          if (vp.zoom && engineName === "chromium") {
            try {
              const cdp = await context.newCDPSession(page);
              await cdp.send("Emulation.setDeviceMetricsOverride", {
                width: Math.round(vp.width / vp.zoom),
                height: Math.round(vp.height / vp.zoom),
                deviceScaleFactor: vp.zoom,
                mobile: false,
              });
            } catch {
              await page.setViewportSize({ width: Math.round(vp.width / vp.zoom), height: Math.round(vp.height / vp.zoom) });
            }
          } else {
            await page.setViewportSize({ width: vp.width, height: vp.height });
          }

          if (scrollPos === "middle") {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
          } else if (scrollPos === "bottom") {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          } else {
            await page.evaluate(() => window.scrollTo(0, 0));
          }

          await page.waitForTimeout(60);

          const check = await runOcclusionCheck(page);

          const record = {
            cellId,
            engine: engineName,
            scenario: scenario.id,
            viewport: vp.label,
            scrollPos,
            dialogFound: check.found,
            isOccluded: check.isOccluded,
            worstCover: check.worstCover,
            probed: check.probed,
          };

          if (check.isOccluded) {
            occludedCount++;
            const screenshotName = `${cellId}.png`;
            const screenshotPath = path.join(OUT_DIR, screenshotName);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            record.screenshot = screenshotPath;
          }

          results.push(record);
        }
      }

      await context.close();
    }

    await browser.close();
  }

  console.log(`\n========================================`);
  console.log(`OCCLUSION MATRIX BENCHMARK COMPLETE`);
  console.log(`Total test cells: ${totalTests}`);
  console.log(`Occluded cells:   ${occludedCount} (${((occludedCount / totalTests) * 100).toFixed(1)}%)`);
  console.log(`========================================`);

  fs.writeFileSync(JSON_FILE, JSON.stringify({ totalTests, occludedCount, results }, null, 2));
  console.log(`Results written to ${JSON_FILE}`);
}

main().catch(console.error);
