# Changelog

All notable changes to CitationWatch dApp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Milestone 1 - Revision 4] - 2026-10-25

### Stacking Context Occlusion Resolution, In-App Notices, and Dual Outcome Mapping

**Git Diff**: [pre-milestones...milestone-1-ux-onboarding-r4](https://github.com/huzyow155/citation-watch-app-genlayer/compare/pre-milestones...milestone-1-ux-onboarding-r4)  
**Revision Tag**: `milestone-1-ux-onboarding-r4`  
**Network**: GenLayer Studionet (Preview)  
**Production URL**: `https://citation-watch-app-genlayer.vercel.app`  

---

### Overview

Milestone 1 Revision 4 resolves a critical dialog occlusion defect where modals rendered inside `<header>` were covered by `<main>` page elements on narrow viewports (500–630px wide). The architecture was overhauled with a top-level React portal (`#modal-root`), an explicit application-wide z-index scale, and background inertness trapping. In addition, all native browser dialogs were replaced with accessible in-app notices, dual status and result mapping was implemented to distinguish agreed from disagreed transactions, and a fresh zero-balance experiment on GenLayer Studionet (Preview) was completed with 100% agreement on first attempt.

---

### Quantifiable Metrics (Revision 2 vs. Revision 4)

| Metric | Revision 2 (`milestone-1-ux-onboarding-r2`) | Revision 4 (`milestone-1-ux-onboarding-r4`) | Improvement |
| :--- | :--- | :--- | :--- |
| **Viewport Occluded Elements (1,953 cells)** | 1,998 externally covered elements | **0 externally covered elements (100% clear)** | Complete resolution of stacking occlusion |
| **Automated Playwright Occlusion Suite** | Failed (6 / 6 tests failed on R3 baseline) | **Passed (6 / 6 tests passed on R4)** | Regression verified |
| **Native Browser Dialogs (`alert/confirm/prompt`)** | 2 browser dialog calls | **0 browser dialog calls across `src/`** | Replaced with accessible InAppNotice |
| **Static Dialog Scanner** | Not present | **Wired into `npm run check` (`scan:dialogs`)** | Continuous regression checks |
| **Axe-core Accessibility Audits (28 scenarios)** | Not tested across modals on small viewports | **28 / 28 scenarios passed (0 violations)** | 0 critical, 0 serious, 0 moderate, 0 minor |
| **Keyboard-Only Verification (3 engines)** | Unverified | **18 / 18 tests passed (Chromium, Firefox, WebKit)** | 100% keyboard accessibility |
| **Lighthouse Accessibility Score** | 99 / 100 | **100 / 100 across `/`, `/app`, `/workbench`** | Perfect 100 on desktop & mobile |
| **Zero-Balance Writes (Fresh throwaway key)** | 3 agreed, 1 disagreed | **4 / 4 writes agreed on 1st attempt (0 retries)** | 0 GEN expended across all 4 writes |
| **Automated Test Suite (Vitest)** | 53 tests | **76 unit & integration tests** | +23 table-driven outcome tests |

---

### Before vs. After Analysis

#### 1. Stacking Context & Modal Mounting Architecture
- **Before**: Modals were rendered as child elements of `<header>` or `<main>`. The `<header>` element uses Tailwind's `backdrop-blur-md` (`backdrop-filter: blur(12px)`). By CSS specifications, applying `backdrop-filter` creates a new stacking context on `<header>`. Descendant dialogs with `position: fixed; z-index: 50` were trapped within this local stacking context. Because `<main id="main-content">` follows `<header>` in DOM ordering, the sticky tab navigation bar and page content cards painted over the dialog body and footer on windows 500–630px wide.
- **After**: Added `<div id="modal-root"></div>` as a top-level sibling to `#root` in `index.html`. Created React `ModalPortal` that teleports every modal into `#modal-root`. Established a canonical z-index scale (`base: 0 < stickyTabs: 10 < stickyHeader: 20 < modalOverlay: 40 < modalDialog: 50 < toast: 60`). Added `modalManager.ts` which sets `inert` and `aria-hidden="true"` on `#app-root` with scrollbar compensation when any dialog opens.
- **Reason**: Resolves stacking context entrapment, ensuring dialogs always paint on the top-most layer above all page content.

#### 2. Native Browser Dialog Replacement with Accessible InAppNotice
- **Before**: Legacy code in `Header.tsx` and `Workbench.tsx` invoked `window.alert()` for invalid private keys and missing account guards. Native browser dialogs lack keyboard trapping, custom styling, screen-reader status announcements, and touch target optimization.
- **After**: Replaced all native dialogs with an accessible `InAppNotice` component featuring `role="alert"` / `role="status"`, `aria-live` announcements, focus trap, Escape dismissal, and touch targets >= 44x44 px. Implemented `scripts/scan_browser_dialogs.mjs` and wired it into `npm run check`.
- **Reason**: Delivers consistent accessible feedback adhering to WCAG 2.1 AA standards.

#### 3. Dual Status and Result Mapping
- **Before**: Transaction lifecycle evaluation relied on raw status strings alone, which created ambiguity because GenLayer Studionet returns receipt status `0x1` for both agreed and disagreed transactions.
- **After**: Implemented canonical `deriveTerminalOutcome({ status, result, leaderResult })` in `src/lib/txLifecycle.ts`. Terminal outcome maps strictly:
  - Terminal status with result `6` (`MAJORITY_AGREE`) -> "Finalized (Agreed)" with green badge.
  - Terminal status with result `7` (`MAJORITY_DISAGREE`) -> "Finalized (Disagreed / State not applied)" with amber badge.
  - Reverted status or leader result `ERROR` -> "Reverted" with rose badge.
  Added table-driven unit test suite in `tests/txLifecycle.test.ts` covering 23 distinct status/result combinations.
- **Reason**: Resolves false terminal classifications and ensures honest UI reporting.

#### 4. Fresh Zero-Balance Empirical Measurement (R3)
- **Before**: Revision 2's zero-balance experiment included 1 consensus disagreement on `register_citation`.
- **After**: Ran a fresh 4-write experiment (`docs/milestones/m1/fix3/zero_balance_experiment_r3.json`) on GenLayer Studionet (Preview) with an unfunded throwaway key (`0x15Fd0F2f7EA16D2ddc41d92bf48805563b893622`, 0 GEN balance) on article *Grace Hopper* (oldid `1379376501`, quote: `"She did not marry again and retained his surname."`). All 4 writes (`register_citation`, `audit_citation`, `publish_claim`, `refresh_claim`) reached validator agreement on the first attempt without retries. Total gas expended: 0 GEN.
- **Reason**: Empirically confirms that zero-balance interaction on Studionet Preview functions reliably across all contract write methods.

---

## [Milestone 1 - Revision 2] - 2026-10-24

### UX, Responsive Viewport Architecture, and Verification Evidence Hardening

**Git Diff**: [pre-milestones...milestone-1-ux-onboarding-r2](https://github.com/huzyow155/citation-watch-app-genlayer/compare/pre-milestones...milestone-1-ux-onboarding-r2)  
**Revision Tag**: `milestone-1-ux-onboarding-r2`  
**Production URL**: `https://citation-watch-app-genlayer.vercel.app`  

---

### Overview

Milestone 1 Revision 2 directly resolves owner review findings regarding walkthrough dialog viewport clipping, mobile zoom reflow, vocabulary honesty, and E2E production evidence verification. The modal architecture across the entire dApp was refactored from flex-centered layouts into a scrollable, viewport-safe container (`overflow-y-auto`, `justify-start`, `m-auto`, sticky header/footer, `max-h-[calc(100vh-2rem)]`), completely eliminating modal cutoff across a 35-cell matrix (widths 320px to 1440px, landscape, and 200%/400% zoom reflow). An empirical zero-balance experiment proved that 4/4 write operations execute without faucet funding on GenLayer Studionet Preview, and the production UI E2E test suite was rerun to generate a hardened evidence pack proving account-matching readback verifications.

---

### Quantifiable Metrics (Revision 1 vs. Revision 2)

| Metric | Revision 1 (`milestone-1-ux-onboarding`) | Revision 2 (`milestone-1-ux-onboarding-r2`) | Improvement |
| :--- | :--- | :--- | :--- |
| **Viewport Matrix Clipping Rate (35 cells)** | 35 / 35 cells clipped (100.0%) | **0 / 35 cells clipped (0.0%)** | Full resolution of dialog clipping |
| **Modal Y Bounding Box at 500x667** | -255px (header clipped above top) | **+16px (fully inside viewport)** | Resolved blocking production bug |
| **Mobile Horizontal Overflow (320px)** | Failed (`scrollWidth > clientWidth`) | **0px overflow (`scrollWidth <= clientWidth`)** | No horizontal overflow |
| **400% Zoom Reflow (320x200 CSS)** | Failed (header & close button cut off) | **Passed (dialog body scrolls, controls visible)** | Responsive reflow verified |
| **Automated Axe Accessibility Audits** | 4 baseline scenarios passed | **15 / 15 scenarios passed (0 violations)** | Comprehensive multi-modal coverage |
| **Zero-Balance Real Writes Executed** | Unmeasured | **4 / 4 write transactions mined on 0 GEN balance (3 accepted by majority agreement, 1 undetermined/disagreed)** | Measured gas consumption: 0 GEN |
| **Readback Registrant Verification** | Clarified (true on M1 & R2 on-chain runs; older pre-milestone defect resolved) | **True (`registrant === runnerAccount`)** | 100% verified on-chain |
| **Automated Test Suite Count** | 42 tests | **87 tests (53 vitest + 34 playwright matrix)** | +45 automated tests |

---

### Before vs. After Analysis

#### 1. Walkthrough Modal Viewport Architecture & Zoom Reflow
- **Before**: In Revision 1, `WalkthroughModal.tsx`, `FundingModal.tsx`, and `TxPipelineModal.tsx` utilized Tailwind's `items-center` without `overflow-y-auto` on the outer fixed container. On viewports with heights below 800px (e.g. 500x667, 390x667, landscape 667x375, or 200%/400% zoom reflow), dialog content overflowed negative Y space (`top < 0`), permanently cutting off the modal title, close button, and Skip button above the viewport.
- **After**: Redesigned all modal containers with fixed viewport-safe containers (`fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4`), top-aligned flex positioning (`flex min-h-full items-start justify-center`), and centered auto margins (`m-auto`). Modal cards enforce `max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)]` with a sticky header, scrollable body (`overflow-y-auto`), and sticky footer (`flex-shrink-0`), guaranteeing that header and navigation buttons remain visible and reachable across all 35 matrix configurations.
- **Reason**: Ensures usability and resolves dialog clipping on small mobile screens, split-screen desktop windows, and 400% zoom reflow.

#### 2. Fluid Responsive Landing Typography
- **Before**: The landing hero headline was styled with static large font classes (`text-5xl sm:text-6xl`), which forced text wrapping beyond screen boundaries on 320px screens and caused horizontal layout overflow.
- **After**: Replaced static font sizing with fluid responsive clamp typography (`text-[clamp(1.75rem,5vw+1rem,3.75rem)]`), added `break-words [overflow-wrap:anywhere]`, and adjusted mobile header brand text to avoid navbar wrapping on narrow screens.
- **Reason**: Eliminates horizontal scrollbars and text cutoff on narrow devices.

#### 3. Zero-Balance Studionet Guidance & Empirical Experiment
- **Before**: The dApp copy previously emphasized "0-gas preview model" while simultaneously showing warning modals advising users to seek faucet funds, creating conflicting guidance for first-time visitors.
- **After**: Executed an empirical zero-balance experiment (`docs/milestones/m1/fix1/zero_balance_experiment.json`) where an unfunded throwaway account (`0xE1876592e963bdA36324F1A2362B94280bFf6C21`) with 0 GEN balance executed all 4 write operations (`register_citation`, `audit_citation`, `publish_claim`, `refresh_claim`) without ever receiving faucet tokens. Updated `FundingModal.tsx` and workbench callouts to clarify that faucet funding is purely optional on Studionet Preview.
- **Reason**: Reassures users that testing the dApp is completely frictionless and requires no token claiming.

#### 4. Vocabulary Honesty & Strict Revert Status Mapping
- **Before**: Certain documentation and comment passages used unsupported overclaims or unverified assertions. Receipt status mapping did not consistently separate Studionet's raw status_name string from UI copy.
- **After**: Audited and cleaned all codebase copy, documentation, and error mappings. Extended `scripts/scan_banned.mjs` to enforce strict vocabulary rules and status mapping. Standardized UI copy on "accepted by validators" and "sha256 fingerprint".
- **Reason**: Complies with GenLayer honesty guidelines and Portal submission criteria.

#### 5. E2E Production Evidence Integrity Pack R2
- **Before**: Previous evidence contained non-matching registrant accounts and lacked explicit consensus vote counts and recorded disagreed transactions.
- **After**: Executed `scripts/run_e2e_r2.mjs` against production `https://citation-watch-app-genlayer.vercel.app` with a fresh throwaway account (`0xf4780364D66D87368729b80A285E24084138203e`). Finalized all 4 writes, verified `registrantMatchesAccount === true` and `publisherMatchesAccount === true`, recorded negative flow revert with 3/5 votes, and honestly recorded a validator disagreement transaction (`0xe33c653ad027caaa4c00f5640e473d8d40dabe80e447bfbc3b8b04de65f4d017`) under Studionet Preview network conditions.
- **Reason**: Establishes verifiable consensus evidence of production functionality.

---

## [Milestone 1] - 2026-10-24

### UX, Onboarding, and Accessibility Overhaul

**Git Diff**: [pre-milestones...milestone-1-ux-onboarding](https://github.com/huzyow155/citation-watch-app-genlayer/compare/pre-milestones...milestone-1-ux-onboarding)

---

### Overview

Milestone 1 delivers a comprehensive overhaul of user experience, interactive onboarding, and accessibility compliance for the CitationWatch dApp on GenLayer Studionet (Preview). This update introduces an interactive 5-step guided walkthrough, a dedicated test funds and gas guide with live RPC balance queries, pre-write validation guards, shimmer skeleton loading states, an application-wide ErrorBoundary, and automated accessibility remediation achieving 0 axe-core violations and 100/99 Lighthouse accessibility scores across desktop and mobile viewports.

---

### Quantifiable Metrics (Before vs. After)

| Metric | Baseline (`pre-milestones` @ `9da5734`) | Milestone 1 (`milestone-1-ux-onboarding`) | Improvement |
| :--- | :--- | :--- | :--- |
| **Axe Violations - Landing (Desktop 1440px)** | 1 serious (`color-contrast`) | **0 violations** | 100% resolved |
| **Axe Violations - Landing (Mobile 390px)** | 1 serious (`color-contrast`) | **0 violations** | 100% resolved |
| **Axe Violations - Workbench (Desktop 1440px)** | 2 violations (1 serious, 1 moderate) | **0 violations** | 100% resolved |
| **Axe Violations - Workbench (Mobile 390px)** | 2 violations (1 serious, 1 moderate) | **0 violations** | 100% resolved |
| **Interactive Guided Tour Steps** | 0 steps (no tour) | **5 steps (keyboard-navigable)** | +5 steps |
| **Dedicated Funding & Gas Guide** | None | **Live modal + RPC balance query** | Complete feature |
| **Pre-Write Balance Guards** | 0/4 write buttons | **4/4 write buttons guarded** | 100% coverage |
| **Inline Gas/Funding Callouts** | 0/4 write operations | **4/4 write operations** | 100% coverage |
| **Shimmer Skeleton Loaders** | 0 skeleton components | **3 dedicated skeleton loaders** | Cards, Details, Claims |
| **Application ErrorBoundary** | Missing (uncaught crashes) | **Full boundary + reset actions** | Production resilient |
| **Direct Deep-Link Routing** | 404 error on `/workbench` | **SPA rewrite (vercel.json)** | 100% resolved |
| **Vitest Unit & Integration Tests** | 37 tests (5 files) | **42 tests (7 files)** | +5 tests (100% passing) |
| **Touch Target Size (>= 44x44px)** | 0% | **94.4% (17/18)** | 17/18 visible interactive targets >= 44x44px (1 sr-only skip link) |

---

### Before vs. After Analysis

#### 1. Interactive Onboarding & Walkthrough
- **Before**: First-time visitors arrived on the Workbench with no visual cues explaining GenLayer's non-deterministic consensus, how verbatim extraction works, or what the 4 tabs accomplish.
- **After**: An interactive 5-step modal walkthrough (`WalkthroughModal.tsx`) introduces the user to:
  1. Source Integrity & Baselines
  2. Non-Deterministic Validator Consensus
  3. Continuous Drift Detection
  4. Cross-Contract ClaimsBoard Integration
  5. Throwaway Keys & Gasless Preview Model
  Includes keyboard navigation (Escape, Left/Right arrows), step indicator pills, and `localStorage` dismissal persistence (`citationwatch_tour_dismissed`).
- **Reason**: Educates new users and judges on GenLayer-native capabilities without cognitive friction.

#### 2. Test Funds and Gas Guidance
- **Before**: No gas or funding explanations existed. Users unfamiliar with GenLayer Studionet (Preview) wondered if real funds were required or why transactions did not trigger MetaMask gas prompts.
- **After**: A dedicated Test Funds & Gas Guide modal (`FundingModal.tsx`) explains:
  - GenLayer Studionet (Preview) zero-gas model (measured transaction cost: 0 GEN).
  - Live account balance querying via `client.getBalance`.
  - Faucet instructions and discord bot access for preview tokens.
  - Low balance recovery instructions.
  - Inline `[Gas & Funds Guide]` action buttons placed directly beside EVERY write button (Register, Audit, Publish Claim, Refresh Claim).
  - Pre-write balance guard (`runPreWriteGuard`) executing before any consensus transaction is submitted.
- **Reason**: Eliminates user hesitation around transaction fees and confirms the preview nature of Studionet.

#### 3. Accessibility Remediation & Usability Verification
- **Before**: Automated axe scans failed on contrast ratios (cyan-600 on dark slate failed AA standard 4.5:1), missing landmark regions, and `label-content-name-mismatch` on custom buttons. Touch targets were sub-40px.
- **After**:
  - Contrast ratios elevated above 9:1 using high-contrast cyan-500 against slate-950 and bright white foreground text.
  - Pure ASCII header and components (replaced non-ASCII symbols with Lucide vector icons).
  - Accessible name alignment on all buttons and interactive controls.
  - Proper landmark hierarchy: `<header>`, `<main>`, `<nav role="tablist">`, and `<section aria-labelledby="...">` landmarks.
  - Keyboard accessible skip link (`Skip to main content`).
  - Mobile 390px viewport verified for zero horizontal overflow (`scrollWidth <= innerWidth`).
- **Reason**: Eliminates all automated axe-core violations, achieves 100/99 Lighthouse accessibility scores, and ensures keyboard usability for assistive technology.

#### 4. Skeleton Loading States & Error Resilience
- **Before**: Slow RPC responses left users staring at blank white screens or frozen card layouts without indication of network activity. Unhandled runtime errors caused full page crashes.
- **After**:
  - Added `CitationCardSkeleton`, `CitationDetailSkeleton`, and `ClaimCardSkeleton` providing animated pulse/shimmer feedback while querying Studionet RPC.
  - Added React `ErrorBoundary` component with actionable "Reload Application" and "Reset to Overview" buttons.
  - Enhanced revert decoding with human-readable consensus disagreement explanations.
- **Reason**: Avoids jarring layout shifts and provides graceful degradation during RPC latency or validator disagreement.

#### 5. Direct Deep-Linking & Routing
- **Before**: Directly loading `https://citation-watch-app-genlayer.vercel.app/workbench` or `/app` resulted in Vercel 404 errors due to missing single-page app rewrites.
- **After**: Added `vercel.json` with SPA wildcard rewrite `[{"source": "/(.*)", "destination": "/"}]` and added route aliases in `App.tsx`.
- **Reason**: Ensures bookmarked or shared links to the workbench route resolve correctly.
