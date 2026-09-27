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
 *   D. Scroll reveal             initScrollReveal / revealAll
 *   E. Initialisation            initInteractions (runs after DOMContentLoaded)
 *
 * Expected markup (class names are the contract with the HTML):
 *   .site-header                        sticky header, used for scroll offset
 *   .instrument-line > .instrument-item cockpit readout strip
 *   svg.vector-arrow .vector-arrow-path the signature arrow, drawn tail to tip
 *   a[href^="#"]                        any in-page link (nav, CTAs, cues)
 *   [data-scroll-anchor]                optional, direct child of a section: align
 *                                       this element's content instead of the section's
 *   .reveal / .draw-line / .is-visible  scroll reveal states, styled in index.html
 *
 * The hero artificial horizon (.hero-art) is deliberately never scripted:
 * it always shows straight and level flight.
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
      speedY: 0.25,      // Fraction of scroll distance applied to the strip
      maxY: 96,          // Clamp in px. Also capped by the strip's bottom padding, so it never overlaps the next section
      driftX: 4,         // Max horizontal drift in px. Keep tiny for legibility
      driftPeriod: 600   // Scroll px per drift cycle. Larger = slower sway
    },
    reveal: {
      selector: [
        '.section-head', '#certifications .stack', '.split > *', '.laws > div',
        '.cards > .card', '.phases > div', '.blueprint-main > *', '.badge-wrap', '#testimonials .eyebrow',
        '.featured', '.quotes > .card', '.about-media', '.about > .stack',
        '.facts > div', '.chips > span', '.contact > :not(.btn)'
      ].join(','),
      lineSelector: '.laws > div, .phases > div, .facts > div, .about', // Top borders that draw left to right
      stagger: 90,       // ms between siblings revealed together
      maxStagger: 6,     // Siblings after this share the last delay, so long groups don't drag
      rootMargin: '0px 0px -12% 0px' // Reveal once an element is ~12% above the bottom of the screen
    },
    arrow: {
      duration: 1000,          // Draw duration in ms (800 to 1200 recommended)
      rootMargin: '0px 0px -35% 0px' // Trigger when the arrow is ~35% up from the bottom of the screen
    },
    scroll: {
      minDuration: 400,  // ms, short hops
      maxDuration: 900,  // ms, long journeys are capped here
      msPerPx: 0.45,     // Duration grows with distance until the cap
      extraOffset: 24    // Gap between the sticky header and the section's first content, in px
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
    // Never travel further than the strip's own bottom padding
    const maxY = () => Math.max(0, Math.min(cfg.maxY, (parseFloat(getComputedStyle(line).paddingBottom) || 0) - 8));
    let limitY = maxY();
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
      const ty = clamp(delta * cfg.speedY, 0, limitY);
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
    const onResize = () => { restTop = homeTop() + (window.scrollY || 0); limitY = maxY(); onScroll(); };
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

    // Opening a shared link such as /#about: once layout and images have
    // settled, correct the browser's native jump to the same content position
    if (location.hash.length > 1) {
      window.addEventListener('load', () => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) jumpTo(getTargetY(target));
      }, { once: true });
    }
  }

  function getHeaderOffset() {
    const header = document.querySelector('.site-header');
    const height = header ? header.getBoundingClientRect().height : 0;
    return height + CONFIG.scroll.extraOffset;
  }

  // Where the page should rest so the target's content, not its top padding,
  // sits just below the sticky header
  function getTargetY(target) {
    // Direct children only, so a wrapper like <main id="top"> doesn't pick up a nested section's anchor
    const anchor = target.querySelector(':scope > [data-scroll-anchor]') || target;
    const paddingTop = parseFloat(getComputedStyle(anchor).paddingTop) || 0;
    const y = anchor.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) + paddingTop - getHeaderOffset();
    return clamp(y, 0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function jumpTo(y) {
    try { window.scrollTo({ top: y, behavior: 'instant' }); }
    catch (e) { window.scrollTo(0, y); }
  }

  function smoothScrollTo(target) {
    if (cancelActiveScroll) cancelActiveScroll();

    const startY = window.scrollY || window.pageYOffset;
    const targetY = getTargetY(target);
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
   * D. SCROLL REVEAL
   * Content fades in and rises as it enters the viewport, and divider
   * lines draw left to right. Classes are only added here, so without
   * JavaScript or with reduced motion the page renders fully visible.
   * ================================================================ */
  let revealObserver = null;

  function initScrollReveal() {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const cfg = CONFIG.reveal;
    const items = Array.from(document.querySelectorAll(cfg.selector));
    const lines = Array.from(document.querySelectorAll(cfg.lineSelector));
    if (!items.length && !lines.length) return;

    // Stagger siblings that share a parent, in document order
    const counts = new Map();
    items.forEach((el) => {
      const i = counts.get(el.parentElement) || 0;
      counts.set(el.parentElement, i + 1);
      el.style.setProperty('--reveal-delay', `${Math.min(i, cfg.maxStagger) * cfg.stagger}ms`);
      el.classList.add('reveal');
    });

    // Redraw each top border as a pseudo-element in the same colour and width
    lines.forEach((el) => {
      const cs = getComputedStyle(el);
      el.style.setProperty('--line-color', cs.borderTopColor);
      el.style.setProperty('--line-width', cs.borderTopWidth);
      el.classList.add('draw-line');
    });

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target); // Reveal once
      });
    }, { rootMargin: cfg.rootMargin, threshold: 0 });

    new Set([...items, ...lines]).forEach((el) => revealObserver.observe(el));
  }

  function revealAll() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = null;
    document.querySelectorAll('.reveal, .draw-line').forEach((el) => el.classList.add('is-visible'));
  }

  /* ================================================================
   * E. INITIALISATION
   * ================================================================ */
  function initInteractions() {
    initInstrumentParallax();
    initVectorArrowAnimation();
    initSmoothScroll();
    initScrollReveal();
  }

  // If the visitor toggles reduced motion while on the page, follow it
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', () => {
      if (prefersReducedMotion()) { destroyInstrumentParallax(); revealAll(); }
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
    initSmoothScroll,
    initScrollReveal,
    revealAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractions);
  } else {
    initInteractions();
  }
})();
