// Run after editing index.html (and before each push):  node tools/make-versions.js
// Builds v2/ to v6/index.html from index.html: same page, a different data-layout (which turns on that
// version's layout in js/main.js), and paths fixed to work one folder down. Never edit v2/ to v6/ by hand.
// v6 is v5 plus data-v6 (the floating icon dock, no wall scan), so it keeps every v5 feature it doesn't change.
// v7 is v6 plus data-v7: no popular designs anywhere.
// v8 is v7 plus data-v8: "Snap your wall" in the Documents step (Gemini finds and names each certificate; see SNAPWALL-GEMINI.md).
// v8 (and v8-rebrand) load js/main.v8.js, a v8-only build of js/main.js, and get slimmed styles: see tools/build-v8.js.
// data-rebrand turns on the 2026 interlocked-logo colors, icon and favicons. v8 has it (live since 2026-11-03);
// v8-rebrand is the same page, kept so the preview link people were sent still works.
const fs = require('fs');
const v8build = require('./build-v8.js');   // v8 gets its own slimmed engine (js/main.v8.js) and styles
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const names = { v2: 'Standard or custom', v3: 'All options, priced', v4: 'Guided, photo first', v5: 'Auto-suggest', v6: 'Floating dock', v7: 'No popular designs', v8: 'Snap your wall (Gemini)', 'v8-rebrand': 'Rebrand preview' };

// Only v8 is rebuilt: Justin works on v8 alone, and v2-v7 stay exactly as they are unless he asks.
// (To rebuild one of them on request, add it to this list for that run.)
const js = v8build.buildJS();
console.log(`js/main.v8.js written (${js.bytesIn} -> ${js.bytesOut} bytes)`);
for (const v of ['v8', 'v8-rebrand']) {
  const rebrand = v === 'v8' || v === 'v8-rebrand';
  const lay = rebrand ? 'v5" data-v6="" data-v7="" data-v8="" data-rebrand="' : v === 'v6' ? 'v5" data-v6="' : v === 'v7' ? 'v5" data-v6="" data-v7="' : v;
  let html = src
    .replace('<html lang="en" data-layout="v1">', `<html lang="en" data-layout="${lay}"${['v4', 'v5', 'v6', 'v7', 'v8', 'v8-rebrand'].includes(v) ? ' data-step="intro"' : ''}>`)
    .replace(/"\.\/vendor\//g, '"../vendor/')
    .replace(/src="\.\/js\//g, 'src="../js/')
    .replace(/src="img\//g, 'src="../img/')
    .replace(/href="img\//g, 'href="../img/')
    .replace(/url\("fonts\//g, 'url("../fonts/')
    .replace(/^<link [^>]*img\/brand\/COBO-(Favicon|AppTile)[^>]*>\r?\n/gm, m => rebrand ? m : '')
    .replace(/<title>(.*?)<\/title>/, `<title>$1 (${v}: ${names[v]})</title>`);
  if (rebrand) {
    // v8 only: js/main.v8.js instead of js/main.js, and only the styles that can apply on this page (tools/build-v8.js)
    const before = html;
    html = html.replace('src="../js/main.js?v=', 'src="../js/main.v8.js?v=');
    if (html === before) throw new Error('index.html no longer loads ./js/main.js?v=');
    const css = v8build.cssForV8(html);
    html = css.html;
    console.log(`${v}: styles ${css.before} -> ${css.after} bytes (${css.stats.rules} rules and ${css.stats.selectors} more selectors that can't apply to v8 left out)`);
  }
  html = `<!-- GENERATED from ../index.html by tools/make-versions.js. Edit index.html, not this file. -->\n${html}`;
  if (!html.includes(`data-layout="${lay}"`)) throw new Error(`index.html is missing <html lang="en" data-layout="v1">`);
  fs.mkdirSync(path.join(root, v), { recursive: true });
  fs.writeFileSync(path.join(root, v, 'index.html'), html);
  console.log(`${v}/index.html written`);
}
