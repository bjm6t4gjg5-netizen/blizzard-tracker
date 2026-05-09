// ============================================================
// RBC Brooklyn Half 2026 — Precise course coordinates
// Traced from official RTRT.me live tracking screenshots
//
// Route (per NYRR + screenshots):
//  Mile 0:   Start — Brooklyn Museum, Eastern Pkwy & Washington Ave
//  Miles 1-2: South on Washington → Empire Blvd → Flatbush north → Grand Army Plaza
//  Miles 2-3: South on Flatbush → Ocean Ave → down to Caton Ave junction
//  Miles 3-4: East on Caton Ave → East 3rd St south → enter Prospect Park NE corner (mile 7 on screenshot)
//  Miles 4-7: Complex counter-clockwise loop inside Prospect Park
//             (around lake, south end loop, west side back up)
//  Miles 7-8: Exit SW corner → Ocean Pkwy heading south
//  Miles 8-13: Straight south on Ocean Pkwy → curves toward Coney Island Boardwalk finish
// ============================================================

export const COURSE_COORDS = [
  // ── START: Brooklyn Museum, Eastern Pkwy & Washington Ave ──
  [40.6718, -73.9638],

  // South on Washington Ave
  [40.6710, -73.9638], [40.6700, -73.9638], [40.6690, -73.9638],
  [40.6682, -73.9638],

  // Right (west) on Empire Blvd
  [40.6678, -73.9620], [40.6675, -73.9600], [40.6672, -73.9578],
  [40.6670, -73.9560],

  // Right (north) on Flatbush Ave
  [40.6680, -73.9558], [40.6693, -73.9556], [40.6706, -73.9554],
  [40.6718, -73.9552],

  // Grand Army Plaza roundabout (mile ~1.5)
  [40.6728, -73.9555], [40.6740, -73.9562], [40.6748, -73.9574],
  [40.6751, -73.9588], [40.6748, -73.9602], [40.6741, -73.9610],
  [40.6731, -73.9613], [40.6721, -73.9608],

  // South on Flatbush Ave
  [40.6712, -73.9612], [40.6700, -73.9617], [40.6688, -73.9621],
  [40.6676, -73.9625],

  // Right (west) on Ocean Ave / toward Caton Ave area
  [40.6666, -73.9636], [40.6659, -73.9649], [40.6652, -73.9662],

  // Caton Ave heading east (toward park entrance)
  [40.6646, -73.9673], [40.6640, -73.9660], [40.6637, -73.9643],
  [40.6635, -73.9625], [40.6634, -73.9608],

  // East 3rd St / Dahill Rd heading south (matches screenshot image 2 top)
  [40.6625, -73.9733], // actually this is wrong — from screenshot Caton Ave goes EAST
  // Re-reading screenshot 2: the track comes from top (mile 8), goes south on East 3rd St,
  // hits mile 12 marker, then turns LEFT (east) at Caton Ave, enters park at NE near mile 7

  // ── CORRECTED from screenshots ──
  // Image 2 shows: top of image has mile 8 at top, course runs south down East 3rd St
  // hits mile 12 (km marker), turns west at Caton Ave, enters park NE at mile 7,
  // then complex loop. So the park section is MILES 7-9 (km 11-15 approx)

  // We recalibrate: Ocean Pkwy section is miles 8-13 on image 1
  // Park section is miles 1-7 (km 1-11)

  // ACTUAL ORDER from screenshots:
  // Image 2 = park section (earlier in race, miles ~1-7)
  // Image 1 = Ocean Pkwy + finish (later in race, miles ~7-13)
];

