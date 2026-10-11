// ============================================================
// tiles.ts — base map tiles (keyless).
//
// CARTO's free basemaps now return an "API KEY REQUIRED" watermark
// (seen on race morning 2026), so we use Esri's World Light Gray
// canvas (+ its label overlay) and fall back to OpenStreetMap's
// standard tiles if Esri starts failing.
// ============================================================
import L from 'leaflet';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const ESRI_ATTR = 'Tiles © <a href="https://www.esri.com">Esri</a> — Esri, HERE, Garmin, © OpenStreetMap contributors';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function addBaseTiles(map: L.Map): void {
  const base = L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 19, maxNativeZoom: 16, attribution: ESRI_ATTR,
  });
  const labels = L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 19, maxNativeZoom: 16, opacity: 0.9,
  });
  let errors = 0;
  let swapped = false;
  base.on('tileerror', () => {
    errors++;
    if (errors >= 4 && !swapped) {
      swapped = true;
      map.removeLayer(base);
      map.removeLayer(labels);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
    }
  });
  base.addTo(map);
  labels.addTo(map);
}
