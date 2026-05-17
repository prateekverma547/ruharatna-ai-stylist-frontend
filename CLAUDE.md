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
define('RUHRATNA_SKIP_TINIFY', true);   // bypass TinyPNG entirely
```

All three endpoints are public (`permission_callback => '__return_true'`)
because they need to work for unauthenticated visitors.

| Route | Body | Flow |
|---|---|---|
| `POST /wp-json/ruhratna-stylist/v1/analyse`       | `{ image: <base64>, occasion }` | base64 → (TinyPNG, optional) → re-encode → Railway `/analyse` → returns `outfit_analysis` synchronously |
| `POST /wp-json/ruhratna-stylist/v1/match`         | `{ outfit_analysis, occasion }` | Forward to Railway `/match` → returns `{ job_id }` **immediately** (async) |
| `GET  /wp-json/ruhratna-stylist/v1/result/<job_id>` | — | Forward to Railway `/result/<job_id>` → returns `{ status: "running" }`, `{ status: "done", result }`, or `{ status: "error", message }` |

TinyPNG compression (when not skipped): POST raw bytes to
`api.tinify.com/shrink` with `Authorization: Basic base64('api:KEY')`,
read the `Location` header, GET the compressed bytes with the same auth.
Status codes and errors propagate back to the JS as `WP_Error` with a
502. The `RUHRATNA_SKIP_TINIFY` flag at the top of
[includes/proxy.php](includes/proxy.php) short-circuits compression and
forwards the raw bytes straight to Railway — useful when the TinyPNG
quota is exhausted or for local debugging.

Upstream JSON is parsed and re-emitted via `WP_REST_Response` so the
WordPress REST stack handles content negotiation and status codes.

## Screen flow (frontend)

Single-page state machine, routed through the REST proxy:

```
.app                                ← single wrapper (every CSS rule scoped under this)
├── #main-content                   ← landing (Fold 1 hero + Fold 2 upload)
├── #screen-loading                 ← shown while /analyse + /match are in flight
└── #screen-results                 ← shown after /match returns
```

JS swaps which top-level section is visible via `style.display`.

- **Style My Outfit →** smooth-scrolls to `#upload-section`
- **Find My Match →** validates a photo + occasion are picked, then
  `findMatch()` swaps to `#screen-loading` and runs three sequential
  REST calls:
  1. `POST /analyse` → returns `outfit_analysis` synchronously. JS marks
     step 1 done, paints the right-column outfit card, and on mobile
     scroll-eases the page down so the card is in view.
  2. `POST /match` → returns `{ job_id }` immediately. JS reveals the
     `#progress-card` (bar + rotating status messages) below the outfit
     card and kicks off the bar animation.
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
- On `#screen-results` show, JS adds `is-results` to `<html>` (kills
  snap-scroll for the long-scroll results page) and pushes a history
  entry. Browser back fires `popstate` which restores `#main-content`,
  clears the `is-results` class, and cancels any in-flight polling.
- Mobile-only `scrollToEl(el, offset)` no-ops above 1024 px (the desktop
  sticky-left layout already keeps everything in view). Used at the
  Phase 2 outfit-card reveal and the Phase 4 "Your Stylist Says" reveal
  so the mobile viewport lands on the freshly-painted section.
- Errors route through `showError(message)` which replaces the loading
  section with a centered "Try Again" card and shuts down the polling
  + progress timers.

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
3. On 2xx, `window.jQuery(document.body).trigger('added_to_cart')` —
   the theme's side cart listens on that event and pops open.
4. Button text flashes "Adding..." → "✓ Added" → reverts after
   1500 ms; pointer-events disabled during the request to prevent
   double-clicks.

`target="_blank"` is removed from cart anchors entirely so a JS failure
falls back to same-tab navigation, not a new tab.

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
| `≥ 1024px` desktop | Two-column `.fold` grid (45fr / 55fr) for landing, snap-scrolling between Fold 1 and Fold 2. Results screen uses a separate flex layout (45% / 55%, sticky left column). |
| `≥ 1280px` wide | More breathing room (larger gap, taller padding). |

Snap scroll lives in section 24 of the stylesheet on `html` (the only
unscoped rules — `<html>` is an ancestor of `.app` so we can't move
them inward). `html.is-results { scroll-snap-type: none }` disables
snap on the long-scroll results page. Disabled entirely on tablet/
mobile via `@media (max-width: 1024px) { html { scroll-snap-type: none
} }`.

## Conventions

- **No build, no framework.** Anything added stays hand-rolled.
- **Mobile-first CSS.** Base rules describe mobile; tablet/desktop are
  media-query overrides.
- **Every CSS rule scoped to `.app`** except the three intentional
  exceptions (`:root`, `@font-face`, `@keyframes`, `html` snap-scroll).
- **All JS lives in one IIFE** in
  [assets/js/stylist.js](assets/js/stylist.js). Closures hold app state
  (`selectedFile`, `selectedOccasion`, `outfitAnalysis`).
- **`escapeHtml()` wraps all API strings** interpolated into
  `innerHTML`. Don't bypass it.
- **Three file inputs** (`#photoInput` desktop, `#cameraInput` mobile
  camera with `capture="environment"`, `#galleryInput` mobile gallery).
  All three share `handleFileSelected(file)`.
- **`renderCompleteLook(card, cl, recs)`** fills the complete-look card
  with image-thumb fallback (`img.onerror` swaps the thumb for a
  `.cl-piece-pill` text fallback).
- **Bump `RUHRATNA_AIS_VERSION`** in both the plugin header and the
  `define()` whenever CSS or JS changes. Both are wired to `?ver=`.
- **Inline `onclick="location.reload()"`** is used on the "↺ Try
  another outfit" button — no extra wiring needed.

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