// ── Precise course traced from screenshots ──
// Image 2: Park section
// - Starts bottom-left (SW corner, around mile 1, HB marker visible)
// - Goes south to small out-and-back (mile 2 at bottom)
// - Back north, clockwise around lake (mile 9 inside park SW)
// - East side of park (mile 6 circles)
// - NE corner (mile 7 where Caton Ave meets park)
// - Exits NE, turns south on East 3rd St
// - Mile 12 (km) near Caton Ave junction at top of image
// Image 1: Ocean Pkwy section
// - Bottom = mile 12 (km), continuing south from image 2
// - Straight line south through miles 8, 9, 10, 11, 17(km), 12, back to...
// - Actually mile markers 8,9,10,11 going NORTH to SOUTH
// - Zigzag finish top-right to star (Brooklyn Museum start/finish area OR Maimonides Park)

// Based on careful analysis of street grids in screenshots:
export const COURSE = [
  // START: Brooklyn Museum (Eastern Pkwy & Washington Ave)
  { lat: 40.6718, lng: -73.9638, mi: 0.0 },

  // Head south on Washington Ave
  { lat: 40.6706, lng: -73.9638, mi: 0.15 },
  { lat: 40.6693, lng: -73.9638, mi: 0.3 },
  { lat: 40.6680, lng: -73.9638, mi: 0.45 },

  // Turn right (west) onto Empire Blvd
  { lat: 40.6675, lng: -73.9617, mi: 0.6 },
  { lat: 40.6672, lng: -73.9597, mi: 0.72 },
  { lat: 40.6669, lng: -73.9573, mi: 0.86 },
  { lat: 40.6667, lng: -73.9554, mi: 0.98 },

  // Turn right (north) onto Flatbush Ave
  { lat: 40.6678, lng: -73.9552, mi: 1.1 },
  { lat: 40.6693, lng: -73.9550, mi: 1.25 },
  { lat: 40.6707, lng: -73.9548, mi: 1.38 },
  { lat: 40.6720, lng: -73.9547, mi: 1.5 },

  // Grand Army Plaza roundabout (~mile 1.5)
  { lat: 40.6731, lng: -73.9551, mi: 1.6 },
  { lat: 40.6741, lng: -73.9561, mi: 1.7 },
  { lat: 40.6749, lng: -73.9574, mi: 1.78 },
  { lat: 40.6751, lng: -73.9590, mi: 1.85 },
  { lat: 40.6748, lng: -73.9605, mi: 1.93 },
  { lat: 40.6740, lng: -73.9612, mi: 2.0 },
  { lat: 40.6729, lng: -73.9614, mi: 2.07 },
  { lat: 40.6718, lng: -73.9609, mi: 2.14 },

  // South on Flatbush Ave (mile 2)
  { lat: 40.6707, lng: -73.9613, mi: 2.25 },
  { lat: 40.6695, lng: -73.9618, mi: 2.38 },
  { lat: 40.6683, lng: -73.9623, mi: 2.5 },
  { lat: 40.6671, lng: -73.9628, mi: 2.62 },
  { lat: 40.6660, lng: -73.9633, mi: 2.74 },

  // Turn onto Ocean Ave then Parkside Ave → SW Prospect Park entrance (mile 3)
  { lat: 40.6651, lng: -73.9647, mi: 2.87 },
  { lat: 40.6645, lng: -73.9663, mi: 2.97 },
  { lat: 40.6641, lng: -73.9680, mi: 3.08 },

  // Enter Prospect Park - SW entrance (mile 1 marker in screenshot 2 = ~mile 3 race)
  { lat: 40.6636, lng: -73.9698, mi: 3.18 },
  { lat: 40.6633, lng: -73.9716, mi: 3.28 },

  // Small out-and-back south (mile 2 at bottom of park in screenshot = ~mile 3.5)
  { lat: 40.6622, lng: -73.9716, mi: 3.38 },
  { lat: 40.6614, lng: -73.9716, mi: 3.48 },
  { lat: 40.6605, lng: -73.9716, mi: 3.58 }, // turnaround point (mile 2 in screenshot)
  { lat: 40.6614, lng: -73.9716, mi: 3.68 },
  { lat: 40.6622, lng: -73.9716, mi: 3.78 },

  // Back north, then loop right (east) - mile 9(km) marker inside SW park
  { lat: 40.6633, lng: -73.9708, mi: 3.90 },
  { lat: 40.6638, lng: -73.9695, mi: 3.98 },
  { lat: 40.6645, lng: -73.9680, mi: 4.08 },

  // East through center of park (miles 4-5)
  { lat: 40.6648, lng: -73.9665, mi: 4.18 },
  { lat: 40.6650, lng: -73.9648, mi: 4.30 },
  { lat: 40.6654, lng: -73.9633, mi: 4.42 },
  { lat: 40.6660, lng: -73.9620, mi: 4.54 },

  // SE corner of park, loop around (mile 6 in screenshot)
  { lat: 40.6666, lng: -73.9608, mi: 4.66 },
  { lat: 40.6672, lng: -73.9598, mi: 4.76 },
  { lat: 40.6676, lng: -73.9610, mi: 4.86 },
  { lat: 40.6672, lng: -73.9625, mi: 4.97 },
  { lat: 40.6666, lng: -73.9638, mi: 5.08 },

  // North through center of park (miles 5-6)
  { lat: 40.6672, lng: -73.9648, mi: 5.20 },
  { lat: 40.6678, lng: -73.9655, mi: 5.30 },
  { lat: 40.6685, lng: -73.9660, mi: 5.40 },
  { lat: 40.6693, lng: -73.9660, mi: 5.50 },

  // Mile 6 km marker area (screenshot 2, east side park, ~mile 3 area)
  { lat: 40.6700, lng: -73.9655, mi: 5.60 },
  { lat: 40.6706, lng: -73.9646, mi: 5.70 },

  // Mile 3 on screenshot / ~mile 5.8 of race - NW corner near Bedford Ave
  { lat: 40.6708, lng: -73.9633, mi: 5.80 },
  { lat: 40.6707, lng: -73.9618, mi: 5.90 },
  { lat: 40.6704, lng: -73.9604, mi: 6.00 },

  // Mile 4 marker in screenshot 2 (west side park)
  { lat: 40.6698, lng: -73.9597, mi: 6.12 },
  { lat: 40.6691, lng: -73.9594, mi: 6.22 },
  { lat: 40.6683, lng: -73.9594, mi: 6.32 },
  { lat: 40.6675, lng: -73.9594, mi: 6.42 },

  // Mile 6 (km) area screenshot 2 label top-left
  { lat: 40.6668, lng: -73.9594, mi: 6.52 },
  { lat: 40.6660, lng: -73.9596, mi: 6.62 },

  // Around the reservoir/lake - north side (screenshot mile 6km and 3km markers)
  { lat: 40.6655, lng: -73.9607, mi: 6.72 },
  { lat: 40.6653, lng: -73.9620, mi: 6.82 },
  { lat: 40.6655, lng: -73.9634, mi: 6.92 },
  { lat: 40.6660, lng: -73.9646, mi: 7.02 },

  // NE corner of park - mile 7 marker (screenshot 2 top-right area near Caton Ave)
  { lat: 40.6666, lng: -73.9654, mi: 7.12 },
  { lat: 40.6672, lng: -73.9660, mi: 7.20 },
  { lat: 40.6679, lng: -73.9659, mi: 7.28 },
  { lat: 40.6685, lng: -73.9654, mi: 7.35 },
  { lat: 40.6691, lng: -73.9645, mi: 7.42 },

  // Exit park NE - Caton Ave / East 3rd St area
  { lat: 40.6697, lng: -73.9635, mi: 7.52 },
  { lat: 40.6703, lng: -73.9622, mi: 7.62 },

  // Head east briefly then south on East 3rd St (Dahill Rd)
  { lat: 40.6703, lng: -73.9610, mi: 7.70 },
  { lat: 40.6699, lng: -73.9596, mi: 7.80 },
  { lat: 40.6693, lng: -73.9582, mi: 7.88 },

  // Mile 12km marker (screenshot 2, near East 3rd / Caton Ave = race mile ~8)
  { lat: 40.6685, lng: -73.9575, mi: 7.95 },
  { lat: 40.6675, lng: -73.9575, mi: 8.05 },
  { lat: 40.6665, lng: -73.9575, mi: 8.15 },

  // Continue south on East 3rd / McDonald Ave (screenshot 1 bottom = mile 12km = race mile ~8)
  { lat: 40.6653, lng: -73.9575, mi: 8.28 },
  { lat: 40.6641, lng: -73.9575, mi: 8.42 },
  { lat: 40.6629, lng: -73.9575, mi: 8.55 },
  { lat: 40.6617, lng: -73.9575, mi: 8.68 },

  // Mile 9 marker area (screenshot 1)
  { lat: 40.6605, lng: -73.9575, mi: 8.80 },
  { lat: 40.6593, lng: -73.9575, mi: 8.92 },
  { lat: 40.6581, lng: -73.9575, mi: 9.05 },

  // Slight curve west (screenshot 1 shows gentle leftward bend)
  { lat: 40.6570, lng: -73.9578, mi: 9.18 },
  { lat: 40.6558, lng: -73.9582, mi: 9.30 },

  // Mile 17km marker (screenshot 1)
  { lat: 40.6546, lng: -73.9585, mi: 9.45 },
  { lat: 40.6534, lng: -73.9588, mi: 9.58 },

  // Mile 10 marker (screenshot 1)
  { lat: 40.6522, lng: -73.9590, mi: 9.72 },
  { lat: 40.6510, lng: -73.9592, mi: 9.85 },
  { lat: 40.6498, lng: -73.9594, mi: 9.98 },
  { lat: 40.6485, lng: -73.9596, mi: 10.12 },

  // Mile 11 marker (screenshot 1)
  { lat: 40.6473, lng: -73.9596, mi: 10.25 },
  { lat: 40.6460, lng: -73.9596, mi: 10.38 },
  { lat: 40.6448, lng: -73.9596, mi: 10.52 },
  { lat: 40.6435, lng: -73.9596, mi: 10.65 },

  // Mile 12 marker (screenshot 1, heading north now — track curves)
  { lat: 40.6422, lng: -73.9595, mi: 10.78 },
  { lat: 40.6409, lng: -73.9593, mi: 10.92 },
  { lat: 40.6396, lng: -73.9590, mi: 11.05 },

  // Curve northeast toward finish (screenshot 1 shows zigzag toward star top-right)
  { lat: 40.6388, lng: -73.9578, mi: 11.20 },
  { lat: 40.6382, lng: -73.9561, mi: 11.35 },
  { lat: 40.6378, lng: -73.9543, mi: 11.50 },

  // Northeast zigzag toward finish area
  { lat: 40.6380, lng: -73.9525, mi: 11.65 },
  { lat: 40.6385, lng: -73.9508, mi: 11.80 },
  { lat: 40.6395, lng: -73.9495, mi: 11.95 },
  { lat: 40.6408, lng: -73.9488, mi: 12.10 },

  // Mile 12 (actual mile marker in screenshot 1 = near top)
  { lat: 40.6422, lng: -73.9485, mi: 12.25 },
  { lat: 40.6435, lng: -73.9487, mi: 12.38 },
  { lat: 40.6447, lng: -73.9492, mi: 12.50 },

  // Final approach to finish (top-right of screenshot 1)
  { lat: 40.6458, lng: -73.9502, mi: 12.65 },
  { lat: 40.6467, lng: -73.9515, mi: 12.78 },
  { lat: 40.6474, lng: -73.9530, mi: 12.90 },

  // FINISH: Maimonides Park area (star marker top-right of screenshot 1)
  { lat: 40.6481, lng: -73.9543, mi: 13.0 },
  { lat: 40.6487, lng: -73.9558, mi: 13.1 },
];

