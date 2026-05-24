/* =========================================================
   RUHRATNA · AI STYLIST — App logic
   Single continuous page (Screen 1 + 2) → Loading screen (3)

   API base is injected by WordPress via wp_localize_script
   as window.ruhratnaStyler.apiBase — points at the plugin's
   REST proxy (/wp-json/ruhratna-stylist/v1).
   ========================================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // landing screens
  const screenIntro   = $("screen-intro");
  const screenUpload  = $("screen-upload");
  const ctaStyle      = $("ctaStyle");

  // upload — desktop drop zone + mobile Camera/Gallery tiles
  const uploadZone           = $("uploadZone");
  const mobileUploadOptions  = $("mobileUploadOptions");
  const mobBtnCamera         = $("mobBtnCamera");
  const mobBtnGallery        = $("mobBtnGallery");
  const photoInput           = $("photoInput");
  const cameraInput          = $("cameraInput");
  const galleryInput         = $("galleryInput");
  const photoPreview         = $("photoPreview");
  const photoPreviewImg      = $("photoPreviewImg");
  const photoPreviewName     = $("photoPreviewName");
  const photoPreviewSize     = $("photoPreviewSize");
  const photoChangeLink      = $("photoChangeLink");

  // occasion
  const occasionSection  = $("occasionSection");
  const occasionGrid     = $("occasionGrid");
  const occasionHintErr  = $("occasionHintError");
  const btnFindMatch     = $("btnFindMatch");

  // loading screen
  const screenLoading    = $("screen-loading");
  const outfitCard       = $("outfit-reading-card");
  const progressCard     = $("progress-card");

  // results screen
  const screenResults    = $("screen-results");
  const showMoreBtn      = $("show-more-btn");

  // app state
  let selectedFile               = null;
  let selectedOccasion           = null;
  let outfitAnalysis             = null;
  let sessionId                  = null;
  let pollIntervalId             = null;   // setInterval handle for the /result polling loop
  let progressMessageIntervalId  = null;   // setInterval handle for the rotating progress messages
  let progressFadeTimeoutId      = null;   // setTimeout handle for the 200ms text-fade swap

  /* ---------------------------------------------------------
     "Show more picks" → reveal tier-2 cards
     --------------------------------------------------------- */
  showMoreBtn.addEventListener("click", showTier2);

  /* ---------------------------------------------------------
     Screen state machine — four screens (intro, upload,
     loading, results) shown one at a time via display:none.
     Transitions are driven through showScreen(name, opts):

       intro  → upload  : pushState   (user-initiated)
       upload → loading : pushState   (Find My Match)
       loading→ results : replaceState  (so back from results
                            skips the now-stale loading state
                            and lands on upload directly)

     Browser back fires popstate; the new history entry's
     state.screen tells us where to land. The very first page
     load gets replaceState({screen:'intro'}) below so popstate
     after a single back from upload sees state.screen='intro'
     instead of null.
     --------------------------------------------------------- */
  const SCREENS = {
    intro:   screenIntro,
    upload:  screenUpload,
    loading: screenLoading,
    results: screenResults,
  };

  function showScreen(name, opts) {
    const histOp = (opts && opts.history) || "push";   // 'push' | 'replace' | 'none'

    for (const key in SCREENS) {
      const el = SCREENS[key];
      if (el) el.style.display = (key === name) ? "" : "none";
    }

    if (histOp === "push")    history.pushState   ({ screen: name }, "");
    if (histOp === "replace") history.replaceState({ screen: name }, "");

    window.scrollTo(0, 0);
  }

  // Tag the initial page load so a single back from upload lands on
  // intro with event.state.screen === 'intro' (instead of null).
  history.replaceState({ screen: "intro" }, "");

  window.addEventListener("popstate", (e) => {
    // tear down any in-flight match-result polling and progress timers
    // before swapping screens, so a back-during-loading doesn't leave
    // a setInterval firing into a hidden DOM.
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    stopProgressAnimation();

    const target = (e.state && e.state.screen) || "intro";
    showScreen(target, { history: "none" });
  });

  /* ---------------------------------------------------------
     Add to Cart — keep the user on the results page.
     Listeners attach directly to the cart containers (not
     document) so we catch the click before any theme handler
     further up the bubble chain can open it in a new tab.
     After a successful fetch we trigger the 'added_to_cart'
     jQuery event so the WooCommerce side cart opens just
     like a normal store add-to-cart would.
     --------------------------------------------------------- */
  function handleCartClick(e) {
    const cartBtn = e.target.closest(".card-cta, .cl-thumb-cart-btn");
    if (!cartBtn) return;
    e.preventDefault();

    const url = cartBtn.getAttribute("href");
    if (!url) return;

    const originalText = cartBtn.textContent;
    cartBtn.textContent = "Adding...";
    cartBtn.style.pointerEvents = "none";

    fetch(url, { credentials: "same-origin" })
      .then((res) => {
        if (res.ok) {
          cartBtn.textContent = "✓ Added";
          if (window.jQuery) {
            // Force WooCommerce to refresh cart fragments first; only after
            // the fragments are back do we fire 'added_to_cart', which opens
            // the side cart. Without this two-step the side cart can open
            // showing stale contents (missing the item we just added) until
            // a page refresh.
            window.jQuery(document.body).trigger("wc_fragment_refresh");
            window.jQuery(document.body).one("wc_fragments_refreshed", function () {
              window.jQuery(document.body).trigger("added_to_cart");
            });
          }
        } else {
          cartBtn.textContent = "Try again";
        }
      })
      .catch(()    => { cartBtn.textContent = "Try again"; })
      .finally(() => {
        setTimeout(() => {
          cartBtn.textContent       = originalText;
          cartBtn.style.pointerEvents = "";
        }, 1500);
      });
  }

  ["tier1-cards", "tier2-cards", "complete-look-card"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("click", handleCartClick);
  });

  /* ---------------------------------------------------------
     Hero CTA + step cards → advance to the upload screen.
     Step cards carry role="button" tabindex="0" so they're
     keyboard-reachable; Enter / Space both fire navigation
     just like a real button would.
     --------------------------------------------------------- */
  ctaStyle.addEventListener("click", () => showScreen("upload"));

  document.querySelectorAll('[data-action="goto-upload"]').forEach((el) => {
    el.addEventListener("click", () => showScreen("upload"));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showScreen("upload");
      }
    });
  });

  /* ---------------------------------------------------------
     Photo guide marquee — clone the 7 example cards once so
     the mobile CSS animation has a seamless 14-card track to
     translate over. The 8th card (= clone of card 1) lands at
     exactly the position the first original started, so the
     keyframes can restart at translateX(0) without a jump.

     The clones are flagged data-clone="true" + aria-hidden +
     tabindex=-1 so screen readers and keyboard users skip them;
     CSS hides them outside the mobile marquee context so they
     don't break the tablet/desktop 2-col grid layout.

     Skipped entirely under prefers-reduced-motion — the mobile
     CSS in that case restores manual horizontal scroll, and
     extra clones would just be redundant scroll length.
     --------------------------------------------------------- */
  (function setupPhotoMarquee() {
    const track = document.querySelector(".photo-track");
    if (!track || track.dataset.cloned === "true") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    Array.from(track.children).forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("data-clone", "true");
      clone.tabIndex = -1;
      track.appendChild(clone);
    });
    track.dataset.cloned = "true";
  })();

  /* ---------------------------------------------------------
     Upload — one input, one zone. Native picker handles
     camera vs gallery on mobile.
     --------------------------------------------------------- */
  uploadZone     .addEventListener("click", () => photoInput.click());
  photoChangeLink.addEventListener("click", () => photoInput.click());

  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      photoInput.click();
    }
  });

  // mobile tiles: each fires its own input so capture="environment"
  // is only sent from the Camera button
  mobBtnCamera .addEventListener("click", () => cameraInput .click());
  mobBtnGallery.addEventListener("click", () => galleryInput.click());

  function formatSize(bytes) {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Mobile-only smooth scroll. Desktop (≥1024px) keeps the static
  // two-column layout, so we no-op there to avoid jumping the page.
  function scrollToEl(el, offset) {
    if (!el || window.innerWidth >= 1024) return;
    const top = el.getBoundingClientRect().top + window.scrollY - (offset || 80);
    window.scrollTo({ top, behavior: "smooth" });
  }

  // Roll the upload screen back to its initial empty state. Used by the
  // rejection-card retry so the just-rejected photo + stale occasion pick
  // aren't still sitting on #screen-upload when the user lands back on it.
  function resetPhotoSelection() {
    selectedFile     = null;
    selectedOccasion = null;

    // clear the file inputs so selecting the same file again still re-fires
    // the change event (browsers suppress change when the value is identical)
    [photoInput, cameraInput, galleryInput].forEach((input) => { input.value = ""; });

    photoPreviewImg.removeAttribute("src");
    photoPreviewName.textContent = "";
    photoPreviewSize.textContent = "";
    photoPreview        .hidden = true;
    uploadZone          .hidden = false;
    mobileUploadOptions .hidden = false;

    // collapse the occasion section + deselect any chip — the section
    // re-reveals next time handleFileSelected runs
    occasionGrid.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-selected"));
    occasionSection.classList.remove("is-visible");
    occasionSection.setAttribute("aria-hidden", "true");
    occasionHintErr.hidden = true;
    occasionGrid.classList.remove("is-shaking");
  }

  function handleFileSelected(file) {
    selectedFile   = file;
    outfitAnalysis = null;
    sessionId      = null;
    console.log(`[ruhratna] photo selected: ${file.name} (${file.type}, ${file.size} bytes)`);

    const reader = new FileReader();
    reader.onload = (e) => { photoPreviewImg.src = e.target.result; };
    reader.readAsDataURL(file);

    photoPreviewName.textContent = file.name;
    photoPreviewSize.textContent = formatSize(file.size);

    uploadZone          .hidden = true;
    mobileUploadOptions .hidden = true;
    photoPreview        .hidden = false;

    occasionSection.classList.add("is-visible");
    occasionSection.setAttribute("aria-hidden", "false");

    // Wait until the occasion-section's CSS transition (max-height 0 →
    // 1200px over 550ms, see .occasion-section in section 17 of the
    // stylesheet) has finished, THEN scroll the "Find My Match" button
    // into view. The previous scrollIntoView({block:'nearest'}) ran
    // mid-transition and Safari, seeing a still-collapsed section,
    // computed a tiny scroll and stopped. We compute the target Y from
    // the button's final position and use window.scrollTo, which has
    // more consistent smooth-scroll support across browsers (Safari's
    // element.scrollIntoView with behavior:smooth is unreliable on
    // older iOS).
    setTimeout(() => {
      const findBtn = $("btnFindMatch");
      if (!findBtn) return;
      const rect    = findBtn.getBoundingClientRect();
      const targetY = rect.bottom + window.scrollY - window.innerHeight + 40;
      if (targetY > window.scrollY) {
        window.scrollTo({ top: targetY, behavior: "smooth" });
      }
    }, 620);
  }

  // all three inputs share the same selection handler
  [photoInput, cameraInput, galleryInput].forEach((input) => {
    input.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleFileSelected(f);
    });
  });

  /* ---------------------------------------------------------
     Occasion chips — single-select via delegated click
     --------------------------------------------------------- */
  occasionGrid.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;

    occasionGrid.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-selected"));
    chip.classList.add("is-selected");
    selectedOccasion = chip.dataset.occasion;
    console.log(`[ruhratna] occasion: ${selectedOccasion}`);

    // clear the missing-occasion error state once a chip is picked
    occasionHintErr.hidden = true;
    occasionGrid.classList.remove("is-shaking");
  });

  /* ---------------------------------------------------------
     Find My Match → loading screen + two-call API flow
     --------------------------------------------------------- */
  btnFindMatch.addEventListener("click", () => {
    if (!selectedFile) {
      console.warn("[ruhratna] find-match clicked without a file");
      return;
    }
    if (!selectedOccasion) {
      flagMissingOccasion();
      return;
    }
    findMatch();
  });

  function flagMissingOccasion() {
    occasionHintErr.hidden = false;
    // restart the animation if it's already in flight
    occasionGrid.classList.remove("is-shaking");
    void occasionGrid.offsetWidth;
    occasionGrid.classList.add("is-shaking");
    setTimeout(() => occasionGrid.classList.remove("is-shaking"), 650);
  }

  function setStepState(stepId, state) {
    const step = $(stepId);
    if (!step) return;
    step.dataset.state = state;

    const icon   = step.querySelector(".lstep-icon");
    const status = step.querySelector(".lstep-status");

    if (state === "done") {
      icon.textContent   = "✓";
      status.textContent = "Done";
    } else if (state === "active") {
      // restore numeric icon if it was previously set to ✓
      icon.textContent   = stepId === "lstep-1" ? "1" : "2";
      status.textContent = "Working...";
    } else {
      icon.textContent   = stepId === "lstep-1" ? "1" : "2";
      status.textContent = "Soon";
    }
  }

  function showOutfitCard(analysis) {
    $("load-odc-type").textContent =
      `${capitalise(analysis.dominant_colour)} ${capitalise(analysis.outfit_type)}`.trim();

    const colour = (analysis.dominant_colour || "").toLowerCase();
    $("load-odc-colour").style.background = COLOUR_MAP[colour] || "#C9A96E";

    $("load-odc-neckline").textContent = capitalise(analysis.neckline);
    $("load-odc-style"   ).textContent = capitalise(analysis.style_weight);
    $("load-odc-occasion").textContent = capitalise(analysis.occasion_confirmed);
    $("load-odc-vibe"    ).textContent = capitalise(analysis.western_or_ethnic);

    if (analysis.colour_accents && analysis.colour_accents.length > 0) {
      $("load-odc-accents").textContent = analysis.colour_accents.map(capitalise).join(", ");
      $("load-odc-accents-wrap").style.display = "";
    } else {
      $("load-odc-accents-wrap").style.display = "none";
    }

    // Phase 1 → Phase 2: hide the shimmer placeholder, reveal the real card
    const placeholder = $("outfit-reading-placeholder");
    if (placeholder) placeholder.hidden = true;

    outfitCard.hidden = false;
    // double rAF so the browser registers the initial state before transitioning
    requestAnimationFrame(() => {
      requestAnimationFrame(() => outfitCard.classList.add("is-visible"));
    });

    // Phase 2 — slide the page down to the real outfit card so the
    // user sees the analysis right after it appears.
    setTimeout(() => scrollToEl(outfitCard), 200);
  }

  function showRejectionMessage(reason) {
    // Hide the existing loading layout (steps + outfit cards) without
    // destroying it, so a subsequent Find My Match can re-use the same DOM.
    const loadingLayout = screenLoading.querySelector(".layout");
    if (loadingLayout) loadingLayout.style.display = "none";

    // remove any prior rejection card so retries don't stack
    const prior = screenLoading.querySelector(".rejection-card");
    if (prior) prior.remove();

    const card = document.createElement("div");
    card.className = "rejection-card";
    card.innerHTML = `
      <h2 class="rejection-heading">We couldn't style this photo</h2>
      <p class="rejection-message">${reason}</p>
      <button type="button" class="btn btn-gold rejection-retry-btn">
        Try another photo <span class="btn-arrow">→</span>
      </button>`;

    card.querySelector(".rejection-retry-btn").addEventListener("click", () => {
      sessionId      = null;
      outfitAnalysis = null;
      resetPhotoSelection();
      card.remove();
      if (loadingLayout) loadingLayout.style.display = "";
      showScreen("upload", { history: "replace" });
    });

    screenLoading.appendChild(card);
  }

  function showError(message) {
    screenLoading.innerHTML = `
      <div style="text-align:center; padding:60px 24px; max-width:480px; margin:0 auto">
        <div style="font-size:48px; margin-bottom:16px">⚠️</div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-weight:300; font-size:24px;
                    color:#2D1F0A; margin-bottom:8px">
          Something went wrong
        </div>
        <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px;
                    color:#8B7355; margin-bottom:24px; line-height:1.6">
          ${message || "Please try again."}
        </div>
        <button onclick="location.reload()"
                style="background:#1A1208; color:#C9A96E;
                       border:none; border-radius:12px;
                       padding:14px 28px; font-size:14px;
                       font-family:'Helvetica Neue',sans-serif;
                       cursor:pointer">
          Try Again
        </button>
      </div>`;
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Could not read photo file"));
      reader.readAsDataURL(file);
    });
  }

  /* ---------------------------------------------------------
     Client-side image prep before /analyse:
       (a) iPhone HEIC/HEIF → JPEG via heic2any (loaded as a
           <script> tag in the template).
       (b) Canvas resize — cap the longest edge at maxPx and
           re-encode as JPEG at 0.85 quality, so the base64
           payload sent to the WP REST proxy stays small.
     Any failure in either step falls back to a raw FileReader
     base64 read so we never block the upload on a transform.
     --------------------------------------------------------- */
  async function processImageForUpload(file, maxPx = 1024) {
    const name = String(file.name || "").toLowerCase();
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      name.endsWith(".heic") ||
      name.endsWith(".heif");

    let sourceBlob = file;

    if (isHeic && typeof window.heic2any === "function") {
      try {
        const converted = await window.heic2any({
          blob:    file,
          toType:  "image/jpeg",
          quality: 0.9,
        });
        // heic2any returns Blob, or Blob[] for multi-image HEIC — normalise
        sourceBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.warn("[ruhratna] HEIC conversion failed, sending raw:", err);
        return toBase64(file);
      }
    }

    try {
      return await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(sourceBlob);
        const img = new Image();

        img.onload = () => {
          try {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!w || !h) throw new Error("Image has zero dimensions");

            const scale = Math.min(1, maxPx / Math.max(w, h));
            const newW  = Math.round(w * scale);
            const newH  = Math.round(h * scale);

            const canvas = document.createElement("canvas");
            canvas.width  = newW;
            canvas.height = newH;
            canvas.getContext("2d").drawImage(img, 0, 0, newW, newH);

            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            URL.revokeObjectURL(url);
            resolve(dataUrl.split(",")[1]);
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Could not decode image"));
        };
        img.src = url;
      });
    } catch (err) {
      console.warn("[ruhratna] canvas resize failed, sending raw:", err);
      return toBase64(file);
    }
  }

  async function findMatch() {
    showScreen("loading");

    setStepState("lstep-1", "active");
    setStepState("lstep-2", "pending");

    try {
      const imageBase64 = await processImageForUpload(selectedFile);

      // imageBase64 is resized to 1024px and HEIC-converted if needed,
      // all client-side. On the WordPress server, proxy.php optionally
      // compresses further via TinyPNG (controlled by RUHRATNA_SKIP_TINIFY —
      // currently true on staging, set to false on live). No JS changes
      // needed when TinyPNG is activated — it is purely a server-side flag.
      // CALL 1 — /analyse  (synchronous; returns outfit_analysis directly)
      const analyseRes = await fetch(`${window.ruhratnaStyler.apiBase}/analyse`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: imageBase64, occasion: selectedOccasion }),
      });
      if (!analyseRes.ok) throw new Error(`Analyse failed (${analyseRes.status})`);

      const analyseData = await analyseRes.json();

      // Backend rejected the photo (e.g. not a clear outfit shot). Skip the
      // /match step and show a stylist-tone retry card instead.
      if (analyseData.error === true && analyseData.confidence_flag === 0) {
        stopProgressAnimation();
        showRejectionMessage(escapeHtml(analyseData.rejection_reason));
        return;
      }

      outfitAnalysis = analyseData.outfit_analysis;
      sessionId      = analyseData.session_id || null;
      console.log("[ruhratna] outfit analysis:", outfitAnalysis);

      // Phase 2 — outfit card slides in, step 2 takes over
      setStepState("lstep-1", "done");
      setStepState("lstep-2", "active");
      showOutfitCard(outfitAnalysis);

      // CALL 2 — /match  (async; returns a job_id immediately)
      const matchRes = await fetch(`${window.ruhratnaStyler.apiBase}/match`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          outfit_analysis: outfitAnalysis,
          occasion:        selectedOccasion,
          session_id:      sessionId,
        }),
      });
      if (!matchRes.ok) throw new Error(`Match failed (${matchRes.status})`);

      const { job_id } = await matchRes.json();
      if (!job_id) throw new Error("Match did not return a job_id");
      console.log("[ruhratna] match job started:", job_id);

      // CALL 3 — poll /result/<job_id> every 4s until status changes,
      // and start the user-facing progress bar + rotating messages
      pollMatchResult(job_id);
      startProgressAnimation();

    } catch (error) {
      console.error("[ruhratna] error:", error);
      stopProgressAnimation();
      showError(error.message);
    }
  }

  function pollMatchResult(jobId) {
    // cancel any previous polling loop, then store this one in module scope
    // so the popstate handler can clear it if the user hits Back mid-poll.
    if (pollIntervalId !== null) clearInterval(pollIntervalId);

    const stopPolling = () => {
      if (pollIntervalId !== null) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    };

    // Phase 3 — reveal the progress card now that /match is in flight.
    // No scroll: the Phase 2 viewport position already shows both the
    // outfit card and the progress card together below it.
    if (progressCard) progressCard.hidden = false;

    pollIntervalId = setInterval(async () => {
      // rebuild the URL each tick with a fresh _=<ts> param so intermediaries
      // (browser cache, CDN edge, WP page-cache plugins) can't serve a stale
      // "running" response after the job has flipped to "done".
      const pollUrl = `${window.ruhratnaStyler.apiBase}/result/${encodeURIComponent(jobId)}?_=${Date.now()}`;
      try {
        const res = await fetch(pollUrl);
        if (!res.ok) throw new Error(`Result poll failed (${res.status})`);
        const data = await res.json();

        if (data.status === "done") {
          stopPolling();
          console.log("[ruhratna] match results:", data.result);
          setStepState("lstep-2", "done");
          completeProgressAnimation();

          // brief pause so the user catches the green ✓ + the full bar
          setTimeout(() => {
            stopProgressAnimation();
            // Replace (not push) so back from results lands on upload,
            // not on the now-finished loading screen.
            showScreen("results", { history: "replace" });
            showResults(data.result);

            // Phase 4 — land the user on the "Your Stylist Says" card on
            // mobile. scrollToEl no-ops on desktop, where the sticky-left
            // layout already keeps the stylist card in view.
            setTimeout(() => {
              const stylistCard = document.querySelector(".stylist-card");
              if (stylistCard) scrollToEl(stylistCard, 80);
            }, 100);
          }, 800);

        } else if (data.status === "error") {
          stopPolling();
          stopProgressAnimation();
          console.error("[ruhratna] match job error:", data);
          showError(data.message || "Match job failed");
        }
        // status === "running" (or anything else) → keep polling
      } catch (err) {
        stopPolling();
        stopProgressAnimation();
        console.error("[ruhratna] poll error:", err);
        showError(err.message);
      }
    }, 4000);
  }

  /* ---------------------------------------------------------
     Progress bar + rotating status messages.
     The bar runs 0% → 95% via a single 80s CSS transition
     (purely declarative, no JS tick). The messages rotate every
     8s via setInterval. When /result returns "done" we snap the
     bar to 100% with a quick easing, hold for 800ms, then
     handle the results swap.
     --------------------------------------------------------- */
  const PROGRESS_MESSAGES = [
    "Finding jewellery that matches your outfit...",
    "Analysing your colours and style...",
    "Reading your neckline and silhouette...",
    "Matching pieces from our collection...",
    "Checking occasion and vibe fit...",
    "Scoring each piece for compatibility...",
    "Curating your top picks...",
    "Balancing your complete look...",
    "Almost there, finalising your style...",
    "Just a moment more, perfecting your match...",
    "Worth the wait — your stylist is thorough...",
  ];

  function startProgressAnimation() {
    const bar = $("loading-progress-bar");
    const msg = $("loading-progress-message");
    if (!bar || !msg) return;

    // ensure a clean slate (handles re-entry e.g. from a retry)
    stopProgressAnimation();

    // reset bar to 0% with no transition, then trigger the 80s ramp to 95%
    bar.style.transition = "none";
    bar.style.width      = "0%";
    void bar.offsetWidth; // force reflow so the next transition takes effect
    bar.style.transition = "width 80s linear";
    bar.style.width      = "95%";

    // first message shows immediately, no fade
    msg.style.opacity   = "1";
    msg.textContent     = PROGRESS_MESSAGES[0];

    let idx = 1;
    progressMessageIntervalId = setInterval(() => {
      if (idx >= PROGRESS_MESSAGES.length) {
        clearInterval(progressMessageIntervalId);
        progressMessageIntervalId = null;
        return;
      }
      fadeSwapMessage(PROGRESS_MESSAGES[idx]);
      idx++;
    }, 8000);
  }

  function fadeSwapMessage(text) {
    const msg = $("loading-progress-message");
    if (!msg) return;
    msg.style.opacity = "0";
    if (progressFadeTimeoutId !== null) clearTimeout(progressFadeTimeoutId);
    progressFadeTimeoutId = setTimeout(() => {
      msg.textContent   = text;
      msg.style.opacity = "1";
      progressFadeTimeoutId = null;
    }, 200);
  }

  function completeProgressAnimation() {
    const bar = $("loading-progress-bar");
    if (!bar) return;
    bar.style.transition = "width 0.4s ease";
    bar.style.width      = "100%";
  }

  function stopProgressAnimation() {
    if (progressMessageIntervalId !== null) {
      clearInterval(progressMessageIntervalId);
      progressMessageIntervalId = null;
    }
    if (progressFadeTimeoutId !== null) {
      clearTimeout(progressFadeTimeoutId);
      progressFadeTimeoutId = null;
    }
  }

  /* ---------------------------------------------------------
     SCREEN 4 — render results
     --------------------------------------------------------- */
  function capitalise(str) {
    if (!str) return "";
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g,  "&amp;")
      .replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatINR(n) {
    return Number(n || 0).toLocaleString("en-IN");
  }

  const TYPE_LABELS = {
    neck:   "Necklace",
    ears:   "Earrings",
    accent: "Accent",
    hands:  "Hands",
  };

  // outfit-card colour swatch lookup
  const COLOUR_MAP = {
    black:  "#1a1208",
    white:  "#f5f5f0",
    grey:   "#8a8a8a",
    red:    "#cc3333",
    green:  "#336633",
    blue:   "#334499",
    pink:   "#cc6688",
    yellow: "#ccaa33",
    orange: "#cc6633",
    purple: "#663399",
    gold:   "#C9A96E",
    silver: "#aaaaaa",
    maroon: "#660033",
    navy:   "#001166",
  };

  function buildProductCard(rec) {
    const card = document.createElement("div");
    card.className = `product-card ${rec.tier === 1 ? "tier1" : "tier2"}`;

    const typeLabel = TYPE_LABELS[rec.type] || rec.type || "Piece";

    // Order: image → badges → info. Image bleeds to card top edges,
    // badges sit on the white surface below it.
    card.innerHTML = `
      <a href="${escapeHtml(rec.product_url)}" target="_blank" rel="noopener">
        <div class="card-image-wrap">
          <img src="${escapeHtml(rec.image_url)}"
               alt="${escapeHtml(rec.title)}"
               class="card-image"
               onerror="this.parentElement.style.background='#f0ebe3'; this.style.display='none'">
        </div>
      </a>
      <div class="card-badges">
        <span class="type-badge ${escapeHtml(rec.type)}">${escapeHtml(typeLabel)}</span>
        <span class="match-score">
          <span class="score-num">${escapeHtml(rec.match_score)}</span>% match
        </span>
      </div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(rec.title)}</div>
        <div class="card-reason">${escapeHtml(rec.reason)}</div>
        <div class="card-footer">
          <div class="card-price">₹${formatINR(rec.price)}</div>
          <a href="/?add-to-cart=${escapeHtml(rec.product_id)}"
             class="card-cta">Add to Cart</a>
        </div>
      </div>`;

    return card;
  }

  function showTier2() {
    $("tier2-cards").style.display = "block";
    showMoreBtn.style.display = "none";
  }

  function showResults(data) {
    const a = outfitAnalysis || {};

    // ----- outfit detail card -----
    $("odc-type").textContent =
      `${capitalise(a.dominant_colour)} ${capitalise(a.outfit_type)}`.trim();

    // colour swatch from the dominant colour
    const colour = (a.dominant_colour || "").toLowerCase();
    $("odc-colour").style.background = COLOUR_MAP[colour] || "#C9A96E";

    $("odc-neckline").textContent = capitalise(a.neckline);
    $("odc-style"   ).textContent = capitalise(a.style_weight);
    $("odc-occasion").textContent = capitalise(a.occasion_confirmed);
    $("odc-vibe"    ).textContent = capitalise(a.western_or_ethnic);

    // accents — hide chip entirely if there are none
    if (a.colour_accents && a.colour_accents.length > 0) {
      $("odc-accents").textContent = a.colour_accents.map(capitalise).join(", ");
      $("odc-accents-wrap").style.display = "";
    } else {
      $("odc-accents-wrap").style.display = "none";
    }

    // stylist reading
    $("stylist-reading-text").textContent = data.stylist_reading || "";

    // recommendations
    const recs  = data.recommendations || [];
    const tier1 = recs.filter((r) => r.tier === 1);
    const tier2 = recs.filter((r) => r.tier === 2);

    $("results-count").textContent =
      `${recs.length} piece${recs.length === 1 ? "" : "s"} found for you`;

    const tier1Container = $("tier1-cards");
    const tier2Container = $("tier2-cards");
    tier1Container.innerHTML = "";
    tier2Container.innerHTML = "";

    tier1.forEach((rec) => tier1Container.appendChild(buildProductCard(rec)));
    tier2.forEach((rec) => tier2Container.appendChild(buildProductCard(rec)));

    if (tier2.length === 0) showMoreBtn.style.display = "none";

    // complete look — single element in the left column (CSS reorders it on mobile)
    const cl   = data.complete_look;
    const card = $("complete-look-card");
    if (cl && cl.suggested) {
      renderCompleteLook(card, cl, recs);
      card.hidden = false;
    } else {
      card.hidden = true;
    }
  }

  /* ---------------------------------------------------------
     Render the complete-look card into a given container.
     Used by showResults() to fill #complete-look-card.
     --------------------------------------------------------- */
  function renderCompleteLook(card, cl, recs) {
    card.querySelector(".cl-description").textContent = cl.look_description || "";

    const piecesContainer = card.querySelector(".cl-pieces");
    piecesContainer.innerHTML = "";

    (cl.pieces || []).forEach((pid) => {
      const product = recs.find((r) => r.product_id === pid);
      if (!product) return;

      const shortName = String(product.title || "").split("–")[0].trim();

      const thumb = document.createElement("div");
      thumb.className = "cl-product-thumb";
      thumb.innerHTML = `
        <a href="${escapeHtml(product.product_url)}" target="_blank" rel="noopener">
          <div class="cl-thumb-img-wrap">
            <img src="${escapeHtml(product.image_url)}"
                 alt="${escapeHtml(product.title)}"
                 class="cl-thumb-img">
          </div>
        </a>
        <div class="cl-thumb-name">${escapeHtml(shortName)}</div>
        <div class="cl-thumb-price">₹${formatINR(product.price)}</div>
        <a href="/?add-to-cart=${escapeHtml(product.product_id)}"
           class="cl-thumb-cart-btn">Add to Cart</a>`;

      // image error → fall back to a simple text pill
      const img = thumb.querySelector(".cl-thumb-img");
      img.onerror = () => {
        const pill = document.createElement("span");
        pill.className   = "cl-piece-pill";
        pill.textContent = shortName;
        thumb.replaceWith(pill);
      };

      piecesContainer.appendChild(thumb);
    });
  }
})();
