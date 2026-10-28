import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIZES, CUSTOM, COLORS, FASTENERS, WALLS, HW, SHOPIFY, LAMINATE, SHEETS, ARTWORK } from './config.js';

// Layout choices for uploaded artwork (logo + background image)
const LAYOUTS = [
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
  wall: 0,                  // index into WALLS, or -1 for wallCustom
  wallCustom: '#ffffff',
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
const wallHex = () => (state.wall < 0 ? state.wallCustom : WALLS[state.wall].hex);

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

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI - 0.15;

const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.5));
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
function artTexture(L) {
  const key = [L.imgId, L.layout, L.size, L.gap, L.rot, L.opacity, L.seed].join('|');
  if (L._key === key) return L._tex;
  if (L._tex) L._tex.dispose();
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
  L._key = key; L._tex = t;
  return t;
}
// A transparent plane (sw x sh inches) carrying the artwork, centered on the surface + the move sliders.
function artMesh(key, sw, sh, rough) {
  const L = state.art[key];
  if (!L.img) return null;
  const tex = artTexture(L), { W, H } = tex.userData.lat;
  tex.repeat.set(sw / W, sh / H);
  tex.offset.set(0.5 - (0.5 + L.offX / sw) * tex.repeat.x, 0.5 - (0.5 + L.offY / sh) * tex.repeat.y);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: rough,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  m.receiveShadow = true;
  return m;
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

  // logo printed on the board face (under the certificates)
  const logo = artMesh('logo', iw, ih, 0.5);
  if (logo) { logo.position.z = T + 0.006; root.add(logo); }

  // sample certificates between board face and acrylic
  lastSheets = sheetLayout(w, h, state.sheetTurn);
  if (state.sheets && lastSheets) {
    lastSheets.rects.forEach((r, i) => {
      const mat = new THREE.MeshStandardMaterial({ map: certificateTexture(r.w, r.h, SHEETS.titles[i % SHEETS.titles.length]), roughness: 0.8 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
      p.position.set(r.x, r.y, T + 0.03); p.receiveShadow = true; root.add(p);
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

  // wall (viewer background color + optional background image)
  const wallG = new THREE.Group();
  wallG.name = 'wall'; wallG.position.z = -(D + 2 * t); wallG.visible = state.view !== 'back';
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: wallHex(), roughness: 0.95 }));
  wall.receiveShadow = true; wallG.add(wall);
  const bgArt = artMesh('background', 400, 400, 0.95);
  if (bgArt) { bgArt.position.z = 0.05; wallG.add(bgArt); }
  root.add(wallG);

  // light + shadow frustum scaled to the board
  const R = Math.max(w, h);
  key.position.set(-R * 0.7, R * 0.9, R * 1.3);
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const sc = key.shadow.camera; const s = R * 1.2;
  sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.5; sc.far = R * 6; sc.updateProjectionMatrix();

  scene.background = new THREE.Color(state.view === 'back' ? '#d7d7d9' : wallHex());
  dirty = true;
  updateUI();
}

/* ------------------------------------------------------------------ camera */
let tween = null;
function viewTarget(view) {
  const { w, h } = dims();
  const aspect = camera.aspect;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = Math.max(h / 2, w / 2 / aspect) / Math.tan(fov / 2) * 1.35 + 2;
  const tgt = new THREE.Vector3(0, 0, 0.5);
  let pos;
  if (view === 'front') pos = new THREE.Vector3(0, 0, dist);
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
  if (instant) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); }
  else tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt };
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
  document.querySelectorAll('#faceSw .sw').forEach(b => b.classList.toggle('on', b.dataset.k === state.face && !state.lamSel));
  $('#lamBtn').classList.toggle('on', !!state.lamSel);
  $('#lamBtnLabel').textContent = state.lamSel ? `${state.lamSel.n}${state.lamSel.name ? ' · ' + state.lamSel.name : ''}` : 'Wilsonart laminate…';
  $('#lamClear').hidden = !state.lamSel;
  $('#grainWrap').hidden = !(state.lamSel && state.lamSel.full);
  document.querySelectorAll('#edgeSw .sw, #edgeSw .match').forEach(b => b.classList.toggle('on', (b.dataset.k ?? 'match') === state.edge));
  document.querySelectorAll('#fastSw .fast').forEach(b => b.classList.toggle('on', b.dataset.k === state.fastener));
  document.querySelectorAll('#wallSw .sw').forEach(b => b.classList.toggle('on', state.wall >= 0 && b.dataset.k === WALLS[state.wall].name));
  document.querySelectorAll('#sizes button').forEach(b => b.classList.toggle('on', b.dataset.k === state.sizeId));
  document.querySelectorAll('[data-orient]').forEach(b => b.classList.toggle('on', b.dataset.orient === state.orient));
  $('#customBox').hidden = state.sizeId !== 'custom';
}
function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }

