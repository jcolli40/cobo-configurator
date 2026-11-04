// Builds img/brand/COBO-Icon-FullColor-Race-Loop.svg for the v8 welcome: the same race-track animation as the store header logo
// (the Shopify theme's tools/make-logo-animations.js), on the icon alone, looping until the visitor presses Start.
// Run: node tools/make-icon-race.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../img/brand/');
const NAVY = '#062B68', BLUE = '#1B88D4', GREEN = '#3CB371';
const CX = 18, CY = 0, R = 10.56;          // status light centre and radius (icon coordinates, same as the header logo)
const stops = [[0, NAVY], [0.5, BLUE], [1, NAVY]];

const src = fs.readFileSync(DIR + 'COBO-Icon-FullColor-Status-PlayOnce.svg', 'utf8');
const statusRe = /<path id="cobo-status"[\s\S]*?<\/path>/;
const frameRe = /<path fill="#1B88D4" fill-rule="evenodd" d="([^"]+)"\/>/;
if (!statusRe.test(src) || !frameRe.test(src)) throw new Error('icon layout changed: status light or blue frame not found');
const frameD = src.match(frameRe)[1];

function lerp(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function at(t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) return lerp(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}
// SVG has no conic gradient, so 120 thin wedges in the gradient colours spin inside the blue frame's outline
function wedges() {
  const N = 120, RR = 125, out = [];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1.6) / N) * 2 * Math.PI - Math.PI / 2; // slight overlap hides seams
    const pt = (a) => `${(CX + RR * Math.cos(a)).toFixed(1)},${(CY + RR * Math.sin(a)).toFixed(1)}`;
    out.push(`<path fill="${at(i / N)}" d="M${CX},${CY}L${pt(a0)}L${pt(a1)}Z"/>`);
  }
  return out.join('');
}
const spin = `<animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="360 ${CX} ${CY}" dur="2.5s" repeatCount="indefinite"/>`;
const track = `<clipPath id="cobo-frame-clip"><path d="${frameD}"/></clipPath>
  <g clip-path="url(#cobo-frame-clip)"><g>${wedges()}${spin}</g></g>`;

const svg = src.replace(statusRe, `<circle id="cobo-status" cx="${CX}" cy="${CY}" r="${R}" fill="${GREEN}"/>`).replace(frameRe, track);
fs.writeFileSync(DIR + 'COBO-Icon-FullColor-Race-Loop.svg', svg);
console.log('COBO-Icon-FullColor-Race-Loop.svg', (svg.length / 1024).toFixed(1) + ' KB');
