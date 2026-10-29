import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIZES, CUSTOM, COLORS, FASTENERS, WALLS, HW, SHOPIFY, LAMINATE, SHEETS, ARTWORK, ENVIRONMENTS, PRESETS, STYLES, DISCOUNTS, UPCHARGES, DOC_SIZES } from './config.js?v=202610291427';   // ?v= stamped by tools/stamp-version.js
import { findDocuments, sizeDocuments, wallLook } from './scan.js?v=202610291427';
import { wallTexture, wallSwatch } from './env.js?v=202610291427';

// Layout choices for uploaded artwork (logo + board background image). only: shown for that layer only.
const LAYOUTS = [
  { id: 'cover',     name: 'Fill board (crop to cover)', only: 'background' },
  { id: 'fit',       name: 'Fit whole image on board',   only: 'background' },
  { id: 'single',    name: 'Single (no repeat)' },
  { id: 'grid',      name: 'Grid' },
  { id: 'brick',     name: 'Offset rows (brick)' },
  { id: 'halfdrop',  name: 'Offset columns (half-drop)' },
  { id: 'honeycomb', name: 'Honeycomb' },
  { id: 'checker',   name: 'Checkerboard / diamond' },
  { id: 'mirror',    name: 'Mirrored grid' },
  { id: 'flip',      name: 'Alternating upside-down rows' },
  { id: 'scatter',   name: 'Scatter (random)' },
];
function artDefaults(key) {
  const c = ARTWORK[key];
  return { layout: c.layout, size: c.size, gap: c.gap, rot: 0, opacity: 100, offX: 0, offY: 0, seed: 1 };
}

// Which version of the page this is (set on <html data-layout> by index.html / v2 / v3; see tools/make-versions.js)
//   v1: one panel of options   v2: size, then Standard or Custom, with simple rows   v3: size, then every option, priced
//   v4: guided, photo first   v5: Auto-suggest (full-screen steps, live camera, our picks) + v3 pricing and v2's simple rows
const LAYOUT = document.documentElement.dataset.layout || 'v1';
const PRICED = LAYOUT === 'v3' || LAYOUT === 'v5';          // options priced with upcharges (else laminate/printing = quoted)
const ROWS = LAYOUT === 'v2' || LAYOUT === 'v5';            // the simple rows (edge switch, eye icons)
const GUIDED = LAYOUT === 'v4' || LAYOUT === 'v5';
// an upcharge from UPCHARGES (config.js): one amount, or one per size
const upAmt = (v) => (v && typeof v === 'object' ? (v[state.sizeId] ?? v.custom ?? 0) : (v || 0));

/* ------------------------------------------------------------------ state */
const state = {
  sizeId: '24x36',          // a standard id, or 'custom'
  customA: 18, customB: 30, // custom short/long side
  orient: 'portrait',       // 'portrait' | 'landscape'
  face: 'Black',            // color name or '#rrggbb'
  edge: 'match',            // 'match' | color name | '#rrggbb'
  fastener: 'alum',
  sheets: true,
  sheetTurn: false,         // rotate the sample certificates 90 degrees from the automatic choice
  wall: 0,                  // index into WALLS, or -1 for wallCustom (Studio room only)
  wallCustom: '#ffffff',
  env: 'studio',            // room preset (ENVIRONMENTS in config.js)
  certNeed: 0,              // "How many certificates?" (0 = not answered)
  path: null,               // v2 only: 'standard' or 'custom' (null = not chosen yet)
  myCerts: [],              // the customer's own certificate photos, shown in place of the samples (in order)
  wallPhoto: { img: null, name: '', aspect: 1, imgId: 0, widthIn: 108, offY: 0 },   // photo of the customer's own wall
  view: 'angle',
  art: {                    // uploaded images: { img (canvas), name, aspect, imgId, ...layout settings }
    logo: { img: null, name: '', ...artDefaults('logo') },
    background: { img: null, name: '', ...artDefaults('background') },
  },
  lamSel: null,             // chosen Wilsonart laminate {n, name, avg, full, ...} (overrides face color)
  grain: false,             // rotate the laminate pattern 90 degrees
  qty: 1,
};

/* ------------------------------------------------------------------ helpers */
const $ = (s) => document.querySelector(s);
const colorHex = (v) => (v && v[0] === '#') ? v : (COLORS.find(c => c.name === v)?.hex ?? '#888888');
// v5 shows photo rooms (plus Studio); a drawn room asked for by a link or popular board shows its photo twin
const PHOTO_ROOMS = LAYOUT === 'v5';
const ROOMS = ENVIRONMENTS.filter(e => e.wall === 'color' || !!e.wall.photo === PHOTO_ROOMS);
const envNow = () => {
  const E = ENVIRONMENTS.find(e => e.id === state.env) || ENVIRONMENTS[0];
  return (PHOTO_ROOMS && E.twin && ENVIRONMENTS.find(e => e.id === E.twin)) || E;
};
const wallHex = () => {
  const E = envNow();
  if (E.wall !== 'color') return E.wall.color || E.wall.bg;
  return state.wall < 0 ? state.wallCustom : WALLS[state.wall].hex;
};

function dims() {
  let a, b;
  if (state.sizeId === 'custom') {
    a = Math.min(state.customA, state.customB); b = Math.max(state.customA, state.customB);
  } else {
    const s = SIZES.find(x => x.id === state.sizeId); a = s.a; b = s.b;
  }
  return state.orient === 'portrait' ? { w: a, h: b } : { w: b, h: a };
}

/* ------------------------------------------------------------------ three setup */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(new URLSearchParams(location.search).get('lowfx') ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping;   // keeps board colors true to their hex values (ACES washed them out)
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.35;   // studio-room reflections on laminate/paint; higher = hazier boards
// Metals and acrylic get the room at their own strength (envMap + envMapIntensity) so they still shine.

// near = 1": plenty of depth precision at a distance, so the certificates don't flicker against the board face
const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.45;                 // slower, calmer turning (1 = three.js default)
controls.minDistance = 8;
// The board turns at most 60 degrees from straight-on in every direction: from the front, or from the back in the Back view.
// v5: left / right only (35 degrees, so the room photo behind it stays believable), at a fixed slight downward look.
const FLAT = LAYOUT === 'v5';
const TURN = FLAT ? Math.PI * 35 / 180 : Math.PI / 3;
const PITCH = 0.08;                          // v5: radians the camera looks down at the board
function lockAngles(view) {
  const back = view === 'back';
  controls.minAzimuthAngle = back ? Math.PI - TURN : -TURN;   // left / right
  controls.maxAzimuthAngle = back ? Math.PI + TURN : TURN;
  controls.minPolarAngle = FLAT ? Math.PI / 2 - PITCH : Math.PI / 2 - TURN;   // up / down
  controls.maxPolarAngle = FLAT ? Math.PI / 2 - PITCH : Math.PI / 2 + TURN;
}
function unlockAngles() {                      // while the camera glides between Front and Back
  controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
  controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
}
lockAngles('angle');

const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.5);
scene.add(hemi);
// overhead spotlight, used by some rooms (fine dining, kitchen); off in Studio
const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.55, 0.65, 2);
spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
scene.add(spot); scene.add(spot.target);
// Room lighting: Studio is the neutral, true-color setup; the other rooms change color, strength and mood.
function applyRoomLight(w, h) {
  const L = envNow().light, R = Math.max(w, h);
  key.color.set(L.keyColor); key.intensity = L.key;
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  scene.environmentIntensity = L.env; renderer.toneMappingExposure = L.exposure;
  spot.visible = L.spot > 0;
  if (spot.visible) {
    spot.position.set(0, h / 2 + R * 0.55, R * 0.75);
    spot.target.position.set(0, h * 0.12, 0);
    const d = spot.position.distanceTo(spot.target.position);
    spot.color.set(L.spotColor); spot.angle = L.spotAngle; spot.intensity = L.spot * d * d;   // inverse-square: strength at the board
    spot.shadow.camera.far = d * 3;
  }
}
const backFill = new THREE.DirectionalLight(0xffffff, 1.6);   // lights the back / z-clip when viewed from behind
backFill.position.set(40, 60, -120);
scene.add(backFill);

const root = new THREE.Group();
scene.add(root);

/* ------------------------------------------------------------------ materials */
function brushedTexture(horizontal = true) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 120 + Math.random() * 110;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = Math.random() * 1.2 + 0.2;
    g.beginPath();
    if (horizontal) { const y = Math.random() * 256; g.moveTo(0, y); g.lineTo(256, y + (Math.random() - 0.5) * 2); }
    else { const x = Math.random() * 256; g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 2, 256); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}
const brushedMap = brushedTexture(true);

function fastenerMaterial() {
  const f = FASTENERS.find(x => x.id === state.fastener);
  const m = new THREE.MeshPhysicalMaterial({
    color: f.color, metalness: f.metal, roughness: f.rough,
    roughnessMap: f.brushed ? brushedMap : null, envMap: envTex, envMapIntensity: 1,
    clearcoat: f.brushed ? 0 : 1, clearcoatRoughness: 0.05,
  });
  return m;
}

// Clear acrylic: nearly invisible glossy sheet. Raising opacity or envMapIntensity puts a white haze over the board.
const acrylicMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.04, depthWrite: false,
  clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMap: envTex, envMapIntensity: 0.5, side: THREE.FrontSide,
});
const laminate = (hex, rough = 0.55) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 });
const bandMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0 });
const mdoMat = new THREE.MeshStandardMaterial({ color: '#a8845a', roughness: 0.85 });
const backLamMat = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.38 });
const alumMat = new THREE.MeshStandardMaterial({ color: '#c3c6cb', metalness: 1, roughness: 0.4, roughnessMap: brushedMap, envMap: envTex });
const steelMat = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 1, roughness: 0.35, envMap: envTex });

/* ------------------------------------------------------------------ sample certificates */
const certCache = new Map();
function certificateTexture(w, h, title) {
  const k = `${w}x${h}|${title}`;
  if (certCache.has(k)) return certCache.get(k);
  const ppi = 56, c = document.createElement('canvas');
  c.width = Math.round(w * ppi); c.height = Math.round(h * ppi);
  const g = c.getContext('2d'), W = c.width, H = c.height, u = Math.min(W, H) / 100;   // u = 1% of the short side
  const serif = 'Georgia, "Times New Roman", serif';
  const fit = (text, size, weight, maxW) => {          // shrink a line of text until it fits
    let s = size; g.font = `${weight} ${s}px ${serif}`;
    while (g.measureText(text).width > maxW && s > 4) { s -= 1; g.font = `${weight} ${s}px ${serif}`; }
  };
  g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1b3a6b'; g.lineWidth = 2.2 * u; g.strokeRect(3 * u, 3 * u, W - 6 * u, H - 6 * u);
  g.strokeStyle = '#b8954a'; g.lineWidth = 0.6 * u; g.strokeRect(6 * u, 6 * u, W - 12 * u, H - 12 * u);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const cx = W / 2, maxW = W - 22 * u;
  let y = 6 * u + H * 0.11;
  g.fillStyle = '#b8954a'; fit('S A M P L E', 3.6 * u, 600, maxW); g.fillText('S A M P L E', cx, y);
  y += 10 * u;
  g.fillStyle = '#1b3a6b'; fit(title.toUpperCase(), 8 * u, 700, maxW); g.fillText(title.toUpperCase(), cx, y);
  y += 4.5 * u;
  g.fillStyle = '#b8954a'; g.fillRect(cx - 18 * u, y, 36 * u, 0.5 * u);
  y += 8 * u;
  g.fillStyle = '#555'; fit('This certifies that', 3.6 * u, 'italic 400', maxW); g.fillText('This certifies that', cx, y);
  y += 8 * u;
  g.fillStyle = '#1d1d1f'; fit('Your Business Name, LLC', 6 * u, 700, maxW); g.fillText('Your Business Name, LLC', cx, y);
  y += 7 * u;
  g.fillStyle = '#d4d0c6';
  const bodyEnd = H - 26 * u, widths = [0.78, 0.86, 0.7, 0.82, 0.62, 0.8, 0.74];
  for (let i = 0; y < bodyEnd; i++, y += 4.2 * u) {
    const bw = maxW * widths[i % widths.length];
    g.fillRect(cx - bw / 2, y, bw, 1.4 * u);
  }
  // gold seal (left) + signature line (right)
  const sy = H - 16 * u, sx = W * 0.25, sr = 8 * u;
  g.fillStyle = '#c9a24e'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fbf3dc'; g.lineWidth = 0.6 * u; g.beginPath(); g.arc(sx, sy, sr * 0.75, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fbf3dc'; fit('★', sr, 400, sr * 1.2); g.textBaseline = 'middle'; g.fillText('★', sx, sy + 0.5 * u);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#1d1d1f'; g.fillRect(W * 0.52, sy + 1 * u, W * 0.34, 0.35 * u);
  g.fillStyle = '#777'; fit('Authorized signature', 2.6 * u, 400, W * 0.34); g.fillText('Authorized signature', W * 0.69, sy + 5 * u);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.userData.keep = true;
  certCache.set(k, t);
  return t;
}

// Fit as many certificates as possible on a w x h board: clear of the edges and the 4 caps.
// Tries the real size (8.5x11) first, both ways round; smaller fallback sizes only if it doesn't fit at all.
function sheetLayout(w, h, turn = false) {
  if (turn === true) {   // "Rotate certificates 90°": force the opposite way round from the automatic choice
    const auto = sheetLayout(w, h);
    if (auto) return sheetLayout(w, h, auto.sw <= auto.sh ? 'wide' : 'tall');
  }
  const ways = (a, b) => turn === 'wide' ? [[b, a]] : turn === 'tall' ? [[a, b]] : [[a, b], [b, a]];
  const m = SHEETS.edgeMargin, clear = HW.capDia / 2 + SHEETS.capClearance;
  const caps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [sx * (w / 2 - HW.inset), sy * (h / 2 - HW.inset)]);
  const hitsCap = (r) => caps.some(([cx, cy]) => {
    const dx = cx - Math.max(r.x - r.w / 2, Math.min(cx, r.x + r.w / 2));
    const dy = cy - Math.max(r.y - r.h / 2, Math.min(cy, r.y + r.h / 2));
    return dx * dx + dy * dy < clear * clear;
  });
  for (const [a, b] of SHEETS.sizes) {
    let best = null;
    for (const [sw, sh] of ways(a, b)) {
      const matches = (sw <= sh) === (w <= h);           // sheet turned the same way as the board
      for (const gap of SHEETS.gaps) {
        for (let cols = Math.floor((w - 2 * m + gap) / (sw + gap)); cols >= 1; cols--) {
          for (let rows = Math.floor((h - 2 * m + gap) / (sh + gap)); rows >= 1; rows--) {
            const n = cols * rows;
            if (best && (n < best.n || (n === best.n && (best.matches || !matches)))) break;
            const tw = cols * sw + (cols - 1) * gap, th = rows * sh + (rows - 1) * gap;
            const rects = [];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              rects.push({ x: -tw / 2 + sw / 2 + c * (sw + gap), y: th / 2 - sh / 2 - r * (sh + gap), w: sw, h: sh });
            }
            if (rects.some(hitsCap)) continue;
            best = { n, cols, rows, sw, sh, rects, matches };
            break;
          }
        }
      }
    }
    if (best) return { ...best, size: [a, b], primary: a === SHEETS.sizes[0][0] && b === SHEETS.sizes[0][1] };
  }
  return null;
}
let lastSheets = null;

