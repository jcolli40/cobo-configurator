// Rooms for the 3D preview: drawn wall textures + lighting presets (see ENVIRONMENTS in config.js).
import * as THREE from 'three';

// how many inches of wall one copy of each texture covers
export const TEX_INCHES = { wood: 48, brick: 32, subway: 24, steel: 48, paint: 60 };

const cache = new Map();
const shade = (hex, k) => {          // lighten (k > 0) or darken (k < 0) a hex color
  const c = new THREE.Color(hex);
  return k >= 0 ? c.lerp(new THREE.Color('#ffffff'), k).getStyle() : c.lerp(new THREE.Color('#000000'), -k).getStyle();
};
function rnd(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

// Draw one repeat of a wall texture on a canvas (512 px). Returns the canvas.
export function wallCanvas(kind, color) {
  const key = kind + color;
  if (cache.has(key)) return cache.get(key);
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), r = rnd(7);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  if (kind === 'wood') {                      // vertical planks with grain
    const planks = 4, pw = S / planks;
    for (let p = 0; p < planks; p++) {
      g.fillStyle = shade(color, (r() - 0.5) * 0.18); g.fillRect(p * pw, 0, pw, S);
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.08})`; g.lineWidth = 0.5 + r() * 1.5;
        const x = p * pw + r() * pw; g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 8, S / 3, x + (r() - 0.5) * 8, S * 2 / 3, x + (r() - 0.5) * 6, S); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(p * pw, 0, 2, S);
    }
  } else if (kind === 'brick') {              // running bond, 8 x 2.67 in bricks with mortar
    const rows = 12, bh = S / rows, bw = S / 4;
    g.fillStyle = shade(color, 0.55); g.fillRect(0, 0, S, S);   // mortar
    for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) {
      const ox = (y % 2) * bw / 2;
      g.fillStyle = shade(color, (r() - 0.5) * 0.3);
      g.fillRect(x * bw + ox + 3, y * bh + 3, bw - 6, bh - 6);
    }
  } else if (kind === 'subway') {             // 3 x 6 in white tiles, offset rows, grey grout
    const rows = 8, th = S / rows, tw = S / 4;
    g.fillStyle = '#c9ced3'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) {
      const ox = (y % 2) * tw / 2, X = x * tw + ox + 2, Y = y * th + 2;
      g.fillStyle = shade(color, (r() - 0.5) * 0.04); g.fillRect(X, Y, tw - 4, th - 4);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(X, Y, tw - 4, 3);   // glaze highlight
    }
  } else if (kind === 'steel') {              // brushed stainless panels
    for (let i = 0; i < 2200; i++) {
      const v = (r() - 0.5) * 0.16; g.strokeStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      g.lineWidth = r() * 1.2; const y = r() * S; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (r() - 0.5) * 2); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(S / 2 - 1, 0, 2, S);   // panel seams
  } else {                                    // paint: very soft roller texture
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.035})`; g.fillRect(r() * S, r() * S, 2, 2); }
  }
  cache.set(key, c);
  return c;
}
export function wallTexture(kind, color, wallSize) {
  const t = new THREE.CanvasTexture(wallCanvas(kind, color));
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(wallSize / TEX_INCHES[kind], wallSize / TEX_INCHES[kind]);
  return t;
}
// Small CSS background for the room picker tiles
export function wallSwatch(env) {
  if (env.wall === 'color') return 'linear-gradient(135deg, #ffffff, #e9e9ec)';
  return `url(${wallCanvas(env.wall.tex, env.wall.color).toDataURL('image/jpeg', 0.7)}) center/220% auto`;
}
