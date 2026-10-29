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

// ---- Popular boards: one-tap starting points (lam = Wilsonart design number; room = a room id below) ----
export const PRESETS = [
  { name: 'Restaurant classic', blurb: '24×36 · Black · chrome caps', cfg: { sizeId: '24x36', orient: 'portrait', face: 'Black', edge: 'match', fastener: 'chrome' }, room: 'bistro' },
  { name: 'Front desk',         blurb: '12×24 · White · aluminum',    cfg: { sizeId: '12x24', orient: 'portrait', face: 'White', edge: 'Black', fastener: 'alum' }, room: 'office' },
  { name: 'Kitchen line',       blurb: '24×24 · Black · black caps',  cfg: { sizeId: '24x24', orient: 'portrait', face: 'Black', edge: 'match', fastener: 'black' }, room: 'kitchen' },
  { name: 'Café',               blurb: '12×36 wide · Forest Green',   cfg: { sizeId: '12x36', orient: 'landscape', face: 'Forest Green', edge: 'match', fastener: 'alum' }, room: 'casual' },
  { name: 'Fine dining',        blurb: '24×36 · woodgrain laminate',  cfg: { sizeId: '24x36', orient: 'portrait', face: 'Black', edge: 'Black', fastener: 'black' }, lam: 'Y0822', room: 'dining' },
];

// ---- Version 4 only: the looks customers swipe through after snapping their wall ----
// The size comes from their photo; a look sets everything else. They're ranked for the wall in the photo:
// suits = how much the look likes a light (+) or dark (-) wall, a warm (+) or cool (-) wall, and a colorful (+) or plain (-) one.
// base = a head start (or handicap) on every wall. Boards that contrast with the wall also get a boost (see rankLooks
// in main.js). Add, remove or reorder freely; the order here is used when there's no photo.
export const STYLES = [
  { name: 'Classic black',  blurb: 'Black · chrome caps',               cfg: { face: 'Black', edge: 'match', fastener: 'chrome' },        suits: { light: 1,    warm: 0,    colorful: 0.5 }, base: 0.5 },
  { name: 'Warm walnut',    blurb: 'Java Cane woodgrain · black caps',   cfg: { face: 'Black', edge: 'Black', fastener: 'black' }, lam: 'Y0822', suits: { light: 0.5, warm: 1.5, colorful: -0.5 }, base: 0.3 },
  { name: 'Gallery white',  blurb: 'White · black edge · aluminum',      cfg: { face: 'White', edge: 'Black', fastener: 'alum' },          suits: { light: -1,   warm: 0,    colorful: 0.5 } },
  { name: 'Iron stone',     blurb: 'Iron Strata stone · black caps',     cfg: { face: 'Black', edge: 'Black', fastener: 'black' }, lam: '5084',  suits: { light: 0.5, warm: -1.5, colorful: -0.5 } },
  { name: 'Forest green',   blurb: 'Forest Green · aluminum caps',       cfg: { face: 'Forest Green', edge: 'match', fastener: 'alum' },   suits: { light: 0.5,  warm: 1,    colorful: -1 } },
  { name: 'Deep navy',      blurb: 'Ceramic Blue · chrome caps',         cfg: { face: 'Black', edge: 'Black', fastener: 'chrome' }, lam: 'Y0745', suits: { light: 1, warm: 1,  colorful: -0.5 } },
  { name: 'Ivory stone',    blurb: 'Ivory Terrene · aluminum caps',      cfg: { face: 'White', edge: 'White', fastener: 'alum' }, lam: '5075',  suits: { light: -1,  warm: -0.5, colorful: 0 } },
  { name: 'Natural raffia', blurb: 'Natural Raffia texture · black edge', cfg: { face: 'White', edge: 'Black', fastener: 'black' }, lam: 'Y0823', suits: { light: -0.5, warm: 1, colorful: -0.5 } },
  { name: 'Industrial raw', blurb: 'Raw wood · black edge · black caps', cfg: { face: 'Raw (unfinished)', edge: 'Black', fastener: 'black' }, suits: { light: 0, warm: -1,   colorful: -1 } },
  { name: 'Bold red',       blurb: 'Red · black edge · black caps',      cfg: { face: 'Red', edge: 'Black', fastener: 'black' },            suits: { light: 1,    warm: -0.5, colorful: -0.6 }, base: -0.3 },
];

