// COBO Compliance Boards configurator - config
// Everything a non-coder would want to tweak lives in this file.
// Units are INCHES everywhere.

// ---- Standard sizes (shorter side x longer side) and prices from complianceboards.com ----
export const SIZES = [
  { id: '6x12',  a: 6,  b: 12, price: 35.95 },
  { id: '12x12', a: 12, b: 12, price: 54.95 },
  { id: '12x24', a: 12, b: 24, price: 89.95 },
  { id: '12x36', a: 12, b: 36, price: 134.95 },
  { id: '24x24', a: 24, b: 24, price: 185.95 },
  { id: '24x36', a: 24, b: 36, price: 269.95 },
];

// Custom board limits (site says: any size within 48" x 96")
export const CUSTOM = { min: 6, maxShort: 48, maxLong: 96 };

// ---- Board face + edge-banding colors ----
// NOTE: the website says "10 colors" but only lists 7 (+ a light blue in image filenames).
// Add the missing ones here: { name, hex }.  Names must match the Shopify variant names.
export const COLORS = [
  { name: 'Black',              hex: '#141414' },
  { name: 'White',              hex: '#f3f2ee' },
  { name: 'Red',                hex: '#b3151c' },
  { name: 'Forest Green',       hex: '#1d5a3a' },
  { name: 'Orange',             hex: '#e7700b' },
  { name: 'Yellow',             hex: '#f1c40f' },
  { name: 'Light Blue',         hex: '#79b0d8' },
  { name: 'Raw (unfinished)',   hex: '#b8956a' },
];

// ---- Fastener (1" dia aluminum cap) finishes ----
export const FASTENERS = [
  { id: 'alum',   name: 'Brushed Aluminum', color: '#c8cbd0', metal: 1.0, rough: 0.42, brushed: true },
  { id: 'chrome', name: 'Brushed Chrome',   color: '#eef0f2', metal: 1.0, rough: 0.24, brushed: true },
  { id: 'black',  name: 'Gloss Black',      color: '#0b0b0c', metal: 0.65, rough: 0.12, brushed: false },
];

// Viewer background (the wall behind the board in the 3D preview; not part of the product)
export const WALLS = [
  { name: 'White',      hex: '#ffffff' },
  { name: 'Greige',     hex: '#b9b2a6' },
  { name: 'Charcoal',   hex: '#3a3c40' },
];

// ---- Sample certificates shown under the acrylic (preview only) ----
// The viewer fits as many as it can, keeping clear of the edges and the 4 caps.
export const SHEETS = {
  sizes: [[8.5, 11], [5, 7], [4, 6], [3, 5]],  // first = the real certificate size; the rest are fallbacks for boards too small for it
  edgeMargin: 0.375,     // minimum space between a certificate and the board edge
  gaps: [1, 0.75, 0.5],  // space between certificates to try, largest first
  capClearance: 0.125,   // keep certificates this far from the edge of each 1" cap
  titles: ['Certificate of Compliance', 'Business License', 'Certificate of Inspection', 'Certificate of Occupancy',
           'Fire Safety Inspection', 'Health Permit', 'Elevator Certificate', 'Operating Permit'],
};

// ---- Uploaded artwork, both printed on the board face: background image (behind) and logo (in front) ----
// size = width of one copy of the image, in inches. gap = space between copies. offsetMax = range of the move sliders.
export const ARTWORK = {
  logo:       { layout: 'single', size: 6,  sizeMin: 0.5, sizeMax: 24, gap: 1, gapMax: 12, offsetMax: 24 },
  background: { layout: 'cover',  size: 12, sizeMin: 1,   sizeMax: 96, gap: 0, gapMax: 24, offsetMax: 48 },
  maxUploadPx: 2048,   // uploads are shrunk to this many pixels on the long side
  maxTexPx: 2048,      // largest texture made for one repeat of the pattern
};

// ---- Hardware dimensions (match the Fusion 360 master COBO-Board-Master) ----
export const HW = {
  boardT: 0.75,        // total thickness (back laminate + MDO core + front laminate)
  lamT: 0.03,          // laminate skin
  bandT: 1 / 25.4,     // 1 mm PVC edge banding
  acrylicT: 0.1875,    // 3/16"
  sheetGap: 0.0625,    // allowance for compliance sheets under the acrylic
  capDia: 1.0,
  capT: 0.25,
  inset: 1.0,          // fastener center to each edge
  studDia: 6 / 25.4,   // M6
  studLen: 1.0,
  tnutBarrelDia: 10 / 25.4,
  tnutFlangeDia: 0.75,
  tnutFlangeT: 0.05,
  tnutBarrelLen: 0.55,
  recessDia: 0.8,
  recessDepth: 0.0625,
  clipT: 0.0625,
  clipFlange: 1.25,
  clipLip: 0.75,
  clipDepth: 0.4,
  clipTopInset: 3,
  clipEndInsetBig: 2,    // boards 12" wide and up
  clipEndInsetSmall: 1.5 // boards under 12" wide
};

// ---- Shopify hand-off ----
// The viewer runs in an iframe (GitHub Pages). "Add to cart" posts a message to the Shopify page,
// which adds the variant via /cart/add.js (see shopify/cobo-configurator-embed.liquid).
// Fill in variant IDs as: variantIds['12x24']['Black'] = 41269695348811
// (12x24 IDs below came from the live site's product JSON; the other sizes still need theirs.)
export const SHOPIFY = {
  messageType: 'cobo:add-to-cart',
  variantIds: {
    '12x24': {
      'Black': 41269695348811,
      'White': 41269695381579,
      'Red': 41269695414347,
      'Forest Green': 41269695447115,
      'Orange': 41269695479883,
      'Yellow': 41269695512651,
      'Raw (unfinished)': 41269695545419,
    },
  },
  quoteEmail: 'support@complianceboards.com',
};

// ---- Wilsonart laminate picker (custom boards) ----
// The library itself (names, numbers, swatches) is built by tools/build_laminates.py into data/laminates.json.
// The lists below only control which filter buttons the picker shows. They mirror Wilsonart's design library filters.
export const LAMINATE = {
  libraryUrl: 'data/laminates.json',
  tileIn: 12,   // how many inches of board one copy of the swatch covers (smaller = finer pattern)
  types: ['Abstracts & Patterns', 'Fibers & Textiles', 'Graphic', 'Metal Looks', 'Particulates', 'Retro',
          'Solids & Optical Solids', 'Spectrum', 'Stones', 'Woodgrains'],
  colors: [
    { name: 'Beige', hex: '#e6d5b8' }, { name: 'Black', hex: '#111111' }, { name: 'Blue', hex: '#2447d6' },
    { name: 'Brown', hex: '#b8946a' }, { name: 'Gray', hex: '#98999b' }, { name: 'Green', hex: '#1b7f1b' },
    { name: 'Multicolor', hex: 'conic' }, { name: 'Neutral', hex: '#ecdcc8' }, { name: 'Orange', hex: '#ff9f0a' },
    { name: 'Purple', hex: '#6a2c63' }, { name: 'Red', hex: '#f21c27' }, { name: 'Taupe', hex: '#b5a595' },
    { name: 'White', hex: '#ffffff' }, { name: 'Yellow', hex: '#ffee00' },
  ],
  shades: ['Dark', 'Light', 'Medium'],
  cuts: ['Plain', 'Plain/Flat', 'Quarter', 'Rift'],        // shown only when Woodgrains is selected
  matches: ['Bookmatch', 'Random', 'Reverse Slipmatch', 'Slipmatch'],
};
