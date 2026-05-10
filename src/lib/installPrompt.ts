// ============================================================
// installPrompt.ts — Detect iOS Safari + standalone-vs-tab so we
// know whether to nudge the user toward "Add to Home Screen".
// ============================================================
import { writable } from 'svelte/store';
import { load, save } from './storage';

/** True for iPhone, iPad, iPod — including iPadOS 13+ which masquerades as Mac. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as "Mac" but supports touch.
  if (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1) return true;
  return false;
}

/** True if the page is running as an installed PWA / home-screen app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // Safari iOS uses navigator.standalone; everyone else uses media query.
  if ((navigator as any).standalone === true) return true;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

/** Show the banner only on iOS browsers where the app is NOT yet installed. */
export function shouldShowInstallPrompt(): boolean {
  return isIOS() && !isStandalone();
}

const DISMISSED_KEY = 'installBannerDismissed';

export const installBannerDismissed = writable<boolean>(load<boolean>(DISMISSED_KEY, false));
installBannerDismissed.subscribe(v => save(DISMISSED_KEY, v));
