# ⚡ Blizzard Tracker
### Team Blizzard · RBC Brooklyn Half 2026 · May 16

Live race tracking dashboard for Catherine and Helaine Blizzard.

---

## 🚀 Run locally

**Prerequisites:** Node.js 18+ and npm

```bash
# 1. Clone / download the project
git clone <your-repo-url>
cd blizzard-tracker

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Then open **http://localhost:5173** in your browser.

The dev server has hot-reload — any changes you make are instantly reflected.

---

## 📦 Build for production

```bash
npm run build
# Output in /dist — ready to deploy to Netlify, Vercel, GitHub Pages
```

### Deploy to GitHub Pages (free hosting):
```bash
# 1. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/blizzard-tracker.git
git push -u origin main

# 2. In GitHub repo settings → Pages → Source: GitHub Actions
# Or use: npm run build && npx gh-pages -d dist
```

### Deploy to Netlify (drag & drop):
```bash
npm run build
# Drag the /dist folder to netlify.com/drop
```

---

## 🗂 Project structure

```
blizzard-tracker/
├── index.html              # Main HTML — all panes and UI
├── vite.config.js          # Build config
├── src/
│   ├── css/
│   │   └── main.css        # Apple-inspired design system
│   ├── js/
│   │   └── main.js         # App entry point — all logic
│   └── data/
│       ├── course.js       # GPS coordinates, checkpoints, elevation
│       ├── runners.js      # State management, RTRT fetch, scenarios
│       └── weather.js      # Open-Meteo weather API
└── public/                 # Static assets
```

---

## ✨ Features

- **Live tracking** from RTRT.me (refreshes every 60 seconds)
- **Real course GPS** traced precisely from RTRT screenshots
- **Pace scenarios** with elevation-adjusted projections
- **Sub-90 goal line** for Catherine — shows if she's ahead/behind in real time
- **Weather integration** via Open-Meteo (free, no API key)
- **Simulator** — drag to any race position, play forward, locks to live once race starts
- **ETA at spectator spots** — tells you when to be where
- **Pace heatmap** on map after race starts
- **Cheer button** links to RTRT cheer feature
- **Drag-and-drop tabs** — reorder to your preference
- **Add custom runners** — add anyone with an RTRT tracker ID
- **Zoomable charts** — scroll/pinch to zoom any chart
- **Toggle chart lines** — click legend items to show/hide

---

## 🏃 Runner tracker IDs

| Runner | ID |
|--------|-----|
| Catherine Blizzard | RMGBEVSK |
| Helaine Blizzard | RRM2PLD3 |

---

## 📅 Race info

- **Race:** 2026 RBC Brooklyn Half Marathon
- **Date:** Saturday, May 16, 2026 · 7:00 AM start
- **Start:** Brooklyn Museum, Eastern Pkwy & Washington Ave
- **Finish:** Maimonides Park, Coney Island area
- **Distance:** 13.1 miles

---

*Built with Vite, Leaflet.js, Chart.js, and Open-Meteo.*
