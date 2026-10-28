import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIZES, CUSTOM, COLORS, FASTENERS, WALLS, HW, SHOPIFY, LAMINATE } from './config.js';

/* ------------------------------------------------------------------ state */
const state = {
  sizeId: '24x36',          // a standard id, or 'custom'
  customA: 18, customB: 30, // custom short/long side
  orient: 'portrait',       // 'portrait' | 'landscape'
  face: 'Black',            // color name or '#rrggbb'
  edge: 'match',            // 'match' | color name | '#rrggbb'
  fastener: 'alum',
  sheets: true,
  wall: 0,
  view: 'angle',
  lamSel: null,             // chosen Wilsonart laminate {n, name, avg, full, ...} (overrides face color)
  grain: false,             // rotate the laminate pattern 90 degrees
};

/* ------------------------------------------------------------------ helpers */
const $ = (s) => document.querySelector(s);
const colorHex = (v) => (v && v[0] === '#') ? v : (COLORS.find(c => c.name === v)?.hex ?? '#888888');

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI - 0.15;

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.35));
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
    roughnessMap: f.brushed ? brushedMap : null,
    clearcoat: f.brushed ? 0 : 1, clearcoatRoughness: 0.05,
  });
  return m;
}

// Clear acrylic: a faint, glossy transparent sheet (crisp poster underneath, no transmission blur)
const acrylicMat = new THREE.MeshPhysicalMaterial({
  color: 0xe6f6ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false,
  clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.6, side: THREE.FrontSide,
});
const laminate = (hex, rough = 0.55) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 });
const bandMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4, metalness: 0 });
const mdoMat = new THREE.MeshStandardMaterial({ color: '#a8845a', roughness: 0.85 });
const backLamMat = new THREE.MeshStandardMaterial({ color: '#17171a', roughness: 0.38 });
const alumMat = new THREE.MeshStandardMaterial({ color: '#c3c6cb', metalness: 1, roughness: 0.4, roughnessMap: brushedMap });
const steelMat = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 1, roughness: 0.35 });

/* ------------------------------------------------------------------ compliance sheet mock-up */
function posterTexture(w, h) {
  const px = 64, c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  const m = 0.05 * c.width;
  g.fillStyle = '#1b3a6b'; g.fillRect(0, 0, c.width, Math.min(c.height * 0.1, 90));
  g.fillStyle = '#ffffff'; g.font = `bold ${Math.min(c.height * 0.055, 44)}px sans-serif`;
  g.textBaseline = 'middle'; g.fillText('SAMPLE COMPLIANCE POSTER', m, Math.min(c.height * 0.05, 45));
  g.fillStyle = '#d9d9d9';
  let y = Math.min(c.height * 0.1, 90) + c.height * 0.04;
  const lh = Math.max(14, c.height * 0.022);
  while (y < c.height - m) {
    const len = c.width * (0.55 + Math.random() * 0.4) - m;
    g.fillRect(m, y, len, lh * 0.45);
    y += lh;
    if (Math.random() < 0.12) y += lh * 0.7;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
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
      if (o.material.map) o.material.map.dispose();
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

  // compliance sheet mock-up between board face and acrylic
  if (state.sheets) {
    const mg = Math.max(0.6, Math.min(3, Math.min(w, h) * 0.1));   // border of board left visible around the sheet
    const sw = w - 2 * mg, sh = h - 2 * mg;
    const mat = new THREE.MeshStandardMaterial({ map: posterTexture(sw, sh), roughness: 0.8 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    p.position.z = T + 0.012; p.receiveShadow = true; root.add(p);
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

  // wall
  const wallZ = -(D + 2 * t);
  const wallMat = new THREE.MeshStandardMaterial({ color: WALLS[state.wall].hex, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), wallMat);
  wall.position.z = wallZ; wall.receiveShadow = true; wall.name = 'wall';
  wall.visible = state.view !== 'back';
  root.add(wall);

  // light + shadow frustum scaled to the board
  const R = Math.max(w, h);
  key.position.set(-R * 0.7, R * 0.9, R * 1.3);
  key.target.position.set(0, 0, 0); scene.add(key.target);
  const sc = key.shadow.camera; const s = R * 1.2;
  sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.5; sc.far = R * 6; sc.updateProjectionMatrix();

  scene.background = new THREE.Color(state.view === 'back' ? '#d7d7d9' : WALLS[state.wall].hex);
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
  scene.background = new THREE.Color(view === 'back' ? '#d7d7d9' : WALLS[state.wall].hex);
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
  document.querySelectorAll('#wallSw .sw').forEach(b => b.classList.toggle('on', b.dataset.k === WALLS[state.wall].name));
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
  const variantId = (std && !L) ? (SHOPIFY.variantIds[std.id]?.[state.face] ?? null) : null;
  return {
    size: std ? std.id : `custom ${fmt(w)}x${fmt(h)}`, widthIn: w, heightIn: h, orientation: state.orient,
    boardColor: L ? `Wilsonart ${L.n}${L.name ? ' ' + L.name : ''}` : faceName,
    laminateNumber: L ? L.n : null, laminateName: L ? (L.name || null) : null, laminateInLibrary: L ? !L.unknown : null,
    patternRotated: L ? state.grain : null,
    edgeBanding: edgeName, fastenerFinish: f.name, sheetsShown: state.sheets,
    price: (std && !L) ? std.price : null, variantId,   // custom laminates are quoted, not priced online
  };
}
function updateUI() {
  paintActive();
  const sp = currentSpec();
  $('#specTitle').textContent = `${fmt(sp.widthIn)}" W × ${fmt(sp.heightIn)}" H`;
  $('#specLine').textContent = `${sp.boardColor} · ${sp.edgeBanding === 'Match board' ? 'matching edge' : sp.edgeBanding + ' edge'} · ${sp.fastenerFinish}`;
  $('#price').textContent = sp.price ? `$${sp.price.toFixed(2)}` : 'Custom quote';
  $('#cta').textContent = sp.price ? 'Add to cart' : 'Request a quote';
  $('#note').textContent = sp.price
    ? 'Ships with aluminum z-clip hanger, M6 studs and 1" caps. Prices shown are the standard-board prices; compliance sheets are not included.'
    : 'Custom boards are made to order — send us this spec and we will quote it.';
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
    const body = encodeURIComponent(`Custom compliance board quote request\n\nSize: ${fmt(sp.widthIn)}" W x ${fmt(sp.heightIn)}" H\nBoard color: ${sp.boardColor}\nEdge banding: ${sp.edgeBanding}\nFastener finish: ${sp.fastenerFinish}\n`);
    const url = `mailto:${SHOPIFY.quoteEmail}?subject=${encodeURIComponent('Custom board quote')}&body=${body}`;
    if (window.parent !== window) window.parent.postMessage({ type: 'cobo:quote', payload: sp }, '*');
    window.open(url, '_blank');
    return;
  }
  if (window.parent !== window) {
    window.parent.postMessage({ type: SHOPIFY.messageType, payload: sp }, '*');
    toast('Sent to cart…');
  } else {
    console.log('ADD TO CART', sp);
    toast(sp.variantId ? `Would add variant ${sp.variantId} to cart (standalone preview)` : 'No Shopify variant ID mapped yet for this combination (see config.js)');
  }
}

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
