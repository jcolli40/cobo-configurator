# Logo panel: sketch notes (17 Nov 2026)

Sketch: `index.html` (4 options, A-D). Screenshots of today's panel: `before-desktop.jpg`, `before-phone.jpg`. No code in `js/` or `v8/` changed.

## Findings
- **Shoppers cannot reach the Logo section in v8 today.** `STEPS6` in `js/main.js` (line 63) lists build: certs, size; style: boardgrp, edge, caps; preview: arview, sharelink, saveit, summary. `logo` and `bgimg` are in the HTML but no step shows them (the section is `hidden`). The build must add `logo` to a step (sketches assume Style, after Caps).
- Today's logo upload is a layout + 6 sliders (`wireArt`, `artTpl`). Placement is free (`offX`/`offY`); the order spec stores only `file` name, layout, width, spacing, rotation, opacity, move X/Y (`currentSpec`, ~line 1267). Fee: `UPCHARGES.logo` = 45, shown as a `+$` pill on the section header and a help line from `paintPrices`.
- A white JPG prints as a white box on a black board. That is what the knockout fixes.
- Logo width should be capped at board width minus 3" (clear of the corner caps, which sit 1" in and are 1" wide).
- Certificates: the sample certificate fit does not know about a logo. Top/Bottom at 1" will collide with them on small boards. The build needs to keep certificates clear of the logo band (or the logo wins and certs move).
- A dark logo on a black board vanishes once its white background is knocked out. Consider a board-colour preview note or warning.

## Upload / storage for orders (updated 17 Nov: Shopify first, R2 as backup)

Today the order carries only the **file name**. Quoted boards open a mailto saying "Please attach your image files" (`js/main.js` ~line 4067). Priced boards go to the Shopify cart with no file at all. The cart add happens in the Shopify page, not in the iframe: `shopify/cobo-configurator-embed.liquid` (~lines 51-90) receives `cobo:add-to-cart` / `cobo:update` by postMessage and posts JSON to `/cart/add.js`.

### Main plan: send the file with the cart (needs a test before we trust it)
How it would work: the iframe puts the original file (and the knocked-out PNG) in the `cobo:add-to-cart` message. A `File`/`Blob` survives postMessage (structured clone), even across origins. The parent builds a `FormData` (`id`, `quantity`, `properties[Logo (original)]` = File, `properties[Logo (print copy)]` = File, plus the existing text properties) and posts it to `/cart/add.js`. Shopify would host the files and the order would show links.

**Plainly: this is not confirmed.**
- Shopify's Ajax Cart reference documents `properties` as key-value text, and shows a FormData example only for a normal add-to-cart form. It says nothing about files, file size limits, or how many/long properties may be. ([Ajax Cart API reference](https://shopify.dev/docs/api/ajax/reference/cart))
- Sending a file in a line-item property has worked in practice (it is what upload apps and old "file upload" tutorials rely on), but it is undocumented behaviour. In Oct 2024 merchants reported it broke: the property arrived as an object (filename, type, tempfile) instead of a usable file. Support said a fix was coming and later that it "should now be resolved", with no detail and no staff post in the thread. ([Shopify community thread](https://community.shopify.com/t/cart-add-js-no-longer-supports-image-blobs-in-the-cart-properties/363446/1))
- Community answers for AJAX also say to host the file elsewhere and store its URL. I did not find an official Shopify statement that `/cart/add.js` accepts multipart files.
- I did not run anything against the store.

If the test passes, these are the points to design for:
- **Size limits:** none documented. Test 1 MB, 5 MB and 20 MB. The page should also cap uploads itself (suggest 10 MB; the configurator already shrinks images to 2048 px for the preview, but the original must be sent untouched).
- **Edit board / `removeLine` flow:** "Edit board" removes the old line with `/cart/change.js` (quantity 0) and then adds the new one. A re-add means the file has to be sent again. If the logo did not change, reuse the first file's Shopify link as plain text (a URL in a normal property) instead of uploading again. Note also that `change.js` with `properties` replaces all properties, so never use it to patch the logo. When a board is reopened from the cart, the browser no longer has the `File`: either re-load the image from the stored link (works only if Shopify's file host allows it from our page, untested) or ask the shopper to re-upload. The knockout settings (on/off, tolerance, width, Top/Bottom) go in the hidden `_cobo` property so the board reopens the same.
- **Quoted custom boards:** these have no cart line (no price), and a mailto can never carry a file. Shopify cannot help here. Use the backup (R2 link in the email body), or give custom sizes a $0 "quote request" cart line. This is the one case where R2 is needed even if the Shopify test passes.
- **Cart drawer:** the property value comes back as a link. The configurator's own cart drawer (`cobo:cart` → the cart list at ~line 4213) should show "Logo file attached" with a small link rather than a long URL. The theme's cart page and checkout will show the raw link unless the theme is edited, or the key starts with `_` (hidden at checkout, still visible in the order in admin; Shopify docs say this). Decide whether the shopper should see it.
- **Old-browser/failed upload:** if the cart add fails, show the existing "Sorry, we could not add that" notice and keep the logo in the builder.

### Quick test (a "For Justin" / first build step, not run yet)
1. In Shopify admin, create a **draft** (unpublished) product with one variant, price $0.01, not on any collection. Not the live board product.
2. Use a preview theme or an unpublished copy of the embed page (not the live theme).
3. From a small test page on that preview: post a `FormData` with a 1 MB, 5 MB and 20 MB PNG to `/cart/add.js` as `properties[Logo]`; then `fetch('/cart.js')` and check the property is a hosted link that opens the file.
4. Check the link in the cart drawer, then go to checkout with a test order (Bogus Gateway or draft order; no real payment) and confirm the link shows in the order in admin and in the confirmation email.
5. Repeat the "Edit board" path (change.js remove + add) and check nothing is lost.
Result decides Shopify-first vs R2.

### Backup: Cloudflare R2 through `worker/worker.js`
Fits if Shopify rejects files or for quoted boards. The Worker already has an allowed-sites list (`originAllowed`), a size cap and an optional KV daily cap, but **no R2 bucket and no upload route**, and no wrangler config is in the repo. Plan: add an R2 bucket binding (e.g. `LOGOS`) and a `POST /logo` route; the page uploads the original file, gets a random id/link back, and puts that link in the cart properties / mailto body. Allow SVG, PNG, WebP, JPG only; cap ~10-20 MB; check the real file type; auto-delete old files with an R2 lifecycle rule.

## Needs Justin
1. Pick A / B / C / D, and whether the repeat layouts (Grid, Brick...) go (A, B, C) or stay as Advanced (D).
2. OK the draft-product test above (a $0.01 draft product and a preview theme in the Shopify store). No live product, price or order is touched.
3. If Shopify files fail, or for quoted custom boards: OK a Cloudflare R2 bucket + Worker route in his account, and where the board shop should see order files (link in the Shopify order, email, or a folder).
4. Retention: how long to keep customer logo files, and the one-line privacy note on the page ("your file is stored to make your board").
5. Should the shopper see the file link in the cart/checkout, or only the shop in the order (hidden `_` key)?
6. Logo fee amount (45 is a placeholder) and whether it varies by board size like `laminate` does. It will later come from the shop panel.
7. Which step the Logo option lives in (sketch assumes Style).
8. Production method is still open, so the preview stays full colour; one-colour/white-ink printing would change the knockout needs.
