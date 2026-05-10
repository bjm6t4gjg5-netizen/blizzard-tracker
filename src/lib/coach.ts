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
  return `Race-morning forecast (7 AM ET): ${icon.icon} ${Math.round(r.tempF)}°F, ${icon.label.toLowerCase()}, ${r.precipPct}% rain, ${Math.round(r.windMph)} mph wind. ${impact.text}.`;
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
      `Catherine's goal is **sub-1:30** — about 6:52/mi flat-equivalent. With Brooklyn's mid-park climb (miles 4–7) the per-mile targets are ~7:05 (mi 1) → 6:50 (mi 3) → 6:55 (mi 5) → 6:55 (mi 7) → 6:50 (mi 10) → 6:30 finish kick.\n\nHelaine's goal is **sub-2:10** — about 9:55/mi flat-equivalent.\n\nEither runner's settings (⚙ on the runner card) lets you tweak any of those splits.`,
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
      `13.1 miles: **Brooklyn Museum → Grand Army Plaza → Prospect Park (north then south) → Ocean Parkway southbound → Surf Ave → W 10th St → Coney Island Boardwalk finish**. ${TOTAL_GAIN_FT}ft total elevation gain. The hills are mostly miles 3–7 in the park; Ocean Pkwy is a long downhill straight.`,
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
      `Footer → "Developer" → enter the password to unlock the 🛠 race-day simulator in the header. Drag the time slider (6:30 AM → 10:30 AM) or click a preset like "Wave 3 gun" or "Cat finishing". Each runner's position is computed from their own wave/corral start, so Catherine and Helaine show at different mile positions for the same simulated minute — exactly what you'd see on race day.`,
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
      `Start (Brooklyn Museum, 7 AM): take the **2/3 to Grand Army Plaza** or **B/Q to Prospect Park**.\n\nFinish (Coney Island Boardwalk): **D/F/N/Q to Stillwell Ave**.\n\nFor each cheer zone, the spectator list on Family HQ shows the exact subway line.`,
  },
  // Bib pickup / expo
  {
    match: /\b(bib|expo|pickup|pre.?race|packet)\b/i,
    reply: () =>
      `Bib pickup happens at the NYRR RUNCENTER (320 W 57th St, Manhattan) in the days before the race. Check the official RBC Brooklyn Half page on nyrr.org for the exact pickup window — usually Wed–Fri before race day, 11 AM to 7 PM.`,
  },
  // After-party
  {
    match: /\b(after.?party|maimonides|beer.?garden|post.?race|food|cele[bb])/i,
    reply: () =>
      `The official after-party is at **Maimonides Park** right by the finish on the Coney Island Boardwalk. Live music, food, drinks. Don't forget — there's also a Venmo "🍺 Buy them a beer" button on Family HQ that goes straight to Catherine.`,
  },
  // Road closures / parking
  {
    match: /\b(road.?clos|parking|drive|car|street)\b/i,
    reply: () =>
      `Don't drive race-day. Eastern Pkwy, Ocean Pkwy, and Surf Ave are all closed from ~5 AM to noon. The subway is the only sane way to spot-hop between cheer zones.`,
  },
  // What to bring
  {
    match: /\b(bring|gear|sign|water|snack|pack|wear)\b/i,
    reply: () =>
      `Spectator checklist:\n• Phone fully charged (live tracker uses it heavily)\n• Sunscreen + hat — Ocean Pkwy is exposed\n• A bottle of water for yourself\n• A sign with their name in big letters — they'll see it from 100m out\n• Their post-race jacket (they'll be cold once they stop running)`,
  },
  // Race wake-up time
  {
    match: /\b(wake|alarm|when.*get.?up|early|morning)\b/i,
    reply: () =>
      `Race goes off at 7:00 AM ET. If you're heading to the start, leave Manhattan/Brooklyn by 5:30 AM. If you're only catching them mid-course (Machate Circle ~7:45 AM, Ocean Pkwy ~8:15 AM), 6:30 AM works.`,
  },
  // Percentile lookup
  {
    match: /\b(percentile|rank|top.?\d+|where.*finish|how.*compare|field)\b/i,
    reply: () =>
      `Catherine's sub-90 target lands her in the **top ~3% of the women's field** at the RBC Brooklyn Half. Helaine's sub-1:50 puts her in the **top ~20%**. Open the Stats tab → "Lookup any finish time" to test other times.`,
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
      `If live data freezes: tap the ↻ in the header to force a refresh. If that doesn't help, the tracker has three CORS-proxy fallbacks and exponential-backoff retry, so it usually self-heals within a minute. As a last resort, NYRR's official tracker at rtrt.me/bkh2026 is the source of truth.`,
  },
  // Why "Blizzard"
  {
    match: /\b(why.?blizzard|name.?mean|family.?name|surname|last.?name)\b/i,
    reply: () =>
      `"Blizzard" is the family name — Catherine + Helaine Blizzard, mother and daughter, racing the same Brooklyn Half together. The lightning bolt ⚡ in the app's logo is a small tribute.`,
  },
  // Brooklyn Half history
  {
    match: /\b(history|years?.?run|how.?old|first.?brooklyn|bkh.?start)\b/i,
    reply: () =>
      `The Brooklyn Half first ran in 1981 — NYC's oldest half marathon. RBC took over title sponsorship in 2014. Roughly 28,000 finishers each year, making it the largest half in the US. The course has been Brooklyn-Museum-to-Coney-Island since 2006.`,
  },
  // Course quirks
  {
    match: /\b(hill|climb|tough.?spot|hard.?part|where.?slow)\b/i,
    reply: () =>
      `The single hardest stretch is **miles 3 → 7 inside Prospect Park**: ~120ft net gain, twisty roads, false flats. Plan to give 5–10 seconds per mile back here and earn it back on **Ocean Pkwy (miles 7 → 12)** — a 7-mile-long gentle downhill straight. The finish at Coney Island is sea-level and flat.`,
  },
  // Sub-90 difficulty
  {
    match: /\b(how.?hard|sub.?90.?mean|fast.?is.?fast|elite|top.?tier)\b/i,
    reply: () =>
      `Sub-90 at the Brooklyn Half puts Catherine in the **top ~3% of the women's field**. That's elite-club territory — typical sub-90 women have 3:00ish marathon range and ~18:00 5K range. Catherine's 5:46 1600m PR (8th grade!) and Boston 3:06:12 (7:06/mi) put her right in the conversation.`,
  },
  // 6-Star history
  {
    match: /\b(6.?star|six.?star|world.?major.?club|wmm)\b/i,
    reply: () =>
      `The Abbott World Marathon Majors 6-Star is awarded to runners who finish all six: **Boston, NYC, Chicago, Berlin, London, Tokyo**. About 13,000 people total have completed it since the program began in 2006. Helaine is one Tokyo away.`,
  },
  // Maimonides Park trivia
  {
    match: /\b(maimonides|coney.?island|park|stadium|brooklyn.?cyclones)\b/i,
    reply: () =>
      `Maimonides Park (where the finish line is) is home to the Brooklyn Cyclones, the Mets' Class-A minor league affiliate. From the boardwalk you can see the Cyclone roller coaster, the Wonder Wheel, and (on a clear day) the Verrazzano Bridge. The after-party fills the ballpark concourse.`,
  },
  // Why is RTRT live vs Garmin different
  {
    match: /\b(rtrt.?vs|why.?different|garmin.?vs|gps.?off|distance.?off)\b/i,
    reply: () =>
      `RTRT updates come from timing mats embedded in the course every 5K — they're definitive but discrete. The runner's Garmin records continuously but adds GPS noise (typically 1–2% extra distance on a 13.1). Between mats, this app *interpolates* RTRT position using the runner's recent average pace, which is why the marker glides smoothly.`,
  },
  // Heart rate / training nerdery
  {
    match: /\b(heart.?rate|hr|zone|threshold|vo2|tempo|interval|workout)\b/i,
    reply: () =>
      `Catherine's Boston 2025 logged an **avg HR of 179 bpm** over 3:06 — likely threshold-plus for her. For Sunday she'll target ~170–175 bpm on the climbs, drop into ~165 on Ocean Pkwy, and kick whatever's left into the finish. Helaine paces more by feel than HR.`,
  },
  // What to eat / fueling
  {
    match: /\b(fuel|gel|food|eat|nutrition|breakfast|carb|hydrate)\b/i,
    reply: () =>
      `Standard half-marathon fueling: light breakfast 2–3h pre-race (oatmeal + banana), 1–2 caffeinated gels during (one before mile 4, one before mile 9), sip water at each station (every ~1.5 miles). Avoid anything new on race day.`,
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
      `**Rain**: no real time penalty for the runners — just slick painted lines. Spectators bring a poncho.\n**Heat (>70°F)**: ~10–20 sec/mi slower target, drink at every station, watch for shade on Ocean Pkwy (there isn't much).\n**Cold (<45°F)**: throw-away gloves at the start, perfect racing weather.`,
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
      `Brooklyn Half course records:\n• **Men:** Belete Assefa, 1:00:48 (2024)\n• **Women:** Senbere Teferi, 1:08:01 (2024)\nMost RBC Brooklyn Half winners go on to elite NYC Marathon performances.`,
  },
  // Fun fact / random
  {
    match: /\b(fun.?fact|random|trivia|did.?you.?know|cool|interesting)\b/i,
    reply: () => {
      const facts = [
        `🍕 Brooklyn Half runners reportedly burn ~1,700 calories — roughly **two slices of NY pizza** worth.`,
        `🏃 The race start line is 200m from the Brooklyn Museum's front steps. The finish is 5m from the Atlantic Ocean. **Sea level to sea level**, 246ft of bumps in between.`,
        `⏱ At Catherine's sub-90 pace (6:52/mi), she completes a mile in less time than a typical Spotify song.`,
        `🚇 The N train passes within 100m of the finish line. You could literally hop off the train at the runner.`,
        `🦄 Helaine has run more marathons (25) than there are subway lines in NYC (24 numbered/lettered services).`,
        `📐 The course covers 21.0975 km — by USATF certification, the difference between that and a "true" 13.1 miles is **less than the length of your shoe**.`,
        `🎂 Catherine's birthday is in May 1998. Her first 13.1 was longer ago than she's been an adult.`,
        `🏆 Catherine has been undefeated at championships in 5th, 6th, and 8th grade. She skipped 7th grade only because she was in the older varsity division (and still placed top 4).`,
      ];
      return facts[Math.floor(Math.random() * facts.length)];
    },
  },
  // Comparison to other distances
  {
    match: /\b(marathon.?vs|half.?vs|5k.?vs|10k.?vs|compare.?distance)\b/i,
    reply: () =>
      `**Distance equivalence rules of thumb** (Riegel formula):\nIf you run a 5K in **X**, expect a half at **X × 4.7** and a marathon at **X × 10**. Catherine's 5:46 1600m would scale to ~3:00 marathon — close to her actual 3:06. Half-marathon should land around 1:25–1:28 for her at peak fitness, which is why sub-90 is realistic.`,
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
      `If a runner needs help mid-race: medical tents are at miles 3, 7, 9, 11, and the finish — clearly marked. Their bib has a phone number on the back. For non-medical emergencies, NYC 311. For life-threatening, 911.`,
  },
  // Wave start times
  {
    match: /\b(wave|corral|start.?time|when.?start|gun.?time|stagger)\b/i,
    reply: () => {
      const ps = get(profiles);
      const lines = ps
        .filter(p => p.wave)
        .map(p => `• ${p.emoji} ${p.name.split(' ')[0]}: ${waveLabel(p, RACE_START)}`);
      const head = `RBC Brooklyn Half goes off in **four staggered waves**:\n• Wave 1: 7:00 AM\n• Wave 2: 7:25 AM\n• Wave 3: 7:50 AM\n• Wave 4: 8:15 AM\n\nWithin each wave, corrals release ~2 min apart.`;
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
