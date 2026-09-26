/**
 * Vector Outcomes · Front end interactions
 * ------------------------------------------------------------------
 * Vanilla JS, no dependencies. Safe to drop into a static site
 * (GitHub Pages, Netlify, etc.) with a single <script> tag:
 *
 *   <script src="vector-outcomes-interactions.js" defer><\/script>
 *   (Written with an escaped slash so this file can also be inlined safely.)
 *
 * Contents
 *   0. CONFIG and helpers       (tune speeds, easing and offsets here)
 *   A. Instrument line parallax  initInstrumentParallax / destroyInstrumentParallax
 *   B. Vector arrow draw-in      initVectorArrowAnimation
 *   C. Smooth in-page scrolling  initSmoothScroll
 *   D. Initialisation            initInteractions (runs after DOMContentLoaded)
 *
 * Expected markup (class names are the contract with the HTML):
 *   .site-header                        sticky header, used for scroll offset
 *   .instrument-line > .instrument-item cockpit readout strip
 *   svg.vector-arrow .vector-arrow-path the signature arrow, drawn tail to tip
 *   a[href^="#"]                        any in-page link (nav, CTAs, cues)
 *
 * Every interaction respects prefers-reduced-motion: with it enabled,
 * elements render in their final, static state and links jump directly.
 */
