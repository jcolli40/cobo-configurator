// "Snap your wall": find the documents in a photo of the customer's wall and guess their sizes.
// Runs on the phone, no downloads. It looks for paper: areas brighter and less colorful than the wall that are
// filled-in, roughly rectangular and not too thin. Good enough for a rough count + sizes; customers can fix the rest.

// returns [{ x, y, w, h, dw, dh }] in the image's pixels: x/y/w/h = the box around it; dw/dh = the sheet's own width
// and height (measured along its edges, so a tilted sheet isn't over-sized)
export function findDocuments(img) {
  const S = 640, k = S / Math.max(img.width, img.height);
  const W = Math.max(8, Math.round(img.width * k)), H = Math.max(8, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, N = W * H;
  const lum = new Uint8Array(N), sat = new Uint8Array(N), hist = new Array(256).fill(0);
  for (let i = 0; i < N; i++) {
    const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
    lum[i] = Math.round(0.299 * r + 0.587 * gg + 0.114 * b);
    sat[i] = Math.max(r, gg, b) - Math.min(r, gg, b);
    hist[lum[i]]++;
  }
  // Otsu's threshold over part of the histogram: splits "bright" from "dark"
  const otsu = (lo) => {
    let n = 0, sum = 0; for (let t = lo; t < 256; t++) { n += hist[t]; sum += t * hist[t]; }
    let sB = 0, wB = 0, best = 0, thr = lo;
    for (let t = lo; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
      sB += t * hist[t]; const v = wB * wF * (sB / wB - (sum - sB) / wF) ** 2;
      if (v > best) { best = v; thr = t; }
    }
    return thr;
  };
  // A wall with light and dark parts (gray planks, brick and mortar) can land on the "bright" side of the first split,
  // so a second split inside the bright part is tried too, and whichever finds the most sheets wins.
  const t1 = otsu(0), t2 = otsu(t1 + 1);
  let best = null;
  for (const thr of new Set([t1, Math.round((t1 + t2) / 2), t2])) {
    const found = sheetsAt(thr);
    const score = found.length + found.reduce((s, f) => s + f.fill, 0) * 0.01;
    if (!best || score > best.score) best = { found, score };
  }
  return best.found.map(f => ({ x: f.x / k, y: f.y / k, w: f.w / k, h: f.h / k, dw: f.dw / k, dh: f.dh / k }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  function sheetsAt(thr) {
    let mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = lum[i] > thr && sat[i] < 70 ? 1 : 0;
    // close 1px gaps (keeps neighboring sheets apart), fill everything enclosed by paper (text, logos, colored
    // headers), then trim 2px off and grow it back (cuts thin bridges between sheets and specks of wall)
    mask = morph(morph(mask, true), false);
    fillHoles(mask);
    mask = morph(morph(mask, false), false); mask = morph(morph(mask, true), true);
    // connected blobs -> sheets
    const seen = new Uint8Array(N), out = [], stack = [];
    for (let s = 0; s < N; s++) {
      if (!mask[s] || seen[s]) continue;
      let minX = W, minY = H, maxX = 0, maxY = 0, n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      stack.push(s); seen[s] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p - x) / W; n++;
        sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        for (const q of [p - 1, p + 1, p - W, p + W]) {
          if (q < 0 || q >= N || seen[q] || !mask[q]) continue;
          if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
          seen[q] = 1; stack.push(q);
        }
      }
      if (n < N * 0.004 || n > N * 0.5) continue;                 // specks, or the wall itself
      // the blob's own long and short side (from how its pixels spread out), whatever angle it's at
      const mx = sx / n, my = sy / n, vx = sxx / n - mx * mx, vy = syy / n - my * my, cxy = sxy / n - mx * my;
      const mid = (vx + vy) / 2, dev = Math.sqrt(((vx - vy) / 2) ** 2 + cxy * cxy);
      const L = Math.sqrt(12 * (mid + dev)), Sh = Math.sqrt(12 * Math.max(0, mid - dev));
      const fill = n / (L * Sh);                                  // 1 = a perfect rectangle
      if (fill < 0.8 || fill > 1.2 || L / Sh > 2.6) continue;     // not a sheet-shaped rectangle
      const ang = 0.5 * Math.atan2(2 * cxy, vx - vy), flat = Math.abs(Math.cos(ang)) >= Math.abs(Math.sin(ang));
      out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, dw: flat ? L : Sh, dh: flat ? Sh : L, fill });
    }
    return out;
  }
  // grow (or shrink) the white parts of a mask by 1 pixel
  function morph(m, grow) {
    const o = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      look: for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        const s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : m[yy * W + xx];
        if (grow && s) { v = 1; break look; }
        if (!grow && !s) { v = 0; break look; }
      }
      o[y * W + x] = v;
    }
    return o;
  }
  // dark areas that can't be reached from the photo's edge without crossing paper are inside a sheet: fill them
  function fillHoles(m) {
    const out = new Uint8Array(N), stack = [];
    const seed = (p) => { if (!m[p] && !out[p]) { out[p] = 1; stack.push(p); } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (stack.length) {
      const p = stack.pop(), x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || out[q] || m[q]) continue;
        out[q] = 1; stack.push(q);
      }
    }
    for (let i = 0; i < N; i++) if (!out[i]) m[i] = 1;
  }
}