/* ------------------------------------------------------------------ uploaded artwork (logo + background) */
function rng(seed) {   // small seeded random generator so "Scatter" stays put until Shuffle is pressed
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// One repeat of the pattern: cell size W x H (inches) and where the copies sit inside it.
function lattice(L) {
  const w = L.size, h = L.size / L.aspect, px = w + L.gap, py = h + L.gap, r = L.rot;
  switch (L.layout) {
    case 'grid':      return { W: px, H: py, pts: [{ x: px / 2, y: py / 2, rot: r }] };
    case 'brick':     return { W: px, H: 2 * py, pts: [{ x: px / 2, y: py / 2, rot: r }, { x: 0, y: 1.5 * py, rot: r }] };
    case 'halfdrop':  return { W: 2 * px, H: py, pts: [{ x: px / 2, y: py / 2, rot: r }, { x: 1.5 * px, y: 0, rot: r }] };
    case 'honeycomb': {
      const d = Math.max(w, h) + L.gap, H = d * Math.sqrt(3);
      return { W: d, H, pts: [{ x: d / 2, y: H / 4, rot: r }, { x: 0, y: H * 0.75, rot: r }] };
    }
    case 'checker':   return { W: 2 * px, H: 2 * py, pts: [{ x: px / 2, y: py / 2, rot: r }, { x: 1.5 * px, y: 1.5 * py, rot: r }] };
    case 'mirror':    return { W: 2 * px, H: 2 * py, pts: [
      { x: px / 2, y: py / 2, rot: r }, { x: 1.5 * px, y: py / 2, rot: -r, fx: true },
      { x: px / 2, y: 1.5 * py, rot: -r, fy: true }, { x: 1.5 * px, y: 1.5 * py, rot: r, fx: true, fy: true }] };
    case 'flip':      return { W: px, H: 2 * py, pts: [{ x: px / 2, y: py / 2, rot: r }, { x: px / 2, y: 1.5 * py, rot: r + 180 }] };
    case 'scatter': {
      const W = 4 * px, H = 4 * py, rand = rng(L.seed), pts = [];
      const dist = (p, q) => { const dx = Math.abs(p.x - q.x) % W, dy = Math.abs(p.y - q.y) % H; return Math.hypot(Math.min(dx, W - dx), Math.min(dy, H - dy)); };
      for (let i = 0; i < 10; i++) {          // best-candidate sampling: spread copies out evenly-ish
        let pick = null, far = -1;
        for (let k = 0; k < 24; k++) {
          const c = { x: rand() * W, y: rand() * H };
          const d = pts.length ? Math.min(...pts.map(p => dist(p, c))) : 1;
          if (d > far) { far = d; pick = c; }
        }
        pts.push({ ...pick, rot: r * (rand() * 2 - 1), k: 0.75 + rand() * 0.35 });
      }
      return { W, H, pts };
    }
    default: {   // single
      const a = r * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const W = (w * c + h * s) * 1.04 + 0.1, H = (w * s + h * c) * 1.04 + 0.1;
      return { W, H, pts: [{ x: W / 2, y: H / 2, rot: r }] };
    }
  }
}
function artTexture(L) {   // L = layer settings (cover/fit already turned into a sized single image)
  const key = [L.imgId, L.layout, L.size, L.gap, L.rot, L.opacity, L.seed].join('|');
  if (L.cache._key === key) return L.cache._tex;
  if (L.cache._tex) L.cache._tex.dispose();
  const lat = lattice(L);
  const ppi = Math.min(96, ARTWORK.maxTexPx / Math.max(lat.W, lat.H));
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(lat.W * ppi)); c.height = Math.max(4, Math.round(lat.H * ppi));
  const g = c.getContext('2d');
  g.setTransform(c.width / lat.W, 0, 0, c.height / lat.H, 0, 0);   // draw in inches
  g.globalAlpha = L.opacity / 100; g.imageSmoothingQuality = 'high';
  const w = L.size, h = L.size / L.aspect, single = L.layout === 'single';
  const shifts = single ? [[0, 0]] : [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => [i, j]));   // copies that spill over a cell edge wrap around
  for (const p of lat.pts) for (const [i, j] of shifts) {
    g.save();
    g.translate(p.x + i * lat.W, p.y + j * lat.H);
    g.rotate(p.rot * Math.PI / 180);
    g.scale((p.fx ? -1 : 1) * (p.k ?? 1), (p.fy ? -1 : 1) * (p.k ?? 1));
    g.drawImage(L.img, -w / 2, -h / 2, w, h);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = single ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;   // single: transparent border clamps to "nothing"
  t.userData = { keep: true, lat };
  L.cache._key = key; L.cache._tex = t;
  return t;
}
// A transparent plane (sw x sh inches) carrying the artwork, centered on the surface + the move sliders.
function artMesh(key, sw, sh, rough) {
  const A = state.art[key];
  if (!A.img || A.hide) return null;   // hide = turned off with the eye icon (preview only)
  let L = { ...A, cache: A };
  if (A.layout === 'cover' || A.layout === 'fit') {          // size the image from the board instead of the slider
    const wide = A.aspect > sw / sh;
    L = { ...L, layout: 'single', size: ((A.layout === 'cover') === wide ? sh * A.aspect : sw) * (A.layout === 'cover' ? 1.003 : 1) };
  }
  const tex = artTexture(L), { W, H } = tex.userData.lat;
  tex.repeat.set(sw / W, sh / H);
  tex.offset.set(0.5 - (0.5 + L.offX / sw) * tex.repeat.x, 0.5 - (0.5 + L.offY / sh) * tex.repeat.y);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: rough,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  m.receiveShadow = true;
  return m;
}
// photo of the customer's wall (see "Room & lighting"): one texture, rebuilt only when a new photo is loaded
let photoTex = null, photoTexId = 0;
function photoTexture(P) {
  if (photoTex && photoTexId === P.imgId) return photoTex;
  photoTex?.dispose();
  photoTex = new THREE.CanvasTexture(P.img);
  photoTex.colorSpace = THREE.SRGBColorSpace; photoTex.anisotropy = 8; photoTex.userData.keep = true;
  photoTexId = P.imgId;
  return photoTex;
}
// v5 room photos (img/rooms/), loaded once each; the board is rebuilt when one arrives so its size is right
const SITE_ROOT = new URL('../', import.meta.url);
const roomTex = new Map();
function roomTexture(path) {
  if (roomTex.has(path)) return roomTex.get(path);
  const t = new THREE.TextureLoader().load(new URL(path, SITE_ROOT).href, () => {
    t.userData.aspect = t.image.width / t.image.height;
    if (envNow().wall.photo === path) buildBoard();
  });
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.keep = true;
  roomTex.set(path, t);
  return t;
}
async function loadArt(L, file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });   // (img.decode() can hang in some browsers)
    const iw = img.naturalWidth || 1024, ih = img.naturalHeight || 1024;
    const svg = file.type === 'image/svg+xml';
    const k = svg ? ARTWORK.maxUploadPx / Math.max(iw, ih) : Math.min(1, ARTWORK.maxUploadPx / Math.max(iw, ih));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    L.img = c; L.aspect = c.width / c.height; L.name = file.name; L.imgId = (L.imgId || 0) + 1;
  } finally { URL.revokeObjectURL(url); }
}

/* ------------------------------------------------------------------ geometry builders */
function boxMesh(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
function plateWithHoles(w, h, depth, holeR, pts, mat, z0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  for (const [px, py] of pts) {
    const p = new THREE.Path(); p.absarc(px, py, holeR, 0, Math.PI * 2, true); s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 32 });
  const m = new THREE.Mesh(g, mat); m.position.z = z0; m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cylZ(r, len, mat, x, y, zCenter, seg = 48) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, zCenter);
  m.castShadow = true; m.receiveShadow = true; return m;
}
function capMesh(mat, x, y, zBottom) {
  const r = HW.capDia / 2, t = HW.capT, ch = 0.035;
  const pts = [[0, 0], [r, 0], [r, t - ch], [r - ch, t], [0, t]].map(p => new THREE.Vector2(p[0], p[1]));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat);
  m.rotation.x = Math.PI / 2; m.position.set(x, y, zBottom);
  m.castShadow = true; m.receiveShadow = true; return m;
}

let disposables = [];
function clearRoot() {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== acrylicMat && o.material !== mdoMat && o.material !== backLamMat &&
        o.material !== alumMat && o.material !== steelMat) {
      if (o.material.map && !o.material.map.userData.keep) o.material.map.dispose();
      o.material.dispose();
    }
  });
  root.clear();
}

function buildBoard() {
  clearRoot();
  const { w, h } = dims();
  const T = HW.boardT, lam = HW.lamT, b = HW.bandT;
  const faceHex = state.lamSel ? state.lamSel.avg : colorHex(state.face);
  const edgeHex = state.edge === 'match' ? faceHex : colorHex(state.edge);
  const cx = w / 2 - HW.inset, cy = h / 2 - HW.inset;
  const pts = [[-cx, -cy], [cx, -cy], [-cx, cy], [cx, cy]];
  const iw = w - 2 * b, ih = h - 2 * b;

  // back laminate (black) with T-nut recess holes
  root.add(plateWithHoles(iw, ih, lam, HW.recessDia / 2, pts, backLamMat, 0));
  // MDO core: lower slab with recess holes, upper slab solid
  root.add(plateWithHoles(iw, ih, HW.recessDepth - lam, HW.recessDia / 2, pts, mdoMat, lam));
  root.add(boxMesh(iw, ih, T - lam - HW.recessDepth, mdoMat, 0, 0, HW.recessDepth + (T - lam - HW.recessDepth) / 2, false));
  // front laminate (board color)
  let frontMat;
  if (state.lamSel && state.lamSel.full) {
    const tex = lamTexture(state.lamSel.full);
    const tile = LAMINATE.tileIn;
    tex.center.set(0.5, 0.5);
    tex.rotation = state.grain ? Math.PI / 2 : 0;
    tex.repeat.set(state.grain ? h / tile : w / tile, state.grain ? w / tile : h / tile);
    frontMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  } else {
    frontMat = laminate(faceHex, 0.5);
  }
  root.add(boxMesh(iw, ih, lam, frontMat, 0, 0, T - lam / 2));
  // 1 mm PVC edge banding
  const bm = bandMat(edgeHex);
  root.add(boxMesh(w, b, T, bm, 0, h / 2 - b / 2, T / 2));
  root.add(boxMesh(w, b, T, bm, 0, -h / 2 + b / 2, T / 2));
  root.add(boxMesh(b, ih, T, bm, w / 2 - b / 2, 0, T / 2));
  root.add(boxMesh(b, ih, T, bm, -w / 2 + b / 2, 0, T / 2));

  // printed artwork on the board face: background image, then logo (both under the certificates)
  const bgArt = artMesh('background', iw, ih, 0.5);
  if (bgArt) { bgArt.position.z = T + 0.004; bgArt.renderOrder = 1; bgArt.userData.sec = 'bgimg'; root.add(bgArt); }
  const logo = artMesh('logo', iw, ih, 0.5);
  if (logo) { logo.position.z = T + 0.008; logo.renderOrder = 2; logo.userData.sec = 'logo'; root.add(logo); }

  // documents between board face and acrylic: the customer's own (any sizes, packed or dragged), or the samples
  lastSheets = sheetLayout(w, h, state.sheetTurn);
  lastDocs = state.myCerts.length ? packDocs(w, h, state.myCerts) : null;
  // (pulled toward the camera in the depth test, so they never flicker against the board face)
  const sheetMat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (state.sheets && lastDocs) {
    for (const r of lastDocs.places) {
      const d = state.myCerts[r.i];   // a photo of their own document, or a sample sized from their wall photo
      const mat = sheetMat(d.sample ? certificateTexture(r.w, r.h, d.title) : ownCertTexture(d, r.w, r.h));
      const p = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
      p.position.set(r.x, r.y, T + 0.03); p.receiveShadow = true; p.userData.sec = 'certs'; p.userData.doc = r.i; root.add(p);
    }
  } else if (state.sheets && lastSheets) {
    lastSheets.rects.forEach((r, i) => {
      const mat = sheetMat(certificateTexture(r.w, r.h, SHEETS.titles[i % SHEETS.titles.length]));
      const p = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
      p.position.set(r.x, r.y, T + 0.03); p.receiveShadow = true; p.userData.sec = 'certs'; root.add(p);
    });
  }

  // acrylic panel (same size as board, flush edges)
  const acr = boxMesh(w, h, HW.acrylicT, acrylicMat, 0, 0, T + HW.sheetGap + HW.acrylicT / 2, false);
  acr.receiveShadow = false; acr.castShadow = true; root.add(acr);

  // aluminum caps + M6 studs + recessed T-nuts
  const fm = fastenerMaterial();
  const zCapBottom = T + HW.sheetGap + HW.acrylicT;
  for (const [px, py] of pts) {
    root.add(capMesh(fm, px, py, zCapBottom));
    root.add(cylZ(HW.studDia / 2, 0.0625 + 0.001, steelMat, px, py, 0.0312));                     // stud tip at back
    const fl = cylZ(HW.tnutFlangeDia / 2, HW.tnutFlangeT, steelMat, px, py, HW.recessDepth - HW.tnutFlangeT / 2);
    root.add(fl);
    // dark bore in the T-nut so the stud tip reads as threaded in
    const bore = cylZ(HW.studDia / 2 + 0.012, 0.004, new THREE.MeshStandardMaterial({ color: '#202020', roughness: 1 }), px, py, 0.0125 - 0.001);
    root.add(bore);
  }

  // z-clip on the back (board half bolted to the board, wall half shown behind it)
  const e = w >= 12 ? HW.clipEndInsetBig : HW.clipEndInsetSmall;
  const cl = w - 2 * e;
  const t = HW.clipT, F = HW.clipFlange, L = HW.clipLip, D = HW.clipDepth;
  const yT = h - HW.clipTopInset, yb = yT - F;                     // from bottom edge (CAD)
  const Y = (y) => y - h / 2;                                      // to board-centered
  const add = (y0, y1, z0, z1) => root.add(boxMesh(cl, y1 - y0, z1 - z0, alumMat, 0, Y((y0 + y1) / 2), (z0 + z1) / 2));
  add(yb, yT, -t, 0);                          // board flange
  add(yb - t, yb, -D, 0);                      // leg
  add(yb - t - L, yb, -D, -D + t);             // hanging lip
  const ywl = yb - 0.05 - L;
  add(ywl, ywl + L, -D - t, -D);               // wall-half lip
  add(ywl - F, ywl, -D - 2 * t, -D - t);       // wall-half flange

  // wall: the room's wall (color or drawn texture), or a photo of the customer's own wall
  const wallG = new THREE.Group();
  wallG.name = 'wall'; wallG.position.z = -(D + 2 * t); wallG.visible = state.view !== 'back';
  const E = envNow();
  const wallMat = E.wall === 'color' || E.wall.photo
    ? new THREE.MeshStandardMaterial({ color: wallHex(), roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ map: wallTexture(E.wall.tex, E.wall.color, 400), roughness: E.wall.tex === 'steel' ? 0.45 : E.wall.tex === 'subway' ? 0.35 : 0.9, metalness: E.wall.tex === 'steel' ? 0.6 : 0 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), wallMat);
  wall.receiveShadow = true; wallG.add(wall);
  // a photo shows as-is (unlit), with the board's shadow laid over it
  const addPhoto = (tex, pw, ph, x, y) => {
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    photo.position.set(x, y, 0.03); wallG.add(photo);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.ShadowMaterial({ opacity: 0.32 }));
    shade.position.set(x, y, 0.05); shade.receiveShadow = true; wallG.add(shade);
  };
  const P = state.wallPhoto;
  if (P.img) addPhoto(photoTexture(P), P.widthIn, P.widthIn / P.aspect, 0, P.offY);
  else if (E.wall.photo) {                       // v5 photo room: the photo's hang point sits behind the board's center
    const tex = roomTexture(E.wall.photo), pw = E.wall.widthIn, ph = pw / (tex.userData.aspect || 4 / 3);
    addPhoto(tex, pw, ph, (0.5 - E.wall.hang[0]) * pw, (E.wall.hang[1] - 0.5) * ph);
  }
  root.add(wallG);

  // which panel section opens when this part of the board is clicked
  const tag = (sec, ...objs) => objs.forEach(o => { o.userData.sec = sec; });
  root.children.forEach(o => {
    if (o.userData.sec) return;
    const m = o.material;
    if (m === frontMat) tag('color', o);
    else if (m === bm) tag('edge', o);
    else if (m === fm) tag('caps', o);
    else if (m === backLamMat || m === alumMat) tag('size', o);
  });

  // light + shadow frustum scaled to the board
  const R = Math.max(w, h);
  key.position.set(-R * 0.7, R * 0.9, R * 1.3);
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const sc = key.shadow.camera; const s = R * 1.2;
  sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.5; sc.far = R * 6; sc.updateProjectionMatrix();
  applyRoomLight(w, h);

  scene.background = new THREE.Color(state.view === 'back' ? '#d7d7d9' : wallHex());
  needBgSample = true;
  dirty = true;
  updateUI();
}

/* ------------------------------------------------------------------ camera */
let tween = null;
// When the Wilsonart side panel covers the right of the 3D view (desktop), the view slides left by half the panel
// width and the board is framed to fit the part still visible. inset = covered width in pixels (animated).
const inset = { now: 0, target: 0 };
function applyInset() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (inset.now > 0.5 && W && H) camera.setViewOffset(W, H, inset.now / 2, 0, W, H);
  else camera.clearViewOffset();
}
function setInset(px) {
  inset.target = px;
  setView(state.view);   // re-frame for the visible width (animated)
}

function viewTarget(view) {
  const { w, h } = dims();
  const aspect = camera.aspect * (1 - inset.target / Math.max(1, stage.clientWidth));
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = Math.max(h / 2, w / 2 / aspect) / Math.tan(fov / 2) * 1.35 + 2;
  const tgt = new THREE.Vector3(0, 0, 0.5);
  let pos;
  if (FLAT && view !== 'back') {                 // v5: always the same slight downward look; Angle = 15 degrees to the side
    const yaw = view === 'front' ? 0 : 0.26;
    pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH)).multiplyScalar(dist);
  } else if (view === 'front') pos = new THREE.Vector3(0, 0, dist);
  else if (view === 'back') pos = new THREE.Vector3(0, 0, -dist);
  else pos = new THREE.Vector3(dist * 0.42, dist * 0.18, dist * 0.9);
  return { pos, tgt };
}
function setView(view, instant = false) {
  state.view = view;
  const { pos, tgt } = viewTarget(view);
  const wall = root.getObjectByName('wall');
  if (wall) wall.visible = view !== 'back';
  scene.background = new THREE.Color(view === 'back' ? '#d7d7d9' : wallHex());
  needBgSample = true;
  if (instant) { camera.position.copy(pos); controls.target.copy(tgt); lockAngles(view); controls.update(); }
  else { unlockAngles(); tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt }; }
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
}

/* ------------------------------------------------------------------ UI */
function swatchRow(el, items, getActive, onPick, extra) {
  el.innerHTML = '';
  if (extra) el.appendChild(extra);
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'sw'; b.style.setProperty('--c', it.hex); b.title = it.name; b.setAttribute('aria-label', it.name);
    b.dataset.k = it.name;
    b.addEventListener('click', () => onPick(it.name));
    el.appendChild(b);
  }
}
function paintActive() {
  const L = state.lamSel;
  document.querySelectorAll('#faceSw .sw').forEach(b => b.classList.toggle('on', b.dataset.k === state.face && !L));
  $('#lamBtn').classList.toggle('on', !!L);
  $('#lamBtnTitle').textContent = L ? `${L.n}${L.name ? ' · ' + L.name : ''}` : 'Browse Wilsonart designs';
  $('#lamBtnLabel').textContent = L ? 'Selected · open to change' : 'Woodgrains, stones, solids and more';
  $('#lamThumb').hidden = !L?.thumb; if (L?.thumb) $('#lamThumb').src = L.thumb;
  $('#lamSelRow').hidden = !L;
  $('#lamSelName').textContent = L ? `${L.n}${L.name ? ' · ' + L.name : ''}` : '';
  if (L?.thumb) $('#lamSelThumb').src = L.thumb; else $('#lamSelThumb').removeAttribute('src');
  $('#grainBtn').hidden = !(L && L.full);                     // typed-in numbers have no pattern to rotate
  $('#grainBtn').setAttribute('aria-pressed', state.grain);
  document.querySelectorAll('#edgeSw .sw').forEach(b => b.classList.toggle('on', b.dataset.k === state.edge));
  $('#edgeMatch').checked = state.edge === 'match';
  $('#edgeSw').classList.toggle('dim', state.edge === 'match');
  document.querySelectorAll('#fastSw .fast').forEach(b => b.classList.toggle('on', b.dataset.k === state.fastener));
  document.querySelectorAll('#wallSw .sw').forEach(b => b.classList.toggle('on', state.wall >= 0 && b.dataset.k === WALLS[state.wall].name));
  document.querySelectorAll('#envGrid .envt').forEach(b => b.classList.toggle('on', b.dataset.env === envNow().id));
  $('#wallColorWrap').hidden = envNow().wall !== 'color' || !!state.wallPhoto.img;
  renderSizes();
  document.querySelectorAll('#sizes .tile').forEach(b => b.classList.toggle('on', b.dataset.k === state.sizeId));
  document.querySelectorAll('[data-orient]').forEach(b => b.classList.toggle('on', b.dataset.orient === state.orient));
  $('#customBox').hidden = state.sizeId !== 'custom';
  document.querySelectorAll('#lamGrid .card').forEach(c => c.classList.toggle('on', c.dataset.n === L?.n));
}

