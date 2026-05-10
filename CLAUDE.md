# Ruhratna AI Stylist — Frontend

## What this is

A single-page web app that recommends jewellery to match the user's outfit photo.
The flow is: user uploads an outfit photo → picks an occasion → backend analyses
the photo and matches jewellery → results screen shows a stylist note plus
ranked product cards. Built for Ruhratna, a premium Indian jewellery brand,
so the visual language is restrained — light type, gold accents, refined corners.

## Stack

Plain HTML / CSS / vanilla JS. No build step, no framework, no package manager.
Open `index.html` directly in a browser; everything ships from this folder.

```
ruhratna-stylist-ui/
├── index.html          # all markup for every screen
├── css/stylist.css     # full stylesheet (mobile-first, three breakpoints)
├── js/stylist.js       # state machine + API calls (single IIFE)
└── assets/             # placeholders for fonts/images
```

There is no router. Screens are sibling `<section>` elements toggled via
`style.display` from JS.

## API

```js
const API_BASE = "https://web-production-8b1fc.up.railway.app";
```

Two POST calls fire from `Find My Match` → handled by `findMatch()` in
[js/stylist.js](js/stylist.js):

| Step | Endpoint | Body | Returns |
|---|---|---|---|
| 1 | `POST /analyse` | `{ image: <base64>, occasion }` | `{ outfit_analysis: {...} }` |
| 2 | `POST /match`   | `{ outfit_analysis, occasion }` | `{ stylist_reading, recommendations[], complete_look }` |

`outfit_analysis` carries `dominant_colour`, `outfit_type`, `neckline`,
`style_weight`, `western_or_ethnic`, `occasion_confirmed`, `colour_accents[]`.
`recommendations[]` items: `{ product_id, title, type, tier, reason, match_score, price, image_url, product_url }`
where `type ∈ {neck, ears, accent, hands}` and `tier ∈ {1, 2}`.

## Screen flow

The whole app lives inside `<div class="app">` under one sticky header. JS just
toggles which top-level section is visible.

```
[Header — sticky, white, RUHRATNA wordmark, optional back arrow]

#main-content        ← landing (Fold 1 + Fold 2)
   .fold.fold-1      hero (left)  +  how it works + tagline (right)
   .fold.fold-2      guidance + photo grid + tips (left)
                     upload + occasion (right)

#screen-loading      ← shown while /analyse + /match are in flight
   loading-orb + step indicators (left)
   skeleton/outfit reading card (right)

#screen-results      ← shown after /match returns
   stylist-card + complete-look-card (left, sticky)
   outfit-detail-card + matches header + tier-1 + show-more + tier-2 (right)
```

Transitions happen in [js/stylist.js](js/stylist.js):

- `Style My Outfit →` smooth-scrolls to `#upload-section`
- `Find My Match` → `findMatch()` swaps `#main-content` for `#screen-loading`,
  runs the two API calls, animates the step indicators, then swaps to
  `#screen-results` with an 800ms pause so the user sees the second step turn green
- Header back arrow is `location.reload()` (start over)
- Errors route through `showError(message)` which replaces the loading section
  with a centered "Try Again" card

## Test mode

When the page is opened from the file system (`window.location.protocol === "file:"`)
JS unhides the gold `⚡ Test Mode` pill in the header. Clicking it skips the
upload/API flow entirely and renders the results screen with `TEST_ANALYSIS`
and `TEST_MATCH` constants defined inside the IIFE. Use this when iterating on
results-screen styling.

## Responsive layout

Mobile-first base styles, then three media queries:

| Breakpoint | Behavior |
|---|---|
| `< 768px` mobile | Single-column flow. Hero is a rounded dark card. Photo grid is a horizontal-scroll strip. Camera + Gallery shown as two side-by-side tiles (`.mob-upload-btn`). Tips render as one inline `.tips-inline` text row. |
| `≥ 768px` tablet | Single column capped at `--tablet-max: 680px`. Hero gets a card. Upload zone replaces the mobile tiles (one drop zone). Photo grid becomes a 2-col grid. |
| `≥ 1024px` desktop | Two-column **`.fold`** grid (45fr/55fr) for landing, with snap scrolling between Fold 1 and Fold 2. **`#screen-results`** uses a separate **`.results-layout`** flex container (45% / 55%, sticky left). |
| `≥ 1280px` wide | Slightly more breathing room (gap, padding). |