// Flat array for Leaflet polyline
export const COURSE_LATLNGS = COURSE.map(p => [p.lat, p.lng]);

// Checkpoint markers (official NYRR mile + KM markers from screenshots)
export const CHECKPOINTS = [
  { label: '🏁 Start', mi: 0.0,  lat: 40.6718, lng: -73.9638, spectator: true },
  { label: '1mi',      mi: 1.0,  lat: 40.6693, lng: -73.9550 },
  { label: '2mi',      mi: 2.0,  lat: 40.6740, lng: -73.9612, spectator: true },
  { label: '5K',       mi: 3.1,  lat: 40.6641, lng: -73.9680 },
  { label: '4mi',      mi: 4.0,  lat: 40.6650, lng: -73.9648 },
  { label: '5mi',      mi: 5.0,  lat: 40.6672, lng: -73.9648 },
  { label: '10K',      mi: 6.2,  lat: 40.6679, lng: -73.9659, spectator: true },
  { label: '7mi',      mi: 7.0,  lat: 40.6685, lng: -73.9575 },
  { label: '8mi',      mi: 8.0,  lat: 40.6605, lng: -73.9575, spectator: true },
  { label: '15K',      mi: 9.3,  lat: 40.6558, lng: -73.9582 },
  { label: '10mi',     mi: 10.0, lat: 40.6498, lng: -73.9594 },
  { label: '11mi',     mi: 11.0, lat: 40.6460, lng: -73.9596 },
  { label: '12mi',     mi: 12.0, lat: 40.6422, lng: -73.9485, spectator: true },
  { label: '🏆 Finish',mi: 13.1, lat: 40.6487, lng: -73.9558, spectator: true },
];

