// ============================================================
// weather.js — Open-Meteo weather fetching & analysis
// ============================================================

const WX_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=40.6602&longitude=-73.9690' +
  '&hourly=temperature_2m,apparent_temperature,precipitation_probability,' +
  'windspeed_10m,winddirection_10m,relativehumidity_2m,dewpoint_2m,cloudcover' +
  '&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch' +
  '&timezone=America%2FNew_York&forecast_days=14';

export async function fetchWeather() {
  const res = await fetch(WX_URL);
  return res.json();
}

export function getRaceDayHours(data, dateStr = '2026-05-16') {
  return data.hourly.time.reduce((acc, t, i) => {
    if (t.startsWith(dateStr)) acc.push(i);
    return acc;
  }, []);
}

export function getCurrentHourIndex(data) {
  const now = new Date().toISOString().slice(0, 13);
  const idx = data.hourly.time.findIndex(t => t.startsWith(now));
  return idx >= 0 ? idx : 0;
}

const DIR_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function extractHourData(data, i) {
  const h = data.hourly;
  return {
    temp:   Math.round(h.temperature_2m[i]),
    feels:  Math.round(h.apparent_temperature[i]),
    wind:   Math.round(h.windspeed_10m[i]),
    windDir: DIR_NAMES[Math.round(h.winddirection_10m[i] / 45) % 8],
    humid:  Math.round(h.relativehumidity_2m[i]),
    dew:    Math.round(h.dewpoint_2m[i]),
    cloud:  Math.round(h.cloudcover[i]),
    rain:   Math.round(h.precipitation_probability[i]),
  };
}

export function getWeatherIcon(wx) {
  if (wx.rain > 60) return '🌧️';
  if (wx.cloud < 20) return '☀️';
  if (wx.cloud < 50) return '⛅';
  if (wx.temp > 75) return '🥵';
  if (wx.temp < 45) return '🥶';
  return '🌤️';
}

export function analyzeRaceImpact(wx) {
  let score = 0;
  const parts = [];
  const pctImpact = []; // [{ label, pctChange }]

  // Temperature
  if (wx.temp < 45) {
    parts.push('🥶 Cold — tight muscles risk'); score -= 1;
    pctImpact.push({ label: 'Cold temp', pct: -1 });
  } else if (wx.temp <= 55) {
    parts.push('🏆 Near-ideal temperature'); score += 2;
    pctImpact.push({ label: 'Ideal temp', pct: +2 });
  } else if (wx.temp <= 62) {
    parts.push('✅ Good racing temp'); score += 1;
  } else if (wx.temp <= 68) {
    parts.push('⚠️ Slightly warm — start conservative'); score -= 1;
    pctImpact.push({ label: 'Warm temp', pct: -2 });
  } else if (wx.temp <= 75) {
    parts.push('⚠️ Warm — expect ~3% slowdown'); score -= 2;
    pctImpact.push({ label: 'Hot temp', pct: -3 });
  } else {
    parts.push('🔴 Hot — significant slowdown'); score -= 3;
    pctImpact.push({ label: 'Very hot', pct: -6 });
  }

  // Wind
  if (wx.wind >= 20) {
    parts.push(`🔴 Strong ${wx.windDir} wind (${wx.wind}mph) — Ocean Pkwy exposed`); score -= 2;
    pctImpact.push({ label: 'Strong wind', pct: -3 });
  } else if (wx.wind >= 12) {
    parts.push(`⚠️ Moderate ${wx.wind}mph ${wx.windDir} wind`); score -= 1;
    pctImpact.push({ label: 'Moderate wind', pct: -1.5 });
  } else {
    parts.push(`✅ Light wind (${wx.wind}mph)`); score += 1;
  }

  // Dew point (comfort)
  if (wx.dew >= 65) {
    parts.push('🔴 Muggy — dew point high, body can\'t cool'); score -= 2;
    pctImpact.push({ label: 'High humidity', pct: -3 });
  } else if (wx.dew >= 55) {
    parts.push('⚠️ Some humidity'); score -= 1;
    pctImpact.push({ label: 'Humidity', pct: -1 });
  } else {
    parts.push('✅ Low dew point — comfortable'); score += 1;
  }

  if (wx.rain > 50) parts.push('🌧️ Rain likely — slippery turns');
  if (wx.rain > 30 && wx.rain <= 50) parts.push('🌦️ Chance of rain');

  const totalPctImpact = pctImpact.reduce((s, p) => s + p.pct, 0);

  const summary =
    score >= 3 ? '🏆 Excellent — ideal PR conditions!'
    : score >= 1 ? '✅ Good conditions — expect solid performances.'
    : score >= -1 ? '⚠️ Mixed — manageable, start conservatively.'
    : '🔴 Tough day — prioritize finishing over time goals.';

  const cls = score >= 2 ? 'wx-good' : score >= 0 ? 'wx-warn' : 'wx-bad';

  return { score, parts, summary, cls, totalPctImpact, pctImpact };
}
