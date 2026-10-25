/**
 * Manages modal root lifecycle, scroll locking, and app-root inertness.
 * When any modal opens, the main app root is marked `inert` and `aria-hidden="true"`,
 * ensuring screen readers and keyboard focus can never leak into background content.
 */

let activeModalCount = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";

export function registerModalOpen() {
  activeModalCount++;

  if (activeModalCount === 1) {
    // Lock body scroll with scrollbar compensation to avoid layout shift
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    originalBodyOverflow = document.body.style.overflow;
    originalBodyPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // Mark the app root inert
    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.setAttribute("inert", "");
      appRoot.setAttribute("aria-hidden", "true");
    }
  }
}

export function registerModalClose() {
  if (activeModalCount > 0) {
    activeModalCount--;
  }

  if (activeModalCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
    document.body.style.paddingRight = originalBodyPaddingRight;

    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.removeAttribute("inert");
      appRoot.removeAttribute("aria-hidden");
    }
  }
}
