# Logo panel: sketch notes (17 Nov 2026)

Sketch: `index.html` (4 options, A-D). Screenshots of today's panel: `before-desktop.jpg`, `before-phone.jpg`. No code in `js/` or `v8/` changed.

## Findings
- **Shoppers cannot reach the Logo section in v8 today.** `STEPS6` in `js/main.js` (line 63) lists build: certs, size; style: boardgrp, edge, caps; preview: arview, sharelink, saveit, summary. `logo` and `bgimg` are in the HTML but no step shows them (the section is `hidden`). The build must add `logo` to a step (sketches assume Style, after Caps).
- Today's logo upload is a layout + 6 sliders (`wireArt`, `artTpl`). Placement is free (`offX`/`offY`); the order spec stores only `file` name, layout, width, spacing, rotation, opacity, move X/Y (`currentSpec`, ~line 1267). Fee: `UPCHARGES.logo` = 45, shown as a `+$` pill on the section header and a help line from `paintPrices`.
- A white JPG prints as a white box on a black board. That is what the knockout fixes.
- Logo width should be capped at board width minus 3" (clear of the corner caps, which sit 1" in and are 1" wide).
- Certificates: the sample certificate fit does not know about a logo. Top/Bottom at 1" will collide with them on small boards. The build needs to keep certificates clear of the logo band (or the logo wins and certs move).
- A dark logo on a black board vanishes once its white background is knocked out. Consider a board-colour preview note or warning.

## Upload / storage for orders
Today the order carries only the **file name**. Quoted boards open a mailto with "Please attach your image files" (`js/main.js` ~line 4067). Priced boards go to the Shopify cart with no file at all.

`worker/worker.js` is the natural home, with caveats:
- It is a Cloudflare Worker (built by `tools/build-worker.js`, no `wrangler` config is in the repo) that already has the right plumbing: an origin allowlist (`originAllowed`, GitHub Pages + complianceboards.com), a size cap, and an optional daily cap using a KV namespace `LIMITS`.
- It has **no R2 bucket and no upload route** now. It only takes one JSON POST (a base64 photo to Gemini) and keeps nothing.
- Plan: add an R2 bucket binding (e.g. `LOGOS`) and a `POST /logo` route. The page uploads the original file (not the knocked-out copy), gets back a random id/URL, and puts that in the order spec and the Shopify line-item properties. Better still, use a signed upload so the Worker never holds big files in memory. Keep the knockout settings (on/off, tolerance, width, Top/Bottom) in the spec so production can redo it from the original.
- Allow SVG, PNG, WebP, JPG only; cap ~10-20 MB; check the real file type (not just the extension); never serve uploads back from the same origin as the site. Auto-delete after N months with an R2 lifecycle rule.

## Needs Justin
1. Pick A / B / C / D, and whether the repeat layouts (Grid, Brick...) go (A, B, C) or stay as Advanced (D).
2. OK to create a Cloudflare R2 bucket + Worker route (uses his Cloudflare account; storage and egress cost is small but it is a new paid-plan item). Where order files should show up for the board shop (a link in the Shopify order? an email? a folder?).
3. Retention: how long to keep customer logo files, and a one-line privacy note on the page ("your file is stored to make your board").
4. Logo fee amount (45 is a placeholder) and whether it varies by board size like `laminate` does. It will later come from the shop panel.
5. Which step the Logo option lives in (sketch assumes Style).
6. Production method is still open, so the preview stays full colour; one-colour/white-ink printing would change the knockout needs.
