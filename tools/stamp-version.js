// Run before each push:  node tools/stamp-version.js
// Gives main.js and config.js a new ?v= in their links, so a phone can never mix a fresh index.html with an old
// cached script (GitHub Pages caches each file separately for ~10 minutes, which left the board blank).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const d = new Date(), pad = (n) => String(n).padStart(2, '0');
const v = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;

for (const f of ['index.html', 'v2/index.html', 'v3/index.html', 'v4/index.html', 'js/main.js'].filter(f => fs.existsSync(path.join(root, f)))) {
  const p = path.join(root, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = before.replace(/([\w-]+\.js)\?v=[\w-]+/g, `$1?v=${v}`);   // every versioned script link/import
  fs.writeFileSync(p, after);
  console.log(`${f}: ${(before.match(/[\w-]+\.js\?v=/g) || []).length} link(s) -> v=${v}`);
}
