// "Snap your wall": find the documents in a photo of the customer's wall and guess their sizes.
// Runs on the phone, no downloads. It looks for paper: areas brighter and less colorful than the wall that are
// filled-in, roughly rectangular and not too thin. Good enough for a rough count + sizes; customers can fix the rest.

// returns [{ x, y, w, h }] in the image's pixels
export function findDocuments(img) {
  const S = 360, k = S / Math.max(img.width, img.height);
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
  // Otsu's threshold splits "bright" (paper) from "dark" (wall)
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sB = 0, wB = 0, best = 0, thr = 160;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = N - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = lum[i] > thr && sat[i] < 70 ? 1 : 0;
  // close small gaps (text, logos) so each sheet is one solid blob: grow 2px, then shrink 2px
  const morph = (m, grow) => {
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
  };
  mask = morph(morph(mask, true), true); mask = morph(morph(mask, false), false);
  // connected blobs -> boxes
  const seen = new Uint8Array(N), boxes = [], stack = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || seen[s]) continue;
    let minX = W, minY = H, maxX = 0, maxY = 0, n = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p - x) / W; n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= N || seen[q] || !mask[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1, area = bw * bh;
    const ratio = Math.max(bw, bh) / Math.min(bw, bh);
    if (area < N * 0.004 || area > N * 0.6) continue;          // specks, or the wall itself
    if (n / area < 0.55 || ratio > 2.6) continue;              // not a filled rectangle
    boxes.push({ x: minX / k, y: minY / k, w: bw / k, h: bh / k });
  }
  return boxes.sort((a, b) => a.y - b.y || a.x - b.x);
}

// Guess each document's paper size. A photo has no inches, so: the typical letter-shaped sheet is taken to be
// 8.5 x 11 and everything else is scaled from it, then snapped to the nearest standard size.
export function sizeDocuments(boxes, sizes) {
  if (!boxes.length) return [];
  const ratio = (b) => Math.max(b.w, b.h) / Math.min(b.w, b.h);
  const areas = boxes.filter(b => ratio(b) > 1.18 && ratio(b) < 1.4).map(b => b.w * b.h).sort((a, b) => a - b);
  const ref = areas.length ? areas[Math.floor(areas.length / 2)] : Math.min(...boxes.map(b => b.w * b.h));
  const ppi = Math.sqrt(ref / (8.5 * 11));
  return boxes.map(b => {
    const short = Math.min(b.w, b.h) / ppi, long = Math.max(b.w, b.h) / ppi;
    const s = sizes.reduce((a, z) => (Math.abs(z.w - short) + Math.abs(z.h - long) < Math.abs(a.w - short) + Math.abs(a.h - long) ? z : a));
    return { box: b, size: s.id, turn: b.w > b.h };
  });
}
