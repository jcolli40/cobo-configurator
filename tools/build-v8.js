// Builds the v8-only files from the shared sources (run by tools/make-versions.js and tools/stamp-version.js;
// you never need to run it on its own):
//   js/main.js   -> js/main.v8.js   the engine with every "which version is this?" question answered for v8
//                                   (LAYOUT = v5, V6/V7/V8 on, rebrand on), the other versions' code removed, minified
//   index.html   -> v8/index.html   (see make-versions.js) loads main.v8.js, and its <style> drops the rules that can
//                                   never match anything on the v8 page, without comments and spaces (cssForV8 below)
// js/main.js stays the file to edit; v1 to v7 keep loading it unchanged.
// Needs Node.js and, the first time, internet (npx downloads esbuild once, then reuses it).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ESBUILD = 'esbuild@0.28.2';   // pinned, so the same main.js always builds the same main.v8.js

// What each version flag in main.js is on the v8 page (<html data-layout="v5" data-v6 data-v7 data-v8 data-rebrand>).
// Each line must still read exactly like this in main.js; if one changes, the build stops so this list gets updated.
const FLAGS = [
  ["const LAYOUT = document.documentElement.dataset.layout || 'v1';", 'LAYOUT', '"v5"'],
  ["const PRICED = LAYOUT === 'v3' || LAYOUT === 'v5';", 'PRICED', 'true'],
  ["const ROWS = LAYOUT === 'v2' || LAYOUT === 'v5';", 'ROWS', 'true'],
  ["const GUIDED = LAYOUT === 'v4' || LAYOUT === 'v5';", 'GUIDED', 'true'],
  ["const V6 = 'v6' in document.documentElement.dataset;", 'V6', 'true'],
  ["const V7 = 'v7' in document.documentElement.dataset;", 'V7', 'true'],
  ["const V8 = 'v8' in document.documentElement.dataset;", 'V8', 'true'],
  ["const PHOTO_ROOMS = LAYOUT === 'v5';", 'PHOTO_ROOMS', 'true'],
  ["const FLAT = LAYOUT === 'v5';", 'FLAT', 'true'],
];
const REPLACE = [["document.documentElement.hasAttribute('data-rebrand')", 'true']];

// A fingerprint of main.js (ignoring the ?v= stamps), written at the top of main.v8.js, to tell which main.js it came from
const sourceHash = (src) => crypto.createHash('sha1').update(src.replace(/\?v=[\w-]+/g, '?v=')).digest('hex').slice(0, 12);

// esbuild, installed once into a folder of its own in the computer's temp folder (not in this repo)
let esb = null;
function esbuild() {
  if (esb) return esb;
  const dir = path.join(require('os').tmpdir(), `cobo-${ESBUILD.replace('@', '-')}`);
  const mod = path.join(dir, 'node_modules', 'esbuild');
  if (!fs.existsSync(path.join(mod, 'package.json'))) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{ "private": true }');
    console.log(`Getting ${ESBUILD} (once)...`);
    execSync(`npm install --no-audit --no-fund ${ESBUILD}`, { cwd: dir, stdio: 'inherit' });
  }
  esb = require(mod);
  if (`esbuild@${esb.version}` !== ESBUILD) throw new Error(`build-v8: expected ${ESBUILD}, found ${esb.version}`);
  return esb;
}

