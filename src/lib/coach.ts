// ============================================================
// coach.ts — Coach Dan's brain.
//
// Canned FAQ engine for v3. The architecture is intentionally
// boring: a list of (regex → reply) topics with a fallback. The
// CoachEngine interface gives us a clean swap point — when we
// wire up a real LLM (Claude, OpenAI, etc.) we just write a new
// implementation and switch which one CoachDan.svelte imports.
// ============================================================
import { get } from 'svelte/store';
import { weather, profiles, runnerState } from './stores';
import { CATHERINE_SUMMARY, HELAINE_SUMMARY, CATHERINE_PRS } from './career';
import { TOTAL_GAIN_FT, SPECTATOR_SPOTS } from './course';
import { weatherIcon, raceImpact } from './weather';
import { formatHMS } from './format';
import { RACE_START } from './time';
import { waveLabel } from './runners';

export interface CoachMessage {
  id: number;
  role: 'user' | 'coach';
  text: string;
  timestamp: number;
}

export interface CoachEngine {
  ask(input: string): Promise<string>;
}

interface Topic {
  match: RegExp;
  reply: () => string;
}

// ────────────────────────────────────────────────────────────
// Canned topics — order matters (most-specific patterns first).
// ────────────────────────────────────────────────────────────

function summarizeWeather(): string {
  const w = get(weather);
  const r = w?.raceStartHour;
  if (!r) return "Weather isn't loaded yet — check the Weather tab in a sec.";
  const icon = weatherIcon(r.weatherCode);
  const impact = raceImpact(r);
  return `Race-morning forecast (7:30 AM CT): ${icon.icon} ${Math.round(r.tempF)}°F, ${icon.label.toLowerCase()}, ${r.precipPct}% rain, ${Math.round(r.windMph)} mph wind. ${impact.text}.`;
}

function summarizeRunners(): string {
  const ps = get(profiles);
  const lines: string[] = [];
  for (const p of ps) {
    const s = get(runnerState(p.id));
    if (s.status === 'pre' || s.status === 'unknown') {
      lines.push(`${p.emoji} ${p.name.split(' ')[0]}: pre-race`);
    } else if (s.status === 'finished') {
      lines.push(`${p.emoji} ${p.name.split(' ')[0]}: finished in ${formatHMS(s.elapsedSec)}`);
    } else {
      lines.push(`${p.emoji} ${p.name.split(' ')[0]}: mile ${s.distMi.toFixed(1)} (${Math.round(s.pct)}%), ETA ${s.etaSec ? formatHMS(s.etaSec) : '—'}`);
    }
  }
  return lines.join(' · ');
}

