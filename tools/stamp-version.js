// Run before each push:  node tools/stamp-version.js
// Gives main.js and config.js a new ?v= in their links, so a phone can never mix a fresh index.html with an old
// cached script (GitHub Pages caches each file separately for ~10 minutes, which left the board blank).
// It then rebuilds v8 (tools/make-versions.js: v8/index.html and js/main.v8.js, the v8-only build of main.js), so v8
// always ships the main.js and index.html that are being pushed, with the same new ?v=.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const d = new Date(), pad = (n) => String(n).padStart(2, '0');
const v = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;

function stamp(files) {
  for (const f of files.filter(f => fs.existsSync(path.join(root, f)))) {
    const p = path.join(root, f);
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(/([\w-]+(?:\.v8)?\.js)\?v=[\w-]+/g, `$1?v=${v}`);   // every versioned script link/import
    fs.writeFileSync(p, after);
    console.log(`${f}: ${(before.match(/[\w-]+\.js\?v=/g) || []).length} link(s) -> v=${v}`);
  }
}

stamp(['index.html', 'js/main.js']);
require('./make-versions.js');   // v8/index.html, v8-rebrand/index.html and js/main.v8.js, from the freshly stamped files
stamp(['v8/index.html', 'v8-rebrand/index.html', 'js/main.v8.js']);   // (already carry v; this just reports it)
