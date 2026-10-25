import fs from "fs";
import path from "path";

// Banned words per specification:
// - "cryptographic proof"
// - "tamper-proof" / "tamperproof"
// - "bytecode"
// - "testnet"
// - "live network" (use "GenLayer Studionet (Preview)")
// - "unanimous" / "unanimously"
// - Exclusivity claims: "first", "only", "the only", "unique" (when referring to the dApp / contract)
// - "revolutionary"
// - Milestone 1 Fix Pass additions:
//   - "immutable"
//   - "prevents" / "prevent"
//   - "guarantee" / "guarantees"
//   - "trustless"
//   - "Finalized ("
//   - user-facing "finalized" (outside raw status mapping/table columns)

const BANNED_PATTERNS = [
  { pattern: /\bcryptographic\s+proof\b/i, name: "cryptographic proof" },
  { pattern: /\btamper-?proof\b/i, name: "tamper-proof" },
  { pattern: /\bbytecode\b/i, name: "bytecode" },
  { pattern: /\btestnet\b/i, name: "testnet" },
  { pattern: /\blive\s+network\b/i, name: "live network" },
  { pattern: /\bunanimous(ly)?\b/i, name: "unanimous" },
  { pattern: /\brevolutionary\b/i, name: "revolutionary" },
  { pattern: /\bimmutable\b/i, name: "immutable" },
  { pattern: /\bprevents?\b/i, name: "prevents" },
  { pattern: /\bguarantees?\b/i, name: "guarantee(s)" },
  { pattern: /\btrustless\b/i, name: "trustless" },
  { pattern: /\bFinalized\s*\(/i, name: "Finalized (" },
  {
    pattern: /\b(the\s+first\s+(?:contract|platform|system|implementation|dapp)|the\s+only\s+(?:contract|platform|system|implementation|solution)|no\s+one\s+else)\b/i,
    name: "exclusivity claim",
  },
];

const rootDir = process.cwd();
const dirsToScan = ["src", "docs"];
const filesToScan = ["index.html", "README.md", "CHANGELOG.md"];

let violations = [];

function isAllowedFinalizedUsage(filePath, line) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");

  // Allow in txLifecycle.ts when mapping raw status_name / receipt status from GenVM
  if (relPath.includes("src/lib/txLifecycle.ts")) {
    if (
      line.includes("statusName") ||
      line.includes("status_name") ||
      line.includes("rawStatus") ||
      line.includes("status ===") ||
      line.includes("finalStatus") ||
      line.includes("FINALIZED") ||
      line.includes("Eliminates all user-facing") ||
      line.includes("finished validator voting")
    ) {
      return true;
    }
  }

  // Allow in test files asserting raw RPC status mapping
  if (relPath.includes("tests/txLifecycle.test.ts")) {
    return true;
  }

  // Allow in scripts processing raw RPC responses
  if (relPath.startsWith("scripts/")) {
    return true;
  }

  // Allow in markdown evidence tables in raw status column or meta description of banning
  if (relPath.endsWith(".md")) {
    if (
      /\|\s*`?FINALIZED`?\s*\|/.test(line) ||
      /\|\s*`?finalized`?\s*\|/i.test(line) ||
      line.includes("raw status") ||
      line.includes("status_name") ||
      line.includes("Elimination of User-Facing") ||
      line.includes("scan_banned.mjs") ||
      line.includes("strict \"finalized\" rules")
    ) {
      return true;
    }
  }

  return false;
}

function scanFile(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Check standard banned patterns
    for (const rule of BANNED_PATTERNS) {
      if (rule.pattern.test(line)) {
        // Allow exact contract error string key in revertMap.ts
        if (
          relPath.includes("src/lib/revertMap.ts") &&
          line.trim().startsWith('"baseline must be an immutable revision permalink":')
        ) {
          continue;
        }

        // Allow meta reference in changelog/docs describing scanner rule
        if (
          relPath.endsWith(".md") &&
          (line.includes("scan_banned") || line.includes("banned words"))
        ) {
          continue;
        }

        violations.push({
          file: relPath,
          line: index + 1,
          word: rule.name,
          text: line.trim(),
        });
      }
    }

    // Check user-facing finalized pattern
    if (/\bfinalized\b/i.test(line)) {
      if (!isAllowedFinalizedUsage(filePath, line)) {
        violations.push({
          file: relPath,
          line: index + 1,
          word: "user-facing finalized",
          text: line.trim(),
        });
      }
    }
  });
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git" && entry.name !== "test-results" && entry.name !== "playwright-report") {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (
        entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".md") ||
        entry.name.endsWith(".html") ||
        entry.name.endsWith(".mjs")
      ) {
        scanFile(fullPath);
      }
    }
  }
}

for (const d of dirsToScan) {
  scanDir(path.join(rootDir, d));
}

for (const f of filesToScan) {
  const p = path.join(rootDir, f);
  if (fs.existsSync(p)) scanFile(p);
}

if (violations.length > 0) {
  console.error(`FAILED: Found ${violations.length} banned word violations:`);
  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line} [${v.word}] -> ${v.text.slice(0, 100)}`);
  });
  process.exit(1);
} else {
  console.log("PASS: Zero banned words detected across codebase and docs.");
  process.exit(0);
}