// ---- Versions 3 and 5: upcharges for options (PLACEHOLDER amounts in dollars; set the real ones here) ----
// In v3 and v5 these boards are priced and go in the cart (only custom sizes are still quoted).
// Any amount can be one number for every size, or one per size like laminate below (custom = custom-size boards).
export const UPCHARGES = {
  customColor: 25,                         // any color outside the stock list
  laminate: { '6x12': 20, '12x12': 30, '12x24': 45, '12x36': 60, '24x24': 75, '24x36': 95, custom: 95 },   // Wilsonart laminate face ("Textures")
  edgeCustom: 10,                          // edge banding in a non-stock color (stock colors are included)
  caps: { alum: 0, chrome: 8, black: 8 },  // per board (4 caps)
  logo: 45,                                // printed logo
  background: 75,                          // printed background image
};

// ---- Volume discounts shown in the cart (PLACEHOLDER tiers: set the real ones here AND as an automatic discount in Shopify) ----
export const DISCOUNTS = [ { min: 3, pct: 5 }, { min: 5, pct: 10 }, { min: 10, pct: 15 } ];

// ---- Sizes customers can pick for their own uploaded documents (inches, upright) ----
export const DOC_SIZES = [
  { id: 'half',    name: 'Half letter', w: 5.5, h: 8.5 },
  { id: 'letter',  name: 'Letter',      w: 8.5, h: 11 },
  { id: 'legal',   name: 'Legal',       w: 8.5, h: 14 },
  { id: 'tabloid', name: 'Tabloid',     w: 11,  h: 17 },
  { id: 'p1824',   name: 'Poster',      w: 18,  h: 24 },
  { id: 'p2436',   name: 'Poster',      w: 24,  h: 36 },
];

// ---- Rooms: preset wall + lighting for the 3D preview (preview only; "Studio" shows true colors) ----
// wall: 'color' = use the wall color picker; otherwise a drawn texture (wood, brick, subway, steel, paint) in that color.
// light: key = main light strength/color, hemi = soft fill, env = reflections, spot = overhead spotlight strength (0 = off).
// twin: the photo room v5 shows in its place (v5 has photo rooms only, plus Studio).
const LIGHT = {
  warm:   { key: 1.9, keyColor: '#fff0d8', hemi: 0.45, sky: '#ffe9c8', ground: '#6b4a35', env: 0.3, exposure: 1.0, spot: 0 },
  bright: { key: 1.7, keyColor: '#fff8f0', hemi: 0.7, sky: '#ffffff', ground: '#b0a89c', env: 0.35, exposure: 1.0, spot: 0 },
  moody:  { key: 0.45, keyColor: '#ffc890', hemi: 0.15, sky: '#ffd9a8', ground: '#2a1a10', env: 0.12, exposure: 1.0, spot: 1.3, spotColor: '#ffc283', spotAngle: 0.6 },
  steel:  { key: 1.3, keyColor: '#f2f7ff', hemi: 0.55, sky: '#eef4ff', ground: '#9aa3ab', env: 0.45, exposure: 1.0, spot: 0.8, spotColor: '#f4f8ff', spotAngle: 0.75 },
};
// Photo rooms (v5): a photo of a real room behind the board. widthIn = how many inches of wall the photo's full
// width covers (sets the scale); hang = where the board's center sits in the photo (0-1 across, 0-1 down);
// bg = the photo's average color (fills the space around it). Photos: img/rooms/<id>.jpg (+ <id>-t.jpg thumbnail).
const photoRoom = (id, name, blurb, hang, bg, light) =>
  ({ id, name, blurb, wall: { photo: `img/rooms/${id}.jpg`, thumb: `img/rooms/${id}-t.jpg`, widthIn: 220, hang, bg }, light: LIGHT[light] });
