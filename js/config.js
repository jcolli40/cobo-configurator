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
  { name: 'Light Gray',         hex: '#c9cbcf' },
  { name: 'Medium Gray',        hex: '#8b8e94' },
  { name: 'Maroon',             hex: '#6d1020' },
  { name: 'Red',                hex: '#b3151c' },
  { name: 'Hot Red',            hex: '#e60f1e' },
  { name: 'Burnt Orange',       hex: '#c9531a' },
  { name: 'Orange',             hex: '#e7700b' },
  { name: 'Yellow',             hex: '#f1c40f' },
  { name: 'Olive',              hex: '#6b6b21' },
  { name: 'Lime Green',         hex: '#8fd01f' },
  { name: 'Emerald Green',        hex: '#0a9a58' },
  { name: 'Forest Green',       hex: '#1d5a3a' },
  { name: 'Seafoam',              hex: '#7dd8b5' },
  { name: 'Teal',               hex: '#0e8a8a' },
  { name: 'Powder Blue',        hex: '#79b0d8' },
  { name: 'Royal Blue',         hex: '#2b50c8' },
  { name: 'Navy Blue',          hex: '#12264d' },
  { name: 'Purple',             hex: '#6f2da8' },
  { name: 'Magenta',            hex: '#d1008f' },
  { name: 'Hot Pink',           hex: '#ff2e93' },
  { name: 'Light Pink',         hex: '#f4c2cf' },
  { name: 'Dark Brown',            hex: '#4a2c1a' },
  { name: 'Raw (unfinished)',   hex: '#b8956a' },
];

