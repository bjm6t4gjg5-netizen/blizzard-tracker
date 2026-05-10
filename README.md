# ⚡ Blizzard Tracker — v2.6

Live race-day dashboard for **Catherine** and **Helaine Blizzard** at the
**RBC Brooklyn Half 2026** (May 16, 7:00 AM ET).

**Feature highlights**

- Real GPX route, official 2026 NYRR course, with both NYC cheer zones
- Robust RTRT client (three-proxy fallback, timeouts, retries, defensive parser)
- Service worker that never caches API responses (no stale runner positions)
- Career sub-pages per runner: PRs, race log, 6-Star Marathon Major tracker
- Pre-race scenarios + mid-race "from here" projection on the pace chart
- Editable per-mile target times (cumulative, not pace-per-segment)
- Add/remove runners, per-runner settings (goal, age, gender, emoji picker)
- Adaptive light/dark themes + 7 accent colors
- Guided tour wizard (auto-runs on first visit, ? re-opens anytime)
- iCal export of predicted arrival times for spectators
- Notification API milestones at 25/50/75/100%
- Confetti on finish (persisted across reloads)
- Password-gated developer / demo mode (`sagichnicht`)
- 50 unit tests, ~180 KB gzipped

This is a from-scratch **Svelte 4 + TypeScript + Vite** rewrite of the v1
vanilla-JS tracker. Highlights of the rebuild:

- **Real GPX route.** Course geometry is parsed from a Garmin-recorded GPX
  trace of the actual Brooklyn Half (`src/lib/course.gpx`) — no more
  hand-coded points, no more 1.7-mile teleport.
- **Robust RTRT client.** Three CORS-proxy fallbacks, exponential-backoff
  retries, timeouts, and a defensive HTML parser that ignores the static
  "13.1 mi" footer text. ([src/lib/rtrt.ts](src/lib/rtrt.ts))
- **Service worker that doesn't lie.** The race-day-critical bug in v1
  (caching live RTRT responses) is fixed: the SW maintains a strict
  never-cache list for all API/proxy hosts. ([public/sw.js](public/sw.js))
- **Timezone-locked race start.** `RACE_START` is anchored to ET so the
  countdown is correct everywhere.
- **Persistent pace history.** Reload mid-race and your runner's trace
  doesn't reset.
- **Typed end-to-end** with TypeScript and 49 unit tests covering the
  course parser, pace/ETA math, RTRT parser, and formatters.
- **Tiny bundle:** ~150 KB gzipped (Leaflet + Chart.js + Svelte runtime).

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # type-checks + builds dist/
npm run preview  # serve the built dist/
```

## Test

```bash
npm test         # 49 unit tests across course, runners, rtrt, format
```

## Deploy

Pushed to `main` → GitHub Actions builds and deploys to GitHub Pages.
The `vite.config.js` uses a relative base (`./`) so the same `dist/`
works at any path (root or `/blizzard-tracker/`).

---

## Architecture

```
src/
├── main.ts                       # entry, mounts <App>
├── App.svelte                    # shell: header / tabs / panes / footer / toast
├── app.css                       # design tokens + atoms
├── lib/                          # pure modules — no Svelte, no DOM where avoidable
│   ├── course.ts                 # GPX parse + helpers (pointAtMile, nearestOnCourse)
│   ├── course.gpx                # the route
│   ├── rtrt.ts                   # RTRT.me API client w/ proxy fallbacks
│   ├── runners.ts                # types, registry, predictions, ETA
│   ├── weather.ts                # Open-Meteo
│   ├── stats.ts                  # field CDF, age groups, percentile lookup
│   ├── time.ts                   # RACE_START, countdownTo
│   ├── format.ts                 # H:MM:SS / pace / parseGoalTime
│   ├── storage.ts                # versioned localStorage
│   └── stores.ts                 # Svelte stores tying it together
├── components/                   # reusable widgets
│   ├── Header.svelte             # countdown + pills + demo menu
│   ├── Tabs.svelte
│   ├── Footer.svelte
│   ├── CourseMap.svelte          # Leaflet
│   ├── ElevationChart.svelte     # Chart.js
│   ├── PaceChart.svelte          # Chart.js — scenarios + actual + goal splits
│   ├── HourlyChart.svelte
│   ├── DistributionChart.svelte
│   ├── RunnerCard.svelte
│   ├── RunnerPill.svelte
│   ├── VsCard.svelte
│   ├── SpectatorList.svelte
│   ├── SpectatorEta.svelte
│   ├── StatsRow.svelte
│   ├── WeatherPanel.svelte
│   └── Toast.svelte
└── tabs/
    ├── FamilyHQ.svelte
    ├── RunnerTab.svelte
    ├── RunnerTabContent.svelte   # body of one runner tab (per-id stores)
    ├── WeatherTab.svelte
    └── StatsTab.svelte
```

---

## Demo / preview mode

Visit `?demo=early`, `?demo=park`, `?demo=ocean`, `?demo=late`, or
`?demo=finish` to preview the app at any race position without waiting
for live data. Or use the `⋯` menu in the header.

```
?demo=park       Catherine at 6.2mi (10K) · Helaine at 5.5mi
?demo=ocean      Both runners on Ocean Pkwy
?demo=finish     Both finished
```

---

## Race info

| | |
|--|--|
| **Race** | 2026 RBC Brooklyn Half Marathon |
| **Date** | Saturday, May 16, 2026 · 7:00 AM ET |
| **Start** | Brooklyn Museum, Eastern Pkwy & Washington Ave |
| **Finish** | Coney Island Boardwalk · Maimonides Park |
| **Distance** | 13.1094 mi (21.098 km) |
| **Elevation gain** | 246 ft (per NYRR) |
| **Catherine** | tracker `RMGBEVSK` · goal sub-1:30 |
| **Helaine** | tracker `RRM2PLD3` · goal sub-2:10 |

Built with ❤️ by Leon Schulte · May 2026
