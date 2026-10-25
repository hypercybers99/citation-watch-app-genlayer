import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";

const CURATED_PAIRS = [
  "chromium_funding_header_landing_w1440_h900_scroll_top.png",
  "chromium_funding_header_landing_w320_h568_scroll_top.png",
  "chromium_funding_header_landing_w500_h400_scroll_top.png",
  "chromium_funding_header_landing_w630_h400_scroll_top.png",
  "chromium_funding_header_landing_w768_h900_scroll_top.png",
  "chromium_funding_header_workbench_w1440_h900_scroll_top.png",
  "chromium_funding_header_workbench_w320_h568_scroll_top.png",
  "chromium_funding_header_workbench_w500_h400_scroll_top.png",
  "chromium_funding_header_workbench_w630_h400_scroll_top.png",
  "chromium_funding_header_workbench_w768_h900_scroll_top.png",
  "chromium_walkthrough_auto_landing_w1440_h900_scroll_top.png",
  "chromium_walkthrough_auto_landing_w320_h568_scroll_top.png",
  "chromium_walkthrough_auto_landing_w500_h400_scroll_top.png",
  "chromium_walkthrough_auto_landing_w630_h400_scroll_top.png",
  "chromium_walkthrough_auto_landing_w768_h900_scroll_top.png",
  "chromium_walkthrough_auto_workbench_w1440_h900_scroll_top.png",
  "chromium_walkthrough_auto_workbench_w320_h568_scroll_top.png",
  "chromium_walkthrough_auto_workbench_w500_h400_scroll_top.png",
  "chromium_walkthrough_auto_workbench_w630_h400_scroll_top.png",
  "chromium_walkthrough_auto_workbench_w768_h900_scroll_top.png",
];

console.log(`Curated pairs count: ${CURATED_PAIRS.length}`);

// 1. Identify bulk files
const beforeDir = "docs/milestones/m1/fix3/before";
const afterDir = "docs/milestones/m1/fix3/after";

const allBefore = fs.readdirSync(beforeDir);
const allAfter = fs.readdirSync(afterDir);

const bulkBefore = allBefore.filter(f => !CURATED_PAIRS.includes(f));
const bulkAfter = allAfter.filter(f => !CURATED_PAIRS.includes(f));

console.log(`Bulk before screenshots to archive: ${bulkBefore.length}`);
console.log(`Bulk after screenshots to archive: ${bulkAfter.length}`);

// Create temporary staging directory for zip
const stagingDir = "docs/milestones/m1/fix4/staging_bulk";
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stagingDir, "before"), { recursive: true });
fs.mkdirSync(path.join(stagingDir, "after"), { recursive: true });

// Copy full matrix files to staging
fs.copyFileSync("docs/milestones/m1/fix3/matrix_before.json", path.join(stagingDir, "matrix_before.json"));
fs.copyFileSync("docs/milestones/m1/fix3/matrix_after.json", path.join(stagingDir, "matrix_after.json"));

// Copy bulk screenshots to staging
for (const f of bulkBefore) {
  fs.copyFileSync(path.join(beforeDir, f), path.join(stagingDir, "before", f));
}
for (const f of bulkAfter) {
  fs.copyFileSync(path.join(afterDir, f), path.join(stagingDir, "after", f));
}

console.log("Staged bulk files for compression. Creating zip archive using PowerShell...");
const zipDest = path.resolve("docs/milestones/m1/fix4/m1_fix3_bulk_evidence.zip");
if (fs.existsSync(zipDest)) fs.unlinkSync(zipDest);

const stagingAbs = path.resolve(stagingDir);
execSync(`powershell -Command "Compress-Archive -Path '${stagingAbs}/*' -DestinationPath '${zipDest}' -CompressionLevel Optimal"`, {
  stdio: "inherit"
});

// Clean up staging
fs.rmSync(stagingDir, { recursive: true, force: true });

// Compute sha256
const zipBuffer = fs.readFileSync(zipDest);
const sha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
const sizeMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);

console.log(`Zip archive created at ${zipDest}`);
console.log(`Size: ${sizeMB} MB (${zipBuffer.length} bytes)`);
console.log(`SHA-256: ${sha256}`);

// Write ARTIFACTS.md
const artifactsMd = `# Milestone 1 Revision 5 Bulk Evidence Archive

Per Milestone 1 Fix Pass 4 requirements, bulk evaluation artifacts (full 1,953-cell JSON matrices and 1,466 uncurated viewport screenshots) are decoupled from the git tracking tree to maintain repository hygiene and readable git diffs.

## Release Archive Details

- **Archive File**: \`m1_fix3_bulk_evidence.zip\`
- **Release Tag**: \`milestone-1-ux-onboarding-r5\`
- **Release URL**: [https://github.com/huzyow155/citation-watch-app-genlayer/releases/download/milestone-1-ux-onboarding-r5/m1_fix3_bulk_evidence.zip](https://github.com/huzyow155/citation-watch-app-genlayer/releases/download/milestone-1-ux-onboarding-r5/m1_fix3_bulk_evidence.zip)
- **File Size**: ${sizeMB} MB (${zipBuffer.length} bytes)
- **SHA-256 Checksum**: \`${sha256}\`

## Contents of the Archive

1. \`matrix_before.json\` (11.89 MB): Full 1,953-cell responsive evaluation matrix with complete DOM ancestor chains before the stacking fix.
2. \`matrix_after.json\` (3.68 MB): Full 1,953-cell responsive evaluation matrix after the stacking fix.
3. \`before/\` (1,380 screenshots): Raw failing cell screenshots prior to portal refactoring.
4. \`after/\` (86 screenshots): Residual non-curated verification screenshots.

## Curated In-Repo Evidence

To keep the repository diff under 200 files while providing complete reviewability:
- **Summaries**: \`docs/milestones/m1/fix3/matrix_before_summary.json\` and \`docs/milestones/m1/fix3/matrix_after_summary.json\` provide authoritative per-engine, per-scenario, and per-viewport statistics.
- **Curated Screenshots**: Exactly 20 before/after comparison screenshot pairs with identical filenames are tracked in \`docs/milestones/m1/fix3/before/\` and \`docs/milestones/m1/fix3/after/\`.
`;

fs.writeFileSync("docs/milestones/m1/fix4/ARTIFACTS.md", artifactsMd, "utf8");
console.log("Wrote docs/milestones/m1/fix4/ARTIFACTS.md");

// Git remove bulk files from repo
console.log("Removing bulk files from git tracking...");
execSync(`git rm -f "docs/milestones/m1/fix3/matrix_before.json" "docs/milestones/m1/fix3/matrix_after.json"`, { stdio: "inherit" });

for (const f of bulkBefore) {
  const p = path.join(beforeDir, f);
  if (fs.existsSync(p)) {
    execSync(`git rm -f "${p.replace(/\\/g, "/")}"`, { stdio: "inherit" });
  }
}

for (const f of bulkAfter) {
  const p = path.join(afterDir, f);
  if (fs.existsSync(p)) {
    execSync(`git rm -f "${p.replace(/\\/g, "/")}"`, { stdio: "inherit" });
  }
}

console.log("Bulk files untracked. Curated pairs remaining:", fs.readdirSync(beforeDir).length, "in before,", fs.readdirSync(afterDir).length, "in after.");