// ---- Real Wilsonart solid colors for the Board Style > Solid Colors tab (v8). n = design number, hex = the color of the swatch ----
export const SOLIDS = [
  { n: "D388", name: "Crystal", hex: "#fcfbf9" },
  { n: "D354", name: "Designer White", hex: "#f9faf5" },
  { n: "D515", name: "Snow White Mist", hex: "#faf9f5" },
  { n: "D427", name: "Linen", hex: "#fcfdef" },
  { n: "15511", name: "Linen Velvet", hex: "#fffeec" },
  { n: "1570", name: "White", hex: "#f6f4f5" },
  { n: "15512", name: "Designer White Velvet", hex: "#f4f6f3" },
  { n: "15501", name: "Snow White Velvet", hex: "#f1f2f7" },
  { n: "D431", name: "Alabaster", hex: "#f9f6ef" },
  { n: "1573", name: "Frosty White", hex: "#f5f6f1" },
  { n: "15055", name: "Specter White", hex: "#f3f1f4" },
  { n: "D403", name: "White Sand", hex: "#f7f3e7" },
  { n: "5012", name: "Magnolia", hex: "#f2f5e5" },
  { n: "3173", name: "Pearl", hex: "#e7e8e3" },
  { n: "D30", name: "Natural Almond", hex: "#f2ebd9" },
  { n: "D439", name: "Wallaby", hex: "#eee6db" },
  { n: "15509", name: "Porcelain Velvet", hex: "#e1e4dd" },
  { n: "4856", name: "Cloud Zephyr", hex: "#d6d8db" },
  { n: "D506", name: "Silver Mist", hex: "#d0d1cc" },
  { n: "1500", name: "Grey", hex: "#cbcbc9" },
  { n: "15516", name: "Icecap Velvet", hex: "#c0c6c6" },
  { n: "D315", name: "Platinum", hex: "#c0c0be" },
  { n: "D381", name: "Fashion Grey", hex: "#bdb9b6" },
  { n: "Y0726", name: "Misty Oyster", hex: "#b9b6b1" },
  { n: "15503", name: "Silver Velvet", hex: "#acb4b6" },
  { n: "D503", name: "Cement", hex: "#adb1b2" },
  { n: "15517", name: "Ethereal Velvet", hex: "#a9b2ad" },
  { n: "Y0846", name: "Southern Cross", hex: "#a3b3b0" },
  { n: "15514", name: "Feather Velvet", hex: "#aaa198" },
  { n: "D355", name: "Gunmetal", hex: "#a2a2a0" },
  { n: "D92", name: "Dove Grey", hex: "#9f9c95" },
  { n: "D90", name: "North Sea", hex: "#8d9190" },
  { n: "D73", name: "Pewter", hex: "#868a93" },
  { n: "5014", name: "Battleship", hex: "#7f8384" },
  { n: "Y0856", name: "Evergreen", hex: "#778578" },
  { n: "D504", name: "Fossil Shale", hex: "#837e78" },
  { n: "10657", name: "Graphite", hex: "#545456" },
  { n: "15507", name: "Slate Velvet", hex: "#584e4c" },
  { n: "D91", name: "Slate Grey", hex: "#4e4943" },
  { n: "15504", name: "Charcoal Velvet", hex: "#454648" },
  { n: "D505", name: "Midnight", hex: "#404146" },
  { n: "15505", name: "Black Velvet", hex: "#1b2121" },
  { n: "1595", name: "Black", hex: "#171717" },
  { n: "Y0844", name: "Rose Dust", hex: "#bb8487" },
  { n: "Y0667", name: "Berry", hex: "#cb111e" },
  { n: "D307", name: "Hollyberry", hex: "#a82639" },
  { n: "Y0834", name: "Savina", hex: "#952026" },
  { n: "D14", name: "Port", hex: "#8a191d" },
  { n: "Y0858", name: "Carnival", hex: "#efd3d0" },
  { n: "D12", name: "Regimental Red", hex: "#9a1f20" },
  { n: "Y0811", name: "Pomegranate", hex: "#8e272a" },
  { n: "Y0853", name: "Persimmon", hex: "#a34521" },
  { n: "D495", name: "Coffee Bean", hex: "#3a2720" },
  { n: "4170", name: "Beige Pampas", hex: "#e6e0d9" },
  { n: "Y0453", name: "Murren", hex: "#eaded1" },
  { n: "1530", name: "Beige", hex: "#e5d6c3" },
  { n: "D50", name: "Khaki Brown", hex: "#d3c1ad" },
  { n: "D327", name: "Pepperdust", hex: "#c7bdb4" },
  { n: "15513", name: "Silk Velvet", hex: "#beb2a6" },
  { n: "Y0733", name: "Orange Crush", hex: "#f18c3c" },
  { n: "D501", name: "Orange Grove", hex: "#f58f2b" },
  { n: "D96", name: "Shadow", hex: "#9f9281" },
  { n: "Y0867", name: "Tangerine", hex: "#c46014" },
  { n: "Y0723", name: "Hot Sun", hex: "#b55108" },
  { n: "4857", name: "Shadow Zephyr", hex: "#dfdcd7" },
  { n: "Y0854", name: "Bakelite Gold", hex: "#c3901d" },
  { n: "4947", name: "Raw Cotton", hex: "#cccabd" },
  { n: "4946", name: "Natural Cotton", hex: "#cecbbb" },
  { n: "Y0868", name: "Sweet Corn", hex: "#e6d694" },
  { n: "Y0847", name: "Tewkesbury", hex: "#cfb22a" },
  { n: "4945", name: "Organic Cotton", hex: "#e1e1d9" },
  { n: "4168", name: "Grey Pampas", hex: "#dfdfd7" },
  { n: "Y0735", name: "Granny Smith", hex: "#d6e160" },
  { n: "Y0836", name: "Tomatillo", hex: "#a6b165" },
  { n: "D498", name: "Island", hex: "#91ba5c" },
  { n: "Y0852", name: "Chutney", hex: "#839b68" },
  { n: "Y0855", name: "Silvan", hex: "#4d642b" },
  { n: "Y0843", name: "Cricket", hex: "#3b7737" },
  { n: "Y0851", name: "Rosemary", hex: "#3d503c" },
  { n: "D79", name: "Hunter Green", hex: "#105038" },
  { n: "Y0686", name: "Iced Mint", hex: "#a0b5b3" },
  { n: "Y0698", name: "Bonaire", hex: "#54bfd3" },
  { n: "15518", name: "Spruce Velvet", hex: "#577172" },
  { n: "D502", name: "Ocean", hex: "#00a1a6" },
  { n: "Y0835", name: "Rendezvous", hex: "#0d7381" },
  { n: "Y0736", name: "Green Tourmaline", hex: "#025560" },
  { n: "Y0832", name: "Sea Wall", hex: "#74a2af" },
  { n: "Y0833", name: "Sea Side", hex: "#7e95a2" },
  { n: "Y0842", name: "Aegean Sea", hex: "#456a73" },
  { n: "D25", name: "Atlantis", hex: "#114867" },
  { n: "15519", name: "Peacock Velvet", hex: "#015265" },
  { n: "Y0845", name: "Spritz", hex: "#c0d1db" },
  { n: "D321", name: "Brittany Blue", hex: "#587190" },
  { n: "D417", name: "Lapis Blue", hex: "#1f59a3" },
  { n: "Y0837", name: "Razzle", hex: "#0f5ea8" },
  { n: "Y0849", name: "Jean", hex: "#3c5671" },
  { n: "15515", name: "Nile Velvet", hex: "#41576c" },
  { n: "D379", name: "Indigo", hex: "#1e3d5a" },
  { n: "Y0831", name: "Let It Rain", hex: "#969caa" },
  { n: "15506", name: "Midnight Velvet", hex: "#1e222d" },
  { n: "Y0838", name: "Palace", hex: "#4b4159" },
  { n: "Y0737", name: "Iolite", hex: "#481970" },
  { n: "Y0864", name: "Eggplant", hex: "#54405d" },
  { n: "Y0731", name: "Majesty", hex: "#5b2d51" },
  { name: 'Raw (unfinished)', hex: '#b8956a' },   // (the unfinished MDO board, not a Wilsonart design)
];

