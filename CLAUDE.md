# Ruhratna AI Stylist — WordPress Plugin

## What this is

A self-contained WordPress plugin that adds a `/ai-stylist` page to the
Ruhratna site. The page collects an outfit photo + occasion from the
visitor, sends the image (compressed via TinyPNG) to the Railway-hosted
analysis backend, then renders a stylist note plus ranked jewellery
matches. Designed to drop into the existing WooCommerce-themed site
without conflicting with Elementor or the theme's CSS reset.

## Stack

PHP + plain HTML/CSS/vanilla JS. No build step, no framework, no
package manager. Hand-rolled. Drop the folder into
`wp-content/plugins/`, activate, visit `/ai-stylist`.

```
ruhratna-ai-stylist/                  (this folder; checked out as ruhratna-stylist-ui/)
├── ruhratna-ai-stylist.php           # plugin bootstrap (header, hooks, enqueue)
├── includes/
│   └── proxy.php                     # REST routes + TinyPNG → Railway proxy
├── templates/
│   └── ai-stylist.php                # page template, wrapped by theme header/footer
├── assets/
│   ├── css/stylist.css               # brand stylesheet, every rule scoped under .app
│   ├── js/stylist.js                 # single IIFE, state machine + REST calls
│   └── fonts/                        # placeholder (fonts load from ruhratna.com)
├── images/                           # photo-guide examples: good-1..4.webp + bad-1..3.webp
├── .gitignore
└── CLAUDE.md
```

## How activation works

`register_activation_hook` runs `ruhratna_ais_activate()` once when the
plugin is enabled in wp-admin. It calls `get_page_by_path('ai-stylist')`
and, if no page exists with that slug, inserts one
(`post_title="AI Stylist"`, `post_status="publish"`, `post_type="page"`)
with empty content. The actual UI is supplied at render time by the
template filter — the page row in the DB is just a hook for the URL.

Deactivation does nothing: the page stays so links don't break.

## Template loading

`template_include` filter swaps in the plugin's
[templates/ai-stylist.php](templates/ai-stylist.php) whenever
`is_page('ai-stylist')` is true. The template calls `get_header()` and
`get_footer()`, so the theme's nav and footer wrap around the AI Stylist
content. Between them sits the full `<div class="app">…</div>` markup
(landing fold, loading screen, results screen, hidden file inputs).

The plugin uses no `Template Name:` annotation because annotation only
works for theme files — `template_include` is the right hook for plugin
templates.

## Asset enqueueing

[ruhratna-ai-stylist.php](ruhratna-ai-stylist.php) hooks
`wp_enqueue_scripts` at **priority 999** so the plugin's CSS lands at
the bottom of `<head>` and wins cascade order against Elementor and the
theme's reset. Both CSS and JS are gated behind
`if (!is_page('ai-stylist')) return;` so they don't load anywhere else.

`wp_localize_script` injects `window.ruhratnaStyler.apiBase` pointing at
`rest_url('ruhratna-stylist/v1')` so the JS can read the REST base
without hardcoding the site URL.

Cache-busting: `RUHRATNA_AIS_VERSION` is the fourth arg to
`wp_enqueue_style` and `wp_enqueue_script`, so it becomes the `?ver=`
query string. Bump it (and the matching `Version:` in the plugin
header) whenever the CSS or JS changes — that's the only way to make
browsers refetch.

## REST proxy

```php
const RUHRATNA_TINIFY_KEY    = '...';
const RUHRATNA_RAILWAY_URL   = 'https://web-production-8b1fc.up.railway.app';
define('RUHRATNA_SKIP_TINIFY', false);  // set true to bypass TinyPNG entirely
```

All three endpoints are public (`permission_callback => '__return_true'`)
because they need to work for unauthenticated visitors.

| Route | Body | Flow |
|---|---|---|
| `POST /wp-json/ruhratna-stylist/v1/analyse`       | `{ image: <base64>, occasion }` | base64 → (TinyPNG, optional) → re-encode → Railway `/analyse` → returns `{ outfit_analysis, session_id }` synchronously, or `{ error: true, confidence_flag: 0, rejection_reason }` when the photo can't be styled |
| `POST /wp-json/ruhratna-stylist/v1/match`         | `{ outfit_analysis, occasion, session_id }` | Proxy explicitly forwards only these three fields; `session_id` is optional (null when absent — backend logging just skips). Railway returns `{ job_id }` **immediately** (async) |
| `GET  /wp-json/ruhratna-stylist/v1/result/<job_id>` | — | Forward to Railway `/result/<job_id>` → returns `{ status: "running" }`, `{ status: "done", result }`, or `{ status: "error", message }` |

