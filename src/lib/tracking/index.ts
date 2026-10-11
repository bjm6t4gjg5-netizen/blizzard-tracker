// ============================================================
// tracking/index.ts — provider dispatch for live race data.
//
// The current race's provider lives in races.ts. stores.ts only ever
// calls fetchLive(); swapping races never touches the store layer.
// ============================================================
import { CURRENT_RACE } from '../races';
import { fetchRunner as fetchRtrt, type RtrtSnapshot } from '../rtrt';
import { fetchMikaRunner, publicRunnerUrl, setDefaultRelay } from './mika';

if (CURRENT_RACE.tracking.type === 'mika') setDefaultRelay(CURRENT_RACE.tracking.relay);

export interface LiveContext {
  /** Runner's goal pace (s/mi) — used to extrapolate between timing mats. */
  goalPaceSec: number;
}

function lastMat(rows: { mi: number; sec: number | null }[]) {
  const r = rows.filter(x => x.sec != null).sort((a, b) => a.mi - b.mi).at(-1);
  return r ? { mi: r.mi, elapsedSec: r.sec! } : undefined;
}

export async function fetchLive(trackId: string, ctx: LiveContext): Promise<RtrtSnapshot | null> {
  const t = CURRENT_RACE.tracking;
  if (!trackId) return null;
  if (t.type === 'rtrt') return fetchRtrt(trackId);
  if (t.type === 'mika') {
    const snap = await fetchMikaRunner(t.base, t.event, trackId, {
      raceDate: CURRENT_RACE.date,
      tz: CURRENT_RACE.tz,
      totalMi: CURRENT_RACE.distanceMi,
      fallbackPaceSec: ctx.goalPaceSec,
    });
    if (!snap) return null;
    return {
      status: snap.status,
      distMi: snap.distMi,
      elapsedSec: snap.elapsedSec,
      splits: snap.splits,
      fetchedAt: snap.fetchedAt,
      source: snap.estimated ? 'mika·est' : 'mika',
      anchor: lastMat(snap.rows),
    };
  }
  return null;
}

/** Link to the runner's page on the official tracker, for "open official" buttons. */
export function officialTrackerUrl(trackId: string): string {
  const t = CURRENT_RACE.tracking;
  if (t.type === 'mika') return trackId ? publicRunnerUrl(t.base, t.event, trackId) : t.publicUrl;
  if (t.type === 'rtrt') return `https://rtrt.me/${t.eventId}/track/${trackId}`;
  return t.publicUrl ?? '#';
}

export const TRACKING_LABEL = CURRENT_RACE.tracking.label;
