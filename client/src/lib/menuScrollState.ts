/** Persists sidebar menu scroll across route changes and full page refresh. */
const STORAGE_KEY = "ops-portal-menu-scroll";

let menuScrollTop = 0;

export function getMenuScrollTop(): number {
  if (menuScrollTop > 0) {
    return menuScrollTop;
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        menuScrollTop = Math.max(0, parsed);
        return menuScrollTop;
      }
    }
  } catch {
    // sessionStorage unavailable (e.g. private browsing)
  }
  return 0;
}

export function setMenuScrollTop(top: number): void {
  menuScrollTop = Math.max(0, top);
  try {
    sessionStorage.setItem(STORAGE_KEY, String(menuScrollTop));
  } catch {
    // ignore
  }
}

/**
 * Restores saved scroll for in-app navigation (in-memory value).
 * After a full refresh, falls back to sessionStorage; if still none, scrolls
 * the active menu item into view.
 */
export function restoreMenuScroll(container: HTMLElement): void {
  const saved = getMenuScrollTop();
  if (saved > 0) {
    container.scrollTop = saved;
    return;
  }

  const active = container.querySelector<HTMLElement>(
    ".menu-item a.active, .submenu-item a.active, .menu-action-button.active"
  );
  if (!active) {
    return;
  }

  active.scrollIntoView({ block: "nearest", behavior: "auto" });
  setMenuScrollTop(container.scrollTop);
}
