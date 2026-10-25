/**
 * Single Canonical Z-Index Scale for CitationWatch
 *
 * Strict ordering rule:
 * page content (0) < sticky tabs (10) < sticky header (20) < modal overlay (40) < modal dialog (50) < toast/notice (60)
 *
 * Used uniformly across CSS and Tailwind utility classes.
 */

export const Z_INDEX = {
  /** Normal document flow and card elements */
  base: "z-0",
  /** Workbench subnavigation tabs */
  stickyTabs: "z-10",
  /** Global application header bar */
  stickyHeader: "z-20",
  /** Modal backdrop overlay (rendered in #modal-root portal) */
  modalOverlay: "z-40",
  /** Modal dialog surface/card (rendered in #modal-root portal) */
  modalDialog: "z-50",
  /** In-app status/alert banners, toasts, and emergency notifications */
  toast: "z-60",
} as const;

export const Z_VALUES = {
  base: 0,
  stickyTabs: 10,
  stickyHeader: 20,
  modalOverlay: 40,
  modalDialog: 50,
  toast: 60,
} as const;
