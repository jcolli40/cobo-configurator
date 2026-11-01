// The Cloudflare Worker's own part: who may call it, size limits, an optional daily cap, then the Gemini request.
// tools/build-worker.js puts the catalog + tools/detect-core.js + this file together into worker/worker.js.
// Settings (all optional except the secret), set in the Worker's Settings -> Variables and Secrets:
//   GEMINI_API_KEY   (secret, required)  the Google AI Studio key
//   ALLOWED_ORIGINS  (text)              extra sites allowed to call it, comma separated, e.g. https://www.complianceboards.com
//   ALLOW_LOCALHOST  (text)              "1" lets pages on localhost call it (testing only)
//   DAILY_LIMIT      (text)              photos per day; default 300. Only counted if a KV namespace named LIMITS is bound.
const DEFAULT_ORIGINS = ['https://jcolli40.github.io', 'https://www.complianceboards.com', 'https://complianceboards.com'];
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 6e6;                                   // the page sends a ~1600 px JPEG, about 0.3 to 1 MB

const detector = makeDetector(CATALOG, { model: 'gemini-3.6-flash', thinking: 'low' });

function originAllowed(origin, env) {
  if (!origin) return false;
  const list = [...DEFAULT_ORIGINS, ...String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
  if (list.includes(origin)) return true;
  return env.ALLOW_LOCALHOST === '1' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ok = originAllowed(origin, env);
    const cors = ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
    const send = (code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });

    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
    if (!ok) return send(403, { error: 'This site isn\'t allowed to use the wall reader.', code: 'origin' });
    if (request.method === 'GET') return send(200, { ready: !!env.GEMINI_API_KEY, model: 'gemini-3.6-flash' });
    if (request.method !== 'POST') return send(405, { error: 'POST a photo' });

    if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) return send(413, { error: 'Photo too large', code: 'too-large' });
    let body;
    try { body = JSON.parse(await request.text()); } catch { return send(400, { error: 'Bad request' }); }
    if (typeof body.image !== 'string' || !body.image || body.image.length > MAX_BYTES * 1.4) return send(400, { error: 'No usable photo' });
    const mime = MIMES.includes(body.mime) ? body.mime : 'image/jpeg';

    // optional daily cap, kept in a KV namespace bound as LIMITS (a soft cap: a burst can overshoot it a little)
    if (env.LIMITS) {
      const day = new Date().toISOString().slice(0, 10), key = `day:${day}`, limit = Number(env.DAILY_LIMIT) || 300;
      const used = Number(await env.LIMITS.get(key)) || 0;
      if (used >= limit) return send(429, { error: 'The wall reader has reached its daily limit. Try again tomorrow.', code: 'daily-limit' });
      await env.LIMITS.put(key, String(used + 1), { expirationTtl: 172800 });
    }

    try {
      const out = await detector.detect(env.GEMINI_API_KEY, body.image, mime, {});   // (test settings from the page are ignored here)
      return send(200, out);
    } catch (e) {
      return send(e.code === 'no-key' ? 503 : e.code === 'rate-limit' ? 429 : 502, { error: e.message, code: e.code || 'error' });
    }
  },
};