// The wall around the documents: its color, and how light, warm and colorful it is (each -1 to 1), plus a plain-English
// name ("light warm beige"). Used to suggest board looks that go with the room.
export function wallLook(img, boxes) {
  const S = 120, k = S / Math.max(img.width, img.height);
  const W = Math.max(4, Math.round(img.width * k)), H = Math.max(4, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, pad = 0.04 * Math.max(img.width, img.height);
  const inDoc = (x, y) => boxes.some(b => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
  const R = [], G = [], B = [], L = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inDoc(x / k, y / k)) continue;
    const i = (y * W + x) * 4; R.push(px[i]); G.push(px[i + 1]); B.push(px[i + 2]); L.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
  }
  if (!R.length) return null;
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const mean = L.reduce((s, v) => s + v, 0) / L.length, sd = Math.sqrt(L.reduce((s, v) => s + (v - mean) ** 2, 0) / L.length);
  const r = med(R), gg = med(G), b = med(B);
  // hue / saturation / lightness
  const mx = Math.max(r, gg, b) / 255, mn = Math.min(r, gg, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) { h = mx === r / 255 ? ((gg - b) / 255 / d) % 6 : mx === gg / 255 ? (b - r) / 255 / d + 2 : (r - gg) / 255 / d + 4; h = (h * 60 + 360) % 360; }
  const cl = (v) => Math.max(-1, Math.min(1, v));
  const look = {
    hex: '#' + [r, gg, b].map(v => v.toString(16).padStart(2, '0')).join(''),
    light: cl((l - 0.5) * 2.2),
    warm: cl(Math.cos((h - 30) * Math.PI / 180) * Math.min(1, s * 3)),   // orange = warmest, blue = coolest
    colorful: cl(s * 3 - 1),
    textured: sd / 255 > 0.13,                                          // brick, wood, tile...
  };
  let name;
  if (s < 0.07) name = l > 0.85 ? 'white' : l > 0.6 ? 'light gray' : l > 0.3 ? 'gray' : 'charcoal';
  else if (h < 45 || h >= 345) name = l < 0.4 ? (h < 20 || h >= 345 ? 'brick' : 'wood brown') : l > 0.7 ? 'beige' : s > 0.45 ? 'terracotta' : 'tan';
  else if (h < 70) name = l > 0.7 ? 'cream' : 'mustard';
  else if (h < 170) name = s < 0.3 ? 'sage green' : 'green';
  else if (h < 260) name = s < 0.3 ? 'slate blue' : 'blue';
  else name = 'purple';
  const tone = l > 0.66 ? 'light' : l < 0.33 ? 'dark' : '';
  const temp = look.warm > 0.25 ? 'warm' : look.warm < -0.25 ? 'cool' : '';
  look.name = [tone, temp, name].filter(Boolean).join(' ').replace(/^light white$/, 'white').replace(/^dark charcoal$/, 'charcoal');
  return look;
}

// Guess each document's paper size. A photo has no inches, so: the typical letter-shaped sheet is taken to be
// 8.5 x 11 and everything else is scaled from it, then snapped to the nearest standard size.
export function sizeDocuments(boxes, sizes) {
  if (!boxes.length) return [];
  const dims = (b) => [b.dw ?? b.w, b.dh ?? b.h];          // the sheet's own sides (tilt-proof) when known
  const ratio = (b) => { const [w, h] = dims(b); return Math.max(w, h) / Math.min(w, h); };
  const areas = boxes.filter(b => ratio(b) > 1.18 && ratio(b) < 1.4).map(b => dims(b)[0] * dims(b)[1]).sort((a, b) => a - b);
  const ref = areas.length ? areas[Math.floor(areas.length / 2)] : Math.min(...boxes.map(b => dims(b)[0] * dims(b)[1]));
  const ppi = Math.sqrt(ref / (8.5 * 11));
  return boxes.map(b => {
    const [w, h] = dims(b), short = Math.min(w, h) / ppi, long = Math.max(w, h) / ppi;
    const s = sizes.reduce((a, z) => (Math.abs(z.w - short) + Math.abs(z.h - long) < Math.abs(a.w - short) + Math.abs(a.h - long) ? z : a));
    return { box: b, size: s.id, turn: w > h };
  });
}
