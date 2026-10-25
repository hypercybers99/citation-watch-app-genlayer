import fs from "fs";

const ledgerSource = fs.readFileSync("contracts-reference/SourceDriftLedger.py", "utf8");
const claimsSource = fs.readFileSync("contracts-reference/ClaimsBoard.py", "utf8");
const serviceSource = fs.readFileSync("src/services/contractService.ts", "utf8");

function extractPythonMethods(source) {
  const methodRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
  const methods = new Map();
  let m;
  while ((m = methodRegex.exec(source)) !== null) {
    const name = m[1];
    if (name.startsWith("_") && name !== "__init__") continue;
    const rawArgs = m[2].split(",").map((s) => s.trim()).filter((s) => s && s !== "self");
    methods.set(name, {
      name,
      params: rawArgs,
      arity: rawArgs.length,
    });
  }
  return methods;
}

const ledgerMethods = extractPythonMethods(ledgerSource);
const claimsMethods = extractPythonMethods(claimsSource);

console.log("=== CONTRACT PUBLIC METHODS & ARITY ===");
console.log("SourceDriftLedger:");
for (const [name, meta] of ledgerMethods) {
  console.log(`  - ${name}(${meta.params.join(", ")}) [arity: ${meta.arity}]`);
}
console.log("ClaimsBoard:");
for (const [name, meta] of claimsMethods) {
  console.log(`  - ${name}(${meta.params.join(", ")}) [arity: ${meta.arity}]`);
}

// Check invocations in contractService.ts
console.log("\n=== CROSS-CHECKING APP CALLS IN contractService.ts ===");
const callRegex = /functionName:\s*["']([^"']+)["'],\s*args:\s*(\[[^\]]*\])/g;
let cm;
let totalChecked = 0;
let errors = 0;

while ((cm = callRegex.exec(serviceSource)) !== null) {
  const funcName = cm[1];
  const rawArgs = cm[2];
  // Count top-level args in array
  const inner = rawArgs.slice(1, -1).trim();
  const arity = inner === "" ? 0 : inner.split(",").length;

  const inLedger = ledgerMethods.get(funcName);
  const inClaims = claimsMethods.get(funcName);

  if (!inLedger && !inClaims) {
    console.error(`ERROR: Method ${funcName} called in contractService.ts does not exist in reference contracts!`);
    errors++;
  } else {
    const target = inLedger || inClaims;
    if (target.arity !== arity) {
      console.error(`ERROR: Arity mismatch for ${funcName}! Contract expects ${target.arity}, app called with ${arity}`);
      errors++;
    } else {
      console.log(`  [OK] ${funcName}: expected arity ${target.arity}, provided arity ${arity}`);
    }
  }
  totalChecked++;
}

console.log(`\nVerified ${totalChecked} contract service invocations. Errors: ${errors}`);
if (errors > 0) {
  process.exit(1);
} else {
  console.log("AST method-name and arity cross-check: 100% PASS.");
}