(function () {
  'use strict';

  /* ================================================================
   * 0. CONFIG AND HELPERS
   * ================================================================ */
  const CONFIG = {
    parallax: {
      speedY: 0.35,      // Fraction of scroll distance applied to the strip (0.3 to 0.4 feels subtle)
      maxY: 48,          // Clamp in px, so the strip never drifts far from its home position
      driftX: 3,         // Max horizontal drift in px. Keep tiny for legibility
      driftPeriod: 600   // Scroll px per drift cycle. Larger = slower sway
    },
    arrow: {
      duration: 1000,          // Draw duration in ms (800 to 1200 recommended)
      rootMargin: '0px 0px -35% 0px' // Trigger when the arrow is ~35% up from the bottom of the screen
    },
    scroll: {
      minDuration: 400,  // ms, short hops
      maxDuration: 900,  // ms, long journeys are capped here
      msPerPx: 0.45,     // Duration grows with distance until the cap
      extraOffset: 16    // Breathing room below the sticky header, in px
    }
  };

  const reducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };
  const prefersReducedMotion = () => reducedMotionQuery.matches;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ================================================================
   * A. INSTRUMENT LINE PARALLAX
   * A glass-cockpit strip that trails the page scroll slightly,
   * giving a subtle sense of depth. Uses one passive scroll listener
   * that only schedules a requestAnimationFrame, and only writes
   * transform (no layout reads inside the frame).
   * ================================================================ */
  let parallaxState = null;

  function initInstrumentParallax() {
    destroyInstrumentParallax(); // Guard against double initialisation
    const line = document.querySelector('.instrument-line');
    if (!line || prefersReducedMotion()) return;

    const cfg = CONFIG.parallax;
    // Measure an untransformed neighbour, so reading position never
    // includes our own transform. Works whether the window or an inner
    // container is the thing that scrolls.
    const anchor = line.previousElementSibling || line.parentElement;
    let ticking = false;
    // Resting position in page coordinates, so the strip sits exactly
    // where the layout put it when the page is at the top
    const homeTop = () => anchor.getBoundingClientRect().bottom;
    let restTop = homeTop() + (window.scrollY || 0);

    const update = () => {
      ticking = false;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const home = homeTop();
      if (home < -vh || home > vh * 2) return; // Far off screen: skip work
      const delta = restTop - home; // Distance scrolled since rest, in px
      const ty = clamp(delta * cfg.speedY, 0, cfg.maxY);
      const tx = Math.sin(delta / cfg.driftPeriod * Math.PI * 2) * cfg.driftX;
      line.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    line.style.willChange = 'transform';
    // Capture phase on document also catches scrolling inside containers
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    const onResize = () => { restTop = homeTop() + (window.scrollY || 0); onScroll(); };
    window.addEventListener('resize', onResize, { passive: true });
    update();

    parallaxState = { line, onScroll, onResize };
  }

  function destroyInstrumentParallax() {
    if (!parallaxState) return;
    document.removeEventListener('scroll', parallaxState.onScroll, { capture: true });
    window.removeEventListener('resize', parallaxState.onResize);
    parallaxState.line.style.transform = '';
    parallaxState.line.style.willChange = '';
    parallaxState = null;
  }

  /* ================================================================
   * B. VECTOR ARROW DRAW-IN
   * The arrow is one continuous path (tail, tip, then arrowhead), so
   * animating stroke-dashoffset draws it from tail to tip in a single
   * stroke. Runs once, when the arrow first enters the viewport.
   * ================================================================ */
  function initVectorArrowAnimation() {
    const paths = document.querySelectorAll('.vector-arrow-path');
    if (!paths.length) return;

    paths.forEach((path) => {
      if (typeof path.getTotalLength !== 'function') return;

      // Reduced motion or no observer support: show the finished arrow
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        resetDash(path);
        return;
      }

      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = `${length}`; // Hidden until triggered

      const observer = new IntersectionObserver(
        (entries, obs) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          obs.disconnect(); // One-time animation
          drawPath(path, length);
        },
        { rootMargin: CONFIG.arrow.rootMargin, threshold: 0 }
      );
      observer.observe(path.closest('svg') || path);
    });
  }

  function drawPath(path, length) {
    const start = performance.now();
    const duration = CONFIG.arrow.duration;

    const frame = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      path.style.strokeDashoffset = String(length * (1 - easeOutCubic(t)));
      if (t < 1) requestAnimationFrame(frame);
      else resetDash(path); // Clean final state, crisp at any zoom level
    };
    requestAnimationFrame(frame);
  }

  function resetDash(path) {
    path.style.strokeDasharray = '';
    path.style.strokeDashoffset = '';
  }

  /* ================================================================
   * C. SMOOTH IN-PAGE SCROLLING
   * Intercepts same-page anchor links and eases the page to the
   * target with easeInOutCubic, accounting for the sticky header.
   * The user can interrupt at any time by wheel or touch.
   * ================================================================ */
  let activeFrame = null;
  let cancelActiveScroll = null;

  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((link) => {
      if (link.dataset.smoothScrollBound) return; // Avoid duplicate handlers
      link.dataset.smoothScrollBound = 'true';

      link.addEventListener('click', (event) => {
        const hash = link.getAttribute('href');
        if (!hash || hash.length < 2) return;
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (!target) return;

        event.preventDefault();
        smoothScrollTo(target);
        if (history.pushState) history.pushState(null, '', hash);
      });
    });
  }

  function getHeaderOffset() {
    const header = document.querySelector('.site-header');
    const height = header ? header.getBoundingClientRect().height : 0;
    return height + CONFIG.scroll.extraOffset;
  }

  function jumpTo(y) {
    try { window.scrollTo({ top: y, behavior: 'instant' }); }
    catch (e) { window.scrollTo(0, y); }
  }

  function smoothScrollTo(target) {
    if (cancelActiveScroll) cancelActiveScroll();

    const startY = window.scrollY || window.pageYOffset;
    const rawY = target.getBoundingClientRect().top + startY - getHeaderOffset();
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    const targetY = clamp(rawY, 0, maxY);
    const distance = targetY - startY;

    if (prefersReducedMotion() || Math.abs(distance) < 2) {
      jumpTo(targetY);
      moveFocus(target);
      return;
    }

    const cfg = CONFIG.scroll;
    const duration = clamp(Math.abs(distance) * cfg.msPerPx, cfg.minDuration, cfg.maxDuration);
    const start = performance.now();

    const stopListening = () => {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
      cancelActiveScroll = null;
    };
    const cancel = () => {
      if (activeFrame) cancelAnimationFrame(activeFrame);
      activeFrame = null;
      stopListening();
    };
    cancelActiveScroll = cancel;
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);

    const frame = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      jumpTo(startY + distance * easeInOutCubic(t));
      if (t < 1) {
        activeFrame = requestAnimationFrame(frame);
      } else {
        activeFrame = null;
        stopListening();
        moveFocus(target);
      }
    };
    activeFrame = requestAnimationFrame(frame);
  }

  // Move keyboard focus to the section for accessibility, without a second jump
  function moveFocus(target) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /* ================================================================
   * D. INITIALISATION
   * ================================================================ */
  function initInteractions() {
    initInstrumentParallax();
    initVectorArrowAnimation();
    initSmoothScroll();
  }

  // If the visitor toggles reduced motion while on the page, follow it
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', () => {
      if (prefersReducedMotion()) destroyInstrumentParallax();
      else initInstrumentParallax();
    });
  }

  // Expose for debugging or re-initialising after dynamic content loads
  window.VectorOutcomes = {
    CONFIG,
    initInteractions,
    initInstrumentParallax,
    destroyInstrumentParallax,
    initVectorArrowAnimation,
    initSmoothScroll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractions);
  } else {
    initInteractions();
  }
})();
