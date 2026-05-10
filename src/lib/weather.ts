// ============================================================
// weather.ts — Open-Meteo client for race-day forecast
//
// Open-Meteo is free, keyless, CORS-friendly. We cache per-day to
// avoid hammering the API on every page load.
// ============================================================
import { load, save } from './storage';
import { RACE_START } from './time';

const BROOKLYN_LAT = 40.65;
const BROOKLYN_LNG = -73.97;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface WeatherHour {
  time: string;
  tempF: number;
  feelsF: number;
  humidity: number;
  windMph: number;
  windDir: number;
  precipPct: number;
  cloudPct: number;
  dewPointF: number;
  weatherCode: number;
}

export interface WeatherSnapshot {
  fetchedAt: number;
  raceMorning: WeatherHour[]; // 5am–11am ET
  raceStartHour: WeatherHour | null;
}

interface OpenMeteoResp {
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    relativehumidity_2m: number[];
    windspeed_10m: number[];
    winddirection_10m: number[];
    precipitation_probability: number[];
    cloudcover: number[];
    dewpoint_2m: number[];
    weathercode: number[];
  };
}

const CACHE_KEY = 'weather';

export async function fetchWeather(): Promise<WeatherSnapshot | null> {
  const cached = load<WeatherSnapshot | null>(CACHE_KEY, null);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const startISO = new Date(RACE_START.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const endISO = new Date(RACE_START.getTime() + 1 * 86_400_000).toISOString().slice(0, 10);
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${BROOKLYN_LAT}&longitude=${BROOKLYN_LNG}` +
    `&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,` +
    `windspeed_10m,winddirection_10m,precipitation_probability,cloudcover,` +
    `dewpoint_2m,weathercode` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph` +
    `&timezone=America%2FNew_York` +
    `&start_date=${startISO}&end_date=${endISO}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const json = (await res.json()) as OpenMeteoResp;
    const snap = transform(json);
    save(CACHE_KEY, snap);
    return snap;
  } catch {
    return cached; // serve stale on error
  }
}

function transform(j: OpenMeteoResp): WeatherSnapshot {
  // Open-Meteo returns local times in "America/New_York" (per the timezone
  // param above) as ISO without offset, e.g. "2026-05-16T07:00".
  const raceDate = RACE_START.toISOString().slice(0, 10);
  const isRaceMorning = (t: string) => {
    if (!t.startsWith(raceDate)) return false;
    const hour = parseInt(t.slice(11, 13), 10);
    return hour >= 5 && hour <= 11;
  };

  const raceMorning: WeatherHour[] = [];
  let raceStartHour: WeatherHour | null = null;
  for (let i = 0; i < j.hourly.time.length; i++) {
    if (!isRaceMorning(j.hourly.time[i])) continue;
    const h: WeatherHour = {
      time: j.hourly.time[i],
      tempF: j.hourly.temperature_2m[i],
      feelsF: j.hourly.apparent_temperature[i],
      humidity: j.hourly.relativehumidity_2m[i],
      windMph: j.hourly.windspeed_10m[i],
      windDir: j.hourly.winddirection_10m[i],
      precipPct: j.hourly.precipitation_probability[i],
      cloudPct: j.hourly.cloudcover[i],
      dewPointF: j.hourly.dewpoint_2m[i],
      weatherCode: j.hourly.weathercode[i],
    };
    raceMorning.push(h);
    const hour = parseInt(j.hourly.time[i].slice(11, 13), 10);
    if (hour === 7) raceStartHour = h;
  }
  return { fetchedAt: Date.now(), raceMorning, raceStartHour };
}

// ────────────────────────────────────────────────────────────
// Display helpers
// ────────────────────────────────────────────────────────────

export function windDirString(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/** WMO weather code → emoji + short label. */
export function weatherIcon(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear' };
  if (code <= 2) return { icon: '🌤', label: 'Mostly clear' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code <= 48) return { icon: '🌫', label: 'Fog' };
  if (code <= 57) return { icon: '🌦', label: 'Drizzle' };
  if (code <= 67) return { icon: '🌧', label: 'Rain' };
  if (code <= 77) return { icon: '🌨', label: 'Snow' };
  if (code <= 82) return { icon: '🌧', label: 'Showers' };
  if (code <= 86) return { icon: '🌨', label: 'Snow showers' };
  if (code <= 99) return { icon: '⛈', label: 'Thunderstorm' };
  return { icon: '🌤', label: 'Mixed' };
}

export function raceImpact(h: WeatherHour | null): { tone: 'good' | 'warn' | 'bad'; text: string } {
  if (!h) return { tone: 'warn', text: 'Forecast loading…' };
  const issues: string[] = [];
  if (h.tempF >= 70) issues.push(`Warm (${Math.round(h.tempF)}°F) — hydrate early`);
  else if (h.tempF >= 60) issues.push(`Mild (${Math.round(h.tempF)}°F)`);
  else issues.push(`Cool (${Math.round(h.tempF)}°F) — perfect`);
  if (h.humidity >= 80) issues.push(`humid (${h.humidity}%)`);
  if (h.windMph >= 15) issues.push(`windy (${Math.round(h.windMph)} mph ${windDirString(h.windDir)})`);
  if (h.precipPct >= 50) issues.push(`${h.precipPct}% rain`);
  const bad = h.tempF >= 75 || h.humidity >= 85 || h.precipPct >= 70;
  const warn = h.tempF >= 65 || h.humidity >= 75 || h.windMph >= 12;
  return {
    tone: bad ? 'bad' : warn ? 'warn' : 'good',
    text: issues.join(' · '),
  };
}