const TOPICS: Topic[] = [
  // Greetings
  {
    match: /^\s*(hi|hey|hello|sup|yo|howdy|hola)\b/i,
    reply: () => `Hey! I'm Coach Dan. Ask me about pacing, cheer zones, weather, or what the runners are up to. Type "help" anytime to see topics.`,
  },
  // Help / capabilities
  {
    match: /\b(help|what.*(can|topic)|topics?|menu|commands?)\b/i,
    reply: () => `I can chat about:\n• Pacing & goal splits\n• Cheer zones (where to stand)\n• Weather forecast\n• How Catherine and Helaine are doing\n• Their records (Boston PR, World Majors, etc.)\n• The course route\n• Demo mode / live tracking\n• Adding the app to your home screen`,
  },
  // Live status
  {
    match: /\b(status|how.*doing|where.*they|current|live|now)\b/i,
    reply: () => summarizeRunners(),
  },
  // Pacing
  {
    match: /\b(pace|goal|sub.?(\d+|90|2.?\d)|split|target|strategy)\b/i,
    reply: () =>
      `Catherine's goal is **sub-3:05** — about 7:03/mi on Chicago's pancake-flat course. The plan: settle through the crowded start (~7:15 mile 1), lock into 7:00–7:05s through halfway (~1:32:20), hold steady through the 18-mile check, survive the 20–24 wall zone, then empty the tank up Mount Roosevelt.\n\nHelaine's goal is **sub-4:00** — about 9:09/mi, even-split with a 2:00:00 halfway.\n\nEither runner's settings (⚙ on the runner card) lets you tweak any of those splits.`,
  },
  // Cheer zones
  {
    match: /\b(cheer|spot|where|watch|stand|spectat|location|view)\b/i,
    reply: () => {
      const lines = SPECTATOR_SPOTS.slice(0, 5).map(s => `• Mile ${s.mi.toFixed(1)} — ${s.name}${s.official ? ` (${s.official} cheer zone)` : ''}: ${s.transit}`);
      return `Best spectator spots:\n${lines.join('\n')}\n\nFull list with ETAs is in the Family HQ "Best spectator spots" card.`;
    },
  },
  // Weather
  {
    match: /\b(weather|temp(erature)?|rain|hot|cold|sun|wind|forecast)\b/i,
    reply: summarizeWeather,
  },
  // Helaine
  {
    match: /\b(helaine|mom|world.?major|tokyo|boston|berlin|major)\b/i,
    reply: () =>
      `Helaine has run **${HELAINE_SUMMARY.marathons} marathons** since ${HELAINE_SUMMARY.firstYear}, including ${HELAINE_SUMMARY.starCount} of 6 Abbott World Marathon Majors:\n${HELAINE_SUMMARY.worldMajors.filter(s => s.finishes).map(s => `• ${s.city} ⭐ ${s.finishes > 1 ? `(×${s.finishes})` : ''}`).join('\n')}\n\nTokyo is the missing star — her 6-Star is one marathon away.`,
  },
  // Catherine
  {
    match: /\b(catherine|kid|gf|girlfriend|cat\b)/i,
    reply: () => {
      const marathonPR = CATHERINE_PRS.find(pr => pr.event === 'Marathon');
      return `Catherine ran ${CATHERINE_SUMMARY.totalRaces} recorded races, including 2× DPL Varsity XC champion (6th + 8th grade) and 2012 City Meet MVP (8th-grade track). Her marathon PR is **${marathonPR?.mark ?? '3:06:12'}** at Boston 2025 (7:06/mi pace). Her 8th-grade 1600m PR was 5:46.`;
    },
  },
  // Course
  {
    match: /\b(course|route|map|elevation|hill|terrain|ocean.?pkwy|prospect|park|finish.?line)\b/i,
    reply: () =>
      `26.2 miles through 29 neighborhoods: **Grant Park → River North → Lincoln Park → Lakeview (north turnaround ~mile 8.5) → Old Town → West Loop/Greektown (halfway) → Little Italy → Pilsen → Chinatown (mile 21) → Bronzeville → Michigan Ave north → "Mount Roosevelt" → Columbus Dr finish in Grant Park**. Only ${TOTAL_GAIN_FT}ft total gain — the flattest of the World Marathon Majors. The lone hill is the Roosevelt Rd bridge, 400m before the finish.`,
  },
  // Live / RTRT / refresh
  {
    match: /\b(rtrt|refresh|update|live.?data|tracker|app)\b/i,
    reply: () =>
      `Live data comes from RTRT.me, refreshing every 60 seconds. Tap ↻ in the header for a manual refresh. If RTRT goes flaky, the tracker tries three CORS-proxy fallbacks before giving up.`,
  },
  // Demo / dev mode
  {
    match: /\b(demo|simulat|test|preview|dev(eloper)?)\b/i,
    reply: () =>
      `Footer → "Developer" → enter the password to unlock the 🛠 race-day simulator in the header. Drag the time slider (6:30 AM → early afternoon) or click a preset like "Wave 3 gun" or "Cat finishing". Each runner's position is computed from their own wave/corral start, so Catherine and Helaine show at different mile positions for the same simulated minute — exactly what you'd see on race day.`,
  },
  // Add to home screen
  {
    match: /\b(install|home.?screen|add.?app|pwa|standalone)\b/i,
    reply: () =>
      `**On iPhone/iPad (Safari):** tap the Share button (square with up-arrow), scroll down, tap "Add to Home Screen", confirm. The app launches like any native app, full-screen, with the Catherine + Helaine icon.\n\n**On Android Chrome:** tap the ⋮ menu, then "Install app".`,
  },
  // Confetti / finish
  {
    match: /\b(confetti|finish|celebrat|win|done)\b/i,
    reply: () =>
      `When either runner crosses the finish line for the first time, the screen rains confetti in their brand color and a toast pops up. It only fires once per session per runner — a refresh won't re-blast it.`,
  },
  // Thanks
  {
    match: /\b(thanks|thank.?you|ty|cheers)\b/i,
    reply: () => `You're welcome! Now go cheer them on. 📣`,
  },
  // Subway / how to get there
  {
    match: /\b(subway|train|how.?get|directions?|metro|mta|transit|line)\b/i,
    reply: () =>
      `Start + finish (Grant Park): **Red/Orange/Green Line to Roosevelt**, then walk into the park.\n\nClassic spot-hop: Red Line to **Grand** (mile 1.2) → Red/Brown to **Belmont** (mile 8.9) → Pink Line to **18th** (Pilsen, mile 19) → Red Line to **Cermak–Chinatown** (mile 21.4) → Roosevelt for the finish.\n\nFor each cheer zone, the spectator list on Family HQ shows the exact CTA line.`,
  },
  // Bib pickup / expo
  {
    match: /\b(bib|expo|pickup|pre.?race|packet)\b/i,
    reply: () =>
      `Bib pickup happens at the **Abbott Health & Fitness Expo at McCormick Place** (2301 S King Dr) on the Thursday–Saturday before race day. No race-day pickup — the runner must collect their own bib with photo ID. Check chicagomarathon.com for exact expo hours.`,
  },
  // After-party
  {
    match: /\b(after.?party|maimonides|beer.?garden|post.?race|food|cele[bb])/i,
    reply: () =>
      `The official **27th Mile Post-Race Party** is in Grant Park right past the finish — live music, food, and the famous Goose Island 312 beer tent. Don't forget — there's also a Venmo "🍺 Buy them a beer" button on Family HQ that goes straight to Catherine.`,
  },
  // Road closures / parking
  {
    match: /\b(road.?clos|parking|drive|car|street)\b/i,
    reply: () =>
      `Don't drive race-day. The Loop, Michigan Ave, and basically every street on the course are closed from ~5 AM to mid-afternoon. The CTA 'L' is the only sane way to spot-hop between cheer zones — get a Ventra day pass.`,
  },
  // What to bring
  {
    match: /\b(bring|gear|sign|water|snack|pack|wear)\b/i,
    reply: () =>
      `Spectator checklist:\n• Phone fully charged (live tracker uses it heavily — bring a power bank, it's a long morning)\n• Layers — October Chicago mornings start in the 40s\n• A bottle of water + snacks for yourself (you'll be out 4+ hours)\n• A sign with their name in big letters — they'll see it from 100m out\n• Their post-race jacket (they'll be freezing once they stop running)`,
  },
  // Race wake-up time
  {
    match: /\b(wake|alarm|when.*get.?up|early|morning)\b/i,
    reply: () =>
      `Race goes off at 7:30 AM CT (Wave 1 at 7:35). Runners need to be in their corrals by ~7:00, so they'll leave the hotel around 5:45. Spectators: be on the Red Line by 7:00 to catch them at State & Grand (mile 1.2) — or sleep in and start at Belmont (~8:30 for Wave 1 runners).`,
  },
  // Percentile lookup
  {
    match: /\b(percentile|rank|top.?\d+|where.*finish|how.*compare|field)\b/i,
    reply: () =>
      `Catherine's sub-3:05 target lands her in the **top ~3% of the women's field** at Chicago. Helaine's sub-4:00 puts her in the **top ~22% of all women** — and miles ahead of the 5:45 median for her 60–64 age group. Open the Stats tab → "Lookup any finish time" to test other times.`,
  },
  // Tour replay
  {
    match: /\b(tour|walkthrough|guide|how.*work|introduction)\b/i,
    reply: () =>
      `Click the **?** button in the top-right header to replay the 13-step guided tour. It hits every part of the app.`,
  },
  // Drag and drop tabs
  {
    match: /\b(rearrange|reorder|drag|move.?tab|order.?tab)\b/i,
    reply: () =>
      `Drag any tab in the top tab bar to reorder them — your preferred layout is remembered across sessions. On iPad / iPhone, long-press a tab then slide it.`,
  },
  // Who built this / about
  {
    match: /\b(who.?(made|built|wrote)|developer|leon|schulte|about|credit)\b/i,
    reply: () =>
      `Built by Leon Schulte with way too much love for his girlfriend's race. The whole stack is open at github.com/bjm6t4gjg5-netizen/blizzard-tracker. If you're feeling generous, there's a "🛠 Tip the dev" pill in the footer.`,
  },
  // Strava
  {
    match: /\b(strava|garmin|wahoo|watch|gps|recording)\b/i,
    reply: () =>
      `Catherine's Boston 2025 Strava trace is linked on her Career page (PR table → click the meet name). She's on a Garmin Forerunner 245.`,
  },
  // RTRT down / contingency
  {
    match: /\b(rtrt.?down|not.?work|broken|stuck|frozen|offline|stale)\b/i,
    reply: () =>
      `If live data freezes: tap the ↻ in the header to force a refresh. The client retries with timeouts, so it usually self-heals within a minute. As a last resort, the official Chicago Marathon app / app.rtrt.me tracker is the source of truth.`,
  },
  // Why "Blizzard"
  {
    match: /\b(why.?blizzard|name.?mean|family.?name|surname|last.?name)\b/i,
    reply: () =>
      `"Blizzard" is the family name — Catherine + Helaine Blizzard, mother and daughter, racing the same Chicago Marathon together. The lightning bolt ⚡ in the app's logo is a small tribute.`,
  },
  // Chicago Marathon history
  {
    match: /\b(history|years?.?run|how.?old|first.?chicago|chi.?start)\b/i,
    reply: () =>
      `The Chicago Marathon first ran in 1977 and is one of the six Abbott World Marathon Majors. ~52,000 finishers make it one of the largest marathons on Earth, and its flat course has produced multiple world records — most recently Kelvin Kiptum's 2:00:35 (2023) and Ruth Chepngetich's 2:09:56 (2024). 2026 is the 48th running.`,
  },
  // Course quirks
  {
    match: /\b(hill|climb|tough.?spot|hard.?part|where.?slow)\b/i,
    reply: () =>
      `Chicago has no real hills — the hard parts are different: **GPS dies in the Loop's canyons** (mile 1–2, trust the pace not the watch), **the wind** off the lake can own the day, the **quiet stretch miles 16–18** where crowds thin, and **"Mount Roosevelt"** — the course's only climb, cruelly placed 400m before the finish. The wall (miles 20–24) does the rest.`,
  },
  // Sub-90 difficulty
  {
    match: /\b(how.?hard|sub.?90.?mean|fast.?is.?fast|elite|top.?tier)\b/i,
    reply: () =>
      `Sub-3:05 at Chicago puts Catherine in the **top ~3% of the women's field** — and comfortably under the 3:23 Boston-qualifying standard for her age group. Her Boston 3:06:12 (7:06/mi) on a much harder course says the fitness is there; Chicago's flatness is worth a minute or two on its own.`,
  },
  // 6-Star history
  {
    match: /\b(6.?star|six.?star|world.?major.?club|wmm)\b/i,
    reply: () =>
      `The Abbott World Marathon Majors 6-Star is awarded to runners who finish all six: **Boston, NYC, Chicago, Berlin, London, Tokyo**. About 13,000 people total have completed it since the program began in 2006. Helaine is one Tokyo away.`,
  },
  // Grant Park trivia
  {
    match: /\b(grant.?park|buckingham|millennium|bean|lakefront|park|stadium)\b/i,
    reply: () =>
      `Grant Park — "Chicago's front yard" — hosts both the start and the finish. Buckingham Fountain sits mid-park, The Bean (Cloud Gate) is two blocks north in Millennium Park, and the lakefront trail runs the whole eastern edge. The 27th Mile Post-Race Party fills the south end after the race.`,
  },
  // Why is RTRT live vs Garmin different
  {
    match: /\b(rtrt.?vs|why.?different|garmin.?vs|gps.?off|distance.?off)\b/i,
    reply: () =>
      `RTRT updates come from timing mats embedded in the course every 5K — they're definitive but discrete. The runner's Garmin records continuously but adds GPS noise (typically 1–2% extra on 26.2, and worse in the Loop's skyscraper canyons). Between mats, this app *interpolates* RTRT position using the runner's recent average pace, which is why the marker glides smoothly.`,
  },
  // Heart rate / training nerdery
  {
    match: /\b(heart.?rate|hr|zone|threshold|vo2|tempo|interval|workout)\b/i,
    reply: () =>
      `Catherine's Boston 2025 logged an **avg HR of 179 bpm** over 3:06 — likely threshold-plus for her. Chicago's flatness means steadier effort: target ~168–172 bpm through 20 miles, then whatever it takes. Helaine paces more by feel than HR.`,
  },
  // What to eat / fueling
  {
    match: /\b(fuel|gel|food|eat|nutrition|breakfast|carb|hydrate)\b/i,
    reply: () =>
      `Marathon fueling is a different sport from the half: breakfast 3h pre-race (oatmeal + banana + coffee), then **a gel every 4–5 miles from mile 5** — that's 4–5 gels total, with caffeine in the back half. Water or Gatorade Endurance at every station (every ~1.5 miles). The race is won at the mile-18 fueling decision, not the finish kick. Nothing new on race day.`,
  },
  // Sleep / taper
  {
    match: /\b(taper|sleep|rest|tired|legs|fresh)\b/i,
    reply: () =>
      `Race-week wisdom: the sleep that matters most is **two nights before** (Thursday), because Friday-night nerves will probably steal some sleep. Easy 20–30 min jog on Friday, then nothing. Legs should feel a bit twitchy on race morning — that's normal.`,
  },
  // Weather strategy
  {
    match: /\b(if.?rain|if.?hot|if.?warm|warm.?race|hot.?race|cold.?race)\b/i,
    reply: () =>
      `**Rain**: no real time penalty for the runners — just slick painted lines. Spectators bring a poncho.\n**Heat (>70°F)**: rare in October but it's happened (2007 was brutal) — ~10–20 sec/mi slower target, drink at every station.\n**Wind**: the real Chicago variable. A lake headwind on Michigan Ave (miles 23–26) is soul-crushing — tuck into a group.\n**Cold (<45°F)**: throw-away gloves and layers at the start, perfect racing weather.`,
  },
  // Spectator chants
  {
    match: /\b(chant|cheer.?phrase|what.?yell|cheer.?word|encourag)\b/i,
    reply: () =>
      `Crowd-tested chants that actually work:\n• "**${" Looking strong ${name}! Stay relaxed!"}**" (personal + tactical)\n• "**You're on pace — KEEP IT**" (informational)\n• Avoid: "almost there!" if they're not (mile 6 is not "almost there")`,
  },
  // Course records
  {
    match: /\b(course.?record|fastest|winner|record)\b/i,
    reply: () =>
      `Chicago Marathon course records — both are **world records set right here**:\n• **Men:** Kelvin Kiptum, 2:00:35 (2023)\n• **Women:** Ruth Chepngetich, 2:09:56 (2024)\nFlat course + cool October mornings = the fastest big-city marathon on the calendar.`,
  },
  // Fun fact / random
  {
    match: /\b(fun.?fact|random|trivia|did.?you.?know|cool|interesting)\b/i,
    reply: () => {
      const facts = [
        `🍕 Marathoners burn ~2,600–3,400 calories over 26.2 — that's an **entire Lou Malnati's deep dish** worth.`,
        `🌆 The course passes through **29 Chicago neighborhoods** and never climbs more than ~30ft at once. Both current marathon world records were set on it.`,
        `⏱ At Catherine's sub-3:05 pace (7:03/mi), she completes each of the 26 miles in less time than a typical Spotify song plus its intro.`,
        `🚇 The Red Line tracks the course at four separate points — spectators can realistically see their runner 4–5 times in one morning.`,
        `🦄 Helaine has run more marathons (25) than there are CTA 'L' stations inside the Loop (there are 9).`,
        `📐 The course covers 42.195 km — by World Athletics certification, the blue line painted on the road is the *shortest legal path*. Every turn taken wide adds real distance.`,
        `🧀 Chicago's wall-zone aid is legendary: Pilsen hands out mariachi energy at mile 19 and Chinatown gives you dragon dancers at 21. Nobody walks through those.`,
        `🏆 Catherine has been undefeated at championships in 5th, 6th, and 8th grade. She skipped 7th grade only because she was in the older varsity division (and still placed top 4).`,
      ];
      return facts[Math.floor(Math.random() * facts.length)];
    },
  },
  // Comparison to other distances
  {
    match: /\b(marathon.?vs|half.?vs|5k.?vs|10k.?vs|compare.?distance)\b/i,
    reply: () =>
      `**Distance equivalence rules of thumb** (Riegel formula):\nIf you run a half in **X**, expect a marathon around **X × 2.1**. A ~1:30 half scales to a ~3:09 marathon — and Catherine has already run 3:06:12 at Boston on a much harder course. That's why sub-3:05 at flat Chicago is the right target, with sub-3:00 as the dream-day scenario.`,
  },
  // Helaine's marathon list
  {
    match: /\b(helaine.?races|her.?marathon|list.?marathon|all.?races)\b/i,
    reply: () =>
      `Helaine has raced 25 marathons since her first at Dallas White Rock 2006: 3× Boston, 3× NYC, Chicago, Berlin, London, Big Sur, 2× OKC, 2× Marine Corps, 2× Eugene, Mount Desert Island, plus 6 Dallas Whites & Metro PCS. Open her Career tab → "All 53 races" for the full table.`,
  },
  // Catherine's PRs
  {
    match: /\b(catherine.?pr|her.?best|her.?fastest|fastest.?time)\b/i,
    reply: () =>
      `Catherine's official PRs:\n• Marathon: **3:06:12** (Boston 2025, 7:06/mi)\n• 1600m: **5:46** (8th grade, City Meet)\n• 800m: **2:30** (8th grade)\n• XC 2-mile: **12:49** (8th grade championship)\n• 100m hurdles: **20.62** (7th grade)\n• Long jump: **13'06"** (8th grade)`,
  },
  // App architecture / nerd questions
  {
    match: /\b(tech.?stack|how.?built|framework|svelte|typescript)\b/i,
    reply: () =>
      `Built with Svelte 4 + TypeScript + Vite. Leaflet for the map, Chart.js for charts, Open-Meteo for the weather forecast. Source is open at github.com/bjm6t4gjg5-netizen/blizzard-tracker.`,
  },
  // Coach Dan about
  {
    match: /\b(who.?are.?you|coach.?dan|about.?you|are.?you.?ai)\b/i,
    reply: () =>
      `I'm Coach Dan — a canned race-day assistant in v3. Right now my answers are pattern-matched to a curated FAQ, but I'm wired to swap to a real LLM (Claude, GPT) in v4. Either way: I'm here to make race day less confusing. 😊`,
  },
  // Emergency
  {
    match: /\b(emergency|hurt|injur|medical|911|ambulance|drop.?out)\b/i,
    reply: () =>
      `If a runner needs help mid-race: Chicago has **21 aid stations**, each with a medical tent — roughly every 1.5 miles, clearly marked. Their bib has a phone number on the back. For non-medical issues, Chicago 311. For life-threatening, 911.`,
  },
  // Wave start times
  {
    match: /\b(wave|corral|start.?time|when.?start|gun.?time|stagger)\b/i,
    reply: () => {
      const ps = get(profiles);
      const lines = ps
        .filter(p => p.wave)
        .map(p => `• ${p.emoji} ${p.name.split(' ')[0]}: ${waveLabel(p, RACE_START)}`);
      const head = `The Chicago Marathon goes off in **three staggered waves** (all times CT):\n• Pros: 7:30 AM\n• Wave 1: 7:35 AM\n• Wave 2: 8:00 AM\n• Wave 3: 8:35 AM\n\nWithin each wave, corrals release ~2 min apart.`;
      const tail = lines.length ? `\n\n**Our runners:**\n${lines.join('\n')}` : '';
      return head + tail;
    },
  },
];