Snap scroll (block 24 in CSS) — `html { scroll-snap-type: y mandatory }` plus
`.fold, #screen-loading, #screen-results { scroll-snap-align: start; min-height: 100vh }`.
Disabled on mobile/tablet via `@media (max-width: 1024px) { html { scroll-snap-type: none } }`.

`scroll-padding-top: var(--header-h)` accounts for the 56px sticky header so
snap targets line up below it.

### Results screen — desktop layout

```
.results-layout                       (.results-screen wraps it)
   display: flex
   gap: 32px
   padding: 32px var(--gutter-desktop)    ← matches header inner padding (48px)
   max-width: 1400px
   margin: 0 auto

   .results-left   width 45%, position: sticky, top: 80px, height: fit-content
   .results-right  width 55%
```

On mobile the two columns flatten via `display: contents` so `order:` can
interleave their children:

```
1 outfit detail card → 2 stylist → 3 complete look →
4 matches header → 5 tier-1 → 6 show more → 7 tier-2
```

The complete-look card is one DOM element (`#complete-look-card`); CSS order
moves it on mobile, no twin element.

## Brand tokens

Defined once in `:root` ([css/stylist.css:30](css/stylist.css#L30)).

```
--gold:        #C9A96E
--gold-light:  #E8D5B0
--gold-dark:   #A07840
--deep:        #1A1208       (hero / dark CTAs)
--cream:       #FAF6F0       (page background)
--text-main:   #2D1F0A
--text-muted:  #8B7355
--border:      rgba(201,169,110,0.25)

--font-display: 'Helvetica Neue', Helvetica, Arial, sans-serif    (light weight headings)
--font-accent:  'Agatho', Georgia, serif                          (italic taglines)
--font-body:    'Helvetica Neue', Helvetica, Arial, ...           (body)
--font-thin:    'Helvetica Neue Thin', 'Helvetica Neue', ...      (subtext, hints)

--header-h:        56px
--content-max:     1200px
--tablet-max:      680px
--gutter-mobile:   24px
--gutter-tablet:   32px
--gutter-desktop:  48px
```

Brand fonts (Agatho + two Helvetica Neue weights) load via `@font-face` from
`ruhratna.com`. Butler is intentionally not used — Helvetica Neue 100/200/300
carries every heading.

### Border-radius scale (Ruhratna's restrained look)

- Large cards (product, outfit detail, stylist, complete-look, upload zone, photo preview, loading outfit card, mobile upload tile, photo guide card): **8px**
- Hero card: **12px** (slightly more — feature card)
- Medium cards (step card, tips card, lstep, btn-find, .odc-chip): **6px**
- Small (chips, buttons, AI Stylist pill): **4px**
- Very small badges (type-badge, ex-badge, outfit-chip): **3px**
- Image containers inside cards (`.card-image-wrap`, `.ex-photo`, `.preview-thumb`): **0** (parent clips via `overflow: hidden`)
- Circular (orb, dots, step-num, hdr-back, preview-check, colour-dot): **50%**

## Key components

| Class | Where | Purpose |
|---|---|---|
| `.hero` | Fold 1 left | Dark card with badge, headline, subtext, gold CTA |
| `.step-card` | Fold 1 right | White card, gold left rail, gradient circle numeral |
| `.ex-card` / `.ex-photo` | Fold 2 left | Photo guide thumbnails. Mobile: horizontal-scroll 140×210 (2/3). Desktop: 2-col grid (3/4). |
| `.tips-inline` | Fold 2 left | One-row inline text tips, dot-separated, no card |
| `.upload-zone` | Fold 2 right | Desktop drop zone (single `#photoInput`) |
| `.mob-upload-btn` | Fold 2 right (mobile only) | Camera + Gallery tiles wired to `#cameraInput` (capture) and `#galleryInput` |
| `.photo-preview-card` | After file selected | 80×80 thumbnail, name, size, "Change photo" link |
| `.chip-grid` / `.chip` | Occasion section | 3-col chip grid; first chip pre-selected (`.is-selected`) |
| `.btn-find` | Bottom of occasion | Dark "Find My Match" CTA |
| `.loading-orb` | Screen 3 left | 120px gold-gradient breathing circle + rotating ring + sparkle |
| `.lstep` | Screen 3 left | Step indicator with `data-state="pending|active|done"` |
| `.outfit-card` | Screen 3 right | Renders outfit reading; sibling skeleton card visible during phase 1 |
| `.outfit-detail-card` | Screen 4 right (top) | White card with label, colour dot + type, 2x2 chip grid + accents row, "↺ Try another" |
| `.stylist-card` | Screen 4 left | Dark card with italic Helvetica quote |
| `.complete-look-card` | Screen 4 left (or mobile order 3) | Gold-tinted card with description + 2 product thumbs (each with own Add to Cart) |
| `.product-card` | Screen 4 right | Square product image (cover, padded), badges below, dark "Add to Cart" CTA, gold quote-block reason |
| `.show-more-btn` | Screen 4 right | Gold-rule divider with "SHOW MORE" centered text |

## Conventions

- **No build, no framework.** Anything added must remain hand-rolled.
- **Mobile-first CSS.** Base rules describe mobile; tablet/desktop are media-query overrides.
- **CSS custom properties** drive colors, fonts, gutters, header height. Don't hardcode colors — use the token.
- **All JS lives in one IIFE** in [js/stylist.js](js/stylist.js). Closures hold app state (`selectedFile`, `selectedOccasion`, `outfitAnalysis`). Functions are not hoisted to `window` except where inline `onclick` requires it (which we currently avoid).
- **Inline `onclick="location.reload()"`** is used on the back arrow and `↺ Try another outfit` button — no IIFE wiring needed for `location`.
- **`escapeHtml()`** wraps all API-string interpolations into `innerHTML`. Don't bypass it.
- **Three file inputs** (`#photoInput` desktop, `#cameraInput` mobile camera with `capture="environment"`, `#galleryInput` mobile gallery). All three feed the same `handleFileSelected(file)` handler via a shared `change` listener.
- **`renderCompleteLook(card, cl, recs)`** fills the complete-look card with image-thumb fallback (`img.onerror` swaps the thumb for a `.cl-piece-pill` text fallback).
- **Don't introduce new font weights** beyond what `--font-thin` (100), `--font-body` (400), and the explicit 200/300/500/600 we already use cover.
- **Fold structure on landing must stay symmetric** — Fold 1 (hero left + steps right) and Fold 2 (guidance left + upload right) each fill `100vh` on desktop with the snap-scroll pattern.

## Gotchas

- **Sticky header offset:** scroll-padding-top is `var(--header-h)` (56px). When adding new snap targets, account for this.
- **`scroll-snap-type: y mandatory` is on `<html>`**, not the app shell. Disabling it on mobile is essential — multiple media queries already handle this.
- **`.layout-left` is sticky only inside `.fold-2`** on desktop (not `.fold-1`, not `#screen-loading`). The results screen uses its own `.results-left` sticky rule, not the layout one.
- **`.complete-look-card` is one element**, not two. CSS `order` moves it on mobile via the `display: contents` flatten trick.
- **`.ex-photo`** has no `border-radius`; the parent `.ex-card`'s 8px rounding plus `overflow: hidden` does the clipping. Same pattern for `.card-image-wrap` (0) inside `.product-card` (8).
- **Image errors** in product cards swap the wrap to a beige bg and hide the broken `<img>`. In complete-look thumbnails, `img.onerror` replaces the entire thumb with a text pill.
- **Test fixtures** live next to the click handler — keep `TEST_ANALYSIS` / `TEST_MATCH` in sync with the real API shape if either changes.

## When extending

- New screen → add a `<section id="screen-X">` inside `.app`, hide via `style.display="none"` initially, transition to it from JS, snap-target it on desktop.
- New brand color → add to `:root`, never to a single rule.
- New radius → consult the scale above; don't introduce a fourth radius value.
- New API field → extend the test fixtures so `⚡ Test Mode` keeps rendering correctly.