function buildJS() {
  const srcPath = path.join(root, 'js', 'main.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  let code = src;
  for (const [line, name] of FLAGS) {
    const at = code.indexOf(line);
    if (at < 0 || code.indexOf(line, at + 1) >= 0) throw new Error(`build-v8: main.js no longer has exactly one "${line}". Update FLAGS in tools/build-v8.js.`);
    code = code.replace(line, '');   // the declaration goes; every use becomes the constant below (same line numbers)
    if (new RegExp(`\\b(let|var|const|function)\\s+${name}\\b`).test(code.replace(/\/\/.*$/gm, ''))) throw new Error(`build-v8: ${name} is declared again in main.js`);
  }
  for (const [from, to] of REPLACE) {
    if (!code.includes(from)) throw new Error(`build-v8: main.js no longer has "${from}". Update REPLACE in tools/build-v8.js.`);
    code = code.split(from).join(to);
  }
  const out = path.join(root, 'js', 'main.v8.js');
  const banner = `/* GENERATED from main.js (${sourceHash(src)}) by tools/build-v8.js for v8 only. Edit main.js, not this file. */`;
  const r = esbuild().transformSync(code, { loader: 'js', format: 'esm', minify: true, treeShaking: true, legalComments: 'none',
    sourcefile: 'main.js', sourcemap: 'inline', sourcesContent: false, banner,
    define: Object.fromEntries(FLAGS.map(([, name, value]) => [name, value])) });
  const js = r.code;
  // keep the source map as its own file (fetched only when someone opens the browser's developer tools)
  const m = js.match(/\n\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)\s*$/);
  if (!m) throw new Error('build-v8: esbuild gave no source map');
  fs.writeFileSync(out, js.slice(0, m.index) + '\n//# sourceMappingURL=main.v8.js.map\n');
  fs.writeFileSync(out + '.map', Buffer.from(m[1], 'base64').toString('utf8'));
  for (const [, name] of FLAGS) if (new RegExp(`\\b${name}\\b`).test(js.slice(0, m.index).replace(banner, ''))) throw new Error(`build-v8: ${name} is still in main.v8.js`);
  return { bytesIn: Buffer.byteLength(src), bytesOut: fs.statSync(out).size };
}

// ---------- CSS ----------
// Splits CSS into its top-level pieces: comments, @-rules (with their {...} block) and style rules. Strings and comments
// are skipped over when matching braces.
function pieces(css) {
  const out = [];
  let i = 0;
  const skipStr = (j) => { const q = css[j]; j++; while (j < css.length && css[j] !== q) { if (css[j] === '\\') j++; j++; } return j + 1; };
  while (i < css.length) {
    if (/\s/.test(css[i])) { let j = i; while (j < css.length && /\s/.test(css[j])) j++; out.push({ ws: css.slice(i, j) }); i = j; continue; }
    if (css.startsWith('/*', i)) { const j = css.indexOf('*/', i + 2); const e = j < 0 ? css.length : j + 2; out.push({ comment: css.slice(i, e) }); i = e; continue; }
    // prelude up to { or ;
    let j = i;
    while (j < css.length && css[j] !== '{' && css[j] !== ';') {
      if (css[j] === '"' || css[j] === "'") j = skipStr(j);
      else if (css.startsWith('/*', j)) { const k = css.indexOf('*/', j + 2); j = k < 0 ? css.length : k + 2; }
      else j++;
    }
    if (css[j] === ';' || j >= css.length) { out.push({ stmt: css.slice(i, j + 1) }); i = j + 1; continue; }
    let depth = 0, k = j;
    for (; k < css.length; k++) {
      const c = css[k];
      if (c === '"' || c === "'") { k = skipStr(k) - 1; continue; }
      if (css.startsWith('/*', k)) { const e = css.indexOf('*/', k + 2); k = (e < 0 ? css.length : e + 2) - 1; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) break;
    }
    out.push({ prelude: css.slice(i, j), body: css.slice(j + 1, k) });
    i = k + 1;
  }
  return out;
}

// Splits a selector list at its top-level commas
function splitSelectors(sel) {
  const parts = []; let depth = 0, start = 0, q = null;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { parts.push(sel.slice(start, i)); start = i + 1; }
  }
  parts.push(sel.slice(start));
  return parts;
}

// Removes every functional pseudo-class with its contents (:not(...), :is(...), :has(...), :nth-child(...)...), and
// attribute selectors and strings, leaving the parts a selector strictly needs.
function plainParts(sel) {
  let out = '', depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (depth === 0 && c === ':' && /^:{1,2}[\w-]+\(/.test(sel.slice(i))) { const k = sel.indexOf('(', i); depth = 1; i = k; continue; }
    if (depth > 0) { if (c === '(') depth++; else if (c === ')') depth--; continue; }
    out += c;
  }
  return out;
}

