// Run after editing index.html (and before each push):  node tools/make-versions.js
// Builds v2/ to v6/index.html from index.html: same page, a different data-layout (which turns on that
// version's layout in js/main.js), and paths fixed to work one folder down. Never edit v2/ to v6/ by hand.
// v6 is v5 plus data-v6 (the floating icon dock, no wall scan), so it keeps every v5 feature it doesn't change.
// v7 is v6 plus data-v7: no popular designs anywhere.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const names = { v2: 'Standard or custom', v3: 'All options, priced', v4: 'Guided, photo first', v5: 'Auto-suggest', v6: 'Floating dock', v7: 'No popular designs' };

for (const v of ['v2', 'v3', 'v4', 'v5', 'v6', 'v7']) {
  const lay = v === 'v6' ? 'v5" data-v6="' : v === 'v7' ? 'v5" data-v6="" data-v7="' : v;
  let html = src
    .replace('<html lang="en" data-layout="v1">', `<html lang="en" data-layout="${lay}"${['v4', 'v5', 'v6', 'v7'].includes(v) ? ' data-step="intro"' : ''}>`)
    .replace(/"\.\/vendor\//g, '"../vendor/')
    .replace(/src="\.\/js\//g, 'src="../js/')
    .replace(/src="img\//g, 'src="../img/')
    .replace(/<title>(.*?)<\/title>/, `<title>$1 (${v}: ${names[v]})</title>`);
  html = `<!-- GENERATED from ../index.html by tools/make-versions.js. Edit index.html, not this file. -->\n${html}`;
  if (!html.includes(`data-layout="${lay}"`)) throw new Error(`index.html is missing <html lang="en" data-layout="v1">`);
  fs.mkdirSync(path.join(root, v), { recursive: true });
  fs.writeFileSync(path.join(root, v, 'index.html'), html);
  console.log(`${v}/index.html written`);
}
