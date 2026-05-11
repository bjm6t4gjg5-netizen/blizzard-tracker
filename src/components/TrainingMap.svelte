<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet.heat';
  import { get } from 'svelte/store';
  import { profiles } from '../lib/stores';
  import {
    CATHERINE_TRAINING, HELAINE_TRAINING, CHICAGO_RACE_LOCATION,
    type TrainingLocation,
  } from '../lib/trainingSample';

  export let height = '440px';

  let mapEl: HTMLDivElement;
  let map: L.Map | null = null;

  /**
   * Heatmap gradient stops per runner. Each runner gets a multi-stop hue
   * ramp (light → dark of their color family) so the heat layer reads like
   * a real intensity gradient rather than alpha-only fade.
   */
  const GRADIENTS = {
    blue: {     // Catherine — light sky → deep navy
      0.0: 'rgba(173, 216, 230, 0)',
      0.25: 'rgba(120, 180, 245, 0.55)',
      0.5:  'rgba(50, 130, 230, 0.78)',
      0.75: 'rgba(0,  85, 200, 0.90)',
      1.0:  'rgba(0,  45, 140, 1.00)',
    },
    pink: {     // Helaine — pale rose → deep ruby
      0.0: 'rgba(255, 220, 235, 0)',
      0.25: 'rgba(255, 165, 195, 0.55)',
      0.5:  'rgba(255,  90, 140, 0.78)',
      0.75: 'rgba(220,  30,  90, 0.90)',
      1.0:  'rgba(160,   0,  60, 1.00)',
    },
  } as const;

  function heatFor(locations: ReadonlyArray<TrainingLocation>, gradient: Record<number, string>) {
    const max = locations.reduce((m, l) => Math.max(m, l.runs), 1);
    const points: [number, number, number][] = locations.map(l => [l.lat, l.lng, l.runs / max]);
    return (L as any).heatLayer(points, {
      radius: 30,
      blur: 18,        // tighter blur than before — locations read more crisply
      maxZoom: 6,
      minOpacity: 0.35,
      gradient,
    });
  }

  /**
   * Visible click target at each city: small filled dot in the runner's
   * brand color, with a popup carrying the city name + run count. Sized
   * proportional to runs so the eye picks home-base cities without the dot
   * dominating the heatmap.
   */
  function plotPins(locations: ReadonlyArray<TrainingLocation>, color: string, who: string, m: L.Map) {
    const max = locations.reduce((m, l) => Math.max(m, l.runs), 1);
    for (const loc of locations) {
      const r = 3 + Math.round(4 * (loc.runs / max));      // 3 → 7 px
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: r,
        color: '#FFFFFF',
        weight: 1.5,
        opacity: 1,
        fillColor: color,
        fillOpacity: 1,
        interactive: true,
      });
      marker.bindPopup(
        `<div class="tt">
          <b style="color:${color}">${who}</b><br>
          ${loc.name}<br>
          <span class="tt-runs">${loc.runs} runs</span>
          ${loc.note ? `<br><i>${loc.note}</i>` : ''}
        </div>`,
        { closeButton: true, autoPan: true, offset: [0, -r] }
      );
      marker.bindTooltip(loc.name, { direction: 'top', offset: [0, -r], opacity: 0.9 });
      marker.addTo(m);
    }
  }

  onMount(() => {
    map = L.map(mapEl, {
      center: [40, 0],
      zoom: 2,
      worldCopyJump: true,
      attributionControl: true,
      zoomControl: true,
      preferCanvas: false,        // SVG renderer plays nicer with heat overlays
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const profs = get(profiles);
    const gf  = profs.find(p => p.id === 'gf');
    const mom = profs.find(p => p.id === 'mom');

    // Helaine heat first so Catherine's blue layers on top in shared cities.
    if (mom) heatFor(HELAINE_TRAINING,   GRADIENTS.pink).addTo(map);
    if (gf)  heatFor(CATHERINE_TRAINING, GRADIENTS.blue).addTo(map);

    // Pins on top of heat — visible clickable dots.
    if (mom) plotPins(HELAINE_TRAINING,   mom.color, mom.name.split(' ')[0], map);
    if (gf)  plotPins(CATHERINE_TRAINING, gf.color,  gf.name.split(' ')[0],  map);

    // ⭐ Big Chicago Marathon marker — the upcoming race
    L.marker([CHICAGO_RACE_LOCATION.lat, CHICAGO_RACE_LOCATION.lng], {
      icon: L.divIcon({
        className: 'chicago-marker-wrap',
        html: '<div class="chicago-marker"><span>🏆</span></div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      }),
      zIndexOffset: 2000,
    })
      .bindPopup(`<b>${CHICAGO_RACE_LOCATION.name}</b><br>Catherine + Helaine both racing`)
      .addTo(map);

    map.fitBounds(
      [[20, -125], [56, 25]],
      { padding: [12, 12], maxZoom: 4 },
    );
  });

  onDestroy(() => {
    if (map) { map.remove(); map = null; }
  });
</script>

<div class="map-host" bind:this={mapEl} style="height: {height}"></div>

<style>
  .map-host {
    width: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--separator-soft);
    box-shadow: var(--shadow-sm);
  }

  :global(.chicago-marker-wrap) { background: transparent; border: none; }
  :global(.chicago-marker) {
    width: 42px; height: 42px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #FF9500, #FF3B30);
    color: white;
    font-size: 20px;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 6px 14px rgba(0,0,0,0.25);
    animation: chicago-pulse 2.6s ease-in-out infinite;
  }
  @keyframes chicago-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.08); }
  }
  :global(.tt) {
    font-size: 12px;
    line-height: 1.5;
    min-width: 140px;
  }
  :global(.tt-runs) {
    display: inline-block;
    margin-top: 2px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-primary);
  }
  :global(.leaflet-popup-content-wrapper) {
    border-radius: 10px !important;
    box-shadow: 0 6px 20px rgba(0,0,0,0.18) !important;
  }
  :global(.leaflet-popup-content) {
    margin: 10px 14px !important;
    font-family: var(--font-sans);
  }
  :global(.leaflet-tooltip) {
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    font-size: 11px;
    padding: 3px 7px;
  }
</style>
