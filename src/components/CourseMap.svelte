<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import {
    COURSE_LATLNGS, COURSE_BOUNDS, COURSE_CENTER,
    CHECKPOINTS, SPECTATOR_SPOTS, MILE_MARKERS, pointAtMile,
  } from '../lib/course';
  import type { RunnerProfile } from '../lib/runners';
  import { profiles, runnerState } from '../lib/stores';

  /** Show all spectator pins, mile markers, etc. */
  export let detailed = true;
  /** Override which runners to show on the map (defaults to all). */
  export let runnerIds: string[] | null = null;
  /** Map height. */
  export let height = '420px';

  let mapEl: HTMLDivElement;
  let map: L.Map | null = null;
  let polyOuter: L.Polyline | null = null;
  let polyInner: L.Polyline | null = null;
  /** id → marker */
  const markers = new Map<string, L.Marker>();
  /** id → unsubscribe fn from that runner's state store. */
  const markerUnsubs = new Map<string, () => void>();
  let resizeObserver: ResizeObserver | null = null;

  function fitBounds() {
    if (!map) return;
    const padX = 0.005;
    const padY = 0.005;
    map.fitBounds(
      [
        [COURSE_BOUNDS.south - padY, COURSE_BOUNDS.west - padX],
        [COURSE_BOUNDS.north + padY, COURSE_BOUNDS.east + padX],
      ],
      { animate: false, padding: [16, 16] },
    );
  }

  function buildRunnerIcon(p: RunnerProfile, isLive: boolean): L.DivIcon {
    const initials = p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return L.divIcon({
      className: 'runner-marker-wrap',
      html: `
        <span class="runner-marker" style="background:${p.color}">
          <span class="rm-init">${initials}</span>
          ${isLive ? '<span class="rm-pulse" style="background:' + p.color + '"></span>' : ''}
        </span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }

  onMount(() => {
    map = L.map(mapEl, {
      center: COURSE_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    // Two-stroke route polyline (white outline + colored fill — race-line look).
    polyOuter = L.polyline(COURSE_LATLNGS as [number, number][], {
      color: '#FFFFFF',
      weight: 8,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    polyInner = L.polyline(COURSE_LATLNGS as [number, number][], {
      color: '#007AFF',
      weight: 4.5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    // Start + finish flags
    const startLL = COURSE_LATLNGS[0];
    const endLL   = COURSE_LATLNGS[COURSE_LATLNGS.length - 1];
    L.marker(startLL, {
      icon: L.divIcon({
        className: 'flag-marker',
        html: '<div class="flag flag-start">🏁</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      }),
    }).bindPopup('<b>Start</b><br>Brooklyn Museum').addTo(map);
    L.marker(endLL, {
      icon: L.divIcon({
        className: 'flag-marker',
        html: '<div class="flag flag-finish">🏆</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      }),
    }).bindPopup('<b>Finish</b><br>Coney Island Boardwalk').addTo(map);

    if (detailed) {
      // Mile markers
      for (const mm of MILE_MARKERS) {
        if (mm.mi === 0 || mm.mi >= 13) continue;
        L.marker([mm.lat, mm.lng], {
          icon: L.divIcon({
            className: 'mile-marker-wrap',
            html: `<div class="mile-marker">${mm.mi}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).bindPopup(`<b>Mile ${mm.mi}</b><br>${Math.round(mm.eleFt)} ft elevation`).addTo(map);
      }

      // Spectator spots
      for (const s of SPECTATOR_SPOTS) {
        const off = s.official ? `<div class="popup-tag">${s.official} Cheer Zone</div>` : '';
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: 'spec-marker-wrap',
            html: `<div class="spec-marker${s.official ? ' spec-marker-official' : ''}">📣</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .bindPopup(`<b>${s.name}</b><br>${s.note}<br><small>${s.transit}</small>${off}`)
          .addTo(map);
      }
    }

    // Runner markers — each marker keeps a live subscription to its runner's
    // state store so the marker tracks distance changes (live RTRT updates,
    // demo-mode transitions, manual refresh, etc.) without polling.
    const ids = runnerIds ?? $profiles.map(p => p.id);
    for (const id of ids) {
      const profile = $profiles.find(p => p.id === id);
      if (!profile) continue;
      const marker = L.marker(COURSE_LATLNGS[0] as [number, number], {
        icon: buildRunnerIcon(profile, false),
        zIndexOffset: 1000,
      }).bindPopup(`${profile.emoji} <b>${profile.name}</b>`);
      marker.addTo(map);
      markers.set(id, marker);

      // Persistent subscription — fires synchronously for the current value
      // and then again every time state changes. The unsubscribe runs on
      // component teardown.
      const stateStore = runnerState(id);
      const unsub = stateStore.subscribe(s => {
        const live = s.status === 'running';
        const distMi = Math.max(0, Math.min(s.distMi, 13.1));
        const target = pointAtMile(distMi);
        marker.setLatLng([target.lat, target.lng]);
        marker.setIcon(buildRunnerIcon(profile, live));
      });
      markerUnsubs.set(id, unsub);
    }

    // Initial fit to bounds
    queueMicrotask(() => {
      fitBounds();
      map?.invalidateSize();
    });

    // Recompute size on container resize (e.g., when tab becomes active)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(mapEl);
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    for (const unsub of markerUnsubs.values()) unsub();
    markerUnsubs.clear();
    if (map) {
      map.remove();
      map = null;
    }
    markers.clear();
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

  /* Leaflet markers — must be global for Leaflet to apply */
  :global(.runner-marker-wrap) { background: transparent; }
  :global(.runner-marker) {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 4px 12px rgba(0,0,0,0.18);
    position: relative;
    border: 1.5px solid white;
  }
  :global(.rm-init) { z-index: 1; }
  :global(.rm-pulse) {
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    opacity: 0.45;
    animation: pulse 1.6s ease-out infinite;
    z-index: 0;
  }
  @keyframes pulse {
    0%   { transform: scale(0.6); opacity: 0.5; }
    80%  { transform: scale(1.4); opacity: 0; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  :global(.flag-marker) { background: transparent; border: none; }
  :global(.flag) {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    font-size: 14px;
    border: 2px solid var(--blue);
  }
  :global(.flag-finish) { border-color: var(--green); }

  :global(.mile-marker-wrap) { background: transparent; border: none; }
  :global(.mile-marker) {
    width: 22px;
    height: 22px;
    background: white;
    border: 2px solid var(--blue);
    color: var(--blue);
    font-size: 11px;
    font-weight: 700;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }

  :global(.spec-marker-wrap) { background: transparent; border: none; }
  :global(.spec-marker) {
    width: 24px;
    height: 24px;
    background: var(--orange);
    color: white;
    font-size: 13px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.2);
  }
  :global(.spec-marker-official) { background: linear-gradient(135deg, #FF9500, #FF3B30); }
  :global(.popup-tag) {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 149, 0, 0.18);
    color: var(--orange);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* Override Leaflet's default popup look to match Apple-ish design */
  :global(.leaflet-popup-content-wrapper) {
    border-radius: 12px !important;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18) !important;
  }
  :global(.leaflet-popup-content) {
    margin: 10px 14px !important;
    font-family: var(--font-sans);
    font-size: 12px !important;
    line-height: 1.45 !important;
  }
</style>
