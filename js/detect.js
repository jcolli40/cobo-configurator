// Part A "detect" (browser side): send a wall photo to Gemini (through /api/detect, which holds the key) and get each
// certificate's box and type back. Part B "tracking" takes the result from here (see handoff()).
// Used by detect/index.html (the test lab) and by the photo scan in js/main.js.

// Where the wall reader lives. On this computer (localhost, or a 192.168... address on your Wi-Fi) it's the local preview
// server. On the public site it's the Cloudflare Worker: paste its address into WORKER_URL after deploying it
// (see SNAPWALL-GEMINI.md). While WORKER_URL is empty the public site simply uses the old scanner.
const WORKER_URL = 'https://cobo-detect.justin-2f3.workers.dev';   // the Cloudflare Worker (holds the Gemini key)
const LOCAL = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(location.hostname);
export const DETECT_URL = LOCAL ? '/api/detect' : WORKER_URL;
const SEND_PX = 1600;                       // the photo is shrunk to this on its long side before sending

let catalog = null;
// { groups, types: [{ id, name, group, board, aka, looks }], other, byId }
export async function certTypes() {
  if (!catalog) {
    catalog = await fetch(new URL('../data/cert-types.json', import.meta.url)).then(r => r.json());
    catalog.byId = Object.fromEntries([...catalog.types, catalog.other].map(t => [t.id, t]));
  }
  return catalog;
}

// is Gemini set up? -> { ready, model }, or null when there's no detect server (e.g. on GitHub Pages)
export async function detectStatus() {
  if (!DETECT_URL) return null;
  try { const r = await fetch(DETECT_URL); return r.ok ? await r.json() : null; } catch { return null; }
}