// ---- Wood edge banding (real-wood look; drawn in the browser, so no image files). hex = average color (swatches, summaries);
//      grain = the darker streaks, light = the lighter streaks, rings = how busy the grain is, contrast = how strong it shows ----
export const WOODS = [
  { name: 'Birch',    hex: '#e4cda3', grain: '#c19a63', light: '#f2e3c4', rings: 0.55, contrast: 0.95 },
  { name: 'Oak',      hex: '#b88d55', grain: '#7d5628', light: '#d1a96d', rings: 1.0,  contrast: 1.6 },
  { name: 'Mahogany', hex: '#6b3320', grain: '#38170b', light: '#8a4a32', rings: 0.75, contrast: 1.5 },
  { name: 'Cherry',   hex: '#964a2d', grain: '#63291a', light: '#b3643f', rings: 0.6,  contrast: 1.3 },
  { name: 'Ebony',    hex: '#1a1613', grain: '#0a0807', light: '#4a423a', rings: 0.5,  contrast: 1.4 },
  { name: 'Bamboo',   hex: '#d6b870', grain: '#a07c38', light: '#ecd99e', rings: 0.45, contrast: 1.3 },
  { name: 'Walnut',   hex: '#5b3f2c', grain: '#2e1d12', light: '#7b5740', rings: 0.8,  contrast: 1.5 },
  { name: 'Teak',     hex: '#a9783d', grain: '#6e4a1f', light: '#c99a5c', rings: 0.65, contrast: 1.4 },
];

// ---- Metallic edge banding (drawn in the browser: a brushed-metal look with a bright reflection). rough = how blurry the reflection is ----
export const METALS = [
  { name: 'Gold',     hex: '#d9b13e', rough: 0.3,  brush: 0.9 },
  { name: 'Silver',   hex: '#c8ccd2', rough: 0.3,  brush: 0.9 },
  { name: 'Copper',   hex: '#b8693a', rough: 0.32, brush: 0.9 },
  { name: 'Chrome',   hex: '#e6eaee', rough: 0.07, brush: 0.2 },
  { name: 'Brass',    hex: '#b9983c', rough: 0.34, brush: 1.0 },
  { name: 'Graphite', hex: '#3b3e44', rough: 0.35, brush: 0.9 },
];

