<script lang="ts">
  import { onMount } from 'svelte';
  import { weather, loadWeather } from '../lib/stores';
  import { weatherIcon, windDirString, raceImpact, type WeatherHour } from '../lib/weather';
  import HourlyChart from './HourlyChart.svelte';

  onMount(() => {
    if (!$weather) loadWeather();
  });

  $: rh = $weather?.raceStartHour ?? null;
  $: icon = rh ? weatherIcon(rh.weatherCode) : { icon: '⏳', label: 'Loading…' };
  $: impact = raceImpact(rh);
</script>

<div class="card wx-hero gap-md">
  <div class="hero-top">
    <div class="icon-big">{icon.icon}</div>
    <div class="hero-text">
      <div class="desc">{icon.label}</div>
      <div class="loc">Brooklyn · 7:00 AM ET · May 16</div>
    </div>
    <div class="temp-block">
      <div class="temp-big">{rh ? Math.round(rh.tempF) + '°' : '—'}</div>
      <div class="feels">Feels {rh ? Math.round(rh.feelsF) + '°' : '—'}</div>
    </div>
  </div>

  <div class="grid">
    <div class="cell">
      <div class="cell-lbl">Wind</div>
      <div class="cell-val">{rh ? Math.round(rh.windMph) + ' mph' : '—'}</div>
      <div class="cell-sub">{rh ? windDirString(rh.windDir) : '—'}</div>
    </div>
    <div class="cell">
      <div class="cell-lbl">Humidity</div>
      <div class="cell-val">{rh ? rh.humidity + '%' : '—'}</div>
      <div class="cell-sub">relative</div>
    </div>
    <div class="cell">
      <div class="cell-lbl">Dew point</div>
      <div class="cell-val">{rh ? Math.round(rh.dewPointF) + '°' : '—'}</div>
      <div class="cell-sub">comfort</div>
    </div>
    <div class="cell">
      <div class="cell-lbl">Rain</div>
      <div class="cell-val">{rh ? rh.precipPct + '%' : '—'}</div>
      <div class="cell-sub">{rh ? rh.cloudPct + '% cloud' : '—'}</div>
    </div>
  </div>

  <div class="impact tone-{impact.tone}">{impact.text}</div>
</div>

<div class="card">
  <div class="card-header"><div class="card-title">Hourly forecast — race morning</div></div>
  <div class="card-pad">
    <HourlyChart hours={$weather?.raceMorning ?? []} />
  </div>
</div>

<style>
  .wx-hero { padding: 18px; }
  .hero-top { display: flex; align-items: center; gap: 14px; }
  .icon-big { font-size: 44px; line-height: 1; }
  .hero-text { flex: 1; }
  .desc { font-weight: 700; font-size: 17px; letter-spacing: -0.3px; }
  .loc { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
  .temp-block { text-align: right; }
  .temp-big { font-size: 36px; font-weight: 700; letter-spacing: -1px; }
  .feels { font-size: 11px; color: var(--text-tertiary); }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 14px;
  }
  .cell {
    background: var(--surface-2);
    padding: 10px;
    border-radius: var(--radius-sm);
    text-align: center;
  }
  .cell-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-tertiary); }
  .cell-val { font-weight: 700; font-size: 17px; margin-top: 2px; font-family: var(--font-mono); }
  .cell-sub { font-size: 10px; color: var(--text-muted); }

  .impact {
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
  }
  .tone-good { background: rgba(52, 199, 89, 0.12); color: #1F9D4F; }
  .tone-warn { background: rgba(255, 149, 0, 0.12); color: var(--orange); }
  .tone-bad  { background: rgba(255, 59, 48, 0.12);  color: var(--red); }

  @media (max-width: 600px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
