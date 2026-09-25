/* One place that turns a stored image URL into a resized, modern-format one.
 *
 * Product images are stored at 1600px because that is what the hero needs. Card
 * grids show them at under 300px, so a page of twenty cards was pulling well
 * over a megabyte to draw thumbnails — the Design Studio fetched 1,275KB of
 * images to fill cards 291px wide.
 *
 * Pages that write their cards in markup already route through Netlify's image
 * CDN. Pages that build cards in JavaScript could not, because the treatment
 * lived in the markup rather than anywhere shareable, and so each new runtime
 * grid arrived with the bug again. This is that shareable thing.
 *
 *   imgCdn('/wedding-invitations-hero.jpg', 600)
 *     → '/.netlify/images?url=%2Fwedding-invitations-hero.jpg&w=600&fm=webp&q=75'
 *
 * Left alone: anything already pointing at the CDN, anything off-site (the CDN
 * only serves this site's own files), and data: URIs. Those come back
 * untouched rather than turned into a broken link.
 */
(function (global) {
  'use strict';

  function imgCdn(url, width) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf('/.netlify/images') === 0) return url;   // already done
    if (/^(data:|blob:)/i.test(url)) return url;
    // Off-site, including our own Supabase storage, which the CDN cannot read.
    if (/^https?:\/\//i.test(url)) return url;
    var w = parseInt(width, 10) || 600;
    return '/.netlify/images?url=' + encodeURIComponent(url) +
           '&w=' + w + '&fm=webp&q=75';
  }

  // A srcset for a card, so a retina screen gets the sharper one and nobody
  // else pays for it.
  function imgCdnSet(url, width) {
    if (!url || imgCdn(url, width) === url) return '';
    var w = parseInt(width, 10) || 600;
    return imgCdn(url, w) + ' ' + w + 'w, ' + imgCdn(url, w * 2) + ' ' + (w * 2) + 'w';
  }

  global.imgCdn = imgCdn;
  global.imgCdnSet = imgCdnSet;
})(window);
