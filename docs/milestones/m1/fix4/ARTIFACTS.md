# Milestone 1 Revision 5 Bulk Evidence Archive

Per Milestone 1 Fix Pass 4 requirements, bulk evaluation artifacts (full 1,953-cell JSON matrices and 1,486 uncurated viewport screenshots) are decoupled from the git tracking tree to maintain repository hygiene and readable git diffs under 200 files.

## Release Archive Details

- **Archive File**: `m1_fix3_bulk_evidence.zip`
- **Release Tag**: `milestone-1-ux-onboarding-r5`
- **Release URL**: [https://github.com/huzyow155/citation-watch-app-genlayer/releases/download/milestone-1-ux-onboarding-r5/m1_fix3_bulk_evidence.zip](https://github.com/huzyow155/citation-watch-app-genlayer/releases/download/milestone-1-ux-onboarding-r5/m1_fix3_bulk_evidence.zip)
- **File Size**: 51.21 MB (53,697,232 bytes)
- **SHA-256 Checksum**: `571c07d643f84c11d5edc35d8c729a87066b95095b2b06b9293c60d70cd83726`

## Contents of the Archive

1. `matrix_before.json` (11.89 MB): Full 1,953-cell responsive evaluation matrix with complete DOM ancestor chains before the stacking fix.
2. `matrix_after.json` (3.68 MB): Full 1,953-cell responsive evaluation matrix after the stacking fix.
3. `before/` (1,390 screenshots): Raw failing cell screenshots prior to portal refactoring.
4. `after/` (96 screenshots): Residual non-curated verification screenshots.

## Curated In-Repo Evidence

To keep the repository diff under 200 files while providing complete reviewability:
- **Summaries**: `docs/milestones/m1/fix3/matrix_before_summary.json` and `docs/milestones/m1/fix3/matrix_after_summary.json` provide authoritative per-engine, per-scenario, and per-viewport statistics.
- **Curated Screenshots**: Exactly 10 representative before/after comparison screenshot pairs with identical filenames are tracked in `docs/milestones/m1/fix3/before/` and `docs/milestones/m1/fix3/after/`.
- **Authoritative 20-Transaction Dump**: `docs/milestones/m1/fix4/raw_rpc_dump.json` (24.38 KB, < 1 MB) provides verified RPC query records across all Milestone 1 transactions.
