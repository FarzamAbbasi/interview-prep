/**
 * Light / dark theme (IPP-1401).
 * The choice is saved in localStorage; with no saved choice the device setting is used.
 * index.html sets data-theme before React starts (no white flash on dark devices).
 */
const KEY = 'askedin_theme';
const listeners = new Set();

export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage blocked (private mode): the theme still changes for this visit
  }
  listeners.forEach((fn) => fn());
}

export function subscribeTheme(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