// ---- Fastener (1" dia aluminum cap) finishes ----
export const FASTENERS = [
  { id: 'chrome', name: 'Silver',           color: '#eef0f2', metal: 1.0, rough: 0.24, brushed: true },
  { id: 'black',  name: 'Black',            color: '#0b0b0c', metal: 0.65, rough: 0.12, brushed: false },
  { id: 'brass',  name: 'Brass',            color: '#e6cd82', metal: 1.0, rough: 0.3, brushed: true },   // (replaced Brushed Aluminum, Oct 2026)
];

// Viewer background (the wall behind the board in the 3D preview; not part of the product)
export const WALLS = [
  { name: 'White',      hex: '#ffffff' },
  { name: 'Greige',     hex: '#b9b2a6' },
  { name: 'Charcoal',   hex: '#3a3c40' },
];

// ---- Popular boards: one-tap starting points (lam = Wilsonart design number; room = a room id below) ----
export const PRESETS = [
  { name: 'Restaurant classic', blurb: '24×36 · Black · silver caps', cfg: { sizeId: '24x36', orient: 'portrait', face: 'Black', edge: 'match', fastener: 'chrome' }, room: 'bistro' },
  { name: 'Front desk',         blurb: '12×24 · White · silver',    cfg: { sizeId: '12x24', orient: 'portrait', face: 'White', edge: 'Black', fastener: 'chrome' }, room: 'office' },
  { name: 'Kitchen line',       blurb: '24×24 · Black · black caps',  cfg: { sizeId: '24x24', orient: 'portrait', face: 'Black', edge: 'match', fastener: 'black' }, room: 'kitchen' },
  { name: 'Café',               blurb: '12×36 wide · Forest Green',   cfg: { sizeId: '12x36', orient: 'landscape', face: 'Forest Green', edge: 'match', fastener: 'brass' }, room: 'casual' },
  { name: 'Fine dining',        blurb: '24×36 · woodgrain laminate',  cfg: { sizeId: '24x36', orient: 'portrait', face: 'Black', edge: 'Black', fastener: 'black' }, lam: 'Y0822', room: 'dining' },
];

// ---- Version 4 only: the looks customers swipe through after snapping their wall ----
// The size comes from their photo; a look sets everything else. They're ranked for the wall in the photo:
// suits = how much the look likes a light (+) or dark (-) wall, a warm (+) or cool (-) wall, and a colorful (+) or plain (-) one.
// base = a head start (or handicap) on every wall. Boards that contrast with the wall also get a boost (see rankLooks
// in main.js). Add, remove or reorder freely; the order here is used when there's no photo.
export const STYLES = [
  { name: 'Classic black',  blurb: 'Black · silver caps',               cfg: { face: 'Black', edge: 'match', fastener: 'chrome' },        suits: { light: 1,    warm: 0,    colorful: 0.5 }, base: 0.5 },
  { name: 'Warm walnut',    blurb: 'Java Cane woodgrain · black caps',   cfg: { face: 'Black', edge: 'Black', fastener: 'black' }, lam: 'Y0822', suits: { light: 0.5, warm: 1.5, colorful: -0.5 }, base: 0.3 },
  { name: 'Gallery white',  blurb: 'White · black edge · silver',        cfg: { face: 'White', edge: 'Black', fastener: 'chrome' },          suits: { light: -1,   warm: 0,    colorful: 0.5 } },
  { name: 'Iron stone',     blurb: 'Iron Strata stone · black caps',     cfg: { face: 'Black', edge: 'Black', fastener: 'black' }, lam: '5084',  suits: { light: 0.5, warm: -1.5, colorful: -0.5 } },
  { name: 'Forest green',   blurb: 'Forest Green · brass caps',          cfg: { face: 'Forest Green', edge: 'match', fastener: 'brass' },   suits: { light: 0.5,  warm: 1,    colorful: -1 } },
  { name: 'Deep navy',      blurb: 'Ceramic Blue · silver caps',         cfg: { face: 'Black', edge: 'Black', fastener: 'chrome' }, lam: 'Y0745', suits: { light: 1, warm: 1,  colorful: -0.5 } },
  { name: 'Ivory stone',    blurb: 'Ivory Terrene · brass caps',         cfg: { face: 'White', edge: 'White', fastener: 'brass' }, lam: '5075',  suits: { light: -1,  warm: -0.5, colorful: 0 } },
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
  edgeWood: { '6x12': 6, '12x12': 8, '12x24': 12, '12x36': 15, '24x24': 16, '24x36': 20, custom: 20 },    // wood edge banding (PLACEHOLDER amounts)
  edgeMetal: { '6x12': 9, '12x12': 12, '12x24': 18, '12x36': 23, '24x24': 24, '24x36': 30, custom: 30 },  // metallic edge banding (PLACEHOLDER amounts)
  edgeCustom: 10,                          // edge banding in a non-stock color (stock colors are included)
  caps: { chrome: 0, black: 0, brass: 0 },  // per board (4 caps): every finish is the same price
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
  clipDepth: 0.1375,   // low profile: with the two 1/16" halves the board stands off the wall about 0.26" (was 0.4 -> 0.525")
  clipTopInset: 3,
  clipEndInsetBig: 2,    // boards 12" wide and up
  clipEndInsetSmall: 1.5 // boards under 12" wide
};

