/* ══════════════════════════════════════════════════════════════════════
   FOREVERPRINT — MEASUREMENT & CONSENT
   ══════════════════════════════════════════════════════════════════════
   One file, loaded on every page. It does four jobs:

     1. Consent Mode v2 — tells Google what it may and may not do BEFORE
        any tag loads. Google enforces this for UK/EEA advertisers: get it
        wrong and conversions, remarketing and Smart Bidding go dark with
        no error message anywhere.
     2. The cookie banner the customer actually answers.
     3. The Google tag (GA4 + Google Ads), loaded only once we have IDs.
     4. Click-ID capture — gclid/gbraid/wbraid and utm_*, so we can tie an
        order back to the ad that earned it. Captured on the landing page,
        carried through to checkout, stored against the order.

   Nothing here fires until the IDs below are filled in, so this file is
   safe to ship before the Google accounts exist.

   Why a file and not Google Tag Manager: this is versioned in git, it can
   be read and debugged like the rest of the site, and there is no second
   interface that can silently disagree with the code. If an agency ever
   needs GTM, it can be added on top without unpicking this.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── CONFIG ───────────────────────────────────────────────────────────
  // Fill these in once the Google accounts exist. Until then the tag never
  // loads — but consent and click-ID capture still work, so no ad click is
  // ever lost while we are waiting.
  var CONFIG = {
    ga4Id:            'G-5SNC87QRQ1',   // GA4 measurement ID (Foreverprint website stream)
    adsId:            'AW-18457098398',   // Google Ads conversion ID (account 972-711-7378)
    purchaseLabel:    '9hBCCKKe4_ocEJ7xg-FE',   // "Purchase" conversion action
    // Value reported to Google. While the business is NOT VAT registered the
    // whole amount charged is revenue, so we report the total paid. When VAT
    // registration happens this becomes the ex-VAT figure — see VAT_REGISTERED
    // in upload-and-print.html.
    reportExVat:      false,
  };

  var CONSENT_COOKIE = 'fp_consent';
  var CONSENT_DAYS   = 182;          // six months, then we ask again
  var ATTR_FIRST_KEY = 'fp_attr_first';
  var ATTR_LAST_KEY  = 'fp_attr_last';
  var ATTR_DAYS      = 90;           // Google's own click lookback for search
  var FIRED_KEY      = 'fp_conversions_fired';

  // ── SMALL HELPERS ────────────────────────────────────────────────────
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }
  function writeCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax' +
      (location.protocol === 'https:' ? ';Secure' : '');
  }
  // Storage throws in private windows and when site data is blocked. Every
  // read and write is wrapped: measurement must never break the shop.
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  // ── CONSENT STATE ────────────────────────────────────────────────────
  // 'granted'  — everything on
  // 'denied'   — analytics and advertising storage off; the site still works
  // null       — not asked yet
  function consentState() {
    var raw = readCookie(CONSENT_COOKIE);
    if (raw === 'granted' || raw === 'denied') return raw;
    return null;
  }

  // ── 1. CONSENT MODE v2 DEFAULTS ──────────────────────────────────────
  // This MUST run before the Google tag loads. Defaults are denied: until
  // somebody says otherwise, Google gets cookieless pings only.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var known = consentState();
  gtag('consent', 'default', {
    ad_storage:         'denied',
    ad_user_data:       'denied',
    ad_personalization: 'denied',
    analytics_storage:  'denied',
    functionality_storage: 'granted',  // remembering the basket is essential
    security_storage:      'granted',
    wait_for_update: 500
  });
  // Keeps the gclid on the URL between pages when storage is denied, so a
  // consented conversion later in the journey can still be attributed.
  gtag('set', 'url_passthrough', true);
  // Never send the full URL where it could carry personal data.
  gtag('set', 'ads_data_redaction', true);

  if (known === 'granted') grantConsent(true);

  function grantConsent(silent) {
    gtag('consent', 'update', {
      ad_storage:         'granted',
      ad_user_data:       'granted',
      ad_personalization: 'granted',
      analytics_storage:  'granted'
    });
    writeCookie(CONSENT_COOKIE, 'granted', CONSENT_DAYS);
    if (!silent) { captureAttribution(); loadTag(); hideBanner(); }
    // Storage was denied when the tag first loaded, so ask it to send a page
    // view now that it may — otherwise this visit is missing from reporting.
    if (!silent && CONFIG.ga4Id) { try { gtag('event', 'page_view'); } catch (e) {} }
  }

  function denyConsent() {
    gtag('consent', 'update', {
      ad_storage:         'denied',
      ad_user_data:       'denied',
      ad_personalization: 'denied',
      analytics_storage:  'denied'
    });
    writeCookie(CONSENT_COOKIE, 'denied', CONSENT_DAYS);
    // Anything already captured under a previous 'yes' is removed.
    lsDel(ATTR_FIRST_KEY); lsDel(ATTR_LAST_KEY);
    hideBanner();
  }

  // ── 2. CLICK-ID / SOURCE CAPTURE ─────────────────────────────────────
  // Stored only with consent — a click ID is advertising measurement, not a
  // necessary cookie. Without consent it lives for this page only and is
  // never written down or sent anywhere.
  var memoryAttr = null;

  function currentAttribution() {
    var p = new URLSearchParams(location.search);
    var out = {};
    ['gclid', 'gbraid', 'wbraid', 'msclkid'].forEach(function (k) {
      if (p.get(k)) out[k] = p.get(k);
    });
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
      if (p.get(k)) out[k] = p.get(k);
    });
    if (!Object.keys(out).length) {
      // No campaign markers. Record the referrer only if it is off-site, so
      // organic and direct visits can still be told apart later.
      var ref = document.referrer || '';
      if (ref && ref.indexOf(location.origin) !== 0) out.referrer = ref.slice(0, 300);
      if (!Object.keys(out).length) return null;
    }
    out.landing_page = (location.pathname + location.search).slice(0, 300);
    out.seen_at      = new Date().toISOString();
    return out;
  }

  function captureAttribution() {
    var now = currentAttribution();
    if (!now) return;
    memoryAttr = now;
    if (consentState() !== 'granted') return;   // in memory only
    var wrapped = JSON.stringify({ at: Date.now(), data: now });
    if (!readAttr(ATTR_FIRST_KEY)) lsSet(ATTR_FIRST_KEY, wrapped);  // first touch sticks
    lsSet(ATTR_LAST_KEY, wrapped);                                   // last touch wins
  }

  function readAttr(key) {
    var raw = lsGet(key);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || !o.at || (Date.now() - o.at) > ATTR_DAYS * 864e5) { lsDel(key); return null; }
      return o.data;
    } catch (e) { return null; }
  }

  // What checkout sends to the server. Null when there is nothing to report
  // or the customer said no.
  function attribution() {
    if (consentState() !== 'granted') return null;
    var last = readAttr(ATTR_LAST_KEY) || memoryAttr;
    var first = readAttr(ATTR_FIRST_KEY);
    if (!last && !first) return null;
    return { last: last || null, first: first || null };
  }

  // ── 3. THE GOOGLE TAG ────────────────────────────────────────────────
  var tagLoaded = false;
  function loadTag() {
    if (tagLoaded) return;
    var id = CONFIG.ga4Id || CONFIG.adsId;
    if (!id) return;                       // nothing configured yet — stay quiet
    tagLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    gtag('js', new Date());
    if (CONFIG.ga4Id) gtag('config', CONFIG.ga4Id);
    if (CONFIG.adsId) gtag('config', CONFIG.adsId, { allow_enhanced_conversions: true });
  }

  // ── 4. EVENTS ────────────────────────────────────────────────────────
  function track(name, params) {
    if (!tagLoaded) return;
    try { gtag('event', name, params || {}); } catch (e) {}
  }

  // A purchase must be counted once. Stripe returns the customer to a URL
  // they can refresh, bookmark or reopen — without a guard that is two or
  // three sales in the reporting and a bid that is wrong for a month.
  function alreadyFired(ref) {
    try {
      var list = JSON.parse(lsGet(FIRED_KEY) || '[]');
      return list.indexOf(ref) > -1;
    } catch (e) { return false; }
  }
  function markFired(ref) {
    try {
      var list = JSON.parse(lsGet(FIRED_KEY) || '[]');
      list.push(ref);
      lsSet(FIRED_KEY, JSON.stringify(list.slice(-50)));
    } catch (e) {}
  }

  // order: { ref, total, items[], email, phone, name, address }
  function purchase(order) {
    if (!order || !order.ref || alreadyFired(order.ref)) return;
    markFired(order.ref);
    if (!tagLoaded) return;

    var value = Number(order.total) || 0;
    if (CONFIG.reportExVat) value = value / 1.2;
    value = Math.round(value * 100) / 100;

    // Enhanced conversions: gtag hashes these in the browser before they
    // leave. It recovers conversions that cookie loss would otherwise hide.
    if (order.email) {
      var ud = { email: String(order.email).trim().toLowerCase() };
      if (order.phone) ud.phone_number = String(order.phone).replace(/[^0-9+]/g, '');
      if (order.name) {
        var parts = String(order.name).trim().split(/\s+/);
        ud.address = {
          first_name: parts[0] || '',
          last_name:  parts.slice(1).join(' ') || '',
          country:    'GB'
        };
        if (order.postcode) ud.address.postal_code = order.postcode;
      }
      try { gtag('set', 'user_data', ud); } catch (e) {}
    }

    // GA4 — the ecommerce report
    track('purchase', {
      transaction_id: order.ref,
      value: value,
      currency: 'GBP',
      items: (order.items || []).map(function (i, n) {
        return {
          item_id:   i.productSlug || i.size || ('item-' + (n + 1)),
          item_name: i.name || 'Print order',
          price:     Number(i.total) || 0,
          quantity:  Number(i.qty) || 1
        };
      })
    });

    // Google Ads — the conversion that bidding will eventually run on
    if (CONFIG.adsId && CONFIG.purchaseLabel) {
      track('conversion', {
        send_to: CONFIG.adsId + '/' + CONFIG.purchaseLabel,
        transaction_id: order.ref,
        value: value,
        currency: 'GBP'
      });
    }
  }

  // ── 5. THE BANNER ────────────────────────────────────────────────────
  function bannerHtml() {
    return '' +
    '<div id="fp-consent" role="dialog" aria-live="polite" aria-label="Cookie choices" style="' +
      'position:fixed;left:0;right:0;bottom:0;z-index:9000;background:#FFFDFA;' +
      'border-top:1px solid #E8DDD8;box-shadow:0 -8px 30px rgba(61,46,36,.10);' +
      'padding:18px 22px;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">' +
      '<div style="max-width:980px;margin:0 auto;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:260px;font-size:13px;line-height:1.7;color:#5C4A3D;">' +
          '<strong style="color:#3D2E24;font-weight:500;">A quick word about cookies.</strong> ' +
          'We use them to see which parts of the site people find useful, and to know when an ' +
          'advert we have paid for actually helped someone. Say no and the site works exactly the same. ' +
          '<a href="/privacy" style="color:#B8976A;">More in our privacy policy</a>.' +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button type="button" id="fp-consent-no" style="' +
            'padding:11px 22px;border-radius:60px;border:1px solid #E8DDD8;background:transparent;' +
            'color:#5C4A3D;font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;">No thanks</button>' +
          '<button type="button" id="fp-consent-yes" style="' +
            'padding:11px 22px;border-radius:60px;border:1px solid #B8976A;background:#B8976A;' +
            'color:#fff;font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;">That\'s fine</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function showBanner() {
    if (document.getElementById('fp-consent')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = bannerHtml();
    document.body.appendChild(wrap.firstChild);
    document.getElementById('fp-consent-yes').onclick = function () { grantConsent(false); };
    document.getElementById('fp-consent-no').onclick  = function () { denyConsent(); };
  }
  function hideBanner() {
    var el = document.getElementById('fp-consent');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ── START ────────────────────────────────────────────────────────────
  function start() {
    captureAttribution();          // memory always; storage only with consent
    // Advanced Consent Mode: the tag loads for everyone, but the denied
    // defaults set above mean it stores nothing and sends no identifying
    // data until the visitor agrees. Two reasons this beats withholding the
    // tag entirely: Google can verify the tag exists (it cannot accept a
    // cookie banner), and cookieless pings let Google model the conversions
    // of people who declined — typically a fifth of them, which we would
    // otherwise bid blind without.
    loadTag();
    if (consentState() === null) showBanner();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────
  window.fpAnalytics = {
    track:        track,
    purchase:     purchase,
    attribution:  attribution,
    consentState: consentState,
    openConsent:  function () { hideBanner(); showBanner(); },   // footer link
    configured:   function () { return !!(CONFIG.ga4Id || CONFIG.adsId); }
  };
})();