// Can this one selector never match on the v8 page? Only two sure reasons count (anything inside :not(), :is(), :has()
// and the like is ignored, so a selector is only dropped for something it strictly needs):
//  1. it needs another layout: [data-layout="v2"] etc. (data-layout is only ever on <html>, and v8's is "v5")
//  2. it needs a class or id that appears nowhere in the v8 page, main.v8.js or the other scripts it loads, so nothing
//     can ever put it there. Names that a script may build from pieces ('is-' + x) are kept: if any start of the name
//     up to a - or _ appears in those files, it counts as "maybe used".
function deadSelector(sel, words, text) {
  const s = plainParts(sel);
  for (const m of s.matchAll(/\[data-layout\s*=\s*["']?([\w-]+)["']?\s*\]/g)) if (m[1] !== 'v5') return true;
  const bare = s.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '');
  for (const m of bare.matchAll(/[.#](-?[A-Za-z_][\w-]*)/g)) {
    const name = m[1];
    if (words.has(name)) continue;
    let maybe = false;
    for (let i = 1; i < name.length; i++) if ((name[i] === '-' || name[i] === '_') && text.includes(name.slice(0, i + 1))) { maybe = true; break; }
    if (!maybe) return true;
  }
  return false;
}

function stripRules(css, words, text, stats) {
  let out = '';
  for (const p of pieces(css)) {
    if (p.ws !== undefined) { out += p.ws; continue; }
    if (p.comment !== undefined) { out += p.comment; continue; }
    if (p.stmt !== undefined) { out += p.stmt; continue; }
    const pre = p.prelude.trim();
    if (pre.startsWith('@')) {
      // @media / @supports / @container / @layer: look inside; anything else (@keyframes, @font-face...) stays as is
      if (/^@(media|supports|container|layer|scope|document)\b/.test(pre)) {
        const inner = stripRules(p.body, words, text, stats);
        if (inner.trim() === '' && p.body.trim() !== '') { stats.rules++; stats.bytes += p.prelude.length + p.body.length + 2; continue; }
        out += `${p.prelude}{${inner}}`;
      } else out += `${p.prelude}{${p.body}}`;
      continue;
    }
    const sels = splitSelectors(p.prelude);
    const keep = sels.filter(s => !deadSelector(s, words, text));
    stats.selectors += sels.length - keep.length;
    if (!keep.length) { stats.rules++; stats.bytes += p.prelude.length + p.body.length + 2; continue; }
    out += keep.length === sels.length ? `${p.prelude}{${p.body}}` : `${keep.map(s => s.trim()).join(', ')} {${p.body}}`;
  }
  return out;
}

// Everything that could put a class or id on the v8 page: the page itself and the scripts it runs
function v8Words(html) {
  const files = ['js/main.v8.js', 'js/config.js', 'js/scan.js', 'js/env.js', 'js/detect.js'];
  const text = [html, ...files.map(f => fs.readFileSync(path.join(root, f), 'utf8'))].join('\n');
  return { words: new Set(text.match(/[\w-]+/g)), text };
}

// index.html's <style> for v8: unreachable rules out, then comments and extra spaces out (esbuild, whitespace only:
// no rules are merged or rewritten)
function cssForV8(html) {
  const a = html.indexOf('<style>'), b = html.indexOf('</style>');
  if (a < 0 || b < 0 || html.indexOf('<style>', a + 1) >= 0) throw new Error('build-v8: expected exactly one <style> in index.html');
  const css = html.slice(a + 7, b);
  // the page without its <style>, so the CSS's own class names don't count as "used"
  const { words, text } = v8Words(html.slice(0, a) + html.slice(b));
  const stats = { rules: 0, selectors: 0, bytes: 0 };
  const kept = stripRules(css, words, text, stats);
  const min = esbuild().transformSync(kept, { loader: 'css', minifyWhitespace: true }).code.trim();
  return { html: `${html.slice(0, a)}<style>\n${min}\n${html.slice(b)}`, stats, before: css.length, after: min.length };
}

module.exports = { buildJS, cssForV8, deadSelector };

if (require.main === module) {
  const r = buildJS();
  console.log(`js/main.v8.js: ${r.bytesIn} -> ${r.bytesOut} bytes`);
}
