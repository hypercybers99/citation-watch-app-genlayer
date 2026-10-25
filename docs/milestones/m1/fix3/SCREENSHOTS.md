# Milestone 1 Fix Pass 3 — Screenshot Comparison Index

This index documents 10 curated side-by-side visual comparisons of dialog rendering across viewports and triggers before and after the Milestone 1 Fix Pass 3 architectural fix (React `ModalPortal` to `#modal-root`, canonical `Z_INDEX` hierarchy, and body `inert` trapping).

## Root Cause Summary
Before the fix, modals were rendered inside `<header>` or `<main>`. The header has `backdrop-blur-md` (`backdrop-filter: blur(12px)`), which by CSS specifications establishes a new stacking context. Descendant dialogs with `position: fixed; z-index: 50` were trapped inside this stacking context. On narrow or short viewports, subsequent DOM elements in `<main>` (such as the sticky tab navigation bar and page content cards) painted on top of the modal body and footer.

After the fix, all modals render into `#modal-root` directly under `<body>` outside any ancestor stacking contexts, with `z-index: 50` on the dialog and `z-index: 40` on the backdrop overlay.

---

## Curated Comparison Matrix (10 Representative Pairs)

| Scenario / Dialog | Viewport | Route | Before (Occluded) | After (Resolved via Portal) | What Changed |
|---|---|---|---|---|---|
| `funding_header_landing_w320` | `320x568 (Mobile)` | `/landing` | [Before Image](./before/chromium_funding_header_landing_w320_h568_scroll_top.png) | [After Image](./after/chromium_funding_header_landing_w320_h568_scroll_top.png) | Funding guide modal renders cleanly above all sticky tabs and card contents without clipping or layering. |
| `funding_header_landing_w500` | `500x400 (Narrow short)` | `/landing` | [Before Image](./before/chromium_funding_header_landing_w500_h400_scroll_top.png) | [After Image](./after/chromium_funding_header_landing_w500_h400_scroll_top.png) | Header dialog body and footer render on top of tablist and hero heading with full visibility. |
| `funding_header_landing_w630` | `630x400 (Target bug)` | `/landing` | [Before Image](./before/chromium_funding_header_landing_w630_h400_scroll_top.png) | [After Image](./after/chromium_funding_header_landing_w630_h400_scroll_top.png) | Resolved owner-reported bug where dialog body was covered by sticky navigation bar. |
| `funding_header_landing_w768` | `768x900 (Tablet)` | `/landing` | [Before Image](./before/chromium_funding_header_landing_w768_h900_scroll_top.png) | [After Image](./after/chromium_funding_header_landing_w768_h900_scroll_top.png) | Dialog paints at z-index 50 above tablet navigation header. |
| `funding_header_landing_w1440` | `1440x900 (Desktop)` | `/landing` | [Before Image](./before/chromium_funding_header_landing_w1440_h900_scroll_top.png) | [After Image](./after/chromium_funding_header_landing_w1440_h900_scroll_top.png) | Desktop presentation maintains full modal portal layering and backdrop blur overlay. |
| `walkthrough_auto_workbench_w320` | `320x568 (Mobile)` | `/workbench` | [Before Image](./before/chromium_walkthrough_auto_workbench_w320_h568_scroll_top.png) | [After Image](./after/chromium_walkthrough_auto_workbench_w320_h568_scroll_top.png) | Guided tour dialog renders above workbench tabs without clipping. |
| `walkthrough_auto_workbench_w500` | `500x400 (Narrow short)` | `/workbench` | [Before Image](./before/chromium_walkthrough_auto_workbench_w500_h400_scroll_top.png) | [After Image](./after/chromium_walkthrough_auto_workbench_w500_h400_scroll_top.png) | Step indicator, title, and buttons sit completely above the tab navigation. |
| `walkthrough_auto_workbench_w630` | `630x400 (Target bug)` | `/workbench` | [Before Image](./before/chromium_walkthrough_auto_workbench_w630_h400_scroll_top.png) | [After Image](./after/chromium_walkthrough_auto_workbench_w630_h400_scroll_top.png) | Resolved walkthrough occlusion on workbench viewports 500-630px wide. |
| `walkthrough_auto_workbench_w768` | `768x900 (Tablet)` | `/workbench` | [Before Image](./before/chromium_walkthrough_auto_workbench_w768_h900_scroll_top.png) | [After Image](./after/chromium_walkthrough_auto_workbench_w768_h900_scroll_top.png) | Tablet layout renders walkthrough overlay cleanly above citation cards. |
| `walkthrough_auto_workbench_w1440` | `1440x900 (Desktop)` | `/workbench` | [Before Image](./before/chromium_walkthrough_auto_workbench_w1440_h900_scroll_top.png) | [After Image](./after/chromium_walkthrough_auto_workbench_w1440_h900_scroll_top.png) | Full desktop interactive guide with background `#app-root` marked inert and aria-hidden. |
