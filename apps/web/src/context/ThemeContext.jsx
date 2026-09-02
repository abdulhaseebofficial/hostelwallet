import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'hw-theme';

const systemPrefersDark = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Three-state theme: 'light', 'dark' or 'system'.
 * The resolved value is written onto <html> as the `dark` class, matching the
 * `darkMode: 'class'` strategy in tailwind.config.js. index.html applies the
 * same logic inline before first paint so there is no flash.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');

  const resolved = theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, resolved]);

  // Follow the OS while the preference is 'system'.
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => document.documentElement.classList.toggle('dark', event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'system' ? (systemPrefersDark() ? 'light' : 'dark') : current === 'dark' ? 'light' : 'dark';
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, isDark: resolved === 'dark', setTheme, toggle }),
    [theme, resolved, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
};

export default ThemeContext;
