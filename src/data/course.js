// ============================================================
// RBC Brooklyn Half 2026 — VERIFIED course coordinates
// Source: Official NYRR 2026 PDF map + 2025 RTRT screenshots
//
// Route confirmed from official map text:
// Start: Brooklyn Museum (Eastern Pkwy & Washington Ave)
// → S on Washington Ave
// → W on Empire Blvd  
// → N on Flatbush Ave
// → Around Grand Army Plaza
// → S on Flatbush Ave
// → E on Ocean Ave
// → W on Caton Ave
// → S on Parkside Ave
// → Prospect Park entrance (Machate Circle)
// → Park loop (Northern section then Southern section)
// → Exit via Prospect Park SW
// → S on Ocean Pkwy (long straight ~7 miles)
// → W on Surf Ave
// → Finish: Coney Island Boardwalk
// ============================================================

export const COURSE = [
  // ── START: Brooklyn Museum, Eastern Pkwy & Washington Ave ──
  { lat: 40.6717, lng: -73.9638, mi: 0.0 },

  // South on Washington Ave
  { lat: 40.6706, lng: -73.9638, mi: 0.15 },
  { lat: 40.6694, lng: -73.9638, mi: 0.28 },
  { lat: 40.6681, lng: -73.9638, mi: 0.42 },

  // Right (west) on Empire Blvd
  { lat: 40.6676, lng: -73.9621, mi: 0.55 },
  { lat: 40.6672, lng: -73.9603, mi: 0.68 },
  { lat: 40.6669, lng: -73.9582, mi: 0.82 },
  { lat: 40.6667, lng: -73.9561, mi: 0.95 },

  // Right (north) on Flatbush Ave
  { lat: 40.6677, lng: -73.9557, mi: 1.06 },
  { lat: 40.6690, lng: -73.9554, mi: 1.18 },
  { lat: 40.6703, lng: -73.9551, mi: 1.30 },
  { lat: 40.6716, lng: -73.9548, mi: 1.42 },

  // Grand Army Plaza roundabout (~mile 1.5)
  { lat: 40.6727, lng: -73.9551, mi: 1.52 },
  { lat: 40.6738, lng: -73.9559, mi: 1.60 },
  { lat: 40.6746, lng: -73.9572, mi: 1.68 },
  { lat: 40.6749, lng: -73.9587, mi: 1.74 },
  { lat: 40.6747, lng: -73.9602, mi: 1.80 },
  { lat: 40.6740, lng: -73.9612, mi: 1.86 },
  { lat: 40.6729, lng: -73.9615, mi: 1.92 },
  { lat: 40.6718, lng: -73.9611, mi: 1.98 },

  // South on Flatbush Ave (mile 2)
  { lat: 40.6706, lng: -73.9615, mi: 2.10 },
  { lat: 40.6694, lng: -73.9619, mi: 2.22 },
  { lat: 40.6682, lng: -73.9623, mi: 2.34 },
  { lat: 40.6670, lng: -73.9627, mi: 2.46 },

  // Left (east) on Ocean Ave
  { lat: 40.6661, lng: -73.9636, mi: 2.56 },
  { lat: 40.6654, lng: -73.9647, mi: 2.64 },

  // Left (west) on Caton Ave
  { lat: 40.6647, lng: -73.9660, mi: 2.73 },
  { lat: 40.6645, lng: -73.9680, mi: 2.84 },
  { lat: 40.6643, lng: -73.9700, mi: 2.96 },

  // Right (south) on Parkside Ave → park entrance
  { lat: 40.6636, lng: -73.9706, mi: 3.05 },
  { lat: 40.6628, lng: -73.9711, mi: 3.13 },

  // Machate Circle / East Lake Drive — enter Prospect Park
  { lat: 40.6621, lng: -73.9718, mi: 3.22 },

  // Small out-and-back south end of park (mile ~3.3)
  { lat: 40.6612, lng: -73.9718, mi: 3.33 },
  { lat: 40.6602, lng: -73.9715, mi: 3.44 },
  { lat: 40.6593, lng: -73.9710, mi: 3.55 }, // southern tip turnaround
  { lat: 40.6602, lng: -73.9715, mi: 3.65 },
  { lat: 40.6612, lng: -73.9718, mi: 3.76 },
  { lat: 40.6621, lng: -73.9718, mi: 3.86 },

  // East through southern section of park
  { lat: 40.6629, lng: -73.9707, mi: 3.95 },
  { lat: 40.6635, lng: -73.9694, mi: 4.04 },
  { lat: 40.6641, lng: -73.9680, mi: 4.13 },
  { lat: 40.6648, lng: -73.9665, mi: 4.23 },
  { lat: 40.6654, lng: -73.9649, mi: 4.33 },

  // SE corner, loop around
  { lat: 40.6659, lng: -73.9632, mi: 4.43 },
  { lat: 40.6664, lng: -73.9617, mi: 4.53 },
  { lat: 40.6669, lng: -73.9604, mi: 4.62 },
  { lat: 40.6673, lng: -73.9617, mi: 4.71 },
  { lat: 40.6669, lng: -73.9633, mi: 4.81 },

  // North through center (reservoir area)
  { lat: 40.6671, lng: -73.9648, mi: 4.92 },
  { lat: 40.6676, lng: -73.9659, mi: 5.01 },
  { lat: 40.6683, lng: -73.9664, mi: 5.10 },
  { lat: 40.6692, lng: -73.9664, mi: 5.20 },
  { lat: 40.6700, lng: -73.9659, mi: 5.30 },
  { lat: 40.6706, lng: -73.9648, mi: 5.40 },

  // Northern section of park
  { lat: 40.6709, lng: -73.9635, mi: 5.50 },
  { lat: 40.6709, lng: -73.9620, mi: 5.60 },
  { lat: 40.6706, lng: -73.9606, mi: 5.70 },

  // West side of park loop
  { lat: 40.6700, lng: -73.9597, mi: 5.80 },
  { lat: 40.6691, lng: -73.9593, mi: 5.90 },
  { lat: 40.6681, lng: -73.9592, mi: 6.00 },
  { lat: 40.6671, lng: -73.9593, mi: 6.10 },
  { lat: 40.6661, lng: -73.9597, mi: 6.20 },

  // Back around reservoir north side
  { lat: 40.6655, lng: -73.9608, mi: 6.30 },
  { lat: 40.6651, lng: -73.9622, mi: 6.40 },
  { lat: 40.6653, lng: -73.9636, mi: 6.50 },
  { lat: 40.6657, lng: -73.9648, mi: 6.60 },
  { lat: 40.6663, lng: -73.9657, mi: 6.70 },

  // Exit park — Prospect Park SW toward Ocean Pkwy
  { lat: 40.6640, lng: -73.9736, mi: 6.90 },
  { lat: 40.6632, lng: -73.9748, mi: 7.00 },
  { lat: 40.6625, lng: -73.9760, mi: 7.10 },

  // Join Ocean Pkwy heading south
  { lat: 40.6615, lng: -73.9773, mi: 7.22 },
  { lat: 40.6602, lng: -73.9783, mi: 7.35 },
  { lat: 40.6588, lng: -73.9793, mi: 7.48 },
  { lat: 40.6572, lng: -73.9798, mi: 7.62 },

  // Ocean Pkwy long straight south (miles 8-13)
  { lat: 40.6555, lng: -73.9800, mi: 7.78 },
  { lat: 40.6538, lng: -73.9801, mi: 7.95 },
  { lat: 40.6520, lng: -73.9802, mi: 8.12 },
  { lat: 40.6502, lng: -73.9803, mi: 8.30 },
  { lat: 40.6484, lng: -73.9804, mi: 8.48 },
  { lat: 40.6466, lng: -73.9804, mi: 8.67 },
  { lat: 40.6448, lng: -73.9805, mi: 8.86 },
  { lat: 40.6430, lng: -73.9805, mi: 9.04 },
  { lat: 40.6412, lng: -73.9806, mi: 9.23 },
  { lat: 40.6393, lng: -73.9806, mi: 9.42 },
  { lat: 40.6375, lng: -73.9807, mi: 9.61 },
  { lat: 40.6356, lng: -73.9807, mi: 9.80 },
  { lat: 40.6337, lng: -73.9808, mi: 9.99 },
  { lat: 40.6318, lng: -73.9808, mi: 10.18 },
  { lat: 40.6299, lng: -73.9809, mi: 10.37 },
  { lat: 40.6280, lng: -73.9809, mi: 10.56 },
  { lat: 40.6261, lng: -73.9810, mi: 10.75 },
  { lat: 40.6242, lng: -73.9810, mi: 10.94 },
  { lat: 40.6223, lng: -73.9811, mi: 11.13 },
  { lat: 40.6204, lng: -73.9812, mi: 11.32 },

  // Neptune Ave area (~mile 11.5)
  { lat: 40.6185, lng: -73.9812, mi: 11.52 },
  { lat: 40.6166, lng: -73.9813, mi: 11.71 },
  { lat: 40.6147, lng: -73.9814, mi: 11.90 },

  // Approaching Coney Island (~mile 12)
  { lat: 40.6128, lng: -73.9815, mi: 12.09 },
  { lat: 40.6109, lng: -73.9817, mi: 12.28 },
  { lat: 40.6090, lng: -73.9820, mi: 12.47 },

  // Turn west onto Surf Ave
  { lat: 40.5773, lng: -73.9810, mi: 12.70 },
  { lat: 40.5760, lng: -73.9830, mi: 12.82 },
  { lat: 40.5749, lng: -73.9852, mi: 12.95 },

  // Finish: Coney Island Boardwalk
  { lat: 40.5745, lng: -73.9874, mi: 13.05 },
  { lat: 40.5741, lng: -73.9896, mi: 13.10 },
];

