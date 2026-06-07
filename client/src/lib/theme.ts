import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dim' | 'dark';

const THEME_KEY = 'nl_theme';
const ACCENT_KEY = 'nl_accent';

export const ACCENTS = ['#1d9bf0', '#7c5cff', '#00ba7c', '#f59e0b', '#f4212e'];

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (c * pct) / 100)));
  return '#' + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function applyTheme(theme: Theme, accent: string): void {
  const el = document.documentElement;
  el.setAttribute('data-theme', theme);
  el.style.setProperty('--accent', accent);
  el.style.setProperty('--accent-press', shade(accent, -12));
  el.style.setProperty('--accent-soft', hexA(accent, 0.12));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'dim');
  const [accent, setAccentState] = useState<string>(
    () => localStorage.getItem(ACCENT_KEY) || '#1d9bf0');

  useEffect(() => { applyTheme(theme, accent); }, [theme, accent]);

  const setTheme = (t: Theme) => { localStorage.setItem(THEME_KEY, t); setThemeState(t); };
  const setAccent = (a: string) => { localStorage.setItem(ACCENT_KEY, a); setAccentState(a); };

  return { theme, setTheme, accent, setAccent };
}