// ---- Shopify hand-off ----
// The viewer runs in an iframe (GitHub Pages). "Add to cart" posts a message to the Shopify page,
// which adds the variant via /cart/add.js (see shopify/cobo-configurator-embed.liquid).
// Fill in variant IDs as: variantIds['12x24']['Black'] = 41269695348811
// (All six sizes are filled in from the store's product list. Colors that aren't variants, like the Wilsonart solids, use the size's Black board, with the real color written on the order.)
export const SHOPIFY = {
  messageType: 'cobo:add-to-cart',
  variantIds: {   // one product per size on complianceboards.com (product title = size), from /products.json on 2026-11-08
    '6x12': {   // 6x6
      'Black': 41268290715723,
      'White': 41268290748491,
      'Red': 41268290781259,
      'Forest Green': 41268290814027,
      'Orange': 41268290846795,
      'Yellow': 41268290879563,
      'Raw (unfinished)': 41268290912331,
    },
    '12x12': {   // 12x6
      'Black': 41268289405003,
      'White': 41268289437771,
      'Red': 41268289470539,
      'Forest Green': 41268289503307,
      'Orange': 41268289536075,
      'Yellow': 41268289568843,
      'Raw (unfinished)': 41268289601611,
    },
    '12x24': {   // 12x24
      'Black': 41269695348811,
      'White': 41269695381579,
      'Red': 41269695414347,
      'Forest Green': 41269695447115,
      'Orange': 41269695479883,
      'Yellow': 41269695512651,
      'Raw (unfinished)': 41269695545419,
    },
    '12x36': {   // 12x36
      'Black': 41268286914635,
      'White': 41268286947403,
      'Red': 41268286980171,
      'Forest Green': 41268287012939,
      'Orange': 41268287045707,
      'Yellow': 41268287078475,
      'Raw (unfinished)': 41268287111243,
    },
    '24x24': {   // 24x24
      'Black': 41268288225355,
      'White': 41268288258123,
      'Red': 41268288290891,
      'Forest Green': 41268288323659,
      'Orange': 41268288356427,
      'Yellow': 41268288389195,
      'Raw (unfinished)': 41268288421963,
    },
    '24x36': {   // 24x36
      'Black': 41268292059211,
      'White': 41268292091979,
      'Red': 41268292124747,
      'Forest Green': 41268292157515,
      'Orange': 41268292190283,
      'Yellow': 41268292223051,
      'Raw (unfinished)': 41268292255819,
    },
  },
  quoteEmail: 'support@complianceboards.com',
  contactUrl: 'https://complianceboards.com/pages/contact',   // v6 cart: "Need more than 10 boards? Contact us" (PLACEHOLDER: check the real contact page)
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