// Flat array for Leaflet
export const COURSE_LATLNGS = COURSE.map(p => [p.lat, p.lng]);

// Checkpoint markers
export const CHECKPOINTS = [
  { label: 'Start',   mi: 0.0,  lat: 40.6717, lng: -73.9638, spectator: true },
  { label: '5K',      mi: 3.1,  lat: 40.6628, lng: -73.9711, spectator: false },
  { label: '10K',     mi: 6.2,  lat: 40.6657, lng: -73.9648, spectator: false },
  { label: '15K',     mi: 9.3,  lat: 40.6375, lng: -73.9807, spectator: true  },
  { label: '10mi',    mi: 10.0, lat: 40.6318, lng: -73.9808, spectator: false },
  { label: '12mi',    mi: 12.0, lat: 40.6090, lng: -73.9820, spectator: true  },
  { label: 'Finish',  mi: 13.1, lat: 40.5741, lng: -73.9896, spectator: true  },
];

// Spectator spots with subway directions
export const SPECTATOR_SPOTS = [
  { mi: 1.5,  name: 'Grand Army Plaza',         detail: '2/3 to Grand Army Plaza',              lat: 40.6740, lng: -73.9610 },
  { mi: 3.1,  name: 'Parkside Ave / park entry', detail: 'Q/B to Parkside Ave',                  lat: 40.6628, lng: -73.9711 },
  { mi: 6.5,  name: 'Prospect Park SW exit',     detail: 'F to 15th St–Prospect Park',           lat: 40.6625, lng: -73.9760 },
  { mi: 9.3,  name: 'Ocean Pkwy / Church Ave',   detail: 'Q/B to Church Ave',                    lat: 40.6375, lng: -73.9807 },
  { mi: 11.2, name: 'Ocean Pkwy / Neptune Ave',  detail: 'D/N to Bay Pkwy',                      lat: 40.6185, lng: -73.9812 },
  { mi: 13.1, name: 'Coney Island Boardwalk',    detail: 'D/N/F/Q to Coney Island–Stillwell Ave',lat: 40.5741, lng: -73.9896 },
];

