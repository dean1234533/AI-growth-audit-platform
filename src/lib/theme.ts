export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ga_theme';

export function getStoredTheme(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
}

export function setTheme(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}

/** Inline script source (runs in <head>, before paint) to avoid a flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var pref = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