// img: an <img> or <canvas> at full size. Returns { items: [{ box: {x,y,w,h} in img pixels, types, heading, issuer,
// confidence, reason, closer_photo: 'none' or why a close-up would help, paper: the sheet itself inside any frame (for sizing;
// .dw/.dh = its true sides when the corners are known), quad: its 4 corners [tl, tr, br, bl] {x,y} or null }], photo_notes, model, usage, ms }. Throws an Error with .code: no-server, no-key, rate-limit, ...
// options (lab testing): { model, thinking, resolution }
export async function detectCertificates(img, options) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, SEND_PX / Math.max(W, H));
  const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const image = c.toDataURL('image/jpeg', 0.86).split(',')[1];
  if (!DETECT_URL) throw Object.assign(new Error("The wall reader isn't set up on this site yet."), { code: 'no-server' });
  let res;
  try {
    res = await fetch(DETECT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, mime: 'image/jpeg', options }) });
  } catch { throw Object.assign(new Error('The detect server isn\'t running.'), { code: 'no-server' }); }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Detect failed (${res.status})`), { code: out.code || (res.status === 404 ? 'no-server' : 'error') });
  out.items = readingOrder(out.items.map(i => {
    const paper = fromBox2d(i.paper_2d || i.box_2d, W, H), quad = toQuad(i.corners, W, H, paper);
    if (quad) Object.assign(paper, quadSides(quad));               // (tilt-proof sides: better paper-size guesses)
    return { ...i, box: fromBox2d(i.box_2d, W, H), paper, quad };
  }).filter(i => i.box.w > 4 && i.box.h > 4));
  return out;
}

// number them like reading a page: rows top to bottom (a row = items beside the first one's middle), left to right
export function readingOrder(items) {
  const left = [...items].sort((a, b) => a.box.y - b.box.y), out = [];
  while (left.length) {
    const mid = left[0].box.y + left[0].box.h / 2;
    const row = left.filter(i => i.box.y <= mid && i.box.y + i.box.h >= mid);
    for (const i of row) left.splice(left.indexOf(i), 1);
    out.push(...row.sort((a, b) => a.box.x - b.box.x));
  }
  return out;
}

// Gemini boxes are [ymin, xmin, ymax, xmax] on a 0-1000 scale
const fromBox2d = ([y0, x0, y1, x1], W, H) => ({ x: x0 / 1000 * W, y: y0 / 1000 * H, w: (x1 - x0) / 1000 * W, h: (y1 - y0) / 1000 * H });
const toBox2d = (b, W, H) => [b.y / H, b.x / W, (b.y + b.h) / H, (b.x + b.w) / W].map(v => Math.round(v * 1000));

// Gemini's corners ([y, x] on 0-1000) -> image pixels, put in order (top-left, top-right, bottom-right, bottom-left) and
// sanity-checked against its box around the paper. null when they don't make a believable sheet of paper.
function toQuad(corners, W, H, paper) {
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  let q = corners.map(([y, x]) => ({ x: x / 1000 * W, y: y / 1000 * H }));
  const cx = q.reduce((s, p) => s + p.x, 0) / 4, cy = q.reduce((s, p) => s + p.y, 0) / 4;
  q.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));   // clockwise on screen
  const first = q.reduce((m, p, i) => (p.x + p.y < q[m].x + q[m].y ? i : m), 0);       // top-left = smallest x + y
  q = [...q.slice(first), ...q.slice(0, first)];
  const cross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  if (![0, 1, 2, 3].every(i => cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]) > 0)) return null;   // must be convex
  const area = Math.abs(q.reduce((s, p, i) => s + p.x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * p.y, 0)) / 2;
  const boxArea = paper.w * paper.h, mx = paper.w * 0.08, my = paper.h * 0.08;
  if (area < boxArea * 0.45 || area > boxArea * 1.15) return null;
  if (!q.every(p => p.x > paper.x - mx && p.x < paper.x + paper.w + mx && p.y > paper.y - my && p.y < paper.y + paper.h + my)) return null;
  return q;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const quadSides = ([tl, tr, br, bl]) => ({ dw: (dist(tl, tr) + dist(bl, br)) / 2, dh: (dist(tl, bl) + dist(tr, br)) / 2 });

// One certificate straightened: the 4 corners are stretched back into a flat rectangle (like a scanner app). Gemini's
// corners are close but not exact, so each side is first nudged onto the paper's real edge in the photo, then the cut
// goes a hair inside it so no wall shows. Falls back to a plain cut-out when the corners aren't known.
export function straightenCertificate(img, item, maxPx = 1100) {
  if (!item.quad) return cropCertificate(img, item.paper, 0.01);
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  let src = img;
  if (!src.getContext) { src = document.createElement('canvas'); src.width = W; src.height = H; src.getContext('2d').drawImage(img, 0, 0); }
  // only read the part of the photo around this certificate (plus room to look for its edges)
  const s0 = quadSides(item.quad), M = Math.ceil(0.06 * Math.max(s0.dw, s0.dh)) + 8;
  const x0 = Math.max(0, Math.floor(Math.min(...item.quad.map(p => p.x))) - M), y0 = Math.max(0, Math.floor(Math.min(...item.quad.map(p => p.y))) - M);
  const x1 = Math.min(W, Math.ceil(Math.max(...item.quad.map(p => p.x))) + M), y1 = Math.min(H, Math.ceil(Math.max(...item.quad.map(p => p.y))) + M);
  const sw = x1 - x0, sh = y1 - y0, sd = src.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, sw, sh).data;
  const q = refineQuad(sd, sw, sh, item.quad.map(p => ({ x: p.x - x0, y: p.y - y0 })));
  const ctr = q.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4 }), { x: 0, y: 0 });
  const qi = q.map(p => ({ x: ctr.x + (p.x - ctr.x) * 0.994, y: ctr.y + (p.y - ctr.y) * 0.994 }));   // (0.6% in from the edges)
  const { dw, dh } = quadSides(qi), k = Math.min(1, maxPx / Math.max(dw, dh));
  const OW = Math.max(8, Math.round(dw * k)), OH = Math.max(8, Math.round(dh * k));
  const m = homography([[0, 0], [OW, 0], [OW, OH], [0, OH]], qi.map(p => [p.x, p.y]));
  const out = document.createElement('canvas'); out.width = OW; out.height = OH;
  const og = out.getContext('2d'), od = og.createImageData(OW, OH), o = od.data;
  for (let v = 0; v < OH; v++) for (let u = 0; u < OW; u++) {
    const uu = u + 0.5, vv = v + 0.5, z = m[6] * uu + m[7] * vv + 1;
    const x = Math.min(sw - 1.001, Math.max(0, (m[0] * uu + m[1] * vv + m[2]) / z - 0.5));
    const y = Math.min(sh - 1.001, Math.max(0, (m[3] * uu + m[4] * vv + m[5]) / z - 0.5));
    const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, a = (yi * sw + xi) * 4, b = a + sw * 4, j = (v * OW + u) * 4;
    for (let ch = 0; ch < 3; ch++) {                       // (smooth: a blend of the 4 nearest photo pixels)
      o[j + ch] = (sd[a + ch] * (1 - fx) + sd[a + 4 + ch] * fx) * (1 - fy) + (sd[b + ch] * (1 - fx) + sd[b + 4 + ch] * fx) * fy;
    }
    o[j + 3] = 255;
  }
  og.putImageData(od, 0, 0);
  return out;
}
// Nudge each side of the quad onto the paper's edge: along the side, look a little in and out for where it turns from
// bright (paper) to darker (wall, frame), fit a straight line through those spots, and meet the lines at new corners.
// A side with no clear edge (a pale wall) keeps Gemini's line; a corner that would move too far keeps Gemini's point.
function refineQuad(px, sw, sh, q) {
  const lum = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= sw || y >= sh) return null;
    const i = (y * sw + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  };
  const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const c = q.reduce((m, p) => ({ x: m.x + p.x / 4, y: m.y + p.y / 4 }), { x: 0, y: 0 });
  let reach = 0;
  const sides = q.map((a, i) => {
    const b = q[(i + 1) % 4], len = dist(a, b);
    let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;                 // a normal, turned to point inward
    if ((c.x - (a.x + b.x) / 2) * nx + (c.y - (a.y + b.y) / 2) * ny < 0) { nx = -nx; ny = -ny; }
    const R = Math.max(4, Math.round(len * 0.035)), pts = [];
    reach = Math.max(reach, R);
    for (let k = 1; k <= 14; k++) {
      const t = k / 15, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      let best = 0, bs = 0;
      for (let s = -R; s <= R; s++) {                    // how much brighter just inside than just outside
        let inS = 0, outS = 0, n = 0;
        for (let d = 1; d <= 6; d++) {
          const li = lum(x + nx * (s + d), y + ny * (s + d)), lo = lum(x + nx * (s - d), y + ny * (s - d));
          if (li == null || lo == null) { n = 0; break; }
          inS += li; outS += lo; n++;
        }
        if (n && (inS - outS) / n > best) { best = (inS - outS) / n; bs = s; }
      }
      if (best > 35) pts.push({ t, s: bs });
    }
    if (pts.length < 6) return { a, b, nx, ny, s0: 0, s1: 0 };
    const med = median(pts.map(p => p.s)), dev = median(pts.map(p => Math.abs(p.s - med))) || 1;
    const ok = pts.filter(p => Math.abs(p.s - med) <= 2.5 * dev + 1);
    const mt = ok.reduce((m, p) => m + p.t, 0) / ok.length, ms = ok.reduce((m, p) => m + p.s, 0) / ok.length;
    const vt = ok.reduce((m, p) => m + (p.t - mt) ** 2, 0), slope = vt ? ok.reduce((m, p) => m + (p.t - mt) * (p.s - ms), 0) / vt : 0;
    return { a, b, nx, ny, s0: ms - slope * mt, s1: ms + slope * (1 - mt) };
  });
  const line = (L) => [{ x: L.a.x + L.nx * L.s0, y: L.a.y + L.ny * L.s0 }, { x: L.b.x + L.nx * L.s1, y: L.b.y + L.ny * L.s1 }];
  const meet = ([p1, p2], [p3, p4]) => {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-6) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
  };
  const L = sides.map(line);
  return q.map((p, i) => {                                 // corner i is where side i-1 meets side i
    const n = meet(L[(i + 3) % 4], L[i]);
    return n && dist(n, p) <= reach * 2 ? n : p;
  });
}
// the 3x3 perspective map (8 numbers) that sends 4 points onto 4 others
function homography(from, to) {
  const A = [], B = [];
  from.forEach(([u, v], i) => {
    const [x, y] = to[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y);
  });
  for (let c = 0; c < 8; c++) {                            // solve A h = B (Gaussian elimination)
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  return B.map((b, i) => b / A[i][i]);
}

// one certificate cut out of the full-size photo (a little margin so no edge is lost)
export function cropCertificate(img, box, pad = 0.02) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, m = Math.max(box.w, box.h) * pad;
  const x = Math.max(0, Math.floor(box.x - m)), y = Math.max(0, Math.floor(box.y - m));
  const w = Math.min(W, Math.ceil(box.x + box.w + m)) - x, h = Math.min(H, Math.ceil(box.y + box.h + m)) - y;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
  return c;
}

// What Part A hands to Part B: one entry per certificate. crop = file name of its full-quality cut-out.
export function handoff(items, photo, meta = {}) {
  return {
    format: 'cobo-detect/1', created: new Date().toISOString(), model: meta.model || null,
    photo: { width: photo.width, height: photo.height, notes: meta.photo_notes || '' },
    location: meta.location || null,   // where the business is, if the documents show it (Part B checks by state)
    certificates: items.map((it, i) => ({
      n: i + 1, types: it.types, confidence: it.confidence, heading: it.heading || '', issuer: it.issuer || '',
      on_board: !!it.onBoard, checked_by_customer: !!it.edited, closer_photo: it.closer_photo || 'none',
      paper: it.paper ? { size: it.paper.id, inches: [it.paper.w, it.paper.h], orientation: it.turn ? 'landscape' : 'portrait' } : null,
      box: { x: Math.round(it.box.x), y: Math.round(it.box.y), w: Math.round(it.box.w), h: Math.round(it.box.h) },
      crop: `crop-${i + 1}.jpg`,
    })),
  };
}

// ---- Demo wall: works with no API key. A drawn wall with labeled documents, plus the answer Gemini should give for it.
// With a key, the same picture goes to the real Gemini instead (a quick end-to-end test).
const DEMO_DOCS = [
  // x, y (px), w, h (inches), heading, sub, types, confidence, look
  { x: 80, y: 120, w: 8.5, h: 11, head: 'FOOD SERVICE PERMIT', sub: 'County Department of Public Health', types: ['food_service_permit'], conf: 'high', color: '#1b3a6b', frame: true },
  { x: 340, y: 150, w: 5.5, h: 8.5, head: 'A', sub: 'SANITATION GRADE', types: ['health_grade_card'], conf: 'high', color: '#2e7d4f', grade: true },
  { x: 520, y: 120, w: 8.5, h: 11, head: 'RETAIL ALCOHOLIC BEVERAGE PERMIT', sub: 'State ABC Commission', types: ['liquor_license'], conf: 'high', color: '#7a1f2b' },
  { x: 800, y: 150, w: 7, h: 7, head: 'NO SMOKING', sub: '', types: ['no_smoking_sign'], conf: 'high', color: '#c62828', sign: true },
  { x: 70, y: 520, w: 11, h: 8.5, head: 'BUSINESS TAX CERTIFICATE', sub: 'City of Riverdale · Finance Dept.', types: ['business_license'], conf: 'medium', color: '#6b4a33' },
  { x: 380, y: 480, w: 8.5, h: 11, head: 'CERTIFICATE OF OCCUPANCY', sub: 'Building Inspections Division', types: ['certificate_of_occupancy'], conf: 'medium', color: '#37474f', frame: true, issue: 'glare' },
  { x: 640, y: 520, w: 8.5, h: 11, head: "SELLER'S PERMIT", sub: 'Department of Revenue', types: ['sales_tax_permit'], conf: 'low', color: '#c27c0e', issue: 'too_small' },
  { x: 900, y: 470, w: 8.5, h: 11, head: 'MENU', sub: 'Harbor Grill', types: null, color: '#222', menu: true },   // not a compliance document: skipped
  { x: 1180, y: 150, w: 18, h: 24, head: 'STATE & FEDERAL LABOR LAW POSTER', sub: 'All-in-one', types: ['federal_labor_poster', 'state_labor_posters', 'state_min_wage', 'workers_comp_notice'], conf: 'medium', color: '#1b3a6b', poster: true },
];
export async function demoWall() {
  const W = 1700, H = 900, ppi = 22, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#e8edf5'; g.fillRect(0, 0, W, H);   // the configurator's light blue (--tint)
  for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 3, 3); }
  const items = [];
  for (const d of DEMO_DOCS) {
    const pw = d.w * ppi, ph = d.h * ppi, f = d.frame ? 14 : 0, cx = d.x + pw / 2;
    if (d.frame) { g.fillStyle = '#2a2420'; g.fillRect(d.x - f, d.y - f, pw + 2 * f, ph + 2 * f); }
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(d.x + 5, d.y + 7, pw, ph);
    g.fillStyle = d.menu ? '#1e1e1e' : '#f7f4ec'; g.fillRect(d.x, d.y, pw, ph);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const line = (txt, y, size, color, weight = 700, font = 'Georgia, serif') => {
      let s = size; g.font = `${weight} ${s}px ${font}`;
      while (g.measureText(txt).width > pw * 0.86 && s > 6) g.font = `${weight} ${--s}px ${font}`;
      g.fillStyle = color; g.fillText(txt, cx, y);
    };
    if (d.sign) {
      line(d.head, d.y + ph * 0.14, 20, d.color, 800, 'Arial, sans-serif');
      g.strokeStyle = d.color; g.lineWidth = 9; g.beginPath(); g.arc(cx, d.y + ph * 0.58, pw * 0.3, 0, 7); g.stroke();
      g.fillStyle = '#555'; g.fillRect(cx - pw * 0.2, d.y + ph * 0.56, pw * 0.4, 8);
      g.beginPath(); g.moveTo(cx - pw * 0.21, d.y + ph * 0.37); g.lineTo(cx + pw * 0.21, d.y + ph * 0.79); g.stroke();
    } else if (d.grade) {
      line(d.sub, d.y + ph * 0.12, 13, '#333', 700, 'Arial, sans-serif');
      line(d.head, d.y + ph * 0.52, 120, d.color, 900, 'Arial, sans-serif');
      line('Score 96.5', d.y + ph * 0.88, 14, '#333', 700, 'Arial, sans-serif');
    } else if (d.menu) {
      line(d.head, d.y + ph * 0.1, 30, '#f2d27a', 700);
      g.fillStyle = '#bbb'; for (let yy = d.y + ph * 0.22; yy < d.y + ph * 0.92; yy += ph * 0.06) g.fillRect(d.x + pw * 0.12, yy, pw * (0.4 + rnd() * 0.36), 4);
    } else if (d.poster) {
      g.fillStyle = d.color; g.fillRect(d.x, d.y, pw, ph * 0.08);
      line(d.head, d.y + ph * 0.04, 22, '#fff', 800, 'Arial, sans-serif');
      for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) {
        const bx = d.x + 10 + q * (pw - 20) / 3, by = d.y + ph * 0.1 + r * ph * 0.22, bw = (pw - 20) / 3 - 8, bh = ph * 0.2;
        g.strokeStyle = '#999'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
        g.fillStyle = ['#b3261e', '#1b3a6b', '#2e7d4f'][(r + q) % 3]; g.fillRect(bx + 6, by + 6, bw - 12, 10);
        g.fillStyle = '#aaa'; for (let yy = by + 26; yy < by + bh - 8; yy += 9) g.fillRect(bx + 8, yy, (bw - 16) * (0.6 + rnd() * 0.4), 3);
      }
    } else {
      g.fillStyle = d.color; g.beginPath(); g.arc(cx, d.y + ph * 0.13, Math.min(pw, ph) * 0.08, 0, 7); g.fill();
      line(d.sub, d.y + ph * 0.26, 11, '#444', 600, 'Arial, sans-serif');
      line(d.head, d.y + ph * 0.36, 26, d.color, 800);
      g.fillStyle = '#a6a6a6'; for (let yy = d.y + ph * 0.48; yy < d.y + ph * 0.88; yy += ph * 0.05) g.fillRect(d.x + pw * 0.12, yy, pw * 0.76 * (0.6 + rnd() * 0.4), 3);
    }
    if (d.types) items.push({ box: { x: d.x - f, y: d.y - f, w: pw + 2 * f, h: ph + 2 * f }, paper: { x: d.x, y: d.y, w: pw, h: ph }, types: d.types, heading: d.grade ? 'A' : d.head,
      issuer: d.grade ? '' : d.sub, confidence: d.conf, reason: 'demo answer', closer_photo: d.issue || 'none' });
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  items.forEach(i => { i.box_2d = toBox2d(i.box, W, H); i.paper_2d = toBox2d(i.paper, W, H); });
  return { blob, canvas: c, result: { items: readingOrder(items), photo_notes: 'Demo answer (no Gemini call).', model: 'demo', usage: null, ms: 0, demo: true } };
}
