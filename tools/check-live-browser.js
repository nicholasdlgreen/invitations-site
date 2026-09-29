// The half of the daily check that only a browser can do.
//
// tools/check-live.py reads the data a customer would be served. It cannot see
// what the page then does with it — and the fault that hid Luxury and Eco for
// five days was exactly that: the data was correct and arrived late, the step
// drew without it and latched. Nothing readable over HTTP was wrong.
//
// Paste this into the browser console (or the Browser pane) on a LIVE page and
// call FP.check(). It asserts about the page as rendered, and returns a report.
// Deterministic and version-controlled, so it can be driven by Playwright later
// rather than improvised each time.
//
//   1. Open  /upload-and-print.html?product=<slug>&source=design-studio
//      after putting a design in sessionStorage (FP.fakeDesign(slug) does it),
//      with the cache disabled — the fault only appears on a cold load.
//   2. Run FP.check({ slug:'<slug>', ranges:['signature','luxury','kinder'] })
//      with the ranges tools/check-live.py reported for that product.
window.FP = (function () {
  var out;
  function ok(cond, what, detail) {
    out.checks++;
    if (!cond) out.fails.push(what + (detail ? ' — ' + detail : ''));
  }

  // Arriving from the design studio is its own code path, and the only one the
  // race showed up on. This puts the page into it without generating a design.
  function fakeDesign(slug) {
    sessionStorage.setItem('foreverprint_design', JSON.stringify({
      source: 'ai-studio', templateName: 'Daily check', templateId: 'check-' + Date.now(),
      size: 'A5', productSlug: slug, thumbnail: null, text: { name1: 'Check' },
      // The page will not move past the upload step without artwork, so a
      // design with none never reaches step 3 and every assertion below would
      // blame the ranges for a page that simply had not got there.
      artworkUrl: 'https://jvcpzmumkyjdyibmwlsd.supabase.co/storage/v1/object/public/artwork/daily-check.png'
    }));
    return 'set — now load /upload-and-print.html?product=' + slug + '&source=design-studio';
  }

  function settled(ms) {
    return new Promise(function (res) { setTimeout(res, ms || 4000); });
  }

  async function check(expect) {
    out = { slug: (expect && expect.slug) || '?', checks: 0, fails: [] };
    await settled(expect && expect.wait);

    var mount = document.getElementById('step3Mount');
    ok(!!mount, 'the order step is on the page');
    if (!mount) return out;

    var text = mount.innerText || '';
    if (!text.length) {
      // Distinguish "the ranges are missing" from "we never got to the step".
      // Reporting five range failures for a page still sitting on the upload
      // step sends someone looking in entirely the wrong place.
      var onStep = (document.querySelector('#step1') || {}).offsetParent ? 'step 1' : 'an earlier step';
      ok(false, 'the order step was reached',
         'the page is still on ' + onStep + ' — check the fake design has artwork');
      out.passed = false;
      return out;
    }

    // The ranges, by the names the customer reads.
    var LABEL = { signature: 'Signature', luxury: 'Luxury', kinder: 'Eco' };
    var want = (expect && expect.ranges) || [];
    // A product genuinely sold on one stock has no range choice, and that is
    // correct — so only assert the heading when more than one range exists.
    if (want.length > 1) {
      ok(/Choose your range/i.test(text), 'the range step is offered',
         'the step went straight to paper, so the other ranges are unreachable');
    }
    want.forEach(function (r) {
      ok(text.indexOf(LABEL[r]) > -1, 'the ' + LABEL[r] + ' range is shown',
         'it is in the data but not on the page');
    });

    // Nothing may be priced at nothing, or at NaN.
    ok(!/£\s*NaN|£\s*0\.00\b/.test(text), 'no broken price on the step',
       (text.match(/£\s*(NaN|0\.00)/) || [''])[0]);

    // A template that reached the customer unfilled.
    ok(!/\{\w+\}/.test(document.body.innerText), 'no raw placeholder anywhere on the page',
       (document.body.innerText.match(/\{\w+\}/) || [''])[0]);

    // The page's own view of the catalogue, which is what the step renders from.
    if (typeof CONFIG !== 'undefined' && typeof PAPER_TIER === 'function'
        && typeof step3Papers === 'function') {
      var seen = {};
      step3Papers().forEach(function (p) { seen[PAPER_TIER(p.name)] = 1; });
      want.forEach(function (r) {
        ok(!!seen[r], 'the page resolves the ' + LABEL[r] + ' range',
           'PAPER_TIER put nothing in it — the catalogue was late');
      });
      ok((CONFIG.papers || []).length > 0, 'the page has a paper catalogue', '');
    }

    out.passed = out.fails.length === 0;
    return out;
  }

  // The studio's own step 3, checked the same way.
  async function checkStudio(expect) {
    out = { slug: (expect && expect.slug) || '?', checks: 0, fails: [] };
    await settled(expect && expect.wait);
    ['colour', 'medium', 'era', 'layout', 'motif', 'mood'].forEach(function (cat) {
      var g = document.querySelector('.ds-chips[data-group="' + cat + '"]');
      ok(g && g.children.length > 0, 'the studio has a ' + cat + ' box',
         'it would be drawn empty or hidden');
    });
    ['medium', 'era', 'layout'].forEach(function (cat) {
      var g = document.querySelector('.ds-chips[data-group="' + cat + '"]');
      ok(g && g.dataset.single === '1', cat + ' is still pick-one',
         'two answers could contradict each other in one brief');
    });
    var brief = document.getElementById('ds-brief-text');
    ok(brief && !/\{\w+\}/.test(brief.textContent), 'the brief has no unfilled slot',
       brief ? brief.textContent.slice(0, 80) : 'no brief');
    out.passed = out.fails.length === 0;
    return out;
  }

  return { check: check, checkStudio: checkStudio, fakeDesign: fakeDesign };
})();
