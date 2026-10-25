import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

/**
 * Strip comments and strings from source code to avoid false positives.
 */
function stripComments(code) {
  // Replace block comments with whitespace
  let clean = code.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));
  // Replace line comments with whitespace
  clean = clean.replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
  return clean;
}

const bannedRegex = /\b(alert|confirm|prompt)\s*\(/g;

let violations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const stripped = stripComments(content);
      const lines = stripped.split('\n');
      lines.forEach((line, index) => {
        let match;
        while ((match = bannedRegex.exec(line)) !== null) {
          violations.push({
            file: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
            line: index + 1,
            match: match[0],
            snippet: line.trim()
          });
        }
      });
    }
  }
}

scanDir(srcDir);

if (violations.length > 0) {
  console.error('\x1b[31m[ERROR] Found browser dialog calls (alert/confirm/prompt) in src/:\x1b[0m');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.snippet}`);
  }
  process.exit(1);
} else {
  console.log('\x1b[32m[OK] scan:dialogs passed: 0 browser dialog calls (alert/confirm/prompt) in src/.\x1b[0m');
  process.exit(0);
}