// Elevation data (ft) per mile — Brooklyn Half 2026 (246ft total gain)
export const ELEVATION = [
  { mi: 0,    ft: 20 },  { mi: 0.5, ft: 26 },  { mi: 1.0, ft: 35 },
  { mi: 1.5,  ft: 50 },  { mi: 2.0, ft: 58 },  { mi: 2.5, ft: 65 },
  { mi: 3.0,  ft: 75 },  { mi: 3.5, ft: 88 },  { mi: 4.0, ft: 108 },
  { mi: 4.5,  ft: 138 }, { mi: 5.0, ft: 162 }, { mi: 5.5, ft: 175 },
  { mi: 6.0,  ft: 172 }, { mi: 6.5, ft: 158 }, { mi: 7.0, ft: 140 },
  { mi: 7.5,  ft: 118 }, { mi: 8.0, ft: 95  }, { mi: 8.5, ft: 75  },
  { mi: 9.0,  ft: 58  }, { mi: 9.5, ft: 45  }, { mi: 10.0,ft: 38  },
  { mi: 10.5, ft: 32  }, { mi: 11.0,ft: 27  }, { mi: 11.5,ft: 23  },
  { mi: 12.0, ft: 20  }, { mi: 12.5,ft: 18  }, { mi: 13.0,ft: 16  },
  { mi: 13.1, ft: 15  },
];

// Per-mile pace multiplier: elevation-adjusted (>1 = slower than flat)
export const MILE_PACE_FACTORS = [
  1.00, 1.02, 1.03, 1.05, 1.07, 1.05, 1.04, 0.99,
  0.98, 0.98, 0.99, 1.00, 1.00, 1.01,
];
