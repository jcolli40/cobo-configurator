// Part A "detect" for the local preview: send a wall photo to Gemini and get back each certificate's box and type.
// Used by tools/serve.js (POST /api/detect). The request itself lives in tools/detect-core.js, which the Cloudflare
// Worker uses too (see tools/build-worker.js), so the two can't drift apart.
// The key: put it in a file named .gemini-key in the cobo-configurator-snapwall folder (one line, nothing else),
// or set the GEMINI_API_KEY environment variable. .gemini-key is git-ignored and never served to the browser.
const fs = require('fs');
const path = require('path');
const { makeDetector } = require('./detect-core.js');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cert-types.json'), 'utf8'));
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';   // Nov 1 tests: as accurate as 3.8 on the example wall, twice as fast (~5 s vs ~9 s)
const THINKING = process.env.GEMINI_THINKING || 'low';          // minimal | low | medium | high
const ENDPOINT = process.env.GEMINI_ENDPOINT || undefined;      // (override: testing only)

const core = makeDetector(CATALOG, { model: MODEL, thinking: THINKING, endpoint: ENDPOINT });

function apiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try { return fs.readFileSync(path.join(ROOT, '.gemini-key'), 'utf8').trim() || null; } catch { return null; }
}

// image: base64 JPEG/PNG/WebP (no "data:" prefix). opts: { model, thinking, resolution } (lab testing).
const detect = (image, mime, opts) => core.detect(apiKey(), image, mime, opts);

module.exports = { detect, apiKey, MODEL, THINKING, CHOICES: core.CHOICES };
