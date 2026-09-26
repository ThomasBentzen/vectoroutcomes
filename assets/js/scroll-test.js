/**
 * TEMPORARY scroll test. Remove this file and its <script> tag in index.html.
 * - Orange progress bar at the top that fills as the page scrolls
 * - Status badge (bottom left) showing whether interactions.js is running,
 *   the reduced motion setting as the browser reports it, and the live
 *   offset of the instrument strip parallax
 */
(function () {
  'use strict';

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;height:5px;width:100%;background:#F0A04B;' +
    'transform-origin:0 50%;transform:scaleX(0);z-index:1000;pointer-events:none';

  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:1000;padding:8px 12px;border-radius:10px;' +
    'background:#F0A04B;color:#0B2545;font:600 12px/1.4 -apple-system,system-ui,sans-serif;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;max-width:calc(100vw - 24px)';

  document.body.append(bar, badge);

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const strip = document.querySelector('.instrument-line');
  let ticking = false;

  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${progress})`;

    const match = strip && /,\s*(-?[\d.]+)px/.exec(strip.style.transform);
    badge.textContent =
      `Scroll test · ${Math.round(progress * 100)}% · ` +
      `interactions.js: ${window.VectorOutcomes ? 'running' : 'NOT loaded'} · ` +
      `reduced motion: ${reduced ? 'ON' : 'off'} · ` +
      `strip offset: ${match ? Math.round(parseFloat(match[1])) + 'px' : 'none'}`;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();