// Size tiles: each board drawn to scale (in the chosen orientation) with its 4 caps and the certificates that fit.
function tileSVG(a, b) {
  const [w, h] = state.orient === 'portrait' ? [a, b] : [b, a];
  const k = 50 / Math.max(w, h), W = w * k, H = h * k, x0 = (60 - W) / 2, y0 = (60 - H) / 2;
  let s = `<svg viewBox="0 0 60 60" aria-hidden="true"><rect class="bd" x="${x0}" y="${y0}" width="${W}" height="${H}" rx="1.5"/>`;
  for (const r of sheetLayout(w, h, state.sheetTurn)?.rects ?? []) {
    s += `<rect class="sh" x="${x0 + (w / 2 + r.x - r.w / 2) * k}" y="${y0 + (h / 2 - r.y - r.h / 2) * k}" width="${r.w * k}" height="${r.h * k}" rx=".5"/>`;
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    s += `<circle class="cap" cx="${30 + sx * (w / 2 - HW.inset) * k}" cy="${30 + sy * (h / 2 - HW.inset) * k}" r="${Math.max(1.3, 0.5 * k)}"/>`;
  }
  return s + '</svg>';
}
function renderSizes() {
  const key = state.orient + state.sheetTurn;          // redraw only when the drawings would change
  if (renderSizes.key === key) return;
  renderSizes.key = key;
  const el = $('#sizes');
  const plus = `<svg viewBox="0 0 60 60" aria-hidden="true"><rect class="bd" x="14" y="8" width="32" height="44" rx="1.5"/><path d="M30 23v14M23 30h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  el.innerHTML = SIZES.map(s => `<button class="tile" type="button" data-k="${s.id}">${tileSVG(s.a, s.b)}<b>${s.a} × ${s.b}</b><small>$${s.price.toFixed(2)}</small></button>`).join('') +
    (LAYOUT === 'v5'   // v5: a full-width card under the standard sizes
      ? `<button class="tile custom wide" type="button" data-k="custom">${plus}<b>Custom Size</b><small>Up to ${CUSTOM.maxShort} × ${CUSTOM.maxLong} in · custom sizes require a custom quote</small></button>`
      : `<button class="tile custom" type="button" data-k="custom">${plus}<b>Custom</b><small>up to ${CUSTOM.maxShort}×${CUSTOM.maxLong}</small></button>`);
}

// Collapsible sections (all in one panel)

// The cart is a bottom panel (computers and phones): tap or swipe the handle (or the cart total) up to see it; swipe down to close.
const phone = matchMedia('(max-width: 860px)');
function setSheet(open) {
  if (open) { closeOptSheet(); if (phone.matches && !$('#lamPanel').hidden) closePicker(); }
  $('#buysheet').classList.toggle('open', open);
  $('#sheetGrab').setAttribute('aria-expanded', open);
  $('#sheetDim').hidden = !open || !phone.matches;
}
function wireSheet() {
  const g = $('#sheetGrab');
  let y0 = null;
  g.addEventListener('pointerdown', (e) => { y0 = e.clientY; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    const open = $('#buysheet').classList.contains('open');
    setSheet(Math.abs(dy) < 8 ? !open : dy < 0);     // tap toggles; swipe up opens, swipe down closes
  });
  $('#sheetDim').addEventListener('click', () => setSheet(false));
  $('#cartTotBtn').addEventListener('click', () => setSheet(!$('#buysheet').classList.contains('open')));
  phone.addEventListener('change', () => setSheet(false));
}
function setSec(sec, open) {
  sec.querySelector('.sec-h').setAttribute('aria-expanded', open);
  sec.querySelector('.sec-b').hidden = !open;
}
// Clicking a part of the board: open its section and fold the others (like Photoshop's auto-collapse)
function openSection(name) {
  const sec = document.querySelector(`.sec[data-sec="${name}"]`);
  if (!sec) return;
  if (phone.matches) return name === 'laminate' ? openPicker() : openOptSheet(sec);   // phones: the option opens in a pop-up sheet
  if (sec.hidden) return openOptSheet(sec);                          // v2/v3: options that aren't cards open in the side sheet
  document.querySelectorAll('.p-body .sec').forEach(s => setSec(s, s === sec));
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  sec.classList.remove('flash'); void sec.offsetWidth; sec.classList.add('flash');
}
// Phones: one option at a time in a pop-up sheet. The section's own controls are moved into the sheet while it's open.
let optOpen = null;   // { sec, body }
function openOptSheet(sec) {
  closeOptSheet(true);
  if (!$('#lamPanel').hidden) closePicker();
  setSheet(false);
  const body = sec.querySelector('.sec-b');
  body.hidden = false;
  $('#optBody').appendChild(body);
  $('#optTitle').textContent = sec.querySelector('.sec-t').textContent;
  $('#optIcon').innerHTML = sec.querySelector('.sec-h .i').outerHTML;
  $('#optSheet').hidden = false;
  $('#optBody').scrollTop = 0;
  optOpen = { sec, body };
  markActive(sec.dataset.sec);
  updateStage(true);
  if (!phone.matches) setInset($('#optSheet').getBoundingClientRect().width);   // computers: slide the board clear of the sheet
}
function closeOptSheet(switching) {
  if (!optOpen) return;
  optOpen.sec.appendChild(optOpen.body);
  setSec(optOpen.sec, false);
  $('#optSheet').hidden = true;
  optOpen = null;
  if (!switching) { markActive(null); updateStage(true); if (!phone.matches && inset.target) setInset(0); }
}
// phones: highlight the option button whose sheet is open
function markActive(name) {
  document.querySelectorAll('.p-body .sec').forEach(s => s.classList.toggle('active', s.dataset.sec === name));
}
// Phones: the 3D view is pinned to the top. It shrinks as you scroll down the options, and while a sheet is open
// it fits the space above the sheet, so the whole board is always visible while you make changes.
const STAGE = { max: 0.56, min: 0.34, sheet: 0.44 };   // fractions of the screen height (sheet: matches .side top: 44vh)
let stageQueued = false, stageMax = 0, stageW = 0;
function updateStage(animate) {
  const w = $('#stageWrap'), st = $('#stage'), root = document.documentElement;
  if (!phone.matches || fullStage()) { root.style.removeProperty('--stageMax'); w.style.clipPath = ''; st.style.transform = ''; stageMax = 0; return; }
  // full height is measured once per screen width, so the address bar sliding in/out doesn't make the view jump
  if (!stageMax || stageW !== innerWidth) {
    stageW = innerWidth; stageMax = Math.round(innerHeight * STAGE.max);
    root.style.setProperty('--stageMax', `${stageMax}px`);
  }
  const H = stageMax / STAGE.max, sheet = !$('#optSheet').hidden || !$('#lamPanel').hidden;
  const h = sheet ? H * STAGE.sheet : Math.max(H * STAGE.min, stageMax - scrollY);   // visible height of the view
  const top = st.offsetTop;                                        // the Front/Angle/Back row above the 3D view
  const s = Math.max(0.2, (h - top) / (stageMax - top));
  if (animate) { w.classList.add('anim'); clearTimeout(updateStage.t); updateStage.t = setTimeout(() => w.classList.remove('anim'), 320); }
  st.style.transform = s < 0.999 ? `scale(${s.toFixed(4)})` : '';
  w.style.clipPath = h < stageMax - 0.5 ? `inset(0 0 ${(stageMax - h).toFixed(1)}px 0)` : '';
}

function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }

function currentSpec() {
  const { w, h } = dims();
  const std = SIZES.find(s => s.id === state.sizeId);
  const f = FASTENERS.find(x => x.id === state.fastener);
  const edgeName = state.edge === 'match' ? 'Match board' : (state.edge[0] === '#' ? `Custom ${state.edge}` : state.edge);
  const faceName = state.face[0] === '#' ? `Custom color ${state.face}` : state.face;
  const L = state.lamSel;
  const printing = !(LAYOUT === 'v2' && state.path === 'standard') && LAYOUT !== 'v5';   // v2 Standard boards and v5 have no printing
  const G = printing ? state.art.logo : {}, B = printing ? state.art.background : {};
  // v1/v2: custom size, laminate, logo or printed background = quoted, not priced online.
  // v3: options are priced with upcharges and go in the cart; only custom sizes are quoted.
  const ups = PRICED ? upcharges(L, G, B) : [];
  const custom = PRICED ? !std : (!std || L || G.img || B.img);
  const baseFace = PRICED && (L || state.face[0] === '#') ? 'Black' : state.face;   // v3/v5: options ride on a base board
  const variantId = custom ? null : (SHOPIFY.variantIds[std.id]?.[baseFace] ?? null);
  return {
    size: std ? std.id : `custom ${fmt(w)}x${fmt(h)}`, widthIn: w, heightIn: h, orientation: state.orient,
    boardColor: L ? `Wilsonart ${L.n}${L.name ? ' ' + L.name : ''}` : faceName,
    laminateNumber: L ? L.n : null, laminateName: L ? (L.name || null) : null, laminateInLibrary: L ? !L.unknown : null,
    patternRotated: L ? state.grain : null,
    edgeBanding: edgeName, fastenerFinish: f.name, sheetsShown: state.sheets,
    certificatesFit: lastSheets?.primary ? lastSheets.n : 0,   // how many 8.5x11 certificates fit
    logo: G.img ? { file: G.name, layout: LAYOUTS.find(x => x.id === G.layout).name, widthIn: G.size, spacingIn: G.gap,
                    rotationDeg: G.rot, opacityPct: G.opacity, moveXIn: G.offX, moveYIn: G.offY } : null,
    background: B.img ? { file: B.name, layout: LAYOUTS.find(x => x.id === B.layout).name, widthIn: B.size, spacingIn: B.gap,
                          rotationDeg: B.rot, opacityPct: B.opacity, moveXIn: B.offX, moveYIn: B.offY } : null,
    quantity: state.qty,
    price: custom ? null : std.price + ups.reduce((s, u) => s + u.amount, 0), variantId,
    basePrice: std ? std.price : null, upcharges: ups,   // v3: the board's own price + each option's upcharge
    // everything needed to reopen this board from the cart ("Edit board")
    config: { sizeId: state.sizeId, orient: state.orient, face: state.face, edge: state.edge, fastener: state.fastener },
  };
}
// v3: the options on this board that cost extra (amounts in UPCHARGES, config.js)
function upcharges(L, G, B) {
  const U = UPCHARGES, out = [];
  if (L) out.push({ label: `Wilsonart laminate ${L.n}`, amount: upAmt(U.laminate) });
  else if (state.face[0] === '#') out.push({ label: 'Custom board color', amount: upAmt(U.customColor) });
  if (state.edge[0] === '#') out.push({ label: 'Custom edge color', amount: upAmt(U.edgeCustom) });
  const cap = upAmt(U.caps[state.fastener]);
  if (cap) out.push({ label: `${FASTENERS.find(f => f.id === state.fastener).name} caps`, amount: cap });
  if (G?.img) out.push({ label: 'Printed logo', amount: upAmt(U.logo) });
  if (B?.img) out.push({ label: 'Printed background image', amount: upAmt(U.background) });
  return out;
}
function logoLine(lg) {
  const fixed = lg.layout.startsWith('Single') || lg.layout.startsWith('Fill') || lg.layout.startsWith('Fit');
  return `${lg.file} (${lg.layout}${lg.layout.startsWith('Fill') || lg.layout.startsWith('Fit') ? '' : `, ${fmt(lg.widthIn)}" wide`}${fixed ? '' : `, ${fmt(lg.spacingIn)}" spacing`}${lg.rotationDeg ? `, rotated ${lg.rotationDeg}°` : ''}${lg.opacityPct < 100 ? `, ${lg.opacityPct}% opacity` : ''})`;
}
function updateUI() {
  paintActive();
  paintExtras();
  rememberDesign();
  const sp = currentSpec();
  paintLayout(sp);
  // main button: what it does + this board's price (quantity is set per board in the cart)
  $('#editBar').hidden = !(editing && sp.price);
  $('#ctaLabel').textContent = sp.price ? (editing ? 'Update cart item' : 'Add to cart') : 'Request a quote';
  $('#price').textContent = sp.price ? `$${(sp.price * sp.quantity).toFixed(2)}${sp.quantity > 1 ? ` · ${sp.quantity} boards` : ''}` : 'Custom quote';  $('#note').textContent = sp.price
    ? 'Ships with aluminum z-clip hanger, M6 studs and 1" caps. Prices shown are the standard-board prices; compliance sheets are not included.'
    : (sp.logo || sp.background)
      ? 'Printed boards are made to order — send us this spec (and your image files) and we will quote it.'
      : 'Custom boards are made to order — send us this spec and we will quote it.';

  // current choice shown on each folded section header
  const edgeTxt = sp.edgeBanding === 'Match board' ? 'Matches board' : sp.edgeBanding;
  const S0 = lastSheets;
  const v = {
    size: `${fmt(sp.widthIn)}" × ${fmt(sp.heightIn)}" · ${state.orient}`,
    color: state.lamSel ? (LAYOUT === 'v5' ? 'Texture chosen' : 'Custom laminate') : (state.face[0] === '#' ? 'Custom color' : state.face),
    laminate: state.lamSel ? `Wilsonart ${state.lamSel.n}` : 'None',
    edge: edgeTxt, caps: sp.fastenerFinish,
    bgimg: sp.background ? sp.background.layout : 'None',
    logo: sp.logo ? sp.logo.file : 'None',
    certs: !state.sheets ? 'Hidden' : S0?.primary ? `${S0.n} fit` : 'Smaller sample',
    wall: `${envNow().name}${state.wallPhoto.img ? ' · your wall' : ''}`,
    certs: state.myCerts.length ? `${state.myCerts.length} of yours` : (!state.sheets ? 'Hidden' : S0?.primary ? `${S0.n} fit` : 'Smaller sample'),
    mywall: state.myCerts.length ? `${state.myCerts.length} document${state.myCerts.length === 1 ? '' : 's'}` : wallInfo ? 'Photo' : 'Snap it',
  };
  document.querySelectorAll('[data-v]').forEach(el => { if (v[el.dataset.v] != null) el.textContent = v[el.dataset.v]; });

  // how many certificates fit
  const S = lastSheets;
  $('#sheetFit').textContent = !S
    ? 'No standard certificate fits on a board this small.'
    : S.primary
      ? `${S.n} × 8.5×11 certificate${S.n === 1 ? '' : 's'} fit${S.n === 1 ? 's' : ''} on this board (${S.cols} across, ${S.rows} down${S.sw > S.sh ? ', turned sideways' : ''}).`
      : `An 8.5×11 certificate won't fit on this board. Showing ${S.n === 1 ? 'one' : S.n} smaller ${fmt(S.size[0])}×${fmt(S.size[1])} certificate${S.n === 1 ? '' : 's'} instead.`;
  // custom limits warning
  if (state.sizeId === 'custom') {
    const a = Math.min(state.customA, state.customB), bb = Math.max(state.customA, state.customB);
    const bad = a < CUSTOM.min || a > CUSTOM.maxShort || bb > CUSTOM.maxLong;
    $('#customWarn').textContent = bad ? `Limits: ${CUSTOM.min}" minimum, up to ${CUSTOM.maxShort}" × ${CUSTOM.maxLong}". Larger sizes: contact us.` : '';
  }
}

