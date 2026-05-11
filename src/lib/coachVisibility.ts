// ============================================================
// coachVisibility.ts — Hide Coach Dan for a session.
// Persisted to localStorage so a refresh respects the choice; a
// new browser session brings him back (he's still useful, just
// not always wanted).
// ============================================================
import { writable } from 'svelte/store';
import { load, save } from './storage';

const KEY = 'coachHidden';
export const coachHidden = writable<boolean>(load<boolean>(KEY, false));
coachHidden.subscribe(v => save(KEY, v));
