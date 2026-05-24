<?php
/**
 * Template Name: Ruhratna AI Stylist
 *
 * Renders the AI Stylist single-page UI on the /ai-stylist page.
 * Theme's get_header()/get_footer() still wrap this content so the
 * WordPress site's nav header is preserved (and offset for via
 * --header-h + scroll-padding-top in stylist.css).
 */

defined('ABSPATH') or exit;

get_header();
?>
<div class="app">

  <!-- =====================================================
       SCREEN 1 : INTRO  (hero + "how it works" steps)
       Visible on first load. The hero CTA and any step card
       advance to #screen-upload via JS showScreen().
       ===================================================== -->
  <section id="screen-intro" class="screen-intro">
    <!-- ===================== FOLD 1 : Hero + How it works ===================== -->
    <div class="layout fold fold-1">

      <!-- LEFT: hero -->
      <div class="layout-left">
        <section class="hero">
          <div class="hero-glow" aria-hidden="true"></div>

          <!-- Service-status badge in the top-right of the hero card.
               Positioned absolutely so it doesn't push the rest of the
               hero content; pulse-dot + "LIVE" label reads as a live
               indicator the way streaming services use it. -->
          <div class="live-badge" aria-label="Service is live">
            <span class="pulse-dot" aria-hidden="true"></span>
            LIVE
          </div>

          <div class="hero-inner">
            <span class="pill-badge">
              <svg class="pill-spark" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/>
              </svg>
              AI Stylist
            </span>

            <h1 class="hero-title">
              Your outfit,<br/>
              <span class="hero-title-gold">our jewellery</span>
            </h1>

            <p class="hero-sub">
              Upload your outfit photo and our AI finds your perfect jewellery match : in seconds.
            </p>

            <button type="button" class="btn btn-gold" id="ctaStyle">
              Style My Outfit
            </button>
          </div>
        </section>
      </div>

      <!-- RIGHT: how it works + tagline -->
      <div class="layout-right">
        <section class="how-it-works secondary">
          <div class="how-it-works-inner">
            <div class="section-label">HOW IT WORKS</div>
            <h2 class="section-title">3 steps to your perfect match</h2>

            <div class="steps">
              <article class="step-card" role="button" tabindex="0" data-action="goto-upload">
                <div class="step-num">1</div>
                <div class="step-body">
                  <h4 class="step-title">Upload your outfit</h4>
                  <p class="step-text">A mirror selfie or flat lay. Any phone camera is fine.</p>
                </div>
              </article>

              <article class="step-card" role="button" tabindex="0" data-action="goto-upload">
                <div class="step-num">2</div>
                <div class="step-body">
                  <h4 class="step-title">Tell us the occasion</h4>
                  <p class="step-text">Wedding, festive, casual, office : we match the right style.</p>
                </div>
              </article>

              <article class="step-card" role="button" tabindex="0" data-action="goto-upload">
                <div class="step-num">3</div>
                <div class="step-body">
                  <h4 class="step-title">Get your styled match</h4>
                  <p class="step-text">3–6 jewellery picks matched to your outfit's colour, neckline and vibe.</p>
                </div>
              </article>
            </div>

            <div class="screen1-tagline">
              <div class="tagline-divider" aria-hidden="true"></div>
              <p class="tagline-text">Styled by AI. Chosen for you.</p>
            </div>
          </div>
        </section>
      </div>
    </div>

  </section>

  <!-- =====================================================
       SCREEN 2 : UPLOAD  (photo guide + Camera / Gallery /
       drop zone + occasion chips + "Find My Match").
       Hidden on first load; revealed by showScreen('upload')
       when the user clicks "Style My Outfit" or any step card.
       ===================================================== -->
  <section id="screen-upload" class="screen-upload" style="display:none">
    <!-- ===================== FOLD 2 : Show outfit + Choose photo ===================== -->
    <div class="layout fold fold-2">

      <!-- LEFT: guidance (sticky on desktop) -->
      <div class="layout-left">
        <section class="guidance">
          <h2 class="guidance-title">Show us your outfit</h2>
          <p class="guidance-sub">
            Our AI works best with a clear full-body photo.
          </p>

          <div class="photo-grid" role="list">
            <div class="photo-track">

            <!-- Good 1 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/good-1.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-good"><span class="ex-tag-mark" aria-label="Good example">✓</span>Mirror selfie</span>
              </div>
            </div>

            <!-- Good 2 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/good-2.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-good"><span class="ex-tag-mark" aria-label="Good example">✓</span>Flat lay</span>
              </div>
            </div>

            <!-- Good 3 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/good-3.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-good"><span class="ex-tag-mark" aria-label="Good example">✓</span>Mirror selfie</span>
              </div>
            </div>

            <!-- Good 4 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/good-4.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-good"><span class="ex-tag-mark" aria-label="Good example">✓</span>Full body</span>
              </div>
            </div>

            <!-- Bad 1 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo ex-photo-dark">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/bad-1.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-bad"><span class="ex-tag-mark" aria-label="Avoid">✗</span>Too dark</span>
              </div>
            </div>

            <!-- Bad 2 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo ex-photo-dark">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/bad-2.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-bad"><span class="ex-tag-mark" aria-label="Avoid">✗</span>Face only</span>
              </div>
            </div>

            <!-- Bad 3 -->
            <div class="ex-card" role="listitem">
              <div class="ex-photo ex-photo-dark">
                <img class="ex-img"
                     src="<?php echo esc_url(plugins_url('images/bad-3.webp', dirname(__FILE__))); ?>"
                     alt="Example outfit photo">
                <span class="ex-tag ex-tag-bad"><span class="ex-tag-mark" aria-label="Avoid">✗</span>Group photo</span>
              </div>
            </div>

            </div><!-- /.photo-track -->
          </div>
        </section>
      </div>

      <!-- RIGHT: choose photo + occasion -->
      <div class="layout-right">

        <!-- Divider : visible only on mobile/tablet -->
        <hr class="gold-divider" />

        <!-- UPLOAD : smooth-scroll target for the hero CTA -->
        <section class="upload-section" id="upload-section">
          <h3 class="action-title">Choose your photo</h3>

          <!-- desktop / tablet: a single drop zone -->
          <div class="upload-zone" id="uploadZone" role="button" tabindex="0"
               aria-label="Upload your outfit photo">
            <div class="upload-icon-wrap">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7h3l1.5-2.5h9L18 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <div class="upload-text">
              <span class="upload-title">Upload your outfit photo</span>
              <span class="upload-sub">Tap to choose from gallery or take a new photo</span>
            </div>
            <div class="upload-arrow" aria-hidden="true">→</div>
          </div>

          <!-- mobile only: two distinct buttons (Camera vs Gallery) -->
          <div class="mobile-upload-options" id="mobileUploadOptions">
            <button type="button" class="mob-upload-btn" id="mobBtnCamera">
              <div class="mob-btn-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="#A07840" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div class="mob-btn-label">Camera</div>
              <div class="mob-btn-sub">Take a photo</div>
            </button>

            <button type="button" class="mob-upload-btn" id="mobBtnGallery">
              <div class="mob-btn-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="#A07840" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
              <div class="mob-btn-label">Gallery</div>
              <div class="mob-btn-sub">Choose existing</div>
            </button>
          </div>

          <!-- preview card replaces the drop zone after a photo is picked -->
          <div class="photo-preview-card" id="photoPreview" hidden>
            <img class="preview-thumb" id="photoPreviewImg" alt="Selected outfit" />
            <div class="preview-info">
              <span class="preview-name" id="photoPreviewName"></span>
              <span class="preview-size" id="photoPreviewSize"></span>
              <button type="button" class="change-photo-btn" id="photoChangeLink">
                Change photo
              </button>
            </div>
            <div class="preview-check" aria-hidden="true">✓</div>
          </div>
        </section>

        <!-- TIPS — photo-quality reminders. Sit between the upload
             controls and the occasion picker so they're visible while
             the user is choosing a photo and after they've picked one. -->
        <div class="tips-inline">
          <span class="tip-inline">
            <svg class="tip-icon" aria-hidden="true" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
            Natural light
          </span>
          <span class="tip-sep" aria-hidden="true">·</span>
          <span class="tip-inline">
            <svg class="tip-icon" aria-hidden="true" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 4l-5 3 2 4 3-1v10h10V10l3 1 2-4-5-3"/>
              <path d="M9 4a3 3 0 0 0 6 0"/>
            </svg>
            Full outfit
          </span>
          <span class="tip-sep" aria-hidden="true">·</span>
          <span class="tip-inline">
            <svg class="tip-icon" aria-hidden="true" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="1.6"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>
            </svg>
            No filters
          </span>
        </div>

        <!-- OCCASION (revealed after photo selected) -->
        <section class="occasion-section" id="occasionSection" aria-hidden="true">
          <h3 class="action-title-sm">What's the occasion?</h3>

          <div class="chip-grid" id="occasionGrid">
            <button type="button" class="chip" data-occasion="Wedding">
              <span class="chip-emoji">💍</span><span>Wedding</span>
            </button>
            <button type="button" class="chip" data-occasion="Festive">
              <span class="chip-emoji">🪔</span><span>Festive</span>
            </button>
            <button type="button" class="chip" data-occasion="Office">
              <span class="chip-emoji">💼</span><span>Office</span>
            </button>
            <button type="button" class="chip" data-occasion="Party">
              <span class="chip-emoji">🎉</span><span>Party</span>
            </button>
            <button type="button" class="chip" data-occasion="Casual">
              <span class="chip-emoji">🌿</span><span>Casual</span>
            </button>
            <button type="button" class="chip" data-occasion="Pooja">
              <span class="chip-emoji">🙏</span><span>Pooja</span>
            </button>
          </div>

          <p class="occasion-hint-error" id="occasionHintError" role="status" aria-live="polite" hidden>
            Pick an occasion to continue
          </p>

          <button type="button" class="btn btn-find" id="btnFindMatch">
            Find My Match <span class="btn-arrow">→</span>
          </button>
          <p class="action-hint">
            <svg class="action-hint-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/></svg>
            AI analyses your outfit in ~6 seconds
          </p>
        </section>

      </div>

    </div>
  </section>

  <!-- =====================================================
       SCREEN 3 : LOADING / ANALYSING
       Shown by JS while /analyse + /match are in-flight.
       ===================================================== -->
  <section id="screen-loading" class="loading-screen" style="display:none">
    <div class="layout">

      <!-- LEFT: header (icon + title) + step indicators -->
      <div class="layout-left loading-left">
        <div class="loading-header">
          <div class="loading-icon" aria-hidden="true">
            <span class="loading-icon-spark">✨</span>
          </div>
          <h2 class="loading-title">Our stylist is at work</h2>
        </div>

        <div class="loading-steps">
          <div class="lstep" id="lstep-1" data-state="active">
            <div class="lstep-icon">1</div>
            <div class="lstep-text">Reading your outfit</div>
            <div class="lstep-status">Working...</div>
          </div>

          <div class="lstep" id="lstep-2" data-state="pending">
            <div class="lstep-icon">2</div>
            <div class="lstep-text">Finding your jewellery</div>
            <div class="lstep-status">Soon</div>
          </div>
        </div>
      </div>

      <!-- RIGHT: skeleton placeholder (Phase 1) → real outfit card (Phase 2) -->
      <div class="layout-right loading-right">

        <!-- Phase 1 placeholder -->
        <div id="outfit-reading-placeholder" class="outfit-card is-visible">
          <div class="outfit-card-label">
            <svg class="outfit-card-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/></svg> Analysing your photo
          </div>

          <div class="skeleton-line wide"></div>
          <div class="skeleton-line medium"></div>

          <div class="skeleton-chips">
            <div class="skeleton-chip"></div>
            <div class="skeleton-chip"></div>
            <div class="skeleton-chip"></div>
          </div>

          <div class="outfit-card-message">
            Reading your outfit colours, neckline and style...
          </div>

          <div class="outfit-card-loader" aria-hidden="true">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <!-- Phase 2 : real outfit card — same design as results-screen .outfit-detail-card,
             with the bouncing-dot loader in place of the "Try another outfit" button -->
        <div id="outfit-reading-card" class="outfit-detail-card outfit-card" hidden>
          <div class="odc-label"><svg class="odc-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/></svg> YOUR OUTFIT</div>

          <div class="odc-main">
            <span id="load-odc-colour" class="odc-colour-dot" aria-hidden="true"></span>
            <span id="load-odc-type" class="odc-type"></span>
          </div>

          <div class="odc-chips">
            <div class="odc-chip">
              <span class="odc-chip-label">Neckline</span>
              <span class="odc-chip-value" id="load-odc-neckline"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Style</span>
              <span class="odc-chip-value" id="load-odc-style"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Occasion</span>
              <span class="odc-chip-value" id="load-odc-occasion"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Vibe</span>
              <span class="odc-chip-value" id="load-odc-vibe"></span>
            </div>
            <div class="odc-chip" id="load-odc-accents-wrap">
              <span class="odc-chip-label">Accents</span>
              <span class="odc-chip-value" id="load-odc-accents"></span>
            </div>
          </div>
        </div>

        <!-- Progress card — revealed by JS when /match polling starts.
             Sits below the outfit card; holds the progress bar + the
             rotating status messages that used to live in the left column. -->
        <div class="progress-card" id="progress-card" hidden>
          <div class="loading-progress" aria-hidden="true">
            <div class="loading-progress-bar" id="loading-progress-bar"></div>
          </div>
          <p class="loading-progress-message" id="loading-progress-message" aria-live="polite"></p>
        </div>
      </div>

    </div>
  </section>

  <!-- =====================================================
       SCREEN 4 : RESULTS
       Shown by JS after /match returns successfully.
       ===================================================== -->
  <section id="screen-results" class="results-screen" style="display:none">
    <div class="results-layout">

      <!-- LEFT (sticky on desktop): AI voice : Stylist Says + Complete Look -->
      <div class="results-left">
        <div class="stylist-card">
          <svg class="stylist-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/></svg>
          <div class="stylist-label">YOUR STYLIST SAYS</div>
          <div class="stylist-text" id="stylist-reading-text"></div>
        </div>

        <div class="complete-look-card" id="complete-look-card" hidden>
          <div class="cl-header">
            <span class="cl-title">Style These Together</span>
          </div>
          <p class="cl-description"></p>
          <div class="cl-pieces"></div>
        </div>
      </div>

      <!-- RIGHT (scrolls): outfit strip → matches header → product cards -->
      <div class="results-right">

        <!-- outfit detail card : full card at top of right column -->
        <div class="outfit-detail-card">
          <div class="odc-label"><svg class="odc-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 1 L10.5 8.5 L17 10 L10.5 11.5 L9 19 L7.5 11.5 L1 10 L7.5 8.5 Z M18 14 L18.7 17.3 L22 18 L18.7 18.7 L18 22 L17.3 18.7 L14 18 L17.3 17.3 Z"/></svg> YOUR OUTFIT</div>

          <div class="odc-main">
            <span id="odc-colour" class="odc-colour-dot" aria-hidden="true"></span>
            <span id="odc-type" class="odc-type"></span>
          </div>

          <div class="odc-chips">
            <div class="odc-chip">
              <span class="odc-chip-label">Neckline</span>
              <span class="odc-chip-value" id="odc-neckline"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Style</span>
              <span class="odc-chip-value" id="odc-style"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Occasion</span>
              <span class="odc-chip-value" id="odc-occasion"></span>
            </div>
            <div class="odc-chip">
              <span class="odc-chip-label">Vibe</span>
              <span class="odc-chip-value" id="odc-vibe"></span>
            </div>
            <div class="odc-chip" id="odc-accents-wrap">
              <span class="odc-chip-label">Accents</span>
              <span class="odc-chip-value" id="odc-accents"></span>
            </div>
          </div>

          <button type="button" class="retake-btn" onclick="location.reload()">
            ↺ Try another outfit
          </button>
        </div>

        <div class="results-header">
          <div class="results-label">YOUR MATCHES</div>
          <div class="results-count" id="results-count"></div>
        </div>

        <div id="tier1-cards" class="cards-grid"></div>

        <button type="button" id="show-more-btn" class="show-more-btn">
          <span class="show-more-line" aria-hidden="true"></span>
          <span class="show-more-text">Show More</span>
          <span class="show-more-line" aria-hidden="true"></span>
        </button>

        <div id="tier2-cards" class="cards-grid" style="display:none"></div>
      </div>

    </div>
  </section>

  <!-- file inputs:
       - photoInput → desktop drop zone (no capture)
       - cameraInput → mobile camera tile (capture="environment")
       - galleryInput → mobile gallery tile (no capture) -->
  <input type="file" id="photoInput"   accept="image/*" hidden />
  <input type="file" id="cameraInput"  accept="image/*" capture="environment" hidden />
  <input type="file" id="galleryInput" accept="image/*" hidden />
</div>

<!-- HEIC → JPEG conversion (iPhone photos). Loaded before the plugin's
     own JS (which is enqueued in the footer) so window.heic2any is
     defined by the time stylist.js needs it. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js"></script>
<?php
get_footer();