function currentSpec() {
  const { w, h } = dims();
  const std = SIZES.find(s => s.id === state.sizeId);
  const f = FASTENERS.find(x => x.id === state.fastener);
  const edgeName = state.edge === 'match' ? 'Match board' : (state.edge[0] === '#' ? `Custom ${state.edge}` : state.edge);
  const faceName = state.face[0] === '#' ? `Custom laminate ${state.face}` : state.face;
  const L = state.lamSel;
  const G = state.art.logo;
  const custom = !std || L || G.img;   // custom size, laminate or logo = quoted, not priced online
  const variantId = custom ? null : (SHOPIFY.variantIds[std.id]?.[state.face] ?? null);
  return {
    size: std ? std.id : `custom ${fmt(w)}x${fmt(h)}`, widthIn: w, heightIn: h, orientation: state.orient,
    boardColor: L ? `Wilsonart ${L.n}${L.name ? ' ' + L.name : ''}` : faceName,
    laminateNumber: L ? L.n : null, laminateName: L ? (L.name || null) : null, laminateInLibrary: L ? !L.unknown : null,
    patternRotated: L ? state.grain : null,
    edgeBanding: edgeName, fastenerFinish: f.name, sheetsShown: state.sheets,
    certificatesFit: lastSheets?.primary ? lastSheets.n : 0,   // how many 8.5x11 certificates fit
    logo: G.img ? { file: G.name, layout: LAYOUTS.find(x => x.id === G.layout).name, widthIn: G.size, spacingIn: G.gap,
                    rotationDeg: G.rot, opacityPct: G.opacity, moveXIn: G.offX, moveYIn: G.offY } : null,
    quantity: state.qty,
    price: custom ? null : std.price, variantId,
  };
}
function logoLine(lg) {
  return `${lg.file} (${lg.layout}, ${fmt(lg.widthIn)}" wide${lg.layout.startsWith('Single') ? '' : `, ${fmt(lg.spacingIn)}" spacing`}${lg.rotationDeg ? `, rotated ${lg.rotationDeg}°` : ''}${lg.opacityPct < 100 ? `, ${lg.opacityPct}% opacity` : ''})`;
}
function updateUI() {
  paintActive();
  const sp = currentSpec();
  $('#specTitle').textContent = `${fmt(sp.widthIn)}" W × ${fmt(sp.heightIn)}" H`;
  $('#specLine').textContent = `${sp.boardColor} · ${sp.edgeBanding === 'Match board' ? 'matching edge' : sp.edgeBanding + ' edge'} · ${sp.fastenerFinish}${sp.logo ? ' · logo' : ''}`;
  $('#price').innerHTML = sp.price
    ? `$${(sp.price * sp.quantity).toFixed(2)}${sp.quantity > 1 ? `<small>$${sp.price.toFixed(2)} each</small>` : ''}`
    : 'Custom quote';
  $('#cta').textContent = sp.price ? 'Add to cart' : 'Request a quote';
  $('#note').textContent = sp.price
    ? 'Ships with aluminum z-clip hanger, M6 studs and 1" caps. Prices shown are the standard-board prices; compliance sheets are not included.'
    : sp.logo
      ? 'Logo boards are made to order — send us this spec (and your logo file) and we will quote it.'
      : 'Custom boards are made to order — send us this spec and we will quote it.';
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
  const sizesEl = $('#sizes');
  sizesEl.innerHTML = '';
  for (const s of SIZES) {
    const b = document.createElement('button'); b.dataset.k = s.id;
    b.innerHTML = `<span>${s.a}×${s.b}</span><small>$${s.price.toFixed(2)}</small>`;
    b.addEventListener('click', () => { state.sizeId = s.id; refresh(true); });
    sizesEl.appendChild(b);
  }
  const cb = document.createElement('button'); cb.dataset.k = 'custom';
  cb.innerHTML = '<span>Custom</span><small>up to 48×96</small>';
  cb.addEventListener('click', () => { state.sizeId = 'custom'; refresh(true); });
  sizesEl.appendChild(cb);

  swatchRow($('#faceSw'), COLORS, null, (n) => { state.face = n; state.lamSel = null; refresh(); });
  const match = document.createElement('button'); match.className = 'match'; match.textContent = 'Match board';
  match.addEventListener('click', () => { state.edge = 'match'; refresh(); });
  swatchRow($('#edgeSw'), COLORS, null, (n) => { state.edge = n; refresh(); }, match);
  swatchRow($('#wallSw'), WALLS, null, (n) => { state.wall = WALLS.findIndex(w => w.name === n); refresh(); });
  $('#wallCustom').addEventListener('input', (e) => { state.wall = -1; state.wallCustom = e.target.value; refresh(); });
  wireArt('logo', $('#logoArt'));
  wireArt('background', $('#bgArt'));

  // quantity
  const setQty = (v) => { state.qty = Math.max(1, Math.min(999, Math.round(+v) || 1)); $('#qty').value = state.qty; updateUI(); };
  $('#qty').addEventListener('change', (e) => setQty(e.target.value));
  document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => setQty(state.qty + +b.dataset.q)));
  $('#cartView').addEventListener('click', () => goShopify('/cart'));
  $('#cartCheckout').addEventListener('click', () => goShopify('/checkout'));

  const fs = $('#fastSw'); fs.innerHTML = '';
  for (const f of FASTENERS) {
    const b = document.createElement('button'); b.className = 'fast'; b.dataset.k = f.id;
    b.innerHTML = `<i style="--c:${f.color}"></i><span>${f.name}</span>`;
    b.addEventListener('click', () => { state.fastener = f.id; refresh(); });
    fs.appendChild(b);
  }

  $('#faceCustom').addEventListener('input', (e) => { state.face = e.target.value; state.lamSel = null; refresh(); });
  $('#lamBtn').addEventListener('click', openPicker);
  $('#lamClear').addEventListener('click', () => { state.lamSel = null; refresh(); });
  $('#grain').addEventListener('change', (e) => { state.grain = e.target.checked; refresh(); });
  $('#edgeCustom').addEventListener('input', (e) => { state.edge = e.target.value; refresh(); });
  $('#cw').addEventListener('input', (e) => { state.customA = clamp(+e.target.value); refresh(true); });
  $('#ch').addEventListener('input', (e) => { state.customB = clamp(+e.target.value); refresh(true); });
  document.querySelectorAll('[data-orient]').forEach(b => b.addEventListener('click', () => { state.orient = b.dataset.orient; refresh(true); }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#sheets').addEventListener('change', (e) => { state.sheets = e.target.checked; refresh(); });
  $('#sheetTurn').addEventListener('change', (e) => { state.sheetTurn = e.target.checked; refresh(); });
  $('#cta').addEventListener('click', onCta);

  // URL presets: ?size=12x24&color=Black&edge=Red&finish=chrome&orient=landscape
  const q = new URLSearchParams(location.search);
  if (q.get('size') && (SIZES.some(s => s.id === q.get('size')))) state.sizeId = q.get('size');
  if (q.get('color') && COLORS.some(c => c.name === q.get('color'))) state.face = q.get('color');
  if (q.get('edge') && COLORS.some(c => c.name === q.get('edge'))) state.edge = q.get('edge');
  if (q.get('finish') && FASTENERS.some(f => f.id === q.get('finish'))) state.fastener = q.get('finish');
  if (q.get('orient') === 'landscape') state.orient = 'landscape';
  if (q.get('sheets') === '0') { state.sheets = false; $('#sheets').checked = false; }
}
function clamp(v) { return Math.max(1, Math.min(96, isFinite(v) ? v : 12)); }

// Upload + layout controls for one artwork layer, cloned from <template id="artTpl"> in index.html
function wireArt(key, mount) {
  const L = state.art[key], cfg = ARTWORK[key];
  const node = $('#artTpl').content.firstElementChild.cloneNode(true);
  const r = (n) => node.querySelector(`[data-r="${n}"]`);
  for (const l of LAYOUTS) r('layout').add(new Option(l.name, l.id));
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
    r('gapWrap').hidden = L.layout === 'single';
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
const pick = { q: '', type: new Set(), color: new Set(), shade: new Set(), cut: new Set(), match: new Set(), shown: 60 };
const FIELD = { type: 'type', color: 'color', shade: 'shade', cut: 'cut', match: 'match' };

fetch(LAMINATE.libraryUrl, { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : { items: [] }))
  .catch(() => ({ items: [] }))
  .then(j => {
    library = j.items || [];
    libraryReady = true;
    const want = new URLSearchParams(location.search).get('lam');      // ?lam=5075 preset
    if (want) { selectLam(findByNumber(want) || unknownLam(want, '#bdbdbd'), true); }
    if (!$('#lamModal').hidden) renderPicker();
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
    const box = document.createElement('div'); box.className = 'fgroup';
    box.innerHTML = `<h3>${g.label}</h3>`;
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
    const b = document.createElement('button'); b.className = 'card'; b.dataset.n = it.n;
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

function openPicker() {
  const m = $('#lamModal');
  m.hidden = false;
  document.body.style.overflow = 'hidden';
  renderPicker();
  setTimeout(() => $('#lamSearch').focus(), 30);
}
function closePicker() {
  $('#lamModal').hidden = true;
  document.body.style.overflow = '';
  $('#lamBtn').focus();
}
function selectLam(item, silent) {
  state.lamSel = item;
  state.grain = false; $('#grain').checked = false;
  if (!silent) closePicker();
  refresh();
}

function wirePicker() {
  const m = $('#lamModal');
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) return closePicker();
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
  if (refit) setView(state.view);
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3800);
}
function onCta() {
  const sp = currentSpec();
  if (!sp.price) {
    const body = encodeURIComponent(`Custom compliance board quote request\n\nQuantity: ${sp.quantity}\nSize: ${fmt(sp.widthIn)}" W x ${fmt(sp.heightIn)}" H\nBoard color: ${sp.boardColor}\nEdge banding: ${sp.edgeBanding}\nFastener finish: ${sp.fastenerFinish}\n` +
      (sp.logo ? `Logo: ${logoLine(sp.logo)}\n\nPlease attach your logo file to this email.\n` : ''));
    const url = `mailto:${SHOPIFY.quoteEmail}?subject=${encodeURIComponent('Custom board quote')}&body=${body}`;
    if (embedded) window.parent.postMessage({ type: 'cobo:quote', payload: sp }, '*');
    window.open(url, '_blank');
    return;
  }
  if (embedded) {
    window.parent.postMessage({ type: SHOPIFY.messageType, payload: sp }, '*');
    toast('Adding to cart…');
  } else {
    // standalone preview (not inside Shopify): keep a pretend cart so the panel can be designed and tested
    const label = `${sp.size} board · ${sp.boardColor}`;
    const detail = `${sp.edgeBanding === 'Match board' ? 'Matching' : sp.edgeBanding} edge · ${sp.fastenerFinish}`;
    const hit = localCart.find(it => it.label === label && it.detail === detail);
    if (hit) { hit.qty += sp.quantity; hit.line = hit.qty * sp.price; }
    else localCart.push({ label, detail, qty: sp.quantity, line: sp.quantity * sp.price });
    renderCart({ items: localCart, total: localCart.reduce((s, it) => s + it.line, 0), demo: true });
    toast(sp.variantId ? `Added ${sp.quantity} to the preview cart` : 'Added to the preview cart (no Shopify variant ID mapped yet for this combination)');
  }
}

/* ------------------------------------------------------------------ cart preview */
// Inside Shopify, the store page sends the real cart in (see shopify/cobo-configurator-embed.liquid).
// Opened on its own, the panel shows a pretend cart so the design can be tested.
const embedded = window.parent !== window;
const localCart = [];
function renderCart(cart) {
  const box = $('#cartBox');
  box.hidden = !cart.items.length;
  if (!cart.items.length) return;
  const count = cart.items.reduce((s, it) => s + it.qty, 0);
  $('#cartCount').textContent = `${count} item${count === 1 ? '' : 's'}${cart.demo ? ' · preview only' : ''}`;
  const list = $('#cartList'); list.innerHTML = '';
  for (const it of cart.items) {
    const li = document.createElement('li');
    li.innerHTML = '<div><b></b><small></small></div><span class="q"></span><span class="lp"></span>';
    li.querySelector('b').textContent = it.label;
    li.querySelector('small').textContent = it.detail;
    li.querySelector('.q').textContent = `× ${it.qty}`;
    li.querySelector('.lp').textContent = `$${it.line.toFixed(2)}`;
    list.appendChild(li);
  }
  $('#cartTotal').textContent = `Subtotal $${cart.total.toFixed(2)}`;
}
function goShopify(path) {
  if (embedded) window.parent.postMessage({ type: 'cobo:go', path }, '*');
  else toast(`In Shopify this opens ${path}`);
}
window.addEventListener('message', (e) => {
  if (!embedded || e.source !== window.parent) return;
  const d = e.data;
  if (d?.type === 'cobo:cart' && d.cart) {
    const items = (d.cart.items || []).map(it => ({
      label: it.product_title + (it.variant_title ? ` · ${it.variant_title}` : ''),
      detail: Object.entries(it.properties || {}).filter(([k, v]) => v && k[0] !== '_').map(([, v]) => v).join(' · '),
      qty: it.quantity, line: (it.final_line_price ?? it.line_price) / 100,
    }));
    renderCart({ items, total: (d.cart.total_price || 0) / 100 });
    if (d.added) toast(`Added to cart`);
  }
  if (d?.type === 'cobo:notice' && d.text) toast(String(d.text));
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
      ? `Tap the button, then point your phone at a wall. Your ${fmt(w)}" × ${fmt(h)}" board appears at real size.`
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
  dirty = true;
}
const clock = new THREE.Clock();
let dirty = true;
controls.addEventListener('change', () => { dirty = true; });
function loop() {
  const dt = clock.getDelta();
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 0.8);
    const k = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (tween.t >= 1) tween = null;
  }
  if (controls.update()) dirty = true;   // true while the user is orbiting / damping
  if (tween) dirty = true;
  if (dirty) { renderer.render(scene, camera); dirty = false; }   // draw only when something changed
  requestAnimationFrame(loop);
}

build();
wirePicker();
new ResizeObserver(() => { resize(); }).observe(stage);
resize();
buildBoard();
setView('angle', true);
window.__cobo = { state, refresh, setView, currentSpec, THREE, scene, camera, renderer };
loop();
