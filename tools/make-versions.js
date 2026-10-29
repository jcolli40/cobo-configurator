// Run after editing index.html (and before each push):  node tools/make-versions.js
// Builds v2/, v3/ and v4/index.html from index.html: same page, a different data-layout (which turns on that
// version's layout in js/main.js), and paths fixed to work one folder down. Never edit v2/ or v3/ by hand.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const names = { v2: 'Standard or custom', v3: 'All options, priced', v4: 'Guided, photo first' };

for (const v of ['v2', 'v3', 'v4']) {
  let html = src
    .replace('<html lang="en" data-layout="v1">', `<html lang="en" data-layout="${v}"${v === 'v4' ? ' data-step="intro"' : ''}>`)
    .replace(/"\.\/vendor\//g, '"../vendor/')
    .replace(/src="\.\/js\//g, 'src="../js/')
    .replace(/src="img\//g, 'src="../img/')
    .replace(/<title>(.*?)<\/title>/, `<title>$1 (${v}: ${names[v]})</title>`);
  html = `<!-- GENERATED from ../index.html by tools/make-versions.js. Edit index.html, not this file. -->\n${html}`;
  if (!html.includes(`data-layout="${v}"`)) throw new Error(`index.html is missing <html lang="en" data-layout="v1">`);
  fs.mkdirSync(path.join(root, v), { recursive: true });
  fs.writeFileSync(path.join(root, v, 'index.html'), html);
  console.log(`${v}/index.html written`);
}
