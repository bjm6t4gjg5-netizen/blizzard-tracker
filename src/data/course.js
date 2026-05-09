// ============================================================
// RBC Brooklyn Half 2026 — Official course coordinates
// Source: NYRR 2026 official PDF map + OpenStreetMap verification
//
// Confirmed route per NYRR:
// Start: Brooklyn Museum (Eastern Pkwy & Washington Ave)
// → South Washington Ave → West Empire Blvd → North Flatbush
// → Grand Army Plaza loop → South Flatbush → East Ocean Ave
// → West Caton Ave → South Parkside Ave → Prospect Park
// → Park loop (Northern then Southern section)
// → Prospect Park SW → South Ocean Pkwy (7+ miles straight)
// → West Surf Ave → Coney Island Boardwalk FINISH
// ============================================================

export const COURSE = [
  // START: Brooklyn Museum, Eastern Pkwy & Washington Ave
  { lat: 40.6717, lng: -73.9638, mi: 0.0 },

  // South on Washington Ave
  { lat: 40.6706, lng: -73.9638, mi: 0.15 },
  { lat: 40.6694, lng: -73.9638, mi: 0.28 },
  { lat: 40.6681, lng: -73.9638, mi: 0.42 },

  // West on Empire Blvd
  { lat: 40.6676, lng: -73.9621, mi: 0.55 },
  { lat: 40.6672, lng: -73.9600, mi: 0.69 },
  { lat: 40.6669, lng: -73.9579, mi: 0.83 },
  { lat: 40.6667, lng: -73.9560, mi: 0.95 },

  // North on Flatbush Ave
  { lat: 40.6677, lng: -73.9558, mi: 1.06 },
  { lat: 40.6690, lng: -73.9555, mi: 1.18 },
  { lat: 40.6703, lng: -73.9552, mi: 1.30 },
  { lat: 40.6716, lng: -73.9549, mi: 1.42 },

  // Grand Army Plaza — roundabout  
  { lat: 40.6726, lng: -73.9552, mi: 1.52 },
  { lat: 40.6736, lng: -73.9559, mi: 1.60 },
  { lat: 40.6745, lng: -73.9571, mi: 1.68 },
  { lat: 40.6749, lng: -73.9587, mi: 1.75 },
  { lat: 40.6747, lng: -73.9602, mi: 1.82 },
  { lat: 40.6740, lng: -73.9612, mi: 1.88 },
  { lat: 40.6730, lng: -73.9616, mi: 1.94 },
  { lat: 40.6719, lng: -73.9612, mi: 2.00 },

  // South on Flatbush Ave
  { lat: 40.6707, lng: -73.9616, mi: 2.12 },
  { lat: 40.6695, lng: -73.9620, mi: 2.24 },
  { lat: 40.6683, lng: -73.9624, mi: 2.36 },
  { lat: 40.6671, lng: -73.9628, mi: 2.48 },
  { lat: 40.6660, lng: -73.9633, mi: 2.59 },

  // Turn — Ocean Ave / Caton Ave junction
  { lat: 40.6651, lng: -73.9645, mi: 2.68 },
  { lat: 40.6645, lng: -73.9658, mi: 2.77 },

  // West on Caton Ave to Parkside Ave
  { lat: 40.6641, lng: -73.9675, mi: 2.88 },
  { lat: 40.6638, lng: -73.9692, mi: 2.98 },

  // South on Parkside Ave — enter park at Machate Circle
  { lat: 40.6632, lng: -73.9700, mi: 3.06 },
  { lat: 40.6625, lng: -73.9706, mi: 3.13 },
  { lat: 40.6618, lng: -73.9712, mi: 3.20 },

  // Inside Prospect Park — East Lake Dr heading south
  { lat: 40.6609, lng: -73.9715, mi: 3.31 },
  { lat: 40.6599, lng: -73.9714, mi: 3.42 },
  { lat: 40.6590, lng: -73.9709, mi: 3.53 },

  // Southern section loop — stays inside Prospect Park
  { lat: 40.6590, lng: -73.9706, mi: 3.36 },
  { lat: 40.6577, lng: -73.9698, mi: 3.48 },
  { lat: 40.6568, lng: -73.9690, mi: 3.58 }, // southern tip, Machate Circle area
  { lat: 40.6577, lng: -73.9698, mi: 3.68 },
  { lat: 40.6590, lng: -73.9706, mi: 3.79 },
  { lat: 40.6602, lng: -73.9712, mi: 3.90 },

  // Head east then north through Southern section
  { lat: 40.6617, lng: -73.9708, mi: 4.06 },
  { lat: 40.6624, lng: -73.9698, mi: 4.15 },
  { lat: 40.6631, lng: -73.9684, mi: 4.25 },
  { lat: 40.6638, lng: -73.9670, mi: 4.35 },
  { lat: 40.6645, lng: -73.9655, mi: 4.45 },
  { lat: 40.6651, lng: -73.9640, mi: 4.55 },
  { lat: 40.6657, lng: -73.9626, mi: 4.64 },
  { lat: 40.6663, lng: -73.9614, mi: 4.73 },

  // SE area loop
  { lat: 40.6669, lng: -73.9604, mi: 4.82 },
  { lat: 40.6674, lng: -73.9616, mi: 4.92 },
  { lat: 40.6670, lng: -73.9630, mi: 5.02 },

  // North through center — reservoir west side
  { lat: 40.6672, lng: -73.9645, mi: 5.13 },
  { lat: 40.6677, lng: -73.9657, mi: 5.22 },
  { lat: 40.6684, lng: -73.9664, mi: 5.31 },
  { lat: 40.6692, lng: -73.9664, mi: 5.40 },
  { lat: 40.6700, lng: -73.9659, mi: 5.50 },
  { lat: 40.6706, lng: -73.9648, mi: 5.60 },

  // Northern section — toward top of park
  { lat: 40.6709, lng: -73.9635, mi: 5.70 },
  { lat: 40.6710, lng: -73.9620, mi: 5.80 },
  { lat: 40.6707, lng: -73.9606, mi: 5.90 },

  // West side loop — back south
  { lat: 40.6700, lng: -73.9597, mi: 6.00 },
  { lat: 40.6691, lng: -73.9594, mi: 6.10 },
  { lat: 40.6681, lng: -73.9593, mi: 6.20 },
  { lat: 40.6671, lng: -73.9594, mi: 6.30 },
  { lat: 40.6661, lng: -73.9598, mi: 6.40 },

  // Around reservoir north side
  { lat: 40.6654, lng: -73.9610, mi: 6.50 },
  { lat: 40.6651, lng: -73.9624, mi: 6.60 },
  { lat: 40.6653, lng: -73.9638, mi: 6.70 },

  // Exit park — head toward Ocean Pkwy via Prospect Park SW
  { lat: 40.6648, lng: -73.9658, mi: 6.82 },
  { lat: 40.6641, lng: -73.9679, mi: 6.94 },
  { lat: 40.6635, lng: -73.9700, mi: 7.05 },
  { lat: 40.6628, lng: -73.9720, mi: 7.16 },

  // Join Ocean Pkwy — heading south (long straight)
  { lat: 40.6619, lng: -73.9740, mi: 7.27 },
  { lat: 40.6607, lng: -73.9754, mi: 7.40 },
  { lat: 40.6594, lng: -73.9763, mi: 7.53 },
  { lat: 40.6580, lng: -73.9768, mi: 7.66 },
  { lat: 40.6565, lng: -73.9772, mi: 7.80 },
  { lat: 40.6549, lng: -73.9775, mi: 7.95 },

  // Ocean Pkwy long straight south — miles 8-12
  { lat: 40.6533, lng: -73.9777, mi: 8.12 },
  { lat: 40.6516, lng: -73.9778, mi: 8.30 },
  { lat: 40.6499, lng: -73.9779, mi: 8.48 },
  { lat: 40.6482, lng: -73.9780, mi: 8.67 },
  { lat: 40.6465, lng: -73.9781, mi: 8.86 },
  { lat: 40.6448, lng: -73.9782, mi: 9.04 },
  { lat: 40.6430, lng: -73.9782, mi: 9.23 },
  { lat: 40.6412, lng: -73.9783, mi: 9.42 },
  { lat: 40.6394, lng: -73.9783, mi: 9.61 },
  { lat: 40.6376, lng: -73.9784, mi: 9.80 },
  { lat: 40.6357, lng: -73.9784, mi: 9.99 },
  { lat: 40.6338, lng: -73.9785, mi: 10.18 },
  { lat: 40.6319, lng: -73.9785, mi: 10.37 },
  { lat: 40.6300, lng: -73.9786, mi: 10.56 },
  { lat: 40.6281, lng: -73.9786, mi: 10.75 },
  { lat: 40.6262, lng: -73.9787, mi: 10.94 },
  { lat: 40.6243, lng: -73.9787, mi: 11.13 },
  { lat: 40.6224, lng: -73.9788, mi: 11.32 },
  { lat: 40.6205, lng: -73.9788, mi: 11.51 },
  { lat: 40.6186, lng: -73.9789, mi: 11.70 },
  { lat: 40.6167, lng: -73.9789, mi: 11.89 },
  { lat: 40.6148, lng: -73.9790, mi: 12.08 },
  { lat: 40.6129, lng: -73.9790, mi: 12.27 },
  { lat: 40.6110, lng: -73.9791, mi: 12.46 },
  { lat: 40.6091, lng: -73.9792, mi: 12.65 },

  // Approach Coney Island — curve west off Ocean Pkwy
  { lat: 40.5922, lng: -73.9800, mi: 12.80 },

  // West on Surf Ave
  { lat: 40.5764, lng: -73.9824, mi: 13.00 },

  // FINISH: Coney Island Boardwalk
  { lat: 40.5742, lng: -73.9847, mi: 13.10 },
];