function build() {
  $('#sizes').addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (t) { state.sizeId = t.dataset.k; refresh(true); }
  });

  // collapsible sections
  document.querySelectorAll('.sec-h').forEach(h => h.addEventListener('click', () => {
    if (phone.matches && h.closest('.sec').dataset.sec === 'laminate') return openPicker();   // phones: straight to the swatches
    if (phone.matches) return openOptSheet(h.closest('.sec'));     // phones: pop-up sheet instead of folding open
    setSec(h.closest('.sec'), h.getAttribute('aria-expanded') !== 'true');
  }));
  $('#optSheet [data-close]').addEventListener('click', () => closeOptSheet());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && optOpen && $('#lamPanel').hidden) closeOptSheet(); });
  addEventListener('scroll', () => {                               // phones: shrink the pinned 3D view as you scroll
    if (stageQueued) return;
    stageQueued = true;
    requestAnimationFrame(() => { stageQueued = false; updateStage(false); });
  }, { passive: true });
  addEventListener('resize', () => updateStage(false));
  phone.addEventListener('change', () => { closeOptSheet(); updateStage(false); $('#cartCheckout').hidden = !cartItems.length && !phone.matches; });
  $('#cartCheckout').hidden = !phone.matches;
  updateStage(false);
  wireBoardClicks();
  wireSheet();

  swatchRow($('#faceSw'), COLORS, null, (n) => { state.face = n; state.lamSel = null; refresh(); });
  // Match toggle: off = back to the last edge color picked (or one that contrasts with the board)
  $('#edgeMatch').addEventListener('change', (e) => {
    state.edge = e.target.checked ? 'match' : (state.lastEdge || (state.face === 'Black' ? 'White' : 'Black'));
    refresh();
  });
  swatchRow($('#edgeSw'), COLORS, null, (n) => { state.edge = state.lastEdge = n; refresh(); });
  swatchRow($('#wallSw'), WALLS, null, (n) => { state.wall = WALLS.findIndex(w => w.name === n); refresh(); });
  $('#wallCustom').addEventListener('input', (e) => { state.wall = -1; state.wallCustom = e.target.value; refresh(); });

  // rooms (wall + lighting presets; photo rooms in v5)
  const eg = $('#envGrid');
  eg.innerHTML = ROOMS.map(e => `<button type="button" class="envt" data-env="${e.id}"><i></i><b>${e.name}</b><small>${e.blurb}</small></button>`).join('');
  eg.querySelectorAll('.envt').forEach(b => {
    const E = ENVIRONMENTS.find(x => x.id === b.dataset.env);
    b.querySelector('i').style.setProperty('--swatch', E.wall.photo ? `url(${new URL(E.wall.thumb, SITE_ROOT).href}) center/cover` : wallSwatch(E));
  });
  eg.addEventListener('click', (e) => { const b = e.target.closest('.envt'); if (b) { state.env = b.dataset.env; refresh(); } });

  // a photo of the customer's own wall as the background (camera on phones, or upload)
  const P = state.wallPhoto;
  const syncPhoto = () => {
    $('#wallPhotoOpts').hidden = $('#wallPhotoClear').hidden = !P.img;
    $('#wallPhotoW').value = P.widthIn; $('#wallPhotoWOut').textContent = `${fmt(Math.round(P.widthIn / 12 * 10) / 10)} ft`;
    $('#wallPhotoY').value = P.offY; $('#wallPhotoYOut').textContent = `${P.offY}"`;
  };
  for (const id of ['#wallCam', '#wallFile']) $(id).addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { await loadArt(P, f); } catch { return toast("Sorry, that photo couldn't be read. Try a JPG or PNG."); }
    P.offY = 0; syncPhoto();
    refresh(); setView('front');
    toast('Your wall is now the background. Adjust "Width of the wall" until the board looks right.');
  });
  $('#wallPhotoClear').addEventListener('click', () => { P.img = null; syncPhoto(); refresh(); });
  $('#wallPhotoW').addEventListener('input', (e) => { P.widthIn = +e.target.value; syncPhoto(); refresh(); });
  $('#wallPhotoY').addEventListener('input', (e) => { P.offY = +e.target.value; syncPhoto(); refresh(); });
  syncPhoto();
  wireArt('logo', $('#logoArt'));
  wireArt('background', $('#bgArt'));

  // quantity
  $('#cartView').addEventListener('click', () => goShopify('/cart'));
  $('#cartCheckout').addEventListener('click', () => (cartItems.length ? goShopify('/checkout') : toast('Your cart is empty. Add a board first.')));

  const fs = $('#fastSw'); fs.innerHTML = '';
  for (const f of FASTENERS) {
    const b = document.createElement('button'); b.className = 'fast'; b.dataset.k = f.id;
    b.innerHTML = `<i style="--c:${f.color}"></i><span>${f.name}</span>`;
    b.addEventListener('click', () => { state.fastener = f.id; refresh(); });
    fs.appendChild(b);
  }

  $('#faceCustom').addEventListener('input', (e) => { state.face = e.target.value; state.lamSel = null; refresh(); });
  $('#lamBtn').addEventListener('click', () => ($('#lamPanel').hidden ? openPicker() : closePicker()));
  $('#lamClear').addEventListener('click', () => { state.lamSel = null; refresh(); });
  $('#grainBtn').addEventListener('click', () => { state.grain = !state.grain; refresh(); });
  $('#edgeCustom').addEventListener('input', (e) => { state.edge = state.lastEdge = e.target.value; refresh(); });
  $('#cw').addEventListener('input', (e) => { state.customA = clamp(+e.target.value); refresh(true); });
  $('#ch').addEventListener('input', (e) => { state.customB = clamp(+e.target.value); refresh(true); });
  document.querySelectorAll('[data-orient]').forEach(b => b.addEventListener('click', () => { state.orient = b.dataset.orient; refresh(true); }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#sheets').addEventListener('change', (e) => { state.sheets = e.target.checked; refresh(); });
  $('#sheetTurn').addEventListener('change', (e) => { state.sheetTurn = e.target.checked; refresh(); });
  $('#cta').addEventListener('click', onCta);
  wireExtras();

  // Start from a shared link (?size=12x24&color=Black&edge=Red&finish=chrome&orient=landscape&room=dining&lam=5075...),
  // otherwise from the last design made on this device.
  let d = readParams(new URLSearchParams(location.search));
  if (!Object.keys(d).length) {
    try { const saved = localStorage.getItem('cobo.last'); if (saved) { d = readParams(new URLSearchParams(saved)); restoredDesign = Object.keys(d).length > 0; } } catch { /* storage blocked */ }
  }
  const { lam, ...rest } = d;
  Object.assign(state, rest);
  pendingLam = lam || null;
  $('#sheets').checked = state.sheets; $('#sheetTurn').checked = state.sheetTurn;
  $('#cw').value = state.customA; $('#ch').value = state.customB;
  wireLayout();
}
let restoredDesign = false;
function clamp(v) { return Math.max(1, Math.min(96, isFinite(v) ? v : 12)); }

// Click a part of the board (a click, not a drag) to open its section in the panel; the cursor shows what's clickable.
function wireBoardClicks() {
  const el = renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const partAt = (ev) => {
    const r = el.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    for (const hit of ray.intersectObjects(root.children, true)) {
      if (!shown(hit.object)) continue;
      if (hit.object.userData.sec) return hit.object.userData.sec;
      if (hit.object.material !== acrylicMat) return null;   // look through the clear acrylic only
    }
    return null;
  };
  // the customer's own documents can be dragged around the board face
  const facePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(HW.boardT + 0.03)), hitPt = new THREE.Vector3();
  const docAt = (ev) => {
    partAt(ev);   // aims the ray
    for (const hit of ray.intersectObjects(root.children, true)) {
      if (!shown(hit.object) || hit.object.material === acrylicMat) continue;
      return hit.object.userData.doc !== undefined ? hit : null;
    }
    return null;
  };
  let down = null, hoverQueued = false, drag = null;
  const DRAG = LAYOUT !== 'v5';               // v5: documents are always auto-arranged (dragging is fiddly on phones)
  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    if (fullStage() || !DRAG) return;         // v4/v5 look browsing + tutorial screens: swipes change the look (see wireLooks)
    const hit = docAt(e);
    if (hit) {
      const o = hit.object;
      drag = { o, i: o.userData.doc, dx: o.position.x - hit.point.x, dy: o.position.y - hit.point.y, moved: false };
      controls.enabled = false;               // move the document, not the camera
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (drag && e.buttons) {
      partAt(e);
      if (ray.ray.intersectPlane(facePlane, hitPt)) {
        const { w, h } = dims(), g = drag.o.geometry.parameters;
        drag.o.position.x = Math.max(-w / 2 + g.width / 2, Math.min(w / 2 - g.width / 2, hitPt.x + drag.dx));
        drag.o.position.y = Math.max(-h / 2 + g.height / 2, Math.min(h / 2 - g.height / 2, hitPt.y + drag.dy));
        drag.moved = true; dirty = true;
      }
      return;
    }
    if (e.buttons || hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => { hoverQueued = false; el.style.cursor = DRAG && docAt(e) ? 'grab' : partAt(e) ? 'pointer' : ''; });
  });
  el.addEventListener('pointerup', (e) => {
    if (drag) {
      const d = drag;
      drag = null; controls.enabled = true;
      if (d.moved) { const doc = state.myCerts[d.i]; doc.px = d.o.position.x; doc.py = d.o.position.y; refresh(); return; }
    }
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;   // it was a drag (rotate)
    if (step() === 'intro' || step() === 'snap') return;
    const sec = partAt(e);
    if (sec && step() === 'styles') { setStep('custom'); setTimeout(() => openSection(sec), 60); }   // v4: tap a part to change it
    else if (sec) openSection(sec);
  });
}

// Upload + layout controls for one artwork layer, cloned from <template id="artTpl"> in index.html
function wireArt(key, mount) {
  const L = state.art[key], cfg = ARTWORK[key];
  const node = $('#artTpl').content.firstElementChild.cloneNode(true);
  const r = (n) => node.querySelector(`[data-r="${n}"]`);
  for (const l of LAYOUTS.filter(x => !x.only || x.only === key)) r('layout').add(new Option(l.name, l.id));
  const sliders = {
    size: [cfg.sizeMin, cfg.sizeMax, 0.25, '"'], gap: [0, cfg.gapMax, 0.25, '"'], rot: [-180, 180, 5, '°'],
    opacity: [10, 100, 5, '%'], offX: [-cfg.offsetMax, cfg.offsetMax, 0.25, '"'], offY: [-cfg.offsetMax, cfg.offsetMax, 0.25, '"'],
  };
  const sync = () => {
    r('opts').hidden = !L.img;
    r('clear').hidden = !L.img;
    r('name').textContent = L.img ? L.name : 'No image yet';
    r('pick').textContent = L.img ? 'Replace image…' : 'Upload image…';
    r('layout').value = L.layout;
    const fitted = L.layout === 'cover' || L.layout === 'fit';   // size comes from the board
    r('sizeWrap').hidden = fitted;
    r('gapWrap').hidden = L.layout === 'single' || fitted;
    r('shuffle').hidden = L.layout !== 'scatter';
    r('rotLbl').textContent = L.layout === 'scatter' ? 'Random spin (±)' : 'Rotation';
    for (const [k, [, , , u]] of Object.entries(sliders)) { r(k).value = L[k]; r(k + 'Out').textContent = fmt(L[k]) + u; }
  };
  for (const [k, [mn, mx, st]] of Object.entries(sliders)) {
    const el = r(k); el.min = mn; el.max = mx; el.step = st;
    el.addEventListener('input', () => { L[k] = +el.value; sync(); refresh(); });
  }
  r('layout').addEventListener('change', (e) => { L.layout = e.target.value; sync(); refresh(); });
  r('file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { await loadArt(L, f); } catch { return toast("Sorry, that file couldn't be read. Try a PNG, JPG or SVG."); }
    sync(); refresh();
  });
  r('clear').addEventListener('click', () => { L.img = null; L.name = ''; sync(); refresh(); });
  r('shuffle').addEventListener('click', () => { L.seed++; refresh(); });
  r('reset').addEventListener('click', () => { Object.assign(L, artDefaults(key)); sync(); refresh(); });
  mount.appendChild(node);
  sync();
}