TinyPNG compression (when not skipped): POST raw bytes to
`api.tinify.com/shrink` with `Authorization: Basic base64('api:KEY')`,
read the `Location` header, GET the compressed bytes with the same auth.
Status codes and errors propagate back to the JS as `WP_Error` with a
502. The `RUHRATNA_SKIP_TINIFY` flag at the top of
[includes/proxy.php](includes/proxy.php) short-circuits compression and
forwards the raw bytes straight to Railway — useful when the TinyPNG
quota is exhausted or for local debugging. **Currently `false`** —
TinyPNG is active on top of the client-side resize (see "Client-side
image processing" below).

Upstream JSON is parsed and re-emitted via `WP_REST_Response` so the
WordPress REST stack handles content negotiation and status codes.

## Client-side image processing

`processImageForUpload(file, maxPx = 1024)` in
[assets/js/stylist.js](assets/js/stylist.js) runs before every `/analyse`
call and shrinks the payload before it ever leaves the browser:

1. **HEIC / HEIF → JPEG.** Detected by MIME (`image/heic`, `image/heif`)
   or extension. Converted via `window.heic2any({ blob: file, toType:
   'image/jpeg', quality: 0.9 })`. The library returns either a `Blob`
   or a `Blob[]` for multi-image HEICs; we normalise by taking the
   first element when it's an array.
2. **Canvas resize.** A temporary `Image` loads from
   `URL.createObjectURL(sourceBlob)`. The longest edge is capped at
   `maxPx` (1024 by default) with aspect-ratio preserved; the image is
   drawn onto a fresh `<canvas>` at the new dimensions and exported via
   `canvas.toDataURL('image/jpeg', 0.85)`. The `data:image/jpeg;base64,`
   prefix is stripped and the bare base64 string is returned.
   `URL.revokeObjectURL()` runs in both onload and onerror paths.

Either stage falling back is safe: on HEIC-conversion failure the
function does a raw `toBase64(file)` read; on canvas failure (zero
dimensions, decode error, etc) it does the same. A `console.warn` notes
why. End result: `/analyse` always gets *something*, even if it's an
unresized raw original.

**heic2any is loaded from a CDN** via a raw `<script>` tag near the
bottom of [templates/ai-stylist.php](templates/ai-stylist.php), just
before `get_footer()` — *not* through `wp_enqueue_script`. The plugin's
own JS is enqueued in the footer (5th arg `true` to
`wp_enqueue_script`), so WordPress emits it inside `get_footer()`'s
`wp_footer` action. A raw tag placed above `get_footer()` therefore
appears in the DOM *before* the plugin's JS executes, guaranteeing
`window.heic2any` is defined when `processImageForUpload()` first runs.

With both client resize (1024 px max edge, 0.85 JPEG) and TinyPNG
running, a 4 MB iPhone HEIC ends up as a sub-100 KB JPEG by the time
Railway sees it.

## Screen flow (frontend)

Four-screen state machine, all four siblings under `.app`, routed
through the REST proxy:

```
.app                                ← single wrapper (every CSS rule scoped under this)
├── #screen-intro                   ← hero + "how it works" steps (visible on load)
├── #screen-upload                  ← photo guide + Camera/Gallery + occasion chips
├── #screen-loading                 ← shown while /analyse + /match + /result are in flight
└── #screen-results                 ← shown after /result returns "done"
```

A single `showScreen(name, { history })` function in
[assets/js/stylist.js](assets/js/stylist.js) is the only place that
flips visibility — it iterates the `SCREENS` map, toggles each via
`style.display`, and optionally pushes / replaces a history entry.

**History stack & back-button cascade.** On page load JS calls
`history.replaceState({ screen: 'intro' }, '')` so the initial entry is
tagged — without this, a single back from upload would fire popstate
with `event.state === null` and we'd lose the target. Transitions then
go:

| From → To | `showScreen` call |
|---|---|
| intro → upload  | `showScreen('upload')`                    (pushState) |
| upload → loading | `showScreen('loading')`                   (pushState) |
| loading → results | `showScreen('results', { history: 'replace' })` (replaceState — replaces the loading entry so back from results skips straight to upload) |

The popstate handler reads `event.state.screen`, tears down any
in-flight `pollIntervalId` + progress timers via
`stopProgressAnimation()`, then calls `showScreen(target, { history:
'none' })`. End result: back goes results → upload → intro → off-page,
which mirrors how the user got in.

- **Style My Outfit →** advances intro → upload via `showScreen`.
- **Step cards** (`[data-action="goto-upload"]`, `role="button"
  tabindex="0"`) also advance to upload — same handler, plus an
  Enter/Space keydown listener for keyboard parity.
- **Find My Match →** validates a photo + occasion are picked, then
  `findMatch()` calls `showScreen('loading')` and runs three sequential
  REST calls (preceded by client-side image prep — see "Client-side
  image processing" above):
  1. `POST /analyse` → returns `{ outfit_analysis, session_id }`
     synchronously. JS stores both (`sessionId` lives next to
     `outfitAnalysis` in module scope), marks step 1 done, paints the
     right-column outfit card, and on mobile scroll-eases the page down
     so the card is in view. If the response is instead
     `{ error: true, confidence_flag: 0, rejection_reason }`, JS
     short-circuits into `showRejectionMessage()` and never calls
     `/match` — see "Rejection card" below.
  2. `POST /match` → returns `{ job_id }` immediately. JS sends
     `{ outfit_analysis, occasion, session_id }` (the `session_id`
     captured in step 1; null is fine — backend logging is best-effort).
     Reveals the `#progress-card` (bar + rotating status messages)
     below the outfit card and kicks off the bar animation.
  3. `GET /result/<job_id>` every 4 s until status is `"done"` or
     `"error"`. Each poll URL has a fresh `?_=<ts>` to defeat browser /
     CDN / page-cache plugin caching. On `"done"`, JS snaps the bar to
     100 %, marks step 2 done, waits 800 ms so the user catches the green
     ✓, then swaps to `#screen-results`.
- The progress bar is a single declarative 80 s CSS transition from 0 %
  to 95 %; the 100 % snap is a separate 0.4 s easing applied on `"done"`.
  Rotating messages live in `PROGRESS_MESSAGES` and swap every 8 s with
  a 200 ms opacity fade. `pollIntervalId`, `progressMessageIntervalId`,
  and `progressFadeTimeoutId` are kept in module scope so `popstate` and
  the error handler can cancel them; `stopProgressAnimation()` is the
  single shutdown point.
- Mobile-only `scrollToEl(el, offset)` no-ops above 1024 px (the desktop
  sticky-left layout already keeps everything in view). Used at the
  Phase 2 outfit-card reveal and the Phase 4 "Your Stylist Says" reveal
  so the mobile viewport lands on the freshly-painted section.
- Errors route through `showError(message)` which replaces the loading
  section with a centered "Try Again" card and shuts down the polling
  + progress timers.
- **Rejection card.** When `/analyse` returns
  `{ error: true, confidence_flag: 0, rejection_reason }` (the backend
  couldn't make sense of the photo — group shot, blurry, no outfit,
  etc), `showRejectionMessage(escapeHtml(reason))` hides the
  `#screen-loading > .layout` *non-destructively* (sets
  `style.display = 'none'`, doesn't wipe `innerHTML` — unlike
  `showError`, which uses a wipe + `location.reload()` retry) and
  appends a centered `.rejection-card` with a "Try another photo"
  button. The button calls `resetPhotoSelection()` (nukes
  `selectedFile`/`selectedOccasion`, clears all three file inputs'
  `.value` so the same file can be re-picked, hides the preview card
  + re-shows the upload zone, deselects any chip and collapses the
  occasion section), nulls `sessionId` + `outfitAnalysis`, removes the
  rejection card + restores the layout's `display`, and finally
  `showScreen('upload', { history: 'replace' })`. End result: user
  lands on a *clean* upload screen with nothing stale, and a fresh
  Find My Match attempt walks the loading screen's original DOM as if
  it were the first run.

## Theme isolation

The Ruhratna site uses Elementor and a theme with an aggressive
`[type=button], [type=submit], button { background-color: transparent;
border: 1px solid #c36; color: #c36 }` reset that hijacks any unscoped
button. The plugin's defense-in-depth strategy, layered:

1. **`.app` scoping.** Every selector in
   [assets/css/stylist.css](assets/css/stylist.css) is prefixed with
   `.app` (except `:root`, `@font-face`, `@keyframes`, and `html` snap-
   scroll rules — those last ones can't be scoped because `<html>` is
   an ancestor of `.app`). The reset block at the top of the file is
   `.app * { … }`, `.app img { … }`, `.app button { … }`. `html`/`body`
   font/background reset has been folded into the `.app` rule itself.
2. **`[type=button]` matched specificity** for buttons that the
   theme's reset targets — selectors are written as
   `.app .btn-gold, .app [type=button].btn-gold` so we tie on
   specificity and win on source order (plugin CSS loads after the
   theme via priority 999).
3. **`!important` on color properties only** — `background`, `color`,
   `border`, `border-color` on `.btn-gold`, `.btn-find`, `.chip`,
   `.chip:hover`, `.chip.is-selected`, etc. Never on layout (padding,
   margin, display) — those weren't being hijacked and adding
   `!important` there would block legitimate overrides.
4. **Literal hex on the buttons that fight hardest.** `var(--gold)`
   and `var(--deep)` were unreliable in some contexts (CSS variable
   inheritance was being intercepted), so the two hottest buttons
   (`.btn-gold` and `.btn-find`) and the border-colors on chip / upload
   / step-card / preview / mob-upload-btn use literal `#C9A96E` and
   `#1A1208` directly.
5. **`border: none !important` + `outline: none !important`** on
   `.btn-gold` to kill the theme's pink 1 px border outright (gold
   buttons are intentionally borderless).

When the theme starts winning again, audit selector specificity in
DevTools — almost always the fix is to add a higher-specificity branch
to our selector list (e.g. add `.app [type=button].new-class` next to
`.app .new-class`).

## Add to Cart flow

Each product card renders `<a class="card-cta"
href="/?add-to-cart=PRODUCT_ID">Add to Cart</a>`. The card image is
wrapped in a separate `<a target="_blank">` linking to the PDP
(`rec.product_url`), so the image click opens the product page in a new
tab while the button click adds to cart.

JS attaches a delegated click listener directly to `#tier1-cards`,
`#tier2-cards`, and `#complete-look-card` (not `document` — catching
earlier in the bubble chain prevents the theme from opening a new tab
first). The handler:

1. `e.preventDefault()` — no navigation.
2. `fetch(url, { credentials: 'same-origin' })` — WooCommerce updates
   the cart session cookie server-side.
3. On 2xx, the side-cart open is a **two-step jQuery dance** instead of
   a bare `added_to_cart` trigger:
   ```js
   $(document.body).trigger('wc_fragment_refresh');
   $(document.body).one('wc_fragments_refreshed', function () {
     $(document.body).trigger('added_to_cart');
   });
   ```
   `wc_fragment_refresh` makes WooCommerce re-fetch its cached cart
   HTML fragments (mini-cart contents, count badges, etc); only after
   `wc_fragments_refreshed` fires do we trigger `added_to_cart`, which
   tells the theme's side-cart widget to pop open. Without the
   refresh-first step the side cart can open showing *stale* contents
   (no new item) until a manual page reload. `.one()` (not `.on()`)
   self-unbinds after firing so listeners don't stack across multiple
   Add to Cart clicks.
4. Button text flashes "Adding..." → "✓ Added" → reverts after
   1500 ms; pointer-events disabled during the request to prevent
   double-clicks.

`target="_blank"` is removed from cart anchors entirely so a JS failure
falls back to same-tab navigation, not a new tab.

## Photo guide (Show us your outfit)

Seven example `.ex-card`s live in the left column of `#screen-upload` —
four "good" examples (`images/good-1.webp` … `good-4.webp`) and three
"avoid" examples (`images/bad-1.webp` … `bad-3.webp`). Each renders a
real `<img>` via `plugins_url('images/<file>', dirname(__FILE__))` and
carries a bottom `.ex-tag` band with an inline ✓/✗ `.ex-tag-mark` chip
plus a one-word label ("Mirror selfie", "Too dark", etc.). The old
top-left `.ex-badge` corner indicators were removed — verdict + label
now read as a single phrase at the bottom of each card.

On mobile the grid becomes a **never-ending marquee**: `setupPhotoMarquee()`
in [assets/js/stylist.js](assets/js/stylist.js) clones the 7 cards once
(marked `data-clone="true" aria-hidden="true" tabindex="-1"`) and sets
`data-cloned="true"` on the `.photo-track` wrapper. The CSS animation
is gated on that attribute so the keyframes can't fire until the
duplicate set exists, otherwise the loop would briefly show empty
space before wrapping. Travel distance = `7 × (140 + 10) = 1050px`,
which is exactly card-1's start position offset — so `translateX(0)
→ translateX(-1050px)` over 30s loops seamlessly. `.photo-track` uses
`display: contents` on tablet/desktop so the 2-col grid still sees
the cards directly (the wrapper is layout-transparent above 768px);
the cloned siblings are hidden everywhere except mobile via
`.ex-card[data-clone="true"] { display: none }`. Under
`prefers-reduced-motion: reduce`, JS skips cloning entirely and the
CSS restores `overflow-x: auto` so the user can swipe through all 7
examples manually.

## Brand tokens

Defined once in `:root` at the top of
[assets/css/stylist.css](assets/css/stylist.css):

```
--gold:        #C9A96E
--gold-light:  #E8D5B0
--gold-dark:   #A07840
--deep:        #1A1208       (hero / dark CTAs)
--cream:       #FAF6F0       (page background)
--text-main:   #2D1F0A
--text-muted:  #8B7355
--border:      rgba(201, 169, 110, 0.25)

--font-display: 'Helvetica Neue'
--font-accent:  'Agatho'                       (italic taglines)
--font-body:    'Helvetica Neue'
--font-thin:    'Helvetica Neue Thin'

--header-h:        56px       (kept for scroll-padding offset against
                               theme's sticky nav — do not remove)
--theme-offset:    120px      (WP theme sticky-header + promo-banner
                               combined height; subtracted from screen
                               min-height on desktop so the vertically-
                               centered hero lands on the *visible*
                               midline, not below it. Retune if the
                               theme's chrome changes.)
--content-max:     1200px
--tablet-max:      680px
--gutter-mobile:   24px
--gutter-tablet:   32px
--gutter-desktop:  48px
```

Fonts load from `ruhratna.com` via `@font-face`. The `assets/fonts/`
folder is a placeholder for any future locally-hosted weights.

### Border-radius scale

- Hero card: **12px** (feature card)
- Large cards (product, outfit detail, stylist, complete-look, upload
  zone, photo preview, loading outfit, mobile upload tile, photo guide
  card): **8px**
- Medium (step card, lstep, btn-find): **6px**
- Small (chips, btn-gold, AI Stylist pill): **4px**
- Tiny badges (type-badge, ex-badge, outfit-chip): **3px**
- Image containers inside cards (`.card-image-wrap`, `.ex-photo`,
  `.preview-thumb`): **0** (the parent clips via `overflow: hidden`)
- Circular: **50%**

## Responsive layout

Mobile-first base styles, then three breakpoints:

| Breakpoint | Behavior |
|---|---|
| `< 768px` mobile | Single-column. Hero is a rounded dark card. Photo grid is a horizontal-scroll strip that bleeds to screen edge via negative margin matching `.fold-2`'s removed padding. Camera + Gallery shown as two `.mob-upload-btn` tiles. Tips inline. |
| `≥ 768px` tablet | Single column capped at `--tablet-max: 680px`. Hero is a card. Upload zone replaces the mobile tiles. Photo grid becomes a 2-col grid. |
| `≥ 1024px` desktop | Two-column `.fold` grid (45fr / 55fr) inside each landing screen — `#screen-intro` wraps `.fold-1` (hero left, "how it works" right) and `#screen-upload` wraps `.fold-2` (photo guide left, upload zone right). Each fold fills the area below the WP theme chrome via `min-height: calc(100vh - var(--theme-offset))`; `.fold-1` also uses `align-content: center` so its grid row sits at the vertical midline of that available space. Results screen uses a separate flex layout (45% / 55%, sticky left column). |
| `≥ 1280px` wide | More breathing room (larger gap, taller padding). |

Section 24 of the stylesheet holds the remaining unscoped `<html>`
rules — `scroll-behavior: smooth` and `scroll-padding-top: var(--header-h)`
(so the WP theme's sticky header doesn't cover anchored content). The
old fold-1 ↔ fold-2 snap-scroll mechanism was retired when the landing
was split into `#screen-intro` and `#screen-upload`: with only one
screen visible at a time there's nothing left to snap between, so the
`scroll-snap-*` declarations and the `is-results` class that gated them
have all been removed. The `min-height: 100vh` on each top-level screen
moved into a desktop-only `@media (min-width: 1025px)` block in the
same section.

## Conventions

- **No build, no framework.** Anything added stays hand-rolled.
- **Mobile-first CSS.** Base rules describe mobile; tablet/desktop are
  media-query overrides.
- **Every CSS rule scoped to `.app`** except the intentional exceptions:
  `:root`, `@font-face`, `@keyframes`, and the two `<html>`-level
  scroll rules in section 24 (`scroll-behavior`, `scroll-padding-top`).
- **All JS lives in one IIFE** in
  [assets/js/stylist.js](assets/js/stylist.js). Closures hold app state
  (`selectedFile`, `selectedOccasion`, `outfitAnalysis`).
- **`escapeHtml()` wraps all API strings** interpolated into
  `innerHTML`. Don't bypass it.
- **Three file inputs** (`#photoInput` desktop, `#cameraInput` mobile
  camera with `capture="environment"`, `#galleryInput` mobile gallery).
  All three share `handleFileSelected(file)`.
- **`processImageForUpload(file, maxPx)`** runs before every `/analyse`
  call (HEIC convert → canvas resize → base64). Both stages fall back
  to a raw `toBase64()` read on failure with a `console.warn`.
- **`resetPhotoSelection()`** rolls the upload screen back to its
  empty state — file inputs cleared, preview hidden, upload zone +
  mobile options re-shown, chip deselected and occasion section
  collapsed. Used by the rejection-card retry. Don't bypass it from
  there: skipping it leaves the rejected photo's preview + occasion
  pick still on screen when the user lands back on `#screen-upload`.
- **`renderCompleteLook(card, cl, recs)`** fills the complete-look card
  with image-thumb fallback (`img.onerror` swaps the thumb for a
  `.cl-piece-pill` text fallback).
- **Bump `RUHRATNA_AIS_VERSION`** in both the plugin header and the
  `define()` whenever CSS or JS changes. Both are wired to `?ver=`.
- **Inline `onclick="location.reload()"`** is used on the "↺ Try
  another outfit" button — no extra wiring needed.
- **Brand sparkle = inline SVG, not a glyph.** The "✦" four-point
  star icon (used in the pill-badge, action hint, outfit-card label,
  outfit-detail label ×2, and stylist-card header) is rendered as a
  shared inline `<svg viewBox="0 0 24 24">` with a sparkles-cluster
  path. All six instances share the same path string so a single
  edit propagates everywhere. Sized in px (`width`/`height`) per
  class, filled with `var(--gold)`. The previous ✦ unicode glyph
  rendered noticeably smaller in Safari due to system-font fallback;
  the SVG is font-independent and identical across browsers.

## Gotchas

- **The plugin's REST routes are unauthenticated.** If you add rate
  limiting or auth later, set `permission_callback` to a real callback
  in [includes/proxy.php](includes/proxy.php).
- **TinyPNG key is hardcoded** at the top of
  [includes/proxy.php](includes/proxy.php). Move it to `wp_options` or
  an env var before open-sourcing.
- **CSS variable resolution can fail inside Elementor wrappers** in
  rare cases. The hottest button rules use literal hex deliberately —
  if you swap them back to `var()`, retest on the staging site.
- **Snap-scroll is on `<html>`, not `.app`.** When you add new
  full-viewport sections (`.fold`-style children of `.app`), add them
  to the `.app .fold, .app #screen-loading, .app #screen-results` rule
  in section 24 of the stylesheet so the snap-align kicks in.
- **`.complete-look-card` is one element**, not two. CSS `order` moves
  it on mobile via the `display: contents` flatten trick on
  `.results-left` / `.results-right`.
- **Add to Cart click listener must be on the containers**, not on
  `document`. A `document`-level handler fires after the theme has
  already opened the link in a new tab.
- **`window.jQuery` may be absent** in the rare WP setup without
  jQuery. The `added_to_cart` trigger is guarded — falling through
  means the side cart simply doesn't auto-open, but the item is still
  in the cart.

## When extending

- New REST route → register inside
  `ruhratna_ais_register_routes()` in
  [includes/proxy.php](includes/proxy.php).
- New page or screen inside the plugin → add markup to
  [templates/ai-stylist.php](templates/ai-stylist.php), CSS to
  [assets/css/stylist.css](assets/css/stylist.css) (remember to scope
  with `.app`), bump the version.
- New brand colour → add to `:root`. If the theme overrides it,
  consider using a literal hex on the affected rule.
- New button class → use the dual-selector pattern
  (`.app .new-btn, .app [type=button].new-btn`) so it survives the
  theme's `[type=button]` reset.
- New product card field → extend `buildProductCard()` in
  [assets/js/stylist.js](assets/js/stylist.js) and keep `escapeHtml()`
  on any user-supplied / API-supplied string.
