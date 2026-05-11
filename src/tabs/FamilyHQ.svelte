<script lang="ts">
  import { get } from 'svelte/store';
  import { derived } from 'svelte/store';
  import type { Readable } from 'svelte/store';
  import { profiles, runnerState, notify } from '../lib/stores';
  import type { RunnerState } from '../lib/runners';
  import { TOTAL_GAIN_FT } from '../lib/course';
  import { buildIcsFile, downloadIcs } from '../lib/ical';
  import CourseMap from '../components/CourseMap.svelte';
  import ElevationChart from '../components/ElevationChart.svelte';
  import SpectatorList from '../components/SpectatorList.svelte';
  import VsCard from '../components/VsCard.svelte';
  import HowTheyDoing from '../components/HowTheyDoing.svelte';
  import VenmoButton from '../components/VenmoButton.svelte';
  import PostRaceScreen from '../components/PostRaceScreen.svelte';

  /**
   * Derived "all runners finished" signal. Rebuilt when the profile list
   * changes so newly added runners count too. When true, Family HQ flips
   * to the post-race celebration view automatically — including from the
   * dev simulator's "All done" preset.
   */
  function buildFinishedStore(p: typeof $profiles): Readable<boolean> {
    if (p.length === 0) return derived(profiles, () => false);
    const stores = p.map(pp => runnerState(pp.id));
    return derived(stores as unknown as Readable<RunnerState>[], (states) =>
      (states as RunnerState[]).length > 0 &&
      (states as RunnerState[]).every(s => s.status === 'finished' && s.elapsedSec > 60)
    );
  }
  let allFinishedStore: Readable<boolean> = buildFinishedStore($profiles);
  $: allFinishedStore = buildFinishedStore($profiles);

  /** Hero photos shown in the Family HQ header — laid out as a clean
      3-column grid (no rotation/overlap). */
  /** Two compact photos in the hero — mom + daughter with medals, and the
   *  Eugene post-race beer (the one that's both of them in the family photo
   *  strip). Smaller height than before, no captions. */
  const heroPhotos = [
    './photo-boston-medals.jpeg',
    './photo-eugene-beer.jpeg',
  ];

  function exportCalendar() {
    const ps = get(profiles);
    const states = new Map(ps.map(p => [p.id, get(runnerState(p.id))]));
    const ics = buildIcsFile({ profiles: ps, states });
    downloadIcs(ics, 'blizzard-tracker.ics');
    notify('📅 Calendar downloaded — open to add to your phone');
  }
</script>