/* ------------------------------------------------------------------ v2 / v3 / v5 layouts */
// Sections shown as main cards/squares in each version (the rest open from a row or link, in a side/bottom sheet).
const MAIN = {
  v2: { none: ['size'], standard: ['size', 'color', 'caps'], custom: ['size', 'laminate', 'color', 'logo', 'bgimg'] },
  v3: ['size', 'color', 'laminate', 'edge', 'caps', 'logo', 'bgimg', 'certs', 'wall'],
  v5: ['size', 'color', 'laminate', 'edge', 'caps', 'wall'],       // phones: 3 per row, Size / Colors / Textures on top
};
function wireLayout() {
  document.querySelectorAll(`.lay-${LAYOUT}`).forEach(el => { el.hidden = false; });
  if (LAYOUT === 'v1') return;
  // rows/links that open a section (in the side sheet on computers, the bottom sheet on phones)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) { const sec = document.querySelector(`.sec[data-sec="${b.dataset.open}"]`); if (sec) openOptSheet(sec); }
  });
  if (ROWS) {
    $('#lnMatch').addEventListener('change', (e) => { $('#edgeMatch').checked = e.target.checked; $('#edgeMatch').dispatchEvent(new Event('change')); });
    document.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.eye;
      if (k === 'sheets') { state.sheets = !state.sheets; $('#sheets').checked = state.sheets; }
      else state.art[k].hide = !state.art[k].hide;
      refresh();
    }));
  }
  if (LAYOUT === 'v2') {
    $('#fork').addEventListener('click', (e) => { const b = e.target.closest('[data-path]'); if (b) setPath(b.dataset.path); });
    // a shared/restored design picks its own path
    if (state.lamSel || pendingLam || state.face[0] === '#' || state.art.logo.img) state.path = 'custom';
    else if (restoredDesign || new URLSearchParams(location.search).has('size')) state.path = 'standard';
  }
  if (LAYOUT === 'v5') {
    // option titles in Title Case
    const titles = { size: 'Size', color: 'Colors', laminate: 'Textures', edge: 'Edge Banding', caps: 'Caps & Studs', wall: 'Room & Lighting',
                     mywall: 'My Wall', certs: 'Sample Certificates', presets: 'Popular Boards' };
    for (const [k, t] of Object.entries(titles)) { const el = $(`.sec[data-sec="${k}"] .sec-t`); if (el) el.textContent = t; }
    $('#lnCerts .lt').firstChild.textContent = 'Sample Certificates ';
    $('.sec[data-sec="laminate"] .sec-h .i use').setAttribute('href', '#i-weave');
    $('#lamTitle').textContent = 'Textures';
    // Size: Auto-suggest line, then Orientation, then the sizes (the custom size is a full-width card under them)
    const orient = $('[data-orient]').closest('.opt');
    orient.previousElementSibling?.matches('hr') && orient.previousElementSibling.remove();
    $('#sizes').before(orient);
    // Popular boards: a strip across the very top of the panel
    $('#popStrip').append($('#presetList'));
    // My Wall (opened from the panel header) holds the photo results, the certificate count and their own documents
    $('#mwSlot').append($('.certcount'), $('#ownDocs'));
    $('#ownDocs .opt span').textContent = 'Your Documents';
    $('#ownDocs .opt + .help').textContent = 'Each document we found, with its guessed size: change a size, turn one or remove extras. Or snap and upload your real permits and licenses to see them on the board.';
    $('#docTools .lbl').hidden = true;                         // (no dragging in v5)
    $('#myWallBtn').addEventListener('click', () => openOptSheet($('.sec[data-sec="mywall"]')));
    // rotate the certificates: the samples, or the documents found in their wall photo
    $('#lnTurn').addEventListener('click', () => {
      state.sheetTurn = !state.sheetTurn; $('#sheetTurn').checked = state.sheetTurn;
      if (state.myCerts.length) { state.myCerts.forEach(d => { d.turn = !d.turn; d.px = d.py = null; }); docsKey = ''; }
      refresh();
    });
    document.addEventListener('click', (e) => { if (e.target.closest('[data-snap]')) { closeOptSheet(); setStep('snap'); } });
    $('#autoBtn').addEventListener('click', () => setStep('snap'));
  }
}
// v2: Standard = stock colors, priced; Custom = laminate / any color / printing, quoted
function setPath(p) {
  state.path = p;
  if (p === 'standard') {
    state.lamSel = null;
    if (state.face[0] === '#') state.face = 'Black';
    if (state.edge[0] === '#') state.edge = 'match';
  }
  closeOptSheet();
  refresh();
  if (phone.matches) document.querySelector('.p-body .sec:not([hidden]):not([data-sec="size"])')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function paintLayout(sp) {
  if (LAYOUT === 'v1') return;
  const main = LAYOUT === 'v2' ? MAIN.v2[state.path || 'none'] : MAIN[LAYOUT] || MAIN.v3;
  document.querySelectorAll('.p-body .sec').forEach(s => { s.hidden = !main.includes(s.dataset.sec); });
  if (LAYOUT === 'v2') {
    document.querySelectorAll('#fork .forkc').forEach(b => b.classList.toggle('on', b.dataset.path === state.path));
    $('#forkStd').textContent = `$${(SIZES.find(s => s.id === state.sizeId)?.price ?? SIZES[0].price).toFixed(2)}`;
    $('#lines').hidden = !state.path;
    document.querySelectorAll('#lines [data-path]').forEach(r => { r.hidden = r.dataset.path !== state.path; });
    $('#faceCustom').closest('.opt').hidden = state.path === 'standard';   // Standard = stock colors only
  }
  if (ROWS) {
    $('#lnMatch').checked = state.edge === 'match';
    $('#lnEdge').hidden = state.edge === 'match';
    for (const b of document.querySelectorAll('[data-eye]')) {
      const k = b.dataset.eye, on = k === 'sheets' ? state.sheets : !state.art[k].hide;
      b.setAttribute('aria-pressed', on);
      b.disabled = k !== 'sheets' && !state.art[k].img;          // nothing to show/hide until something's uploaded
    }
  }
  if (LAYOUT === 'v5') {
    // their own uploaded documents replace the samples: the samples row is greyed out
    const own = state.myCerts.some(d => !d.sample);
    $('#lnCerts').classList.toggle('off', own);
    $('#lnCerts').querySelectorAll('button').forEach(b => { b.disabled = own; });
    $('#lnTurn').setAttribute('aria-pressed', state.sheetTurn);
    $('#myWallBtn .v').textContent = state.myCerts.length ? ` · ${state.myCerts.length}` : '';
    $('#mwEmpty').hidden = !!wallInfo; $('#mwGot').hidden = !wallInfo;
    if (wallInfo) {
      const n = state.myCerts.filter(d => d.sample).length;
      $('#mwSw').style.background = wallInfo.hex;
      $('#mwTxt').textContent = `${n ? `${n} document${n === 1 ? '' : 's'} on a` : 'A'} ${wallInfo.name} wall`;
    }
  }
  if (PRICED) paintPrices();
}
// v3: "Included" / "+$X" on each option. v5: only the extra costs ("+$X"), plus the board's price on Size.
function paintPrices() {
  const U = UPCHARGES, v5 = LAYOUT === 'v5', tag = (n) => (n ? `+$${n}` : v5 ? '' : 'Included');
  const set = (el, n) => { if (el) { el.textContent = tag(n); el.classList.toggle('inc', !n); el.hidden = !el.textContent; } };
  const badge = (h) => {
    let up = h.querySelector('.up');
    if (!up) { up = document.createElement('em'); up.className = 'up'; h.insertBefore(up, h.querySelector('.chev')); }
    return up;
  };
  const head = {
    color: state.face[0] === '#' && !state.lamSel ? upAmt(U.customColor) : 0,
    laminate: upAmt(U.laminate), edge: state.edge[0] === '#' ? upAmt(U.edgeCustom) : 0,
    caps: upAmt(U.caps[state.fastener]), logo: upAmt(U.logo), bgimg: upAmt(U.background),
  };
  for (const [k, n] of Object.entries(head)) {
    const h = document.querySelector(`.sec[data-sec="${k}"] .sec-h`);
    if (h) set(badge(h), n);
  }
  if (v5) {                                                    // Size: this board's own price
    const up = badge($('.sec[data-sec="size"] .sec-h')), std = SIZES.find(s => s.id === state.sizeId);
    up.classList.add('size');
    up.textContent = std ? `$${std.price.toFixed(2)}` : '';
    up.hidden = !std;
  }
  document.querySelectorAll('#fastSw .fast').forEach(b => {
    let up = b.querySelector('.up');
    if (!up) { up = document.createElement('em'); up.className = 'up'; b.insertBefore(up, b.querySelector('span').nextSibling); }
    set(up, upAmt(U.caps[b.dataset.k]));
  });
  const extra = (input, n) => { const row = $(input)?.closest('.opt'); if (!row) return; let up = row.querySelector('.up'); if (!up) { up = document.createElement('em'); up.className = 'up'; row.insertBefore(up, $(input)); } set(up, n); };
  extra('#faceCustom', upAmt(U.customColor)); extra('#edgeCustom', upAmt(U.edgeCustom));
  // priced instead of quoted
  const sz = state.sizeId === 'custom' ? 'custom-size' : state.sizeId.replace('x', '×');
  const words = { laminate: `Wilsonart laminate adds $${upAmt(U.laminate)} to a ${sz} board.`, background: `A printed background adds $${upAmt(U.background)} per board.`, logo: `A printed logo adds $${upAmt(U.logo)} per board.` };
  document.querySelectorAll('[data-quote]').forEach(el => { el.textContent = words[el.dataset.quote]; });
}

/* ------------------------------------------------------------------ helpers for a better start */
// Own certificates: each photo is fitted onto a white sheet the size of the certificate spot.
function ownCertTexture(own, w, h) {
  const k = `${w}x${h}`;
  own.tex ??= {};
  if (own.tex[k]) return own.tex[k];
  const ppi = 48, c = document.createElement('canvas'); c.width = Math.round(w * ppi); c.height = Math.round(h * ppi);
  const g = c.getContext('2d'), m = 0.2 * ppi;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  const s = Math.min((c.width - 2 * m) / own.img.width, (c.height - 2 * m) / own.img.height);
  const iw = own.img.width * s, ih = own.img.height * s;
  g.drawImage(own.img, (c.width - iw) / 2, (c.height - ih) / 2, iw, ih);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.keep = true;
  return (own.tex[k] = t);
}

// ---- The customer's own documents: any size (Letter, Legal, Tabloid, posters, custom), turned either way ----
let lastDocs = null;   // { places: [{ i, x, y, w, h }], missing: [i...] } for the current board
const docDims = (d) => {
  const s = DOC_SIZES.find(x => x.id === d.size);
  const [w, h] = s ? [s.w, s.h] : [d.cw || 8.5, d.ch || 11];
  return d.turn ? [h, w] : [w, h];
};
const docLabel = (d) => { const [w, h] = docDims(d), s = DOC_SIZES.find(x => x.id === d.size); return `${s ? s.name + ' ' : ''}${fmt(Math.min(w, h))}×${fmt(Math.max(w, h))}`; };
// Guess a paper size from the photo's shape (posters look like letters in a photo, so those are picked by hand)
function guessDoc(d) {
  const r = Math.max(d.aspect, 1 / d.aspect);
  const best = ['letter', 'legal', 'tabloid'].map(id => DOC_SIZES.find(s => s.id === id))
    .reduce((a, s) => (Math.abs(s.h / s.w - r) < Math.abs(a.h / a.w - r) ? s : a));
  d.size = best.id; d.turn = d.aspect > 1; d.cw = 8.5; d.ch = 11; d.px = d.py = null;
}
// Keep documents clear of the 4 caps (+ clearance), like the sample certificates
function capHit(W, H) {
  const clear = HW.capDia / 2 + SHEETS.capClearance;
  const caps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [sx * (W / 2 - HW.inset), sy * (H / 2 - HW.inset)]);
  return (r) => caps.some(([cx, cy]) => {
    const dx = cx - Math.max(r.x - r.w / 2, Math.min(cx, r.x + r.w / 2)), dy = cy - Math.max(r.y - r.h / 2, Math.min(cy, r.y + r.h / 2));
    return dx * dx + dy * dy < clear * clear;
  });
}
// Pack mixed-size documents in centered rows (largest first). If that leaves some out, try a tighter packing that
// also stacks small documents beside big ones (and, for samples from a wall photo, may turn one sideways).
// Anything touching a cap is packed again inside the caps. Dragged documents keep their spot.
// Returns what's placed and what doesn't fit.
const packMemo = new Map();
function packDocs(W, H, docs) {
  const key = `${W}x${H}|${docs.map(d => [...docDims(d), d.sample ? 1 : 0].join(',')).join(';')}`;
  if (!packMemo.has(key)) { if (packMemo.size > 400) packMemo.clear(); packMemo.set(key, packFresh(W, H, docs)); }
  const P = packMemo.get(key);
  // dragged documents stay where they were put (kept on the board)
  return { missing: P.missing, places: P.places.map(p => {
    const d = docs[p.i];
    return d.px == null ? { ...p } : { ...p, x: Math.max(-W / 2 + p.w / 2, Math.min(W / 2 - p.w / 2, d.px)), y: Math.max(-H / 2 + p.h / 2, Math.min(H / 2 - p.h / 2, d.py)) };
  }) };
}
function packFresh(W, H, docs) {
  const hits = capHit(W, H), g = 0.75;
  const items = () => docs.map((d, i) => { const [w, h] = docDims(d); return { i, w, h, turn: !!d.sample }; });
  const rowPack = (m) => {
    const AW = W - 2 * m, AH = H - 2 * m, missing = [], rows = [];
    const order = items().sort((a, b) => b.h - a.h || b.w - a.w);
    let row = null;
    for (const it of order) {
      if (it.w > AW || it.h > AH) { missing.push(it.i); continue; }
      if (!row || row.w + g + it.w > AW) { row = { items: [], w: -g, h: 0 }; rows.push(row); }
      row.items.push(it); row.w += g + it.w; row.h = Math.max(row.h, it.h);
    }
    let total = -g; const kept = [];
    for (const r of rows) { if (total + g + r.h <= AH) { kept.push(r); total += g + r.h; } else missing.push(...r.items.map(x => x.i)); }
    const places = []; let top = total / 2;
    for (const r of kept) {
      let x = -r.w / 2;
      for (const it of r.items) { places.push({ i: it.i, x: x + it.w / 2, y: top - it.h / 2, w: it.w, h: it.h }); x += it.w + g; }
      top -= r.h + g;
    }
    return { places, missing };
  };
  // free-space packing (MaxRects, best short side fit) with the 4 caps blocked off; the group is then centered
  const ORDERS = [(a, b) => b.w * b.h - a.w * a.h, (a, b) => b.h - a.h || b.w - a.w, (a, b) => b.w - a.w || b.h - a.h, (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h)];
  const tightPack = (gap, list, rule, flip) => {
    const m = SHEETS.edgeMargin, AW = W - 2 * m + gap, AH = H - 2 * m + gap;   // each document carries a gap right and below
    let free = [{ x: 0, y: 0, w: AW, h: AH }];
    const cut = (R) => {                                   // take rectangle R out of the free space
      const next = [];
      for (const f of free) {
        if (R.x >= f.x + f.w || R.x + R.w <= f.x || R.y >= f.y + f.h || R.y + R.h <= f.y) { next.push(f); continue; }
        if (R.x > f.x) next.push({ x: f.x, y: f.y, w: R.x - f.x, h: f.h });
        if (R.x + R.w < f.x + f.w) next.push({ x: R.x + R.w, y: f.y, w: f.x + f.w - R.x - R.w, h: f.h });
        if (R.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: R.y - f.y });
        if (R.y + R.h < f.y + f.h) next.push({ x: f.x, y: R.y + R.h, w: f.w, h: f.y + f.h - R.y - R.h });
      }
      free = next.filter((a, k) => !next.some((b, j) => j !== k && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
        && (j < k || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)));
    };
    const rc = HW.capDia / 2 + SHEETS.capClearance, c = HW.inset - m;   // cap keep-out square, in packing coordinates
    for (const [cx, cy] of [[c, c], [W - 2 * m - c, c], [c, H - 2 * m - c], [W - 2 * m - c, H - 2 * m - c]]) cut({ x: cx - rc + gap, y: cy - rc + gap, w: 2 * rc - gap, h: 2 * rc - gap });
    const placed = [], missing = [];
    for (const [k, it] of list.entries()) {
      let best = null;
      const ways = it.turn ? [[it.w, it.h], [it.h, it.w]] : [[it.w, it.h]];   // samples may be turned; flip(k): try that first
      for (const [w, h] of flip(k) ? ways.reverse() : ways) {
        for (const f of free) {
          if (w + gap > f.w + 1e-6 || h + gap > f.h + 1e-6) continue;
          // rule 0: best short side fit; 1: highest spot first (fills rows); 2: leftmost spot first (fills columns)
          const s = rule === 1 ? f.y * 1000 + f.x : rule === 2 ? f.x * 1000 + f.y : Math.min(f.w - w - gap, f.h - h - gap);
          if (!best || s < best.s - 1e-6 || (Math.abs(s - best.s) < 1e-6 && f.y * 100 + f.x < best.y * 100 + best.x)) best = { s, x: f.x, y: f.y, w, h };
        }
      }
      if (!best) { missing.push(it.i); continue; }
      placed.push({ i: it.i, ...best });
      cut({ x: best.x, y: best.y, w: best.w + gap, h: best.h + gap });
    }
    // center the group, as long as that keeps it clear of the caps
    const x0 = Math.min(...placed.map(p => p.x)), x1 = Math.max(...placed.map(p => p.x + p.w));
    const y0 = Math.min(...placed.map(p => p.y)), y1 = Math.max(...placed.map(p => p.y + p.h));
    const at = (dx, dy) => placed.map(p => ({ i: p.i, x: -W / 2 + m + p.x + p.w / 2 + dx, y: H / 2 - m - p.y - p.h / 2 - dy, w: p.w, h: p.h }));
    let places = at(0, 0);
    if (placed.length) {
      const centered = at((W - 2 * m - x1 - x0) / 2, (H - 2 * m - y1 - y0) / 2);
      if (!centered.some(hits)) places = centered;
    }
    return { places, missing };
  };
  // rows first (tidiest); the tighter packing only when rows leave documents out
  let P = rowPack(SHEETS.edgeMargin);
  if (P.places.some(hits)) P = rowPack(HW.inset + HW.capDia / 2 + SHEETS.capClearance);
  const FLIPS = [() => false, () => true, (k) => k > 0];          // as they are / turned first / all but the biggest
  for (const gap of [g, 0.5]) for (const flip of FLIPS) for (const order of ORDERS) for (const rule of [0, 1, 2]) {
    if (!P.missing.length) break;
    const t = tightPack(gap, items().sort(order), rule, flip);
    if (t.missing.length < P.missing.length) P = t;
  }
  // still short: a few hundred random orders and turns (the same ones every time, so the layout doesn't jump)
  const rand = rng(11);
  for (let n = 0; n < 250 && P.missing.length; n++) {
    const list = items().map(it => ({ it, r: rand() })).sort((a, b) => a.r - b.r).map(x => x.it);
    const turns = list.map(() => rand() < 0.5), gap = rand() < 0.5 ? g : 0.5;
    const t = tightPack(gap, list, Math.floor(rand() * 3), (k) => turns[k]);
    if (t.missing.length < P.missing.length) P = t;
  }
  return P;
}
// "Snap your wall": count the documents in a photo, guess their sizes, fill the board with samples that size
async function scanWall(file) {
  const tmp = {};
  try { await loadArt(tmp, file); } catch { return toast("Sorry, that photo couldn't be read. Try a JPG or PNG."); }
  const found = sizeDocuments(findDocuments(tmp.img), DOC_SIZES);
  // preview: the photo with a numbered box around each document found
  const cv = $('#scanCanvas'), k = 640 / Math.max(tmp.img.width, tmp.img.height);
  cv.width = Math.round(tmp.img.width * k); cv.height = Math.round(tmp.img.height * k);
  const g = cv.getContext('2d'); g.drawImage(tmp.img, 0, 0, cv.width, cv.height);
  g.lineWidth = 3; g.font = 'bold 16px system-ui, sans-serif';
  found.forEach((f, i) => {
    const b = f.box;
    g.strokeStyle = '#2e7d4f'; g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
    g.fillStyle = '#2e7d4f'; g.fillRect(b.x * k, b.y * k, 24, 22); g.fillStyle = '#fff'; g.fillText(i + 1, b.x * k + 7, b.y * k + 17);
  });
  $('#scanResult').hidden = false;
  if (!found.length) {
    $('#scanText').textContent = "We couldn't spot the certificates in that photo. Try again closer up, with the wall behind them in view, or set the number with − / +.";
    return { found, img: tmp.img };
  }
  const counts = {};
  for (const f of found) { const s = DOC_SIZES.find(x => x.id === f.size); const n = `${s.name.toLowerCase()} ${fmt(s.w)}×${fmt(s.h)}`; counts[n] = (counts[n] || 0) + 1; }
  $('#scanText').textContent = `Found ${found.length}: ${Object.entries(counts).map(([n, c]) => `${c} ${n}`).join(', ')}. Wrong? Change sizes or remove extras ${LAYOUT === 'v5' ? 'below' : 'under Sample certificates'}.`;
  state.myCerts = found.map((f, i) => {
    const s = DOC_SIZES.find(x => x.id === f.size);
    const d = { sample: true, title: SHEETS.titles[i % SHEETS.titles.length], size: f.size, turn: f.turn, cw: s.w, ch: s.h, px: null, py: null, imgId: `s${i}${Math.random()}`, aspect: f.turn ? s.h / s.w : s.w / s.h };
    d.thumb = certificateTexture(f.turn ? s.h : s.w, f.turn ? s.w : s.h, d.title).image.toDataURL('image/jpeg', 0.5);
    return d;
  });
  state.sheets = true; $('#sheets').checked = true;
  docsKey = '';
  useBestFit();
  if (LAYOUT !== 'v4') toast(`Found ${found.length} document${found.length === 1 ? '' : 's'}. Here's a board that fits them.`);
  return { found, img: tmp.img };
}

// "See an example" (also ?scan=demo): a drawn photo of a wall with 6 certificates, run through the same scan
async function scanExample() {
  const W = 1600, H = 1200, ppi = 22, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), rnd = rng(3);
  g.fillStyle = '#8c9a86'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 30000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * W, rnd() * H, 3, 3); }
  const docs = [[90, 110, 8.5, 11, '#1b3a6b'], [330, 110, 8.5, 11, '#b3261e'], [590, 130, 8.5, 11, '#2c6e49', 1], [90, 420, 8.5, 11, '#6b4a33'], [860, 100, 11, 17, '#1b3a6b'], [1180, 140, 8.5, 11, '#c27c0e']];
  for (const [x, y, w, h, head, frame] of docs) {
    const pw = w * ppi, ph = h * ppi;
    if (frame) { g.fillStyle = '#2a2420'; g.fillRect(x - 18, y - 18, pw + 36, ph + 36); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 6, y + 8, pw, ph);
    g.fillStyle = '#f6f3ec'; g.fillRect(x, y, pw, ph);
    g.fillStyle = head; g.fillRect(x + pw * 0.08, y + ph * 0.06, pw * 0.84, ph * 0.08);
    g.fillStyle = '#9a9a9a'; for (let yy = y + ph * 0.22; yy < y + ph * 0.9; yy += ph * 0.045) g.fillRect(x + pw * 0.1, yy, pw * 0.8 * (0.6 + rnd() * 0.4), ph * 0.012);
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  return scanWall(new File([blob], 'example-wall.jpg', { type: 'image/jpeg' }));
}

