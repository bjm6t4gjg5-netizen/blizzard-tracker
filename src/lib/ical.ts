// ============================================================
// ical.ts — Build an .ics calendar of predicted arrival times.
//
// Spectators add the file to their phone calendar so it pings them
// 5 minutes before each runner reaches each cheer zone.
// ============================================================
import { SPECTATOR_SPOTS } from './course';
import { RACE_START } from './time';
import type { RunnerState } from './runners';
import type { RunnerProfile } from './runners';

interface Args {
  profiles: RunnerProfile[];
  states: Map<string, RunnerState>;
}

function pad(n: number, w = 2): string { return String(n).padStart(w, '0'); }

/** Format a Date as YYYYMMDDTHHMMSSZ (basic-ISO UTC) for ICS. */
function ics(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/**
 * Compute predicted ETA, in seconds elapsed from race start, for each spectator
 * spot for one runner. Uses the same simple "current pace × remaining miles"
 * model as the on-page ETAs.
 */
function predictArrivals(state: RunnerState): Map<number, number> {
  const out = new Map<number, number>();
  if (state.distMi <= 0 || state.elapsedSec <= 0) {
    // Pre-race: use the goal projection as a fallback (10:00/mi default).
    const fallbackPace = 10 * 60;
    for (const s of SPECTATOR_SPOTS) out.set(s.mi, s.mi * fallbackPace);
    return out;
  }
  const pace = state.elapsedSec / Math.max(state.distMi, 0.01);
  for (const s of SPECTATOR_SPOTS) {
    if (s.mi <= state.distMi) continue; // already passed
    out.set(s.mi, state.elapsedSec + (s.mi - state.distMi) * pace);
  }
  return out;
}

export function buildIcsFile({ profiles, states }: Args): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Blizzard Tracker//RBC Brooklyn Half 2026//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push('X-WR-CALNAME:Blizzard Tracker — race-day spectator plan');
  lines.push('X-WR-TIMEZONE:America/New_York');

  const stamp = ics(new Date());

  // The race itself
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:bkh2026-start@blizzard-tracker`);
  lines.push(`DTSTAMP:${stamp}`);
  lines.push(`DTSTART:${ics(RACE_START)}`);
  lines.push(`DTEND:${ics(new Date(RACE_START.getTime() + 30 * 60_000))}`);
  lines.push(`SUMMARY:🏁 RBC Brooklyn Half — race start`);
  lines.push(`LOCATION:Brooklyn Museum, Eastern Pkwy & Washington Ave`);
  lines.push(`DESCRIPTION:${escapeText('Catherine and Helaine start the 2026 RBC Brooklyn Half. 13.1 miles to Coney Island.')}`);
  lines.push('END:VEVENT');

  for (const profile of profiles) {
    const state = states.get(profile.id);
    if (!state) continue;
    const arrivals = predictArrivals(state);
    for (const spot of SPECTATOR_SPOTS) {
      const sec = arrivals.get(spot.mi);
      if (sec == null) continue;
      const at = new Date(RACE_START.getTime() + sec * 1000);
      const end = new Date(at.getTime() + 5 * 60_000);
      const officialNote = spot.official ? ` (${spot.official} cheer zone)` : '';
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:bkh2026-${profile.id}-${spot.mi.toFixed(1)}@blizzard-tracker`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART:${ics(at)}`);
      lines.push(`DTEND:${ics(end)}`);
      lines.push(`SUMMARY:${escapeText(`${profile.emoji} ${profile.name.split(' ')[0]} ~ Mile ${spot.mi.toFixed(1)} · ${spot.name}${officialNote}`)}`);
      lines.push(`LOCATION:${escapeText(spot.name + ' · ' + spot.transit)}`);
      lines.push(`DESCRIPTION:${escapeText(spot.note + ' (Predicted from current pace; refresh and re-export mid-race for live updates.)')}`);
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT5M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeText(profile.name.split(' ')[0])} approaching ${escapeText(spot.name)}`);
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  // ICS spec wants CRLF line endings
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(content: string, filename = 'blizzard-tracker.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