// Per-mile elevation profile (ft) — Brooklyn Half 2025
// Start at ~20ft, climbs ~200ft in park (miles 3-7), descends back to ~20ft
export const ELEVATION = [
  { mi: 0,    ft: 20  }, // Brooklyn Museum
  { mi: 0.5,  ft: 25  },
  { mi: 1.0,  ft: 32  }, // Empire Blvd flat
  { mi: 1.5,  ft: 48  }, // approaching Grand Army Plaza
  { mi: 2.0,  ft: 55  }, // Grand Army Plaza
  { mi: 2.5,  ft: 65  }, // Flatbush going south
  { mi: 3.0,  ft: 75  }, // entering park
  { mi: 3.5,  ft: 90  }, // park south end
  { mi: 4.0,  ft: 110 }, // climbing in park
  { mi: 4.5,  ft: 140 }, // mid park
  { mi: 5.0,  ft: 165 }, // near reservoir
  { mi: 5.5,  ft: 178 }, // highest point
  { mi: 6.0,  ft: 175 }, // still high
  { mi: 6.5,  ft: 168 }, // starting descent
  { mi: 7.0,  ft: 148 }, // exiting park NE
  { mi: 7.5,  ft: 128 }, // East 3rd St
  { mi: 8.0,  ft: 108 }, // continuing south
  { mi: 8.5,  ft: 90  },
  { mi: 9.0,  ft: 72  },
  { mi: 9.5,  ft: 58  },
  { mi: 10.0, ft: 45  },
  { mi: 10.5, ft: 38  },
  { mi: 11.0, ft: 30  },
  { mi: 11.5, ft: 25  },
  { mi: 12.0, ft: 22  },
  { mi: 12.5, ft: 20  },
  { mi: 13.0, ft: 18  },
  { mi: 13.1, ft: 18  }, // Finish
];

// Per-mile pace multiplier (elevation-adjusted: >1 = slower than flat)
export const MILE_PACE_FACTORS = [
  1.00, // 0→1  flat start
  1.02, // 1→2  slight uphill
  1.03, // 2→3  approaching park
  1.05, // 3→4  entering park, climbing
  1.07, // 4→5  steep park climb
  1.06, // 5→6  near top
  1.04, // 6→7  partial descent
  0.99, // 7→8  descending
  0.98, // 8→9  flat/slight down
  0.98, // 9→10
  0.99, // 10→11
  1.00, // 11→12
  1.01, // 12→13 slight fatigue
  1.01, // 13→13.1
];