/* ------------------------------------------------------------------ v4 + v5: guided, photo first */
// v4: 1 (intro) full screen, snap your wall.  2 (styles) swipe through looks picked for that wall; the board stays put.
//     3 (custom) the usual options panel.
// v5: the same idea as a short tutorial over the live 3D board, one full screen at a time, with Back and Skip:
//     intro (welcome; the board turns slowly on a real wall) -> snap (live camera on phones) -> styles ("Our picks")
//     -> custom. The step is <html data-step="...">; index.html's CSS shows and hides the parts.
function step() { return document.documentElement.dataset.step || ''; }
const fullStage = () => ['styles', 'intro', 'snap'].includes(step()) && GUIDED;   // the board fills the screen
let looks = [], lookAt = 0, wallInfo = null;
let sway = null;            // v5 welcome/snap: the camera holds still at this framing (board beside the card)
let showcase = null;        // v5: the room the board was in before the welcome screen showed it on brick
function setStep(s) {
  document.documentElement.dataset.step = s;
  controls.enabled = !['styles', 'intro', 'snap'].includes(s);   // swipes change the look / tutorial screens: no turning
  if (s !== 'custom') { closeOptSheet(); if (!$('#lamPanel').hidden) closePicker(); setSheet(false); }
  if (LAYOUT === 'v5') tourStep(s);
  scrollTo(0, 0);
  updateStage();
  requestAnimationFrame(() => {
    resize();
    if (!sway) return setView(s === 'styles' ? 'angle' : state.view);
    sway = swayFrame();                                      // (sized for the full-screen view, after the resize)
    const p = swayPose(sway);
    unlockAngles(); tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p.pos, t1: p.tgt };
  });
}
const hexL = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const lookFace = (L) => (L.lam && findByNumber(L.lam)?.avg) || (L.lam ? '#808080' : colorHex(L.cfg.face));
// best looks for the wall first; boards that stand out from the wall get a boost
function rankLooks(w) {
  return STYLES.map((s, i) => ({
    ...s,
    score: !w ? -i : (s.base || 0) + s.suits.light * w.light + s.suits.warm * w.warm + s.suits.colorful * w.colorful + 2 * Math.abs(hexL(lookFace(s)) - (w.light + 1) / 2),
  })).sort((a, b) => b.score - a.score);
}
function lookWhy(L) {
  if (!wallInfo) return LAYOUT === 'v5' ? 'Swipe to see more of our picks' : 'Swipe to see more looks';
  const c = Math.abs(hexL(lookFace(L)) - (wallInfo.light + 1) / 2);
  return `${c > 0.4 ? 'Stands out on' : c < 0.18 ? 'Blends softly with' : 'Sits nicely on'} your ${wallInfo.name} wall`;
}
function showLook(i, dir = 0) {
  lookAt = (i + looks.length) % looks.length;
  const L = looks[lookAt];
  applyDesign({ ...L.cfg, lam: L.lam || null, env: 'studio' }, false);   // keeps the size from the photo; camera stays put
  const best = wallInfo && lookAt === 0 ? 'Best match · ' : '';
  $('#lookCount').textContent = LAYOUT === 'v5' ? `${best}${lookAt + 1} of ${looks.length}` : `${best || 'Look '}${lookAt + 1} of ${looks.length}`;
  $('#lookKick').textContent = `Step 3 of 3 · ${wallInfo ? 'Picked for your wall' : 'Our picks'}`;
  $('#lookName').textContent = L.name;
  $('#lookSpec').textContent = L.blurb;
  $('#lookWhy').textContent = lookWhy(L);
  const sp = currentSpec();
  $('#lookPrice').textContent = sp.price ? `$${sp.price.toFixed(2)}` : 'Custom quote';
  $('#lookDots').innerHTML = looks.map((_, k) => `<i class="${k === lookAt ? 'on' : ''}"></i>`).join('');
  const c = $('#lookCard'); c.classList.remove('in-l', 'in-r'); void c.offsetWidth; if (dir) c.classList.add(dir > 0 ? 'in-r' : 'in-l');
}
function browseLooks() {
  looks = rankLooks(wallInfo);
  $('#lookWall').hidden = !wallInfo;
  $('#lookRetake').textContent = wallInfo ? 'Retake photo' : 'Snap your wall';
  setStep('styles');
  showLook(0);
}
async function guideScan(file) {
  const busy = LAYOUT === 'v5' ? $('#tourSnap') : $('#guide'), msg = LAYOUT === 'v5' ? $('#tourMsg') : $('#guideMsg');
  busy.classList.add('busy'); msg.textContent = '';
  let r = null;
  try { r = file ? await scanWall(file) : await scanExample(); } catch (e) { console.error(e); }
  busy.classList.remove('busy');
  if (!r?.found?.length) {
    msg.textContent = LAYOUT === 'v5'
      ? "We couldn't spot the certificates in that photo. Try a little closer, with some wall showing around them, or tap Skip to see our picks."
      : "We couldn't spot the certificates in that photo. Try again a little closer, with some wall showing around them, or browse the looks without a photo.";
    if (camStream) $('#camFeed').play().catch(() => {});
    return;
  }
  wallInfo = wallLook(r.img, r.found.map(f => f.box));
  if (wallInfo) {                                          // show the board on a wall the color of theirs
    showcase = null;                                       // (their wall replaces the room from before the welcome screen)
    Object.assign(state, { env: 'studio', wall: -1, wallCustom: wallInfo.hex });
    $('#wallCustom').value = wallInfo.hex;
    $('#lookSw').style.background = wallInfo.hex;
    const n = r.found.length;
    $('#lookWallTxt').textContent = `${n} document${n === 1 ? '' : 's'} on a ${wallInfo.name} wall`;
    $('#lookShot').src = $('#scanCanvas').toDataURL('image/jpeg', 0.7);
  }
  browseLooks();
}
// the look bar (shared by v4 and v5): arrows, swipes, keys and its buttons
function wireLooks() {
  $('#lookPrev').addEventListener('click', () => showLook(lookAt - 1, -1));
  $('#lookNext').addEventListener('click', () => showLook(lookAt + 1, 1));
  $('#lookCustomize').addEventListener('click', () => { setStep('custom'); toast(`${looks[lookAt].name}: tap any option to change it.`); });
  $('#lookScratch').addEventListener('click', () => { applyDesign({ face: 'Black', edge: 'match', fastener: 'alum', lam: null }); setStep('custom'); });
  $('#lookRetake').addEventListener('click', () => setStep(LAYOUT === 'v5' ? 'snap' : 'intro'));
  // swipe the board or the card to change the look
  let sx = null;
  const down = (e) => { if (step() === 'styles' && !e.target.closest('button')) sx = { x: e.clientX, y: e.clientY }; };
  stage.addEventListener('pointerdown', down);
  $('#lookBar').addEventListener('pointerdown', down);
  addEventListener('pointerup', (e) => {
    if (!sx) return;
    const dx = e.clientX - sx.x, dy = e.clientY - sx.y; sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) showLook(lookAt + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  addEventListener('pointercancel', () => { sx = null; });
  addEventListener('keydown', (e) => {
    if (step() !== 'styles' || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') showLook(lookAt + 1, 1);
    if (e.key === 'ArrowLeft') showLook(lookAt - 1, -1);
  });
}
// where to start: shared links go straight to the options; ?scan=demo runs the example photo; ?step=styles browses
function firstStep(photoStep) {
  const q = new URLSearchParams(location.search);
  if (q.has('size') || q.has('color')) setStep('custom');
  else if (q.get('scan') === 'demo') { setStep(photoStep); guideScan(null); }
  else if (q.get('step') === 'styles') browseLooks();
  else if (q.get('step') === 'snap' && LAYOUT === 'v5') setStep('snap');
  else setStep('intro');
}
function wireGuide() {
  const onFile = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) guideScan(f); };
  $('#guideCam').addEventListener('change', onFile);
  $('#guideFile').addEventListener('change', onFile);
  $('#guideDemo').addEventListener('click', () => guideScan(null));
  $('#guideBrowse').addEventListener('click', () => { wallInfo = null; browseLooks(); });
  $('#guideScratch').addEventListener('click', () => setStep('custom'));
  $('#guideResume').hidden = !restoredDesign;
  $('#guideResume').addEventListener('click', () => setStep('custom'));
  $('#backLooks').addEventListener('click', () => { if (!looks.length) looks = rankLooks(wallInfo); setStep('styles'); showLook(lookAt); });
  wireLooks();
  firstStep('intro');
}

// ---- v5 tutorial screens ----
const touch = matchMedia('(pointer: coarse)');
const TOUR = ['intro', 'snap', 'styles'];
function tourStep(s) {
  const i = TOUR.indexOf(s);
  document.querySelectorAll('.t-dots i').forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
  $('#tourBack').hidden = i <= 0;
  $('#tourSkip').textContent = s === 'snap' ? 'Skip photo' : 'Skip';
  $('#tourMsg').textContent = '';
  // welcome + snap: the board on a brick café wall (their own room comes back afterwards)
  if (s === 'intro' || s === 'snap') {
    if (!showcase && !wallInfo) { showcase = { env: state.env }; state.env = 'bistro'; refresh(); }
    sway = true;                                             // framed by setStep once the view has its full size
  } else {
    sway = null;
    if (showcase) { state.env = showcase.env; showcase = null; refresh(); }
  }
  if (s === 'snap') { if (touch.matches) startCam(); else camOff(); }
  else stopCam();
}
// where the board sits while the tutorial cards cover part of the screen: right of the card (computers), above it (phones)
function swayFrame() {
  const { w, h } = dims(), fov = THREE.MathUtils.degToRad(camera.fov) / 2, r = stage.getBoundingClientRect();
  const aspect = r.width / Math.max(1, r.height);
  if (step() === 'snap') {                                   // snap: centered, between the tip and the shutter
    const d = Math.max(h / 2 / 0.6, w / 2 / aspect / 0.8) / Math.tan(fov) + 2;
    return { tgt: new THREE.Vector3(0, 0, 0.5), d };
  }
  if (phone.matches || aspect < 1) {
    const room = 0.42;                                       // top 42% of the screen is free
    const d = Math.max(h / 2 / room, w / 2 / aspect) / Math.tan(fov) * 1.35 + 2;
    return { tgt: new THREE.Vector3(0, -d * Math.tan(fov) * (1 - room), 0.5), d };
  }
  const room = 0.62;                                         // right 62% of the screen is free
  const d = Math.max(h / 2, w / 2 / (aspect * room)) / Math.tan(fov) * 1.3 + 2;
  return { tgt: new THREE.Vector3(-d * Math.tan(fov) * aspect * (1 - room), 0, 0.5), d };
}
// the camera for a sway framing: a little to the side, at the same slight downward look as the options view
function swayPose(f) {
  const a = 0.2, c = Math.cos(PITCH);
  return { tgt: f.tgt.clone(), pos: new THREE.Vector3(f.tgt.x + f.d * Math.sin(a) * c, f.tgt.y + f.d * Math.sin(PITCH), f.tgt.z + f.d * Math.cos(a) * c) };
}
// live camera (phones; computers can switch it on). If it's blocked or missing, the shutter opens the phone's camera app.
let camStream = null;
async function startCam() {
  if (camStream) return;
  if (!navigator.mediaDevices?.getUserMedia) return camOff();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    if (step() !== 'snap') return stopCam();               // they moved on while the permission question was up
    const v = $('#camFeed'); v.srcObject = camStream;
    await v.play().catch(() => {});
    $('#tourSnap').classList.add('live');
    $('#tourShutter').setAttribute('aria-label', 'Take the photo');
    $('#tourLive').hidden = true;
    $('#tourTip').textContent = 'Fit the certificates you have up now in the frame, with some wall showing around them.';
  } catch { camStream = null; camOff(); }
}
function stopCam() {
  camStream?.getTracks().forEach(t => t.stop());
  camStream = null;
  $('#camFeed').srcObject = null;
  $('#tourSnap').classList.remove('live');
}
function camOff() {
  const desk = !touch.matches;                             // computers: upload (or drag in) a photo; the laptop camera is optional
  $('#tourSnap').classList.toggle('desk', desk);
  $('#tourShutter').setAttribute('aria-label', desk ? 'Upload a photo' : 'Take the photo');
  $('#tourTip').textContent = desk
    ? 'Upload or drag in a photo of the certificates on your wall, with some wall showing around them. No photo handy? Try our example.'
    : 'Tap the button and take a photo of the certificates you have up now, with some wall showing around them.';
  $('#tourLive').hidden = !desk || !navigator.mediaDevices?.getUserMedia;
}
async function snapFrame() {
  const v = $('#camFeed');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  v.pause();                                               // hold the picture while we look at it
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  guideScan(new File([blob], 'wall.jpg', { type: 'image/jpeg' }));
}
function wireTour() {
  const onFile = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) guideScan(f); };
  $('#tourFile').addEventListener('change', onFile);
  $('#tourCam').addEventListener('change', onFile);
  $('#tourShutter').addEventListener('click', () => (camStream ? snapFrame() : $(touch.matches ? '#tourCam' : '#tourFile').click()));
  // computers: drag a photo anywhere onto the snap screen
  let drags = 0;
  const hasFile = (e) => step() === 'snap' && [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', (e) => { if (hasFile(e)) { drags++; $('#tourSnap').classList.add('drag'); } });
  addEventListener('dragleave', () => { if (drags && !--drags) $('#tourSnap').classList.remove('drag'); });
  addEventListener('dragover', (e) => { if (hasFile(e)) e.preventDefault(); });
  addEventListener('drop', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault(); drags = 0; $('#tourSnap').classList.remove('drag');
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (f) guideScan(f); else $('#tourMsg').textContent = 'That isn\'t a photo. Drop a JPG or PNG of your wall.';
  });
  $('#tourDemo').addEventListener('click', () => guideScan(null));
  $('#tourLive').addEventListener('click', startCam);
  $('#tourStart').addEventListener('click', () => setStep('snap'));
  $('#tourResume').hidden = !restoredDesign;
  $('#tourResume').addEventListener('click', () => setStep('custom'));
  $('#tourBack').addEventListener('click', () => setStep(TOUR[Math.max(0, TOUR.indexOf(step()) - 1)]));
  // Skip: the welcome skips the whole tour; the photo step goes on to our picks; our picks goes to the options
  $('#tourSkip').addEventListener('click', () => {
    const s = step();
    if (s === 'snap') browseLooks();                     // (with the last photo's suggestions, if there was one)
    else setStep('custom');
  });
  addEventListener('resize', () => {
    if (!sway) return;
    sway = swayFrame(); const p = swayPose(sway);
    tween = null; camera.position.copy(p.pos); controls.target.copy(p.tgt); dirty = true;
  });
  wireLooks();
  firstStep('snap');
}

// "Try it with examples" (also ?docs=demo): a labor-law poster plus two permits, drawn on the spot
function loadExampleDocs() {
  const make = (w, h, color, title, lines) => {
    const k = 60, c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height * 0.14);
    g.fillStyle = '#fff'; g.font = `bold ${c.width * 0.075}px sans-serif`; g.fillText(title, c.width * 0.06, c.height * 0.09);
    g.fillStyle = '#c9c9c9';
    for (let y = c.height * 0.2, n = 0; y < c.height * 0.93; y += c.height / lines, n++) g.fillRect(c.width * 0.06, y, c.width * (n % 4 === 0 ? 0.5 : 0.88), c.height / lines * 0.35);
    return { img: c, aspect: w / h, name: title, imgId: Math.random(), thumb: c.toDataURL('image/jpeg', 0.5) };
  };
  const poster = make(18, 24, '#1b3a6b', 'EMPLOYEE RIGHTS', 40); poster.size = 'p1824';
  const permit = make(8.5, 11, '#c0392b', 'FOOD SERVICE PERMIT', 22); permit.size = 'letter';
  const lic = make(11, 8.5, '#2c6e49', 'LIQUOR LICENSE', 16); lic.size = 'letter'; lic.turn = true;
  state.myCerts = [poster, permit, lic].map(d => ({ cw: 8.5, ch: 11, px: null, py: null, turn: false, ...d }));
  state.sheets = true; $('#sheets').checked = true;
  docsKey = '';
  refresh();
}
const docsFit = (W, H) => packDocs(W, H, state.myCerts.map(d => ({ ...d, px: null }))).missing.length === 0;
// smallest board that holds all of the customer's documents
function bestFitDocs() {
  let best = null;
  for (const s of SIZES) for (const o of ['portrait', 'landscape']) {
    const [w, h] = o === 'portrait' ? [s.a, s.b] : [s.b, s.a];
    if (docsFit(w, h) && (!best || s.price < best.size.price || (s.price === best.size.price && o === state.orient))) best = { size: s, orient: o };
  }
  if (best) return best;
  let c = null;
  for (let a = 12; a <= CUSTOM.maxShort; a += 2) for (let b = a; b <= CUSTOM.maxLong; b += 2) {
    if (b / a > 1.6) break;                   // keep custom boards a normal shape (no 20 x 70 strips)
    if ((!c || a * b < c.w * c.h)) { if (docsFit(a, b)) c = { custom: true, w: a, h: b }; else if (docsFit(b, a)) c = { custom: true, w: b, h: a }; }
  }
  return c || { custom: true, tooBig: true };
}

// "How many certificates?": the smallest standard board that fits them (either way round), or a custom size.
function fitsOn(w, h) { const L = sheetLayout(w, h); return L?.primary ? L.n : 0; }
function bestFit(n) {
  if (!n) return null;
  let best = null;
  for (const s of SIZES) for (const o of ['portrait', 'landscape']) {
    const [w, h] = o === 'portrait' ? [s.a, s.b] : [s.b, s.a];
    const fit = fitsOn(w, h);
    if (fit >= n && (!best || s.price < best.size.price || (s.price === best.size.price && o === state.orient))) best = { size: s, orient: o, fit };
  }
  if (best) return best;
  // more than any standard board holds: suggest a custom size (grid of sheets + margins clear of the caps)
  const cols = Math.ceil(Math.sqrt(n * 11 / 8.5)), rows = Math.ceil(n / cols);
  let w = Math.ceil(cols * 8.5 + (cols - 1) + 4), h = Math.ceil(rows * 11 + (rows - 1) + 4);
  while (fitsOn(w, h) < n && w <= CUSTOM.maxShort) w++;
  return { custom: true, w: Math.min(w, CUSTOM.maxShort), h: Math.min(h, CUSTOM.maxLong), fit: fitsOn(Math.min(w, CUSTOM.maxShort), Math.min(h, CUSTOM.maxLong)) };
}
function useBestFit() {
  const b = state.myCerts.length ? bestFitDocs() : bestFit(state.certNeed);
  if (b?.tooBig) return;
  state.myCerts.forEach(d => { d.px = d.py = null; });
  if (!b) return;
  if (b.custom) Object.assign(state, { sizeId: 'custom', customA: Math.min(b.w, b.h), customB: Math.max(b.w, b.h), orient: b.w > b.h ? 'landscape' : 'portrait' });
  else Object.assign(state, { sizeId: b.size.id, orient: b.orient });
  $('#cw').value = state.customA; $('#ch').value = state.customB;
  refresh(true);
}

// Apply a whole design at once (popular boards, shared links, restored last design)
function applyDesign(d, refit = true) {
  for (const k of ['sizeId', 'orient', 'face', 'edge', 'fastener', 'customA', 'customB', 'sheets', 'sheetTurn', 'env', 'certNeed']) if (d[k] !== undefined) state[k] = d[k];
  $('#sheets').checked = state.sheets; $('#sheetTurn').checked = state.sheetTurn;
  $('#cw').value = state.customA; $('#ch').value = state.customB;
  if (d.lam) { pendingLam = d.lam; if (libraryReady) { const it = findByNumber(d.lam) || unknownLam(d.lam, '#bdbdbd'); state.lamSel = it; pendingLam = null; } }
  else { state.lamSel = null; pendingLam = null; }
  refresh(refit);
}
let pendingLam = null;

