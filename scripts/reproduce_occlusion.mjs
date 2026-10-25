import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 500, height: 667 } });
  await page.goto("https://citation-watch-app-genlayer.vercel.app/workbench", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const dialog = await page.$('div[role="dialog"]');
  console.log("Dialog present:", !!dialog);

  if (dialog) {
    const title = await page.$('#walkthrough-title');
    const closeBtn = await page.$('button[aria-label="Skip guided tour"]');
    const nextBtn = await page.$('button:has-text("Next")');

    console.log("Found elements:", { title: !!title, closeBtn: !!closeBtn, nextBtn: !!nextBtn });

    if (title && nextBtn) {
      const titleBox = await title.boundingBox();
      const nextBox = await nextBtn.boundingBox();
      console.log("Title box:", titleBox);
      console.log("Next box:", nextBox);

      const hitTitle = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el ? { tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 30) } : null;
        },
        { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 }
      );

      const hitNext = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);
          return el ? { tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 30) } : null;
        },
        { x: nextBox.x + nextBox.width / 2, y: nextBox.y + nextBox.height / 2 }
      );

      console.log("Hit at title center:", hitTitle);
      console.log("Hit at next button center:", hitNext);
    }
  }

  await browser.close();
}

main().catch(console.error);