{#if $allFinishedStore}
  <!-- Race-day complete: Champions-League-style thank-you + Chicago countdown -->
  <PostRaceScreen />
{:else}
<HowTheyDoing />

<div class="hero card">
  <div class="hero-left">
    <div class="hero-eyebrow">💙 Team Blizzard · RBC Brooklyn Half 2026 ⚡</div>
    <h1 class="hero-title">Catherine &amp; Helaine race Brooklyn.</h1>
    <p class="hero-sub">
      Saturday, May 16 · 7:00 AM ET · Brooklyn Museum → Coney Island Boardwalk · 13.1 miles · {TOTAL_GAIN_FT}ft total elevation gain.
    </p>
    <div class="hero-meta">
      <span class="pill">🏁 Brooklyn Museum</span>
      <span class="pill">🏆 Coney Island</span>
      <span class="pill">⛰ {TOTAL_GAIN_FT}ft</span>
    </div>
  </div>
  <div class="hero-photo-pair">
    {#each heroPhotos as src}
      <img {src} alt="" loading="lazy" />
    {/each}
  </div>
</div>

<div class="vs-grid gap-md">
  {#if $profiles[0]}<VsCard profile={$profiles[0]} />{/if}
  <div class="vs-divider"><span>VS</span></div>
  {#if $profiles[1]}<VsCard profile={$profiles[1]} />{/if}
</div>

<!-- Tip-jar / Venmo CTA: prominent friendly card so visitors actually see it -->
<div class="beer-card gap-md">
  <div class="beer-foam"></div>
  <div class="beer-emoji" aria-hidden="true">🍺</div>
  <div class="beer-text">
    <div class="beer-title">Cheering for Team Blizzard?</div>
    <div class="beer-sub">Buy Catherine &amp; Helaine a post-race beer at Maimonides Park. Goes to <span class="mono">@Catherine-Blizzard</span> on Venmo — she'll share with mom.</div>
  </div>
  <div class="beer-cta">
    <VenmoButton variant="primary" label="🍺 Venmo a beer" />
  </div>
</div>

<div class="card gap-md" data-tour="map">
  <div class="card-header">
    <div class="card-title">Live Course Map · official 2026 route</div>
    <div class="legend">
      <span><span class="lg lg-route"></span> Course</span>
      <span><span class="lg lg-spec"></span> Cheer zone</span>
      <span><span class="lg lg-mile"></span> Mile marker</span>
    </div>
  </div>
  <div class="card-pad">
    <CourseMap height="460px" />
  </div>
</div>

<div class="card gap-md">
  <div class="card-header"><div class="card-title">Elevation profile · {TOTAL_GAIN_FT}ft total · park climb miles 3–7, downhill on Ocean Pkwy</div></div>
  <div class="card-pad">
    <ElevationChart />
  </div>
</div>

<SpectatorList />

<div class="ical-card gap-md" data-tour="ical">
  <div class="ical-text">
    <div class="ical-title">📅 Add the spectator plan to your calendar</div>
    <div class="ical-sub">Generates a .ics file with predicted arrival times at each cheer zone, plus a 5-minute heads-up alarm. Re-export mid-race for live updates.</div>
  </div>
  <button class="btn" on:click={exportCalendar}>Download .ics</button>
</div>
{/if}

<style>
  .hero {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: var(--gap-md);
    padding: var(--gap-lg);
    margin-bottom: var(--gap-md);
    background: linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--blue) 8%, var(--surface)) 60%, color-mix(in srgb, var(--blue) 18%, var(--surface)) 100%);
    border: 1px solid var(--separator-soft);
  }
  .hero-eyebrow { font-size: 11px; font-weight: 700; color: var(--blue); letter-spacing: 0.4px; text-transform: uppercase; }
  .hero-title { font-size: 32px; font-weight: 800; letter-spacing: -1.2px; margin: 8px 0 10px; line-height: 1.05; color: var(--text-primary); }
  .hero-sub { font-size: 14px; color: var(--text-secondary); margin: 0 0 12px; line-height: 1.5; }
  .hero-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .hero-meta .pill {
    background: var(--surface);
    border: 1px solid var(--separator-soft);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .hero-photo-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-self: center;
  }
  .hero-photo-pair img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    object-position: center 25%;
    display: block;
    background: white;
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--separator-soft);
  }

  .vs-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--gap-md);
    align-items: stretch;
  }
  .vs-divider {
    align-self: center;
    text-align: center;
  }
  .vs-divider span {
    display: inline-block;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-tertiary);
    font-weight: 700;
    font-size: 11px;
    line-height: 36px;
    letter-spacing: 0.5px;
  }

  .legend { margin-left: auto; display: flex; gap: 12px; font-size: 10px; color: var(--text-tertiary); }
  .legend > span { display: inline-flex; align-items: center; gap: 4px; }
  .lg { display: inline-block; }
  .lg-route { width: 18px; height: 3px; background: var(--blue); border-radius: 2px; }
  .lg-spec  { width: 8px;  height: 8px; background: var(--orange); border-radius: 50%; }
  .lg-mile  { width: 10px; height: 10px; background: white; border: 2px solid var(--blue); border-radius: 50%; }

  .ical-card {
    margin-top: var(--gap-md);
    background: linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--blue) 6%, var(--surface)) 100%);
    border: 1px solid var(--separator-soft);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    box-shadow: var(--shadow-sm);
    color: var(--text-primary);
  }
  .ical-title { color: var(--text-primary); }
  .ical-sub   { color: var(--text-tertiary); }

  /* ───── Beer / Venmo CTA card ───── */
  .beer-card {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    padding: 18px 22px;
    border-radius: var(--radius);
    /* Warm amber-to-gold gradient so it doesn't blend into the rest of the
       blue/white surfaces. Hard to miss while scrolling. */
    background: linear-gradient(135deg, #FFF4D4 0%, #FFDF7E 55%, #F4B132 100%);
    border: 1px solid rgba(180, 130, 0, 0.25);
    box-shadow: 0 4px 16px rgba(244, 177, 50, 0.20), var(--shadow-sm);
    color: #4D3A00;
  }
  .beer-foam {
    /* Subtle white "foam head" at the top */
    position: absolute;
    inset: 0 0 auto 0;
    height: 14px;
    background: radial-gradient(ellipse 60% 100% at 20% 100%, rgba(255,255,255,0.85), transparent 70%),
                radial-gradient(ellipse 50% 100% at 65% 100%, rgba(255,255,255,0.70), transparent 70%),
                radial-gradient(ellipse 40% 100% at 90% 100%, rgba(255,255,255,0.75), transparent 70%);
    pointer-events: none;
  }
  .beer-emoji {
    font-size: 52px;
    line-height: 1;
    flex-shrink: 0;
    filter: drop-shadow(0 2px 4px rgba(180, 130, 0, 0.25));
    animation: beer-tilt 5s ease-in-out infinite;
  }
  @keyframes beer-tilt {
    0%, 100% { transform: rotate(-4deg); }
    50%      { transform: rotate(6deg); }
  }
  .beer-text { flex: 1; min-width: 0; }
  .beer-title {
    font-weight: 800;
    font-size: 17px;
    letter-spacing: -0.3px;
    color: #2A2002;
  }
  .beer-sub {
    margin-top: 4px;
    font-size: 13px;
    line-height: 1.45;
    color: #5C4500;
  }
  .beer-sub .mono { background: rgba(255,255,255,0.55); padding: 1px 6px; border-radius: 4px; }
  .beer-cta { flex-shrink: 0; }
  .ical-text { flex: 1; min-width: 0; }
  .ical-title { font-weight: 700; font-size: 14px; color: var(--text-primary); }
  .ical-sub   { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }

  @media (max-width: 1024px) {
    /* iPad portrait */
    .hero { padding: 18px; }
    .hero-title { font-size: 26px; }
  }
  @media (max-width: 880px) {
    .hero { grid-template-columns: 1fr; }
    .hero-title { font-size: 24px; }
    .vs-grid { grid-template-columns: 1fr; }
    .ical-card { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 540px) {
    .hero { padding: 14px; }
    .hero-title { font-size: 20px; line-height: 1.15; }
    .hero-sub { font-size: 12px; }
    .hero-meta .pill { font-size: 10px; padding: 3px 8px; }
    .hero-photo-pair img { aspect-ratio: 4 / 3; }
    .hero-photo-fig figcaption { font-size: 9px; padding: 4px 6px; }
    .legend { display: none; }
    .beer-card { flex-direction: column; align-items: flex-start; padding: 16px; text-align: left; }
    .beer-emoji { font-size: 40px; }
    .beer-cta { width: 100%; }
    .beer-cta :global(.venmo) { width: 100%; justify-content: center; }
  }
</style>