// A design as link settings (?size=24x36&color=Black...) and back again
function designParams() {
  const p = new URLSearchParams();
  if (state.sizeId === 'custom') { p.set('size', 'custom'); p.set('w', state.customA); p.set('h', state.customB); } else p.set('size', state.sizeId);
  p.set('orient', state.orient); p.set('color', state.face); p.set('edge', state.edge); p.set('finish', state.fastener);
  if (state.lamSel) p.set('lam', state.lamSel.n);
  if (state.env !== 'studio') p.set('room', state.env);
  if (!state.sheets) p.set('sheets', '0');
  if (state.sheetTurn) p.set('turn', '1');
  if (state.certNeed) p.set('need', state.certNeed);
  return p;
}
function readParams(q) {
  const d = {}, hex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
  if (q.get('size') === 'custom') { d.sizeId = 'custom'; d.customA = clamp(+q.get('w')); d.customB = clamp(+q.get('h')); }
  else if (SIZES.some(s => s.id === q.get('size'))) d.sizeId = q.get('size');
  if (q.get('orient') === 'landscape' || q.get('orient') === 'portrait') d.orient = q.get('orient');
  if (COLORS.some(c => c.name === q.get('color')) || hex(q.get('color'))) d.face = q.get('color');
  if (q.get('edge') === 'match' || COLORS.some(c => c.name === q.get('edge')) || hex(q.get('edge'))) d.edge = q.get('edge');
  if (FASTENERS.some(f => f.id === q.get('finish'))) d.fastener = q.get('finish');
  if (ENVIRONMENTS.some(e => e.id === q.get('room'))) d.env = q.get('room');
  if (q.get('sheets') === '0') d.sheets = false;
  if (q.get('turn') === '1') d.sheetTurn = true;
  if (+q.get('need') > 0) d.certNeed = Math.min(40, +q.get('need'));
  if (q.get('lam')) d.lam = q.get('lam');
  return d;
}
// Share: phones open the share sheet (Messages, email...); computers copy the link.
let parentPage = null;   // inside Shopify: the store page's address (sent by the embed snippet)
async function shareDesign() {
  const p = designParams().toString();
  const url = parentPage ? `${parentPage}?cobo=${encodeURIComponent(p)}` : `${location.origin}${location.pathname}?${p}`;
  const { w, h } = dims();
  const text = `My ${fmt(w)}" × ${fmt(h)}" compliance board design`;
  if (navigator.share) { try { await navigator.share({ title: 'Compliance board design', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it into an email or message to share this design.'); }
  catch { prompt('Copy this link to share your design:', url); }
}
// Remember the last design on this device, and bring it back next visit
let saveT = null;
function rememberDesign() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem('cobo.last', designParams().toString()); } catch { /* storage blocked */ } }, 600);
}

function wireExtras() {
  // popular boards
  $('#presetList').innerHTML = PRESETS.map((p, i) => `<button type="button" class="preset" data-p="${i}"><i></i><b>${p.name}</b><small>${p.blurb}</small></button>`).join('');
  $('#presetList').querySelectorAll('.preset').forEach((b) => {
    const p = PRESETS[+b.dataset.p], c = p.cfg;
    b.querySelector('i').style.setProperty('--swatch', p.lam ? '#6b4a33' : colorHex(c.face));
    b.querySelector('i').style.setProperty('--edge', c.edge === 'match' ? 'transparent' : colorHex(c.edge));
  });
  $('#presetList').addEventListener('click', (e) => {
    const b = e.target.closest('.preset'); if (!b) return;
    const p = PRESETS[+b.dataset.p];
    applyDesign({ ...p.cfg, lam: p.lam, env: p.room || state.env });
    closeOptSheet();
    toast(`${p.name}: change anything you like from here.`);
  });
  // how many certificates
  document.querySelectorAll('[data-cc]').forEach(b => b.addEventListener('click', () => {
    state.certNeed = Math.max(0, Math.min(40, state.certNeed + +b.dataset.cc));
    updateUI(); rememberDesign();
  }));
  $('#certAdvice').addEventListener('click', (e) => { if (e.target.closest('#useFit')) useBestFit(); });
  // own documents (any size)
  const addCerts = async (files) => {
    for (const f of files) {
      const own = {};
      try { await loadArt(own, f); } catch { toast(`Couldn't read ${f.name}`); continue; }
      guessDoc(own);
      const t = document.createElement('canvas'), k = 88 / Math.max(own.img.width, own.img.height);   // small preview for the list
      t.width = Math.round(own.img.width * k); t.height = Math.round(own.img.height * k);
      t.getContext('2d').drawImage(own.img, 0, 0, t.width, t.height); own.thumb = t.toDataURL('image/jpeg', 0.7);
      state.myCerts.push(own);
    }
    docsKey = '';
    refresh();
    if (lastDocs?.missing.length) toast('Some documents don\'t fit on this board yet. See the suggestion under Size.');
  };
  for (const id of ['#certCam', '#certFiles']) $(id).addEventListener('change', async (e) => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) await addCerts(fs); });
  $('#certClear').addEventListener('click', () => { state.myCerts = []; docsKey = ''; refresh(); });
  $('#docAuto').addEventListener('click', () => { state.myCerts.forEach(d => { d.px = d.py = null; }); refresh(); });
  $('#docDemo').addEventListener('click', loadExampleDocs);
  $('#scanDemo').addEventListener('click', scanExample);
  for (const id of ['#scanCam', '#scanFile']) $(id).addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await scanWall(f); });
  const list = $('#docList');
  list.addEventListener('change', (e) => {
    const li = e.target.closest('.doc'); if (!li) return;
    const d = state.myCerts[+li.dataset.i];
    if (e.target.matches('select')) { d.size = e.target.value; if (d.size === 'custom') { [d.cw, d.ch] = docDims({ ...d, size: 'letter', turn: false }); } }
    if (e.target.matches('[data-cw]')) d.cw = Math.max(2, Math.min(96, +e.target.value || 8.5));
    if (e.target.matches('[data-ch]')) d.ch = Math.max(2, Math.min(96, +e.target.value || 11));
    d.px = d.py = null; docsKey = ''; refresh();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'), li = e.target.closest('.doc'); if (!b || !li) return;
    const i = +li.dataset.i;
    if (b.dataset.act === 'turn') { state.myCerts[i].turn = !state.myCerts[i].turn; state.myCerts[i].px = state.myCerts[i].py = null; }
    if (b.dataset.act === 'remove') state.myCerts.splice(i, 1);
    docsKey = ''; refresh();
  });
  // share
  $('#shareBtn').addEventListener('click', shareDesign);
}
// parts of the panel that depend on the extras (called from updateUI)
let docsKey = '';   // redraw the document list only when the documents change (keeps focus in its inputs)
function paintDocs() {
  const docs = state.myCerts, miss = new Set(lastDocs?.missing || []);
  const key = docs.map(d => [d.imgId, d.size, d.turn, d.cw, d.ch].join(':')).join('|') + '/' + [...miss].join(',');
  $('#docTools').hidden = !docs.length;
  if (key === docsKey) return;
  docsKey = key;
  const opts = DOC_SIZES.map(s => `<option value="${s.id}">${s.name} ${fmt(s.w)}×${fmt(s.h)}</option>`).join('') + '<option value="custom">Custom size…</option>';
  $('#docList').innerHTML = docs.map((d, i) => `<li class="doc${miss.has(i) ? ' miss' : ''}" data-i="${i}">
      <img alt=""><select aria-label="Document size">${opts}</select>
      <button class="ib" type="button" data-act="turn" title="Turn sideways" aria-label="Turn sideways"><svg class="i"><use href="#i-rotate"/></svg></button>
      <button class="ib" type="button" data-act="remove" title="Remove" aria-label="Remove">×</button>
      ${d.size === 'custom' ? `<span class="cust">W <input type="number" data-cw min="2" max="96" step="0.5" value="${d.cw}"> × H <input type="number" data-ch min="2" max="96" step="0.5" value="${d.ch}"> in</span>` : ''}
      ${miss.has(i) ? `<span class="warn">Doesn't fit on this board (${docLabel(d)}). Try the size suggested above.</span>` : ''}</li>`).join('');
  $('#docList').querySelectorAll('.doc').forEach((li, i) => { li.querySelector('img').src = docs[i].thumb; li.querySelector('select').value = docs[i].size; });
}
function paintExtras() {
  paintDocs();
  // how many certificates (or: which of your documents) -> advice + highlight the best-fit size tile
  const docs = state.myCerts.length;
  document.querySelector('.certcount .opt').hidden = !!docs;
  const n = docs ? 0 : state.certNeed, b = docs ? bestFitDocs() : bestFit(n);
  $('#certNeed').textContent = n || '—';
  const { w, h } = dims(), here = fitsOn(w, h);
  let advice;
  if (docs) {
    const on = b.custom ? state.sizeId === 'custom' && Math.round(w) === b.w && Math.round(h) === b.h
      : state.sizeId === b.size.id && state.orient === b.orient;
    if (on && b.custom) b.custom = false, b.size = { a: b.w, b: b.h }, b.orient = state.orient;   // already on it: say so
    const fitsHere = !lastDocs?.missing.length;
    advice = b.tooBig ? 'Your documents are bigger than our largest board (48 × 96). Contact us for oversize boards.'
      : b.custom ? `Your ${docs} document${docs === 1 ? '' : 's'} need a custom <b>${b.w}" × ${b.h}"</b> board. <button class="link" id="useFit" type="button">Use it</button>`
      : on ? `<b>${b.size.a} × ${b.size.b}</b> is the best fit for your ${docs} document${docs === 1 ? '' : 's'}.`
      : `Best fit for your ${docs} document${docs === 1 ? '' : 's'}: <b>${b.size.a} × ${b.size.b}${b.orient === 'landscape' ? ' landscape' : ''}</b>. <button class="link" id="useFit" type="button">Use it</button>${fitsHere ? ' (They fit on your current size too.)' : ''}`;
    $('#certAdvice').innerHTML = advice;
    document.querySelectorAll('#sizes .tile').forEach(t => {
      const s = SIZES.find(x => x.id === t.dataset.k);
      t.classList.toggle('rec', !!(!b.custom && t.dataset.k === b.size.id && b.orient === state.orient));
      t.classList.toggle('nofit', !!(s && !docsFit(...(state.orient === 'portrait' ? [s.a, s.b] : [s.b, s.a]))));
    });
  }
  else if (!n) advice = 'Tell us how many 8.5×11 documents you need to display, and we\'ll suggest the size that fits.';
  else if (b?.custom) advice = `More than any standard board holds. A custom <b>${b.w}" × ${b.h}"</b> fits ${b.fit}. <button class="link" id="useFit" type="button">Use it</button>`;
  else {
    const name = `${b.size.a} × ${b.size.b}${b.orient === 'landscape' ? ' landscape' : ''}`;
    const on = state.sizeId === b.size.id && state.orient === b.orient;
    advice = on ? `<b>${name}</b> is the best fit: it holds ${b.fit}.` : `Best fit: <b>${name}</b> holds ${b.fit}. <button class="link" id="useFit" type="button">Use it</button>`
      + (here >= n ? ` (Your current size fits them too.)` : '');
  }
  if (!docs) {
    $('#certAdvice').innerHTML = advice;
    document.querySelectorAll('#sizes .tile').forEach(t => {
      const s = SIZES.find(x => x.id === t.dataset.k);
      t.classList.toggle('rec', !!(n && b && !b.custom && t.dataset.k === b.size.id && b.orient === state.orient));
      t.classList.toggle('nofit', !!(n && s && fitsOn(...(state.orient === 'portrait' ? [s.a, s.b] : [s.b, s.a])) < n));
    });
  }
  // own documents
  $('#certClear').hidden = !docs;
  $('#certOwnInfo').hidden = !docs;
  if (docs) {
    const shown = lastDocs?.places.length || 0, miss = docs - shown;
    $('#certOwnInfo').textContent = `${shown} of your ${docs} document${docs === 1 ? '' : 's'} on the board${miss ? `; ${miss} won't fit at this size` : ''}. Upload more to add them.`;
  }
}

/* ------------------------------------------------------------------ Wilsonart laminate library + picker */
const texCache = new Map();
function lamTexture(url) {
  if (texCache.has(url)) return texCache.get(url);
  const t = new THREE.TextureLoader().load(url, () => { dirty = true; });
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;   // mirrored tiling hides seams on non-seamless swatches
  t.anisotropy = 8;
  texCache.set(url, t);
  return t;
}

let library = [];
let libraryReady = false;
const pick = { q: '', type: new Set(), color: new Set(), shade: new Set(), cut: new Set(), match: new Set(), shown: 60,
               open: new Set() };   // open = which filter categories are expanded (all start folded)
const FIELD = { type: 'type', color: 'color', shade: 'shade', cut: 'cut', match: 'match' };

// paths are worked out from this script's own location, so /v2/ and /v3/ pages find the same files
const SITE = new URL('../', import.meta.url);
fetch(new URL(LAMINATE.libraryUrl, SITE), { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : { items: [] }))
  .catch(() => ({ items: [] }))
  .then(j => {
    library = (j.items || []).map(it => ({ ...it, thumb: it.thumb && new URL(it.thumb, SITE).href, full: it.full && new URL(it.full, SITE).href }));
    libraryReady = true;
    const want = pendingLam;                                           // laminate from a link, preset or saved design
    pendingLam = null;
    if (want) { selectLam(findByNumber(want) || unknownLam(want, '#bdbdbd'), true); }
    if (!$('#lamPanel').hidden) renderPicker();
  });

const findByNumber = (n) => library.find(it => it.n.toLowerCase() === String(n).trim().toLowerCase());
const unknownLam = (n, hex) => ({ n: String(n).trim(), name: '', avg: hex, full: null, unknown: true });

function passes(it, skip) {
  const q = pick.q.trim().toLowerCase();
  if (q && !(it.n.toLowerCase().includes(q) || it.name.toLowerCase().includes(q))) return false;
  for (const k of Object.keys(FIELD)) {
    if (k === skip || !pick[k].size) continue;
    if (!pick[k].has(it[FIELD[k]])) return false;
  }
  return true;
}

function renderPicker() {
  const wood = pick.type.has('Woodgrains');
  const groups = [
    { key: 'type', label: 'Design type', opts: LAMINATE.types.map(n => ({ name: n })) },
    { key: 'color', label: 'Color', opts: LAMINATE.colors },
    { key: 'shade', label: 'Shade', opts: LAMINATE.shades.map(n => ({ name: n })) },
    ...(wood ? [{ key: 'cut', label: 'Cut', opts: LAMINATE.cuts.map(n => ({ name: n })) },
                { key: 'match', label: 'Match', opts: LAMINATE.matches.map(n => ({ name: n })) }] : []),
  ];
  const f = $('#lamFilters');
  f.innerHTML = '';
  for (const g of groups) {
    const box = document.createElement('details'); box.className = 'fgroup'; box.dataset.g = g.key;
    box.open = pick.open.has(g.key);
    const n = pick[g.key].size;
    box.innerHTML = `<summary><span>${g.label}</span><em>${n || ''}</em><svg class="i chev"><use href="#i-chev"/></svg></summary>`;
    const row = document.createElement('div'); row.className = 'chips';
    for (const o of g.opts) {
      const count = library.filter(it => passes(it, g.key) && it[FIELD[g.key]] === o.name).length;
      const on = pick[g.key].has(o.name);
      const b = document.createElement('button');
      b.className = 'chip' + (on ? ' on' : ''); b.dataset.g = g.key; b.dataset.v = o.name;
      b.disabled = !on && count === 0; b.setAttribute('aria-pressed', on);
      const dot = g.key === 'color' ? `<i class="dot${o.hex === 'conic' ? ' multi' : ''}" style="--c:${o.hex === 'conic' ? '#fff' : o.hex}"></i>` : '';
      b.innerHTML = `${dot}<span>${o.name}</span><em>${count}</em>`;
      row.appendChild(b);
    }
    box.appendChild(row); f.appendChild(box);
  }
  const items = library.filter(it => passes(it));
  const anyFilter = pick.q || ['type', 'color', 'shade', 'cut', 'match'].some(k => pick[k].size);
  $('#lamCount').textContent = libraryReady
    ? `${items.length} of ${library.length} design${library.length === 1 ? '' : 's'}`
    : 'Loading designs…';
  $('#lamReset').hidden = !anyFilter;

  const grid = $('#lamGrid'); grid.innerHTML = '';
  for (const it of items.slice(0, pick.shown)) {
    const b = document.createElement('button'); b.className = 'card' + (state.lamSel?.n === it.n ? ' on' : ''); b.dataset.n = it.n;
    b.innerHTML = `<img src="${it.thumb}" alt="" loading="lazy" width="256" height="256"><span class="nm">${it.name || 'Design'}</span><span class="no">${it.n}</span>${it.demo ? '<b class="demo">Demo</b>' : ''}`;
    grid.appendChild(b);
  }
  $('#lamMore').hidden = items.length <= pick.shown;

  // nothing matched: offer to use whatever number they typed
  const q = pick.q.trim();
  const nf = $('#lamNotFound');
  nf.hidden = !(libraryReady && q && items.length === 0);
  if (!nf.hidden) $('#lamNfNum').textContent = q;
}

// The picker is a side panel, not a pop-up: the board stays visible, so each pick shows on it right away.
function openPicker() {
  if (phone.matches) { closeOptSheet(true); setSheet(false); markActive('laminate'); }
  $('#lamPanel').hidden = false;
  $('#lamBtn').setAttribute('aria-expanded', 'true');
  if (!phone.matches) setInset($('#lamPanel').getBoundingClientRect().width);   // slide the board out from under the panel
  renderPicker();
  if (!phone.matches) setTimeout(() => $('#lamSearch').focus(), 30);   // on phones, focusing would pop up the keyboard
  updateStage(true);                                                   // phones: board fits above the picker
}
function closePicker() {
  $('#lamPanel').hidden = true;
  $('#lamBtn').setAttribute('aria-expanded', 'false');
  if (inset.target) setInset(0);
  if (!optOpen) markActive(null);
  updateStage(true);
  if (!phone.matches) $('#lamBtn').focus();
}
function selectLam(item) {
  state.lamSel = item;
  state.grain = false;
  refresh();
}

// 1 / 2 / 3 swatches per row (remembered in this browser)
function setCols(n) {
  $('#lamGrid').style.setProperty('--cols', n);
  $('#lamGrid').dataset.cols = n;
  document.querySelectorAll('#lamCols [data-cols]').forEach(b => { b.classList.toggle('on', +b.dataset.cols === n); b.setAttribute('aria-pressed', +b.dataset.cols === n); });
  try { localStorage.setItem('cobo.lamCols', n); } catch { /* storage blocked: fine */ }
}

function wirePicker() {
  const m = $('#lamPanel');
  let cols = 3;
  try { cols = +localStorage.getItem('cobo.lamCols') || 3; } catch { /* storage blocked */ }
  setCols(cols);
  $('#lamCols').addEventListener('click', (e) => { const b = e.target.closest('[data-cols]'); if (b) setCols(+b.dataset.cols); });
  // the filter dropdowns: one open at a time (remembered across re-renders); a click elsewhere closes it
  m.addEventListener('toggle', (e) => {
    const d = e.target.closest?.('details.fgroup');
    if (!d) return;
    if (d.open) { pick.open = new Set([d.dataset.g]); m.querySelectorAll('details.fgroup[open]').forEach(o => { if (o !== d) o.open = false; }); }
    else pick.open.delete(d.dataset.g);
  }, true);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#lamFilters')) m.querySelectorAll('details.fgroup[open]').forEach(o => { o.open = false; });
  });
  m.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return closePicker();
    const chip = e.target.closest('.chip');
    if (chip) {
      const s = pick[chip.dataset.g];
      s.has(chip.dataset.v) ? s.delete(chip.dataset.v) : s.add(chip.dataset.v);
      if (chip.dataset.g === 'type' && !pick.type.has('Woodgrains')) { pick.cut.clear(); pick.match.clear(); }
      pick.shown = 60; return renderPicker();
    }
    const card = e.target.closest('.card');
    if (card) return selectLam(findByNumber(card.dataset.n));
    if (e.target.closest('#lamMore')) { pick.shown += 60; return renderPicker(); }
    if (e.target.closest('#lamReset')) {
      pick.q = ''; $('#lamSearch').value = '';
      for (const k of Object.keys(FIELD)) pick[k].clear();
      pick.shown = 60; return renderPicker();
    }
    if (e.target.closest('#lamUseNum')) return selectLam(unknownLam(pick.q, $('#lamStand').value));
  });
  $('#lamSearch').addEventListener('input', (e) => { pick.q = e.target.value; pick.shown = 60; renderPicker(); });
  $('#lamSearch').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const exact = findByNumber(pick.q);
    const hits = library.filter(it => passes(it));
    if (exact) selectLam(exact);
    else if (hits.length === 1) selectLam(hits[0]);
    else if (pick.q.trim() && hits.length === 0) selectLam(unknownLam(pick.q, $('#lamStand').value));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) closePicker(); });
}

