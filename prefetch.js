/*!
 * Foreverprint prefetch.js
 * ------------------------------------------------------------
 * Speeds up perceived navigation by prefetching pages before
 * the user clicks. Two strategies running together:
 *
 *  1. EAGER: shortly after the page settles, prefetch a small
 *     list of high-traffic pages (home, products, etc).
 *  2. HOVER/FOCUS: when the user hovers over (or keyboard-focuses)
 *     an internal link, prefetch its destination so the click is
 *     near-instant.
 *
 * Safe defaults:
 *  - Skips on slow connections (2G, save-data mode)
 *  - Same-origin only — never prefetches external URLs
 *  - Dedupes via in-memory Set
 *  - Uses requestIdleCallback so it never competes with the
 *    initial page render
 *
 * To change the eager list, edit EAGER_PAGES below.
 * ------------------------------------------------------------
 */
(function () {
  'use strict';

  // ── 1. Skip if the user is on a slow connection or asked us not to ──
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    if (conn.saveData) return;
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return;
  }

  // ── 2. Pages to prefetch eagerly on every page load ──
  // These are the highest-traffic landing/conversion pages. Edit freely.
  var EAGER_PAGES = [
    '/',
    '/products.html',
    '/wedding-invitations.html',
    '/upload-and-print.html',
    '/design-studio.html',
    '/how-it-works.html'
  ];

  // ── 3. Dedupe set so we never prefetch the same URL twice ──
  var prefetched = new Set();
  // Don't prefetch the page the user is currently on
  prefetched.add(location.pathname);
  prefetched.add(location.pathname.replace(/\.html$/, ''));

  function prefetch(url) {
    if (!url) return;
    // Resolve to absolute pathname for dedupe
    var resolved;
    try {
      resolved = new URL(url, location.href);
    } catch (e) { return; }
    // Same-origin only
    if (resolved.origin !== location.origin) return;
    var key = resolved.pathname;
    if (prefetched.has(key)) return;
    prefetched.add(key);

    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = resolved.href;
    link.as = 'document';
    // Append silently — browsers handle this without affecting layout
    document.head.appendChild(link);
  }

  // ── 4. Strategy 1: eager prefetch of common pages ──
  function runEagerPrefetch() {
    for (var i = 0; i < EAGER_PAGES.length; i++) {
      prefetch(EAGER_PAGES[i]);
    }
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(runEagerPrefetch, { timeout: 2000 });
  } else {
    setTimeout(runEagerPrefetch, 1500);
  }

  // ── 5. Strategy 2: prefetch on hover/focus ──
  // Using mouseover (which bubbles) + focusin (keyboard nav).
  // The handler walks up to the nearest <a> ancestor and prefetches
  // its href if it's same-origin.
  function handleEnter(e) {
    var target = e.target;
    // Bail early if target isn't an element (mouseover can fire on text nodes)
    if (!target || target.nodeType !== 1) return;
    var a = target.closest && target.closest('a[href]');
    if (!a) return;
    // Skip download links, mailto:, tel:, anchor-only links
    if (a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    prefetch(a.href);
  }
  document.addEventListener('mouseover', handleEnter, { passive: true, capture: true });
  document.addEventListener('focusin', handleEnter, { passive: true });
})();