export const ENVIRONMENTS = [
  { id: 'studio',  name: 'Studio',             blurb: 'True color',                      wall: 'color',
    light: { key: 2.3, keyColor: '#ffffff', hemi: 0.5, sky: '#ffffff', ground: '#8a8a8a', env: 0.35, exposure: 1.0, spot: 0 } },
  { id: 'dining',  name: 'Fine dining',        blurb: 'Candlelit, warm spotlight',        wall: { tex: 'wood', color: '#5a3a26' }, twin: 'walnut-steakhouse',
    light: { key: 0.25, keyColor: '#ffb070', hemi: 0.1, sky: '#ffcf9a', ground: '#2a1a10', env: 0.1, exposure: 1.0, spot: 1.6, spotColor: '#ffc283', spotAngle: 0.55 } },
  { id: 'bistro',  name: 'Bistro café',        blurb: 'Warm daylight on brick',           wall: { tex: 'brick', color: '#a0573a' }, twin: 'brick-cafe',
    light: { key: 2.0, keyColor: '#fff0d8', hemi: 0.45, sky: '#ffe9c8', ground: '#6b4a35', env: 0.3, exposure: 1.0, spot: 0 } },
  { id: 'casual',  name: 'Fast casual',        blurb: 'Bright fluorescent, white tile',   wall: { tex: 'subway', color: '#f3f5f6' }, twin: 'white-tile-cafe',
    light: { key: 1.5, keyColor: '#eef4ff', hemi: 0.95, sky: '#f2f7ff', ground: '#c9d1d9', env: 0.45, exposure: 1.02, spot: 0 } },
  { id: 'kitchen', name: 'Commercial kitchen', blurb: 'Stainless steel, hard overhead light', wall: { tex: 'steel', color: '#c3c8ce' }, twin: 'steel-kitchen',
    light: { key: 1.2, keyColor: '#f2f7ff', hemi: 0.5, sky: '#eef4ff', ground: '#9aa3ab', env: 0.45, exposure: 1.0, spot: 1.1, spotColor: '#f4f8ff', spotAngle: 0.75 } },
  { id: 'office',  name: 'Office lobby',       blurb: 'Soft, neutral painted wall',       wall: { tex: 'paint', color: '#d8d4cc' }, twin: 'modern-cafe',
    light: { key: 1.9, keyColor: '#fff7ec', hemi: 0.55, sky: '#ffffff', ground: '#9a958c', env: 0.3, exposure: 1.0, spot: 0 } },
  photoRoom('brick-cafe',         'Brick Café',         'Exposed brick, warm light', [0.53, 0.40], '#835d46', 'warm'),
  photoRoom('modern-cafe',        'Modern Café',        'Plaster over wood paneling', [0.50, 0.30], '#a78c75', 'bright'),
  photoRoom('white-tile-cafe',    'White Tile Café',    'Bright subway tile',       [0.60, 0.40], '#c1a995', 'bright'),
  photoRoom('concrete-loft',      'Concrete Loft',      'Raw concrete wall',        [0.50, 0.40], '#8f8378', 'warm'),
  photoRoom('coastal-cafe',       'Coastal Café',       'Sunlit textured plaster',  [0.50, 0.40], '#cab2a1', 'bright'),
  photoRoom('mediterranean-cafe', 'Mediterranean Café', 'Warm limewash',            [0.50, 0.40], '#bba189', 'bright'),
  photoRoom('slat-wood-cafe',     'Slat Wood Café',     'Oak slats, soft glow',     [0.55, 0.40], '#986f49', 'warm'),
  photoRoom('rustic-wood',        'Rustic Wood',        'Reclaimed wood planks',    [0.55, 0.38], '#926649', 'warm'),
  photoRoom('retro-diner',        'Retro Diner',        'Mint tile and chrome',     [0.60, 0.38], '#989b8f', 'bright'),
  photoRoom('steel-kitchen',      'Commercial Kitchen', 'Stainless steel',          [0.50, 0.42], '#a1988f', 'steel'),
  photoRoom('elegant-dining',     'Elegant Dining',     'Cream paneled walls',      [0.50, 0.37], '#7b5d40', 'warm'),
  photoRoom('walnut-steakhouse',  'Walnut Steakhouse',  'Dark walnut paneling',     [0.516, 0.30], '#3d2314', 'moody'),   // centered on the middle panel
  photoRoom('moody-dining',       'Moody Dining',       'Charcoal panels, candlelight', [0.50, 0.35], '#3a2617', 'moody'),
  photoRoom('green-lounge',       'Green Lounge',       'Deep green, brass accents', [0.55, 0.40], '#373a2b', 'moody'),
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
