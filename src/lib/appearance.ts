// ============================================================
// appearance.ts — Theme + accent color preferences.
//
// Persisted to localStorage. Theme mode honors the system pref
// when set to "system". Accent re-maps the chrome accent only —
// per-runner brand colors are intentionally untouched.
// ============================================================
import { writable } from 'svelte/store';
import { load, save } from './storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AccentPreset {
  key: string;
  label: string;
  /** Light-mode accent (used as --blue). */
  hue: string;
  /** Darker shade for hover / pressed. */
  hueDeep: string;
  /** 8% alpha soft fill. */
  hueSoft: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { key: 'blue',    label: 'iOS Blue',    hue: '#007AFF', hueDeep: '#0040DD', hueSoft: 'rgba(0, 122, 255, 0.10)' },
  { key: 'indigo',  label: 'Indigo',      hue: '#5856D6', hueDeep: '#3F3D9C', hueSoft: 'rgba(88, 86, 214, 0.12)' },
  { key: 'magenta', label: 'Brooklyn',    hue: '#FF2D55', hueDeep: '#C8002F', hueSoft: 'rgba(255, 45, 85, 0.10)' },
  { key: 'orange',  label: 'Race-day',    hue: '#FF9500', hueDeep: '#C26B00', hueSoft: 'rgba(255, 149, 0, 0.12)' },
  { key: 'green',   label: 'Park',        hue: '#34C759', hueDeep: '#1F9D4F', hueSoft: 'rgba(52, 199, 89, 0.12)' },
  { key: 'teal',    label: 'Ocean',       hue: '#0AB1B1', hueDeep: '#017A7A', hueSoft: 'rgba(10, 177, 177, 0.12)' },
  { key: 'graphite',label: 'Graphite',    hue: '#3A3A3C', hueDeep: '#1C1C1E', hueSoft: 'rgba(58, 58, 60, 0.10)' },
];

/** Light + iOS Blue is the canonical starting look, matching the original v1. */
const DEFAULT_THEME: ThemeMode = 'light';
const DEFAULT_ACCENT = 'blue';

export const theme  = writable<ThemeMode>(load<ThemeMode>('theme', DEFAULT_THEME));
export const accent = writable<string>(load<string>('accent', DEFAULT_ACCENT));

theme.subscribe(t => save('theme', t));
accent.subscribe(a => save('accent', a));

// ────────────────────────────────────────────────────────────
// Apply to <html data-theme="..." data-accent="..."> on every change
// ────────────────────────────────────────────────────────────

function effectiveTheme(t: ThemeMode): 'light' | 'dark' {
  if (t !== 'system') return t;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearance(t: ThemeMode, a: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', effectiveTheme(t));
  root.setAttribute('data-accent', a);
}

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => {
    // Force a re-apply only when in system mode.
    theme.update(v => v); // triggers subscribers
  });
}

// Wire stores → DOM
let lastT: ThemeMode = DEFAULT_THEME;
let lastA: string = DEFAULT_ACCENT;
theme.subscribe(t => { lastT = t; applyAppearance(t, lastA); });
accent.subscribe(a => { lastA = a; applyAppearance(lastT, a); });
