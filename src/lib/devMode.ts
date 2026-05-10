// ============================================================
// devMode.ts — Password-gated developer mode.
//
// Unlocks the demo / race-position simulator menu. Persists the
// unlock in localStorage so Leon doesn't have to retype on every
// page load. The hash-only check is for casual obscurity, NOT
// security — anyone determined to read the source can find the
// hash and brute-force it. That's fine: the only thing dev mode
// reveals is the demo race-stage menu.
// ============================================================
import { writable } from 'svelte/store';
import { load, save, remove } from './storage';

const STORAGE_KEY = 'devMode';

// SHA-256 hash of 'sagichnicht'. We hash so the literal password
// doesn't sit in the JS bundle as plain text.
const PASSWORD_HASH = '86e5b11bbd0820a81399d0d6ab679993d80484c3ed7a7c273fec87303de2483a';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const initial = load<boolean>(STORAGE_KEY, false);
export const devUnlocked = writable<boolean>(initial);

devUnlocked.subscribe(v => {
  if (v) save(STORAGE_KEY, true);
  else remove(STORAGE_KEY);
});

/** Try to unlock. Returns true on success. */
export async function tryUnlock(password: string): Promise<boolean> {
  const hash = await sha256Hex(password.trim());
  if (hash === PASSWORD_HASH) {
    devUnlocked.set(true);
    return true;
  }
  return false;
}

export function lockDevMode(): void {
  devUnlocked.set(false);
}
