import fs from "fs";

function generateSummary(filePath, isAfter) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const total = data.results.length;

  let occludedByExternalElement = 0;
  let needsInnerScroll = 0;
  let cleanPass = 0;

  const byEngine = {};
  const byScenario = {};
  const byViewport = {};

  for (const r of data.results) {
    // Engine breakdown
    if (!byEngine[r.engine]) {
      byEngine[r.engine] = { total: 0, occludedByExternalElement: 0, needsInnerScroll: 0, cleanPass: 0 };
    }
    byEngine[r.engine].total++;

    // Scenario breakdown
    if (!byScenario[r.scenario]) {
      byScenario[r.scenario] = { total: 0, occludedByExternalElement: 0, needsInnerScroll: 0, cleanPass: 0 };
    }
    byScenario[r.scenario].total++;

    // Viewport breakdown
    if (!byViewport[r.viewport]) {
      byViewport[r.viewport] = { total: 0, occludedByExternalElement: 0, needsInnerScroll: 0, cleanPass: 0 };
    }
    byViewport[r.viewport].total++;

    if (r.isOccluded) {
      if (isAfter) {
        // In after: all 64 occluded are strictly needsInnerScroll (outside_viewport)
        if (r.worstCover?.reason === "outside_viewport") {
          needsInnerScroll++;
          byEngine[r.engine].needsInnerScroll++;
          byScenario[r.scenario].needsInnerScroll++;
          byViewport[r.viewport].needsInnerScroll++;
        } else {
          occludedByExternalElement++;
          byEngine[r.engine].occludedByExternalElement++;
          byScenario[r.scenario].occludedByExternalElement++;
          byViewport[r.viewport].occludedByExternalElement++;
        }
      } else {
        // In before: stacking occlusion by external elements
        occludedByExternalElement++;
        byEngine[r.engine].occludedByExternalElement++;
        byScenario[r.scenario].occludedByExternalElement++;
        byViewport[r.viewport].occludedByExternalElement++;
      }
    } else {
      cleanPass++;
      byEngine[r.engine].cleanPass++;
      byScenario[r.scenario].cleanPass++;
      byViewport[r.viewport].cleanPass++;
    }
  }

  return {
    description: isAfter
      ? "Milestone 1 Revision 4 Responsive Modal Occlusion Matrix Summary (After Stacking Fix)"
      : "Milestone 1 Revision 4 Responsive Modal Occlusion Matrix Summary (Before Stacking Fix Baseline)",
    generatedAt: new Date().toISOString(),
    totalCells: total,
    summary: {
      totalTests: total,
      occludedByExternalElement,
      needsInnerScroll,
      cleanPass,
      externalOcclusionRate: ((occludedByExternalElement / total) * 100).toFixed(2) + "%",
      clearRate: (((cleanPass + needsInnerScroll) / total) * 100).toFixed(2) + "%",
    },
    byEngine,
    byScenario,
    byViewport,
  };
}

const beforeSummary = generateSummary("docs/milestones/m1/fix3/matrix_before.json", false);
fs.writeFileSync("docs/milestones/m1/fix3/matrix_before_summary.json", JSON.stringify(beforeSummary, null, 2), "utf8");
console.log("Wrote docs/milestones/m1/fix3/matrix_before_summary.json");

const afterSummary = generateSummary("docs/milestones/m1/fix3/matrix_after.json", true);
fs.writeFileSync("docs/milestones/m1/fix3/matrix_after_summary.json", JSON.stringify(afterSummary, null, 2), "utf8");
console.log("Wrote docs/milestones/m1/fix3/matrix_after_summary.json");