function refresh(refit = false) {
  buildBoard();
  if (refit && !sway) setView(state.view);   // (v5 tutorial screens keep their own framing)
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3800);
}
function onCta() {
  const sp = currentSpec();
  if (!sp.price) {
    const body = encodeURIComponent(`Custom compliance board quote request\n\nQuantity: ${sp.quantity}\nSize: ${fmt(sp.widthIn)}" W x ${fmt(sp.heightIn)}" H\nBoard color: ${sp.boardColor}\nEdge banding: ${sp.edgeBanding}\nFastener finish: ${sp.fastenerFinish}\n` +
      (sp.background ? `Background image: ${logoLine(sp.background)}\n` : '') +
      (sp.logo ? `Logo: ${logoLine(sp.logo)}\n` : '') +
      (sp.logo || sp.background ? '\nPlease attach your image files to this email.\n' : ''));
    const url = `mailto:${SHOPIFY.quoteEmail}?subject=${encodeURIComponent('Custom board quote')}&body=${body}`;
    if (embedded) window.parent.postMessage({ type: 'cobo:quote', payload: sp }, '*');
    window.open(url, '_blank');
    return;
  }
  const ed = editing;
  editing = null; state.qty = 1;
  const id = JSON.stringify(sp.config), thumb = boardThumb();
  if (thumb) { thumbs.set(id, thumb); saveThumbs(); }
  if (embedded) {
    // editing a cart line = remove the old line and add the new board in its place (done by the Shopify page)
    window.parent.postMessage(ed ? { type: 'cobo:update', key: ed.key, payload: sp } : { type: SHOPIFY.messageType, payload: sp }, '*');
    toast(ed ? 'Updating your cart…' : 'Adding to cart…');
  } else {
    // standalone preview (not inside Shopify): keep a pretend cart so the panel can be designed and tested
    if (ed) localCart.splice(ed.key, 1);
    const hit = localCart.find(it => JSON.stringify(it.cfg) === id);
    if (hit) { hit.qty += sp.quantity; hit.line = hit.qty * hit.unit; }
    else localCart.push({ label: `${sp.size} board · ${sp.boardColor}`, rows: specRows(sp), qty: sp.quantity, unit: sp.price, line: sp.quantity * sp.price, cfg: sp.config });
    localCartChanged();
    setSheet(true);
    toast(ed ? 'Cart updated' : sp.variantId ? 'Added to the preview cart' : 'Added to the preview cart (no Shopify variant ID mapped yet for this combination)');
  }
  updateUI();
}
function localCartChanged() {
  localCart.forEach((it, i) => { it.key = i; });
  renderCart({ items: localCart, total: localCart.reduce((s, it) => s + it.line, 0), demo: true });
}
// per-board quantity in the cart (0 = remove)
function setLineQty(i, q) {
  const it = cartItems[i];
  if (!it) return;
  q = Math.max(0, Math.min(999, q));
  if (embedded) { window.parent.postMessage({ type: 'cobo:qty', key: it.key, quantity: q }, '*'); return; }
  if (q === 0) localCart.splice(i, 1);
  else { it.qty = q; it.line = q * it.unit; }
  localCartChanged();
}

// Cart thumbnails: a small picture of the board, taken from the 3D view when it's added (kept for this browser tab)
const thumbs = new Map();
try { for (const [k, v] of JSON.parse(sessionStorage.getItem('cobo.thumbs') || '[]')) thumbs.set(k, v); } catch { /* none */ }
function saveThumbs() { try { sessionStorage.setItem('cobo.thumbs', JSON.stringify([...thumbs].slice(-30))); } catch { /* storage full/blocked */ } }
function boardThumb() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return null;
  const pos = camera.position.clone(), tgt = controls.target.clone();
  const v = viewTarget('angle');
  camera.position.copy(v.pos); camera.lookAt(v.tgt);
  renderer.render(scene, camera);
  const src = renderer.domElement, k = src.width / W, s = Math.min(src.height, (W - inset.now) * k) * 0.92;
  const cx = (W - inset.now) * k / 2;                          // middle of the part of the view the side panel doesn't cover
  const c = document.createElement('canvas'); c.width = c.height = 160;
  c.getContext('2d').drawImage(src, cx - s / 2, (src.height - s) / 2, s, s, 0, 0, 160, 160);
  camera.position.copy(pos); camera.lookAt(tgt);
  dirty = true;
  return c.toDataURL('image/jpeg', 0.82);
}
function specRows(sp) {
  return [['Size', `${fmt(sp.widthIn)}" × ${fmt(sp.heightIn)}"`], ['Orientation', sp.orientation[0].toUpperCase() + sp.orientation.slice(1)],
    ['Board color', sp.boardColor], ['Edge banding', sp.edgeBanding === 'Match board' ? 'Matches board' : sp.edgeBanding], ['Caps & studs', sp.fastenerFinish],
    ...(sp.upcharges?.length ? [['Board', `$${sp.basePrice.toFixed(2)}`], ...sp.upcharges.map(u => [u.label, `+$${u.amount}`])] : [])];
}

// "Edit board" on a cart line: load that board back into the builder; the main button becomes "Update cart item"
let editing = null;   // { key, label } while a cart line is being edited
function editCartItem(it) {
  const c = it.cfg;
  Object.assign(state, { sizeId: c.sizeId, orient: c.orient, face: c.face, edge: c.edge, fastener: c.fastener, lamSel: null, qty: it.qty });
  for (const k of ['logo', 'background']) { state.art[k].img = null; state.art[k].name = ''; }   // cart boards have no printing
  document.querySelectorAll('.art [data-r="opts"]').forEach(o => { o.hidden = true; });
  document.querySelectorAll('.art [data-r="name"]').forEach(n => { n.textContent = 'No image yet'; });
  editing = { key: it.key, label: it.label };   // state.qty = the line's quantity, so updating keeps it
  setSheet(false);
  openSection('size');
  refresh(true);
  toast(`Editing: ${it.label}`);
}

/* ------------------------------------------------------------------ cart preview */
// Inside Shopify, the store page sends the real cart in (see shopify/cobo-configurator-embed.liquid).
// Opened on its own, the panel shows a pretend cart so the design can be tested.
const embedded = window.parent !== window;
const localCart = [];
let cartItems = [];
function renderCart(cart) {
  cartItems = cart.items;
  const count = cart.items.reduce((s, it) => s + it.qty, 0);
  $('#cartEmpty').hidden = !!count;
  $('#cartFoot').hidden = !count;
  $('#cartCheckout').hidden = !count && !phone.matches;     // phones: Checkout always sits beside Add to cart
  $('#sheetCount').textContent = count ? `(${count})` : '';
  $('#cartCount').textContent = count ? `${count} board${count === 1 ? '' : 's'}${cart.demo ? ' · preview only' : ''}` : '';
  // price breakdown + volume discount. Preview cart: worked out here from DISCOUNTS; in Shopify: the store's own
  // automatic discount (cart.discount), so what's shown always matches checkout.
  const tier = [...DISCOUNTS].reverse().find(t => count >= t.min);
  const discount = cart.demo ? (tier ? cart.total * tier.pct / 100 : 0) : (cart.discount || 0);
  const subtotal = cart.demo ? cart.total : (cart.subtotal ?? cart.total + discount);
  const total = subtotal - discount;
  $('#cartSum').hidden = !count;
  $('#sumBoards').textContent = `$${subtotal.toFixed(2)}`;
  $('#sumDiscRow').hidden = !(discount > 0);
  $('#sumDiscLbl').textContent = tier ? `Volume discount (${tier.pct}% off ${tier.min}+)` : 'Discount';
  $('#sumDisc').textContent = `−$${discount.toFixed(2)}`;
  $('#sumTotal').textContent = `$${total.toFixed(2)}`;
  const next = DISCOUNTS.find(t => count < t.min);
  $('#discHint').textContent = !next ? '' : count ? `Add ${next.min - count} more board${next.min - count === 1 ? '' : 's'} to save ${next.pct}%.` : `Save ${DISCOUNTS[0].pct}% when you order ${DISCOUNTS[0].min} or more boards.`;
  $('#cartTotal').textContent = `$${total.toFixed(2)}`;               // the bar always shows the cart total
  const list = $('#cartList'); list.innerHTML = '';
  cart.items.forEach((it, i) => {
    const li = document.createElement('li'); li.className = 'ci';
    const th = (it.cfg && thumbs.get(JSON.stringify(it.cfg))) || it.image || '';
    li.innerHTML = `${th ? '<img class="th" alt="">' : '<span class="th"></span>'}<span class="nm"></span><span class="lp"></span>
      <span class="acts">${it.cfg ? `<button class="link" type="button" data-edit="${i}">Edit board</button>` : ''}<button class="link rm" type="button" data-rm="${i}">Remove</button></span>
      <span class="qty" role="group" aria-label="Quantity"><button type="button" data-qd="-1" data-i="${i}" aria-label="One fewer">−</button><span></span><button type="button" data-qd="1" data-i="${i}" aria-label="One more">+</button></span>
      <details class="ci-d"><summary>Board details<svg class="i chev"><use href="#i-chev"/></svg></summary><dl class="spec"></dl></details>`;
    if (th) li.querySelector('img').src = th;
    li.querySelector('.nm').textContent = it.label;
    li.querySelector('.lp').textContent = `$${it.line.toFixed(2)}`;
    li.querySelector('.qty span').textContent = it.qty;
    const dl = li.querySelector('dl');
    for (const [k, v] of it.rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
    li.querySelector('.ci-d').hidden = !it.rows.length;
    list.appendChild(li);
  });
}
$('#cancelEdit').addEventListener('click', () => { editing = null; state.qty = 1; updateUI(); toast('Edit cancelled'); });
$('#cartList').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edit]'), rm = e.target.closest('[data-rm]'), q = e.target.closest('[data-qd]');
  if (ed) editCartItem(cartItems[+ed.dataset.edit]);
  if (rm) setLineQty(+rm.dataset.rm, 0);
  if (q) setLineQty(+q.dataset.i, cartItems[+q.dataset.i].qty + +q.dataset.qd);
});
function goShopify(path) {
  if (embedded) window.parent.postMessage({ type: 'cobo:go', path }, '*');
  else toast(`In Shopify this opens ${path}`);
}
window.addEventListener('message', (e) => {
  if (!embedded || e.source !== window.parent) return;
  const d = e.data;
  if (d?.type === 'cobo:cart' && d.cart) {
    const items = (d.cart.items || []).map(it => {
      let cfg = null;
      try { cfg = it.properties?._cobo ? JSON.parse(it.properties._cobo) : null; } catch { /* not one of ours */ }
      return {
        key: it.key, cfg, qty: it.quantity, line: (it.final_line_price ?? it.line_price) / 100, image: it.image || '',
        label: it.product_title + (it.variant_title ? ` · ${it.variant_title}` : ''),
        rows: Object.entries(it.properties || {}).filter(([k, v]) => v && k[0] !== '_'),   // "_" properties are hidden data
      };
    });
    renderCart({ items, total: (d.cart.total_price || 0) / 100, subtotal: (d.cart.original_total_price ?? d.cart.total_price ?? 0) / 100, discount: (d.cart.total_discount || 0) / 100 });
    if (d.added) { toast(d.updated ? 'Cart updated' : 'Added to cart'); setSheet(true); }
  }
  if (d?.type === 'cobo:notice' && d.text) toast(String(d.text));
  if (d?.type === 'cobo:page' && /^https:\/\//.test(d.url || '')) parentPage = String(d.url);   // for share links
});
if (embedded) window.parent.postMessage({ type: 'cobo:get-cart' }, '*');

/* ------------------------------------------------------------------ phone AR */
// The "View on your wall" button shows only where AR works: iPhone/iPad (Quick Look) or Android Chrome (WebXR).
// Add ?ar=1 to the URL to show it anyway (e.g. to test the pop-up on a computer).
(async () => {
  let ok = new URLSearchParams(location.search).get('ar') === '1';
  if (!ok) ok = !!document.createElement('a').relList?.supports?.('ar');               // Apple Quick Look
  if (!ok) { try { ok = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); } catch { /* no WebXR */ } }
  $('#arBtn').hidden = !ok;
})();

let arUrl = null;
async function exportBoardGLB() {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const board = root.clone(true);                        // shares geometry + materials, so this is cheap
  board.getObjectByName('wall')?.removeFromParent();     // the viewer background is not part of the product
  const g = new THREE.Group(); g.add(board);
  g.scale.setScalar(0.0254);                             // inches -> meters (AR shows it at true size)
  return new GLTFExporter().parseAsync(g, { binary: true, maxTextureSize: 2048 });
}
async function openAR() {
  const m = $('#arModal'), mv = $('#arViewer'), msg = $('#arMsg');
  m.hidden = false; document.body.style.overflow = 'hidden';
  msg.textContent = 'Preparing your board…';
  try {
    await import('../vendor/model-viewer.min.js');
    const glb = await exportBoardGLB();
    if (arUrl) URL.revokeObjectURL(arUrl);
    arUrl = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    mv.src = arUrl;
    await new Promise((res) => mv.addEventListener('load', res, { once: true }));
    const { w, h } = dims();
    msg.textContent = mv.canActivateAR
      ? `Tap the button, then point your phone at a wall. Your ${fmt(w)}" × ${fmt(h)}" board appears at real size; pinch to resize it.`
      : 'Open this page on an iPhone, iPad or Android phone to place the board on your wall.';
  } catch (err) {
    console.error(err);
    msg.textContent = 'Sorry, the AR view could not be prepared on this device.';
  }
}
function closeAR() { $('#arModal').hidden = true; document.body.style.overflow = ''; $('#arBtn').focus(); }
$('#arBtn').addEventListener('click', openAR);
$('#arModal').addEventListener('click', (e) => { if (e.target.id === 'arModal' || e.target.closest('[data-close]')) closeAR(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#arModal').hidden) closeAR(); });

/* ------------------------------------------------------------------ loop */
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(r.height, 1);
  camera.updateProjectionMatrix();
  applyInset();
  dirty = true;
}
const clock = new THREE.Clock();
let dirty = true;
// Phones: the 3D view is scaled down while scrolling; paint the space around it with the exact rendered wall color
// (read from a corner of the image) so there's no visible box edge.
let needBgSample = true;
function sampleBg() {
  needBgSample = false;
  const gl = renderer.getContext(), px = new Uint8Array(4);
  gl.readPixels(2, gl.drawingBufferHeight - 3, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  stage.parentElement.style.background = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
}
controls.addEventListener('change', () => { dirty = true; });
function loop() {
  const dt = clock.getDelta();
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 0.8);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) { tween = null; lockAngles(state.view); }
  }
  if (inset.now !== inset.target) {      // slide the view while the laminate panel opens/closes
    inset.now += (inset.target - inset.now) * Math.min(1, dt * 9);
    if (Math.abs(inset.target - inset.now) < 0.5) inset.now = inset.target;
    applyInset(); dirty = true;
  }
  if (controls.update()) dirty = true;   // true while the user is orbiting / damping
  if (tween) dirty = true;
  if (dirty) {                                    // draw only when something changed
    renderer.render(scene, camera); dirty = false;
    if (needBgSample) sampleBg();
  }
  requestAnimationFrame(loop);
}

build();
wirePicker();
new ResizeObserver(() => { resize(); }).observe(stage);
resize();
buildBoard();
setView('angle', true);
window.__cobo = { state, refresh, setView, currentSpec, THREE, scene, camera, renderer, applyDesign };   // also tells index.html the builder started
loop();
renderCart({ items: [], total: 0, demo: !embedded });   // empty cart state + volume-discount hint
if (restoredDesign && !GUIDED) toast('Welcome back! We restored your last design.');
if (LAYOUT === 'v4') wireGuide();
if (LAYOUT === 'v5') wireTour();
if (new URLSearchParams(location.search).get('docs') === 'demo') loadExampleDocs();
if (new URLSearchParams(location.search).get('scan') === 'demo' && !GUIDED) scanExample();
// ?peek=#fork scrolls that part of the panel into view (used for screenshots)
const peek = new URLSearchParams(location.search).get('peek');
if (peek) setTimeout(() => { try { document.querySelector(peek)?.scrollIntoView({ block: 'start' }); } catch { /* bad selector */ } }, 300);
