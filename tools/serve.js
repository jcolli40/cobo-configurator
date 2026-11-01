// Local preview server (no installs needed, just Node.js).
// Run from the cobo-configurator folder:  node tools/serve.js
// Then open http://localhost:8000
// Dev copy (snapwall-gemini): also answers POST /api/detect (Part A, see tools/gemini-detect.js) and
// GET /api/detect (is a Gemini key set up?).
const http = require('http');
const fs = require('fs');
const path = require('path');
const gemini = require('./gemini-detect.js');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream',
};

const sendJSON = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

async function detectRoute(req, res) {
  if (req.method === 'GET') return sendJSON(res, 200, { ready: !!gemini.apiKey(), model: gemini.MODEL, thinking: gemini.THINKING, choices: gemini.CHOICES });
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'POST a photo' });
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 15e6) return sendJSON(res, 413, { error: 'Photo too large' }); chunks.push(c); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return sendJSON(res, 400, { error: 'Bad request' }); }
  if (typeof body.image !== 'string' || !body.image) return sendJSON(res, 400, { error: 'No photo' });
  try {
    const out = await gemini.detect(body.image, body.mime || 'image/jpeg', body.options || {});
    console.log(`detect: ${out.items.length} found in ${out.ms} ms (${out.model}, thinking ${out.settings.thinking}, detail ${out.settings.resolution})`, out.usage ? JSON.stringify(out.usage) : '');
    sendJSON(res, 200, out);
  } catch (e) {
    console.error('detect failed:', e.code || '', e.message, e.raw ? `\n${e.raw}` : '');
    sendJSON(res, e.code === 'no-key' ? 503 : 502, { error: e.message, code: e.code || 'error' });
  }
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/api/detect') return detectRoute(req, res);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  // never serve hidden files (.gemini-key, .git)
  if (path.relative(ROOT, file).split(path.sep).some(s => s.startsWith('.'))) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`COBO configurator preview: http://localhost:${PORT}  (Gemini key: ${gemini.apiKey() ? 'found' : 'not set up yet'})`));
