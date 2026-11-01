// Part A "detect", the Gemini request itself. Shared by:
//   tools/gemini-detect.js   (the local preview server: reads the key from .gemini-key)
//   worker/worker.js         (the Cloudflare Worker, built by tools/build-worker.js: the key is a Worker secret)
// Plain JavaScript with no Node-only code, so it can run in both. Edit it here, then rebuild the Worker.
//
// makeDetector(catalog, { model, thinking, endpoint }) -> { detect(key, image, mime, opts), CHOICES }
//   catalog = the parsed data/cert-types.json
//   detect() resolves { items, photo_notes, model, settings, usage, ms } or throws an Error with .code
//   (no-key, rate-limit, timeout, network, gemini, bad-json).
function makeDetector(CATALOG, cfg) {
  const ENDPOINT = cfg.endpoint || 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const ISSUES = ['none', 'glare', 'too_small', 'blurry', 'cut_off', 'blocked'];
  const IDS = [...CATALOG.types.map(t => t.id), CATALOG.other.id];

  const INSTRUCTIONS = `You look at a photo of a wall in a restaurant or other business and find every compliance document on it:
permits, licenses, certificates, inspection cards, required posters, notices, compliance signs and tags.

For each one, return:
- box_2d: [ymin, xmin, ymax, xmax] around the document's outer edge (including its frame, if framed), normalized to 0-1000.
- paper_2d: the same, but around the paper itself, inside any frame, mat or sleeve (equal to box_2d if unframed).
- types: the matching type id(s) from the catalog below. Use one id, unless it is an all-in-one poster that combines
  several notices (then list every notice it covers). Use "other" if it is a compliance document you can't match.
- heading: the largest title text you can read on it, as written ("" if unreadable).
- issuer: the agency or company that issued it, if you can read it at a glance ("" if not).
- confidence: "high" if the heading or design clearly identifies the type, "medium" if it is a strong guess from the
  layout, seal or partial text, "low" if you are unsure.
- reason: a few words on what gave it away (e.g. "big A grade", "ACORD 25 grid", "ABC board seal").
- closer_photo: "none" if its heading and seal are easy to read in this photo. Otherwise why a closer photo of just
  this one would help: "glare" (reflection hides part of it), "too_small" (too far away to read), "blurry",
  "cut_off" (partly outside the photo) or "blocked" (something in front of it).

Rules:
- Identify the TYPE only. Do not read or report dates, license numbers, names or other fine print.
- Local names differ by state and city; match on meaning (the "also called" lists help). Never invent a new type id.
- Skip things that are not compliance documents: menus, art, photos, mirrors, windows, clocks, decorations, light
  switches, outlets. Include a paper document you can't identify as "other" with low confidence.
- One box per physical item. Several documents in one frame each get their own box. Several small wallet cards in one
  sleeve can share one box.
- Watch the look-alikes: a health inspection grade card (one big grade or score) vs a food service establishment permit
  (text-heavy certificate); a maximum occupancy placard (one big number) vs a certificate of occupancy (full
  certificate); a food protection manager certificate (letter size, a person's name) vs food handler cards (wallet
  size); a fire operational permit vs fire extinguisher or sprinkler inspection paperwork.
- If the photo is blurry, too far away or has glare, still return what you can and say so in photo_notes.

Catalog (id: name. Also called ... Looks: ...):
${CATALOG.types.map(t => `- ${t.id}: ${t.name}. Also called: ${t.aka.join('; ')}. Looks: ${t.looks}`).join('\n')}
- other: a compliance document that matches none of the above.`;

  const SCHEMA = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            box_2d: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
            paper_2d: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 1000 }, minItems: 4, maxItems: 4 },
            types: { type: 'array', items: { type: 'string', enum: IDS }, minItems: 1, maxItems: 8 },
            heading: { type: 'string' },
            issuer: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reason: { type: 'string' },
            closer_photo: { type: 'string', enum: ISSUES },
          },
          required: ['box_2d', 'paper_2d', 'types', 'heading', 'confidence', 'closer_photo'],
        },
      },
      photo_notes: { type: 'string' },
    },
    required: ['items'],
  };

  // The lab can try other settings per photo (speed vs accuracy). Only these values are accepted.
  const CHOICES = {
    model: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
    thinking: ['minimal', 'low', 'medium', 'high'],
    resolution: ['low', 'medium', 'high', 'ultra_high'],
  };
  const pick = (k, v, dflt) => (CHOICES[k].includes(v) ? v : dflt);
  const clamp = (b) => b.map(n => Math.max(0, Math.min(1000, Math.round(n))));

  // the model's final text: steps[].content[] of type "text" (output_text when the API provides it)
  function outputText(body) {
    if (typeof body.output_text === 'string') return body.output_text;
    const texts = [];
    for (const s of body.steps || body.outputs || []) {
      if (s.type && s.type !== 'model_output') continue;
      for (const c of Array.isArray(s.content) ? s.content : [s]) if (c?.type === 'text' && c.text) texts.push(c.text);
    }
    return texts.join('');
  }

  // image: base64 JPEG/PNG/WebP (no "data:" prefix). opts: { model, thinking, resolution } (lab testing only).
  async function detect(key, image, mime = 'image/jpeg', opts = {}) {
    if (!key) { const e = new Error('No Gemini API key yet.'); e.code = 'no-key'; throw e; }
    const settings = { model: pick('model', opts.model, cfg.model), thinking: pick('thinking', opts.thinking, cfg.thinking), resolution: pick('resolution', opts.resolution, 'high') };
    const t0 = Date.now();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: settings.model,
        store: false,                                   // don't keep customer photos on Google's side
        system_instruction: INSTRUCTIONS,
        input: [
          { type: 'text', text: 'Find the compliance documents on this wall. Return JSON only.' },
          { type: 'image', mime_type: mime, data: image, resolution: settings.resolution },
        ],
        generation_config: { thinking_level: settings.thinking },
        response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
      }),
      signal: AbortSignal.timeout(90000),
    }).catch((err) => {
      const e = new Error(err.name === 'TimeoutError' ? 'Gemini took longer than 90 seconds. Try again.' : `Couldn't reach Gemini (${err.message}).`);
      e.code = err.name === 'TimeoutError' ? 'timeout' : 'network'; throw e;
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === 'failed') {
      const msg = body.error?.message || body.errors?.[0]?.message || `Gemini error ${res.status}`;
      const e = new Error(msg); e.code = res.status === 429 ? 'rate-limit' : 'gemini'; e.status = res.status; throw e;
    }
    const text = outputText(body);
    let out;
    try { out = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch { const e = new Error('Gemini sent back something that isn\'t JSON.'); e.code = 'bad-json'; e.raw = text.slice(0, 2000); throw e; }
    // keep only well-formed items and known types (the schema should already ensure this)
    const items = (out.items || []).filter(i => Array.isArray(i.box_2d) && i.box_2d.length === 4).map(i => ({
      box_2d: clamp(i.box_2d), paper_2d: Array.isArray(i.paper_2d) && i.paper_2d.length === 4 ? clamp(i.paper_2d) : clamp(i.box_2d),
      types: [...new Set((i.types || []).filter(t => IDS.includes(t)))].slice(0, 8),
      heading: String(i.heading || ''), issuer: String(i.issuer || ''),
      confidence: ['high', 'medium', 'low'].includes(i.confidence) ? i.confidence : 'low', reason: String(i.reason || ''),
      closer_photo: ISSUES.includes(i.closer_photo) ? i.closer_photo : 'none',
    })).map(i => (i.types.length ? i : { ...i, types: ['other'], confidence: 'low' }));
    return { items, photo_notes: String(out.photo_notes || ''), model: body.model || settings.model, settings, usage: body.usage || null, ms: Date.now() - t0 };
  }

  return { detect, CHOICES };
}

if (typeof module !== 'undefined') module.exports = { makeDetector };   // (ignored inside the Worker)
