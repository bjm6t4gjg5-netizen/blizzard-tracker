// ============================================================
// storage.ts — versioned localStorage with safe fallback
// ============================================================

const PREFIX = 'blizzard:v2:';

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
