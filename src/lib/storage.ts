// ============================================================
// storage.ts — versioned localStorage with safe fallback
// ============================================================

/**
 * Versioned key prefix. Bumping this invalidates every persisted setting
 * (goals, profiles, pace history, tour-seen, theme, etc.) so a schema or
 * RACE change doesn't leave stale data masking the new defaults.
 *
 * v3: Helaine sub-1:50 goal + wave/corral fields
 * v4: Catherine goal Sub-1:32, "goal" scenario removed (canonical goal line
 *     now drawn from editable mile splits), Helaine wave 2 Corral C,
 *     Helaine DOB 1964-04-13, height 5'7", weight 120 lb.
 * v5 (chi2026): Chicago Marathon build. Critically, this orphans Brooklyn's
 *     persisted paceHistory/goals/profiles — without the bump, the old
 *     13.1mi race trace renders mid-course on the Chicago pace chart.
 *     Bump again (or change the race slug) for every future race.
 */
const PREFIX = 'blizzard:v5:chi2026:';

// One-time tidy-up: drop orphaned v4 keys so they don't linger forever.
try {
  if (typeof localStorage !== 'undefined') {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('blizzard:v4:') || k.startsWith('blizzard:v3:')) {
        localStorage.removeItem(k);
      }
    }
  }
} catch { /* private browsing etc. */ }

/** Read a value, validating the schema. Returns fallback on any error or version mismatch. */
export function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

/** Write a value; quietly ignores quota / permission errors. */
export function save<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded, private browsing, etc. — silent
  }
}

export function remove(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** Subscribe to cross-tab changes for a single key. Returns an unsubscribe fn. */
export function subscribe<T>(
  key: string,
  fallback: T,
  onChange: (value: T) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const fullKey = PREFIX + key;
  const handler = (e: StorageEvent) => {
    if (e.key !== fullKey) return;
    try {
      onChange(e.newValue ? (JSON.parse(e.newValue) as T) : fallback);
    } catch {
      onChange(fallback);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
