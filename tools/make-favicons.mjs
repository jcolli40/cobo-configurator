// Builds the browser-tab icons from the brand package (run: node tools/make-favicons.mjs; needs Microsoft Edge installed):
//   img/brand/COBO-Favicon.svg        switches by itself: full colour on light browsers, white + sky blue on dark ones
//                                     (Chrome, Edge and Firefox use this one)
//   img/brand/COBO-Favicon-16/32/48/192.png   the backup for Safari (no SVG tab icons): the light icon on a navy rounded tile,
//                                     so it shows on light and dark tabs alike
//   img/brand/COBO-AppTile-180.png    iPhone home-screen tile: the same, square (iOS rounds the corners itself)
// The same files go to the Shopify theme as cobo-favicon.svg, cobo-favicon-*.png and cobo-apptile-180.png.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, '../cobo-logo-2026/interlocked/SVG/');
const OUT = join(ROOT, 'img/brand/');
const NAVY = '#062B68';

// ---------- the switching SVG ----------
const full = readFileSync(PKG + 'COBO-Icon-FullColor.svg', 'utf8');
const inner = full.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  .replace(/fill="#062B68"/g, 'class="n" fill="#062B68"')
  .replace(/fill="#1B88D4"/g, 'class="b" fill="#1B88D4"');
// square canvas (236 x 236) so the tab doesn't squash the 236 x 200 icon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -18 236 236" width="236" height="236">
<style>@media (prefers-color-scheme: dark) { .n { fill: #FFFFFF; } .b { fill: #6CC0F8; } }</style>
${inner}</svg>
`;
writeFileSync(OUT + 'COBO-Favicon.svg', svg);
console.log('COBO-Favicon.svg', (svg.length / 1024).toFixed(1) + ' KB');

// ---------- the tile PNGs, drawn by headless Edge ----------
const rev = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(PKG + 'COBO-Icon-Reverse.svg')).toString('base64');
const tile = (size, round) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;background:${NAVY};border-radius:${round ? Math.round(size * 0.22) : 0}px;display:grid;place-items:center">
<img src="${rev}" style="width:${Math.round(size * 0.78)}px;height:auto"></div></body></html>`;

const port = 9335;
const proc = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'cobo-cdp-favicons')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const wait = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });   // see-through outside the rounded corners

for (const [name, size, round] of [['COBO-Favicon-16.png', 16, true], ['COBO-Favicon-32.png', 32, true], ['COBO-Favicon-48.png', 48, true], ['COBO-Favicon-192.png', 192, true], ['COBO-AppTile-180.png', 180, false]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(tile(size, round)).toString('base64') });
  await sleep(600);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(OUT + name, Buffer.from(r.result.data, 'base64'));
  console.log(name);
}
ws.close(); proc.kill();
