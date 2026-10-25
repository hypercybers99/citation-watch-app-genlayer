import { execSync } from "child_process";
import fs from "fs";

const routes = [
  { name: "landing", path: "/" },
  { name: "app", path: "/app" },
  { name: "workbench", path: "/workbench" },
];

const scores = {};

for (const r of routes) {
  // Mobile
  console.log(`Auditing ${r.name} (mobile)...`);
  const mobileCmd = `npx lighthouse http://localhost:4173${r.path} --only-categories=accessibility --output=json --output-path=stdout --chrome-flags="--headless" --preset=perf`;
  try {
    const out = execSync(mobileCmd, { maxBuffer: 10 * 1024 * 1024 }).toString();
    const json = JSON.parse(out);
    scores[`${r.name}_mobile`] = Math.round(json.categories.accessibility.score * 100);
  } catch (e) {
    console.error(`Failed mobile for ${r.name}`, e.message);
  }

  // Desktop
  console.log(`Auditing ${r.name} (desktop)...`);
  const desktopCmd = `npx lighthouse http://localhost:4173${r.path} --only-categories=accessibility --output=json --output-path=stdout --chrome-flags="--headless" --preset=desktop`;
  try {
    const out = execSync(desktopCmd, { maxBuffer: 10 * 1024 * 1024 }).toString();
    const json = JSON.parse(out);
    scores[`${r.name}_desktop`] = Math.round(json.categories.accessibility.score * 100);
  } catch (e) {
    console.error(`Failed desktop for ${r.name}`, e.message);
  }
}

console.log("Lighthouse Accessibility Scores:", scores);
fs.writeFileSync("docs/milestones/m1/fix3/lighthouse_scores.json", JSON.stringify(scores, null, 2));