const FALLBACK = `I don't have a great answer for that yet. Try asking about pacing, cheer zones, weather, or the runners' records — or type "help" to see all topics.`;

function matchAnswer(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return FALLBACK;
  for (const t of TOPICS) {
    if (t.match.test(trimmed)) return t.reply();
  }
  return FALLBACK;
}

// ────────────────────────────────────────────────────────────
// Engine
// ────────────────────────────────────────────────────────────

export const cannedEngine: CoachEngine = {
  async ask(input: string): Promise<string> {
    // Tiny artificial delay — feels less robotic than instant replies.
    await new Promise(r => setTimeout(r, 350 + Math.random() * 400));
    return matchAnswer(input);
  },
};

// ────────────────────────────────────────────────────────────
// Quick-reply chip suggestions — shown above the input on first open.
// ────────────────────────────────────────────────────────────

export const QUICK_REPLIES: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: '🏃 Pacing',      prompt: 'What\'s the pacing strategy?' },
  { label: '📣 Cheer zones',  prompt: 'Where should I stand to cheer?' },
  { label: '🌤 Weather',      prompt: 'How\'s the race-day weather?' },
  { label: '🏆 Records',      prompt: 'Tell me about their records' },
  { label: '🎲 Fun fact',     prompt: 'Tell me a fun fact' },
  { label: '🍕 Fueling',      prompt: 'What should they eat before the race?' },
  { label: '🚇 Subway',       prompt: 'How do I get to the cheer zones?' },
  { label: '📲 Install',      prompt: 'How do I add this to my home screen?' },
];