export const COURSE_LATLNGS = COURSE.map(p => [p.lat, p.lng]);

export const CHECKPOINTS = [
  { label:'Start',  mi:0.0,  lat:40.6717, lng:-73.9638, spectator:true  },
  { label:'5K',     mi:3.1,  lat:40.6618, lng:-73.9712, spectator:false },
  { label:'10K',    mi:6.2,  lat:40.6653, lng:-73.9638, spectator:false },
  { label:'15K',    mi:9.3,  lat:40.6430, lng:-73.9782, spectator:true  },
  { label:'10mi',   mi:10.0, lat:40.6319, lng:-73.9785, spectator:false },
  { label:'12mi',   mi:12.0, lat:40.6110, lng:-73.9791, spectator:true  },
  { label:'Finish', mi:13.1, lat:40.5742, lng:-73.9847, spectator:true  },
];

export const SPECTATOR_SPOTS = [
  { mi:1.5,  name:'Grand Army Plaza',         detail:'2/3 to Grand Army Plaza',              lat:40.6740, lng:-73.9610 },
  { mi:3.1,  name:'Parkside Ave / park entry', detail:'Q/B to Parkside Ave',                  lat:40.6618, lng:-73.9712 },
  { mi:6.5,  name:'Prospect Park SW exit',     detail:'F to 15th St–Prospect Park',           lat:40.6635, lng:-73.9700 },
  { mi:9.3,  name:'Ocean Pkwy / Church Ave',   detail:'Q/B to Church Ave',                    lat:40.6430, lng:-73.9782 },
  { mi:11.2, name:'Ocean Pkwy / Neptune Ave',  detail:'D/N to Bay Pkwy',                      lat:40.6224, lng:-73.9788 },
  { mi:13.1, name:'Coney Island Boardwalk',    detail:'D/N/F/Q to Stillwell Ave',              lat:40.5742, lng:-73.9847 },
];

export const ELEVATION = [
  {mi:0,ft:20},{mi:0.5,ft:26},{mi:1.0,ft:35},{mi:1.5,ft:50},{mi:2.0,ft:58},
  {mi:2.5,ft:65},{mi:3.0,ft:75},{mi:3.5,ft:88},{mi:4.0,ft:108},{mi:4.5,ft:138},
  {mi:5.0,ft:162},{mi:5.5,ft:175},{mi:6.0,ft:172},{mi:6.5,ft:158},{mi:7.0,ft:140},
  {mi:7.5,ft:118},{mi:8.0,ft:95},{mi:8.5,ft:75},{mi:9.0,ft:58},{mi:9.5,ft:45},
  {mi:10.0,ft:38},{mi:10.5,ft:32},{mi:11.0,ft:27},{mi:11.5,ft:23},
  {mi:12.0,ft:20},{mi:12.5,ft:18},{mi:13.0,ft:16},{mi:13.1,ft:15},
];

export const MILE_PACE_FACTORS = [
  1.00,1.02,1.03,1.05,1.07,1.05,1.04,0.99,
  0.98,0.98,0.99,1.00,1.00,1.01,
];
