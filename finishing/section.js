// "Finishing touches" — one block. Foil shown as colour, everything else said
// in words.
//
// No invitation, no monogram, no printed ground. Earlier versions built a fake
// card and pressed fake foil into fake type; that was three pretences stacked
// on each other and it read that way.
//
// One file, loaded by every product landing page. It draws only what the
// product offers AND what its papers can physically take, both supplied by the
// host page, so it cannot promise a finish the printer would refuse.
(function (global) {
  'use strict';

  // THE EIGHT FOILS, AND WHY THIS IS A COPY
  //
  // These are character-for-character the colours in step3/step3.js, which is
  // what the customer sees at the order step. They are duplicated rather than
  // shared because the two files are loaded by different pages — section.js by
  // 24 landing pages, step3.js by the order page alone — and a shared file
  // would mean a script tag on all 25 and regenerating every landing page from
  // Supabase, which is a great deal of risk for a swatch.
  //
  // The copy is held honest by tools/test-foil-swatches.js, which fails if the
  // two sets ever differ. That matters: this file knew only gold, silver and
  // rose until 3 October, so Copper, Red, Blue, Green and Holographic all drew
  // as GOLD on every landing page — five of the eight colours we sell, wrong,
  // for as long as step3.js had been right.
  function metal(a, b, c, d) {
    return 'background:'
      + 'radial-gradient(circle at 33% 25%,rgba(255,255,255,.96) 0%,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 52%),'
      + 'linear-gradient(145deg,' + a + ' 0%,' + b + ' 26%,' + c + ' 48%,' + b + ' 64%,' + d + ' 100%)';
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // "Silk, Uncoated and Gloss", not "Silk and Uncoated and Gloss".
  function listOf(a) {
    if (a.length <= 1) return a[0] || '';
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  function foilOf(name) {
    var o = String(name).toLowerCase();
    if (/rose/.test(o))   return metal('#8E5745', '#F6D6C6', '#D08E74', '#7E4A39');
    if (/silver/.test(o)) return metal('#6F757D', '#FBFCFD', '#C3C9D0', '#666C74');
    if (/copper/.test(o)) return metal('#6F3317', '#F4C9A4', '#C0713F', '#5E2B12');
    if (/red/.test(o))    return metal('#6E101B', '#F8B9BF', '#C32C3B', '#5C0C16');
    if (/blue/.test(o))   return metal('#0F2F57', '#BFD9F7', '#2A6CB4', '#0B2446');
    if (/green/.test(o))  return metal('#114027', '#C2E8CF', '#2B8955', '#0D3320');
    // Holographic is not one metal. It is a sheen that changes with the angle,
    // so a single linear ramp reads as a flat colour and lies about what
    // arrives. The hue sweep is the honest picture of it.
    if (/holo/.test(o))
      return 'background:'
        + 'radial-gradient(circle at 33% 25%,rgba(255,255,255,.92) 0%,rgba(255,255,255,.30) 28%,rgba(255,255,255,0) 54%),'
        + 'conic-gradient(from 210deg,#8FD9E8,#C7A8E8,#F2A8C4,#F6D79B,#BFE8A8,#8FD9E8)';
    return metal('#7E6018', '#FBEFC2', '#CBA52B', '#6E5414');
  }

  // Foiling leads: it is the one people come for and the only finish with real
  // colour. The database orders lamination first for the order step; sorting
  // here leaves that data alone.
  var FIRST = ['foiling', 'lamination'];

  // opts: { url, key, allowed:[type names this product offers],
  //         papers:[stocks that can take finishing] }
  async function mount(el, opts) {
    if (!el) return;
    var all = [];
    try {
      // active=eq.true, which the order page has always had and this did not.
      // Retiring a finish by marking it inactive would therefore have taken it
      // out of the order step and left it advertised on every landing page —
      // the shop refusing to sell a thing the page beside it still offers.
      // Found on 3 October while withdrawing Spot UV, which was deleted
      // outright and so never exposed it.
      var r = await fetch(opts.url + '/rest/v1/finish_types'
        + '?select=name,description,options&active=eq.true&order=display_order',
        { headers: { apikey: opts.key, Authorization: 'Bearer ' + opts.key } });
      if (r.ok) all = await r.json();
    } catch (e) { /* the section hides itself below if nothing arrives */ }

    var allowed = (opts.allowed || []).map(function (x) { return String(x).toLowerCase().trim(); });
    var types = all
      .filter(function (t) { return !allowed.length || allowed.indexOf(t.name.toLowerCase().trim()) >= 0; })
      .filter(function (t) {
        return (t.options || []).some(function (o) { return o.name && o.name.toLowerCase() !== 'none'; });
      })
      .sort(function (a, b) {
        var ia = FIRST.indexOf(a.name.toLowerCase().trim());
        var ib = FIRST.indexOf(b.name.toLowerCase().trim());
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    if (!types.length) { var s = el.closest('section'); if (s) s.style.display = 'none'; return; }

    // "Matt, Gloss or Soft Touch" — an Oxford-free list, because these are read
    // as a set of choices rather than as a sentence.
    function listOptions(names) {
      if (!names.length) return '';
      if (names.length === 1) return '<b>' + esc(names[0]) + '</b>';
      return names.slice(0, -1).map(function (n) { return '<b>' + esc(n) + '</b>'; }).join(', ')
        + ' or <b>' + esc(names[names.length - 1]) + '</b>';
    }

    function realOptions(t) {
      return (t.options || []).filter(function (o) {
        return o.name && o.name.toLowerCase() !== 'none';
      });
    }

    // Foiling is the only finish with anything to look at, so it keeps its
    // swatches. Everything else became a heading, a description and a grid —
    // three stacked mini-sections for what is really one line of specification
    // each, and the grid left holes when a finish had two options and the row
    // had three columns.
    //
    // Each of those is now a single row: the finish on the left, what you can
    // have and what it is on the right. It holds its shape whether a product
    // offers two of them or five, which the grid did not.
    var foilTypes  = types.filter(function (t) { return /foil/i.test(t.name); });
    var plainTypes = types.filter(function (t) { return !/foil/i.test(t.name); });

    var foilHtml = foilTypes.map(function (t) {
      var opts2 = realOptions(t);
      return '<div class="fs-group"><div class="fs-gname">' + esc(t.name) + '</div>'
        + '<div class="fs-gdesc">' + esc(t.description || '') + '</div>'
        + '<div class="fs-row is-foil">' + opts2.map(function (o) {
            return '<div class="fs-o">'
              + '<span class="fs-sw" style="' + foilOf(o.name) + '"></span>'
              + '<span class="fs-n">' + esc(o.name) + ' foil</span></div>';
          }).join('') + '</div></div>';
    }).join('');

    var plainHtml = plainTypes.length
      ? '<div class="fs-lines">' + plainTypes.map(function (t) {
          var opts2 = realOptions(t);
          // A type whose single option only repeats its own name has nothing to
          // add — "Protective finish: Add Protective finish" read twice. Its
          // description says it on its own.
          var bare = opts2.length === 1
            && opts2[0].name.replace(/^Add\s+/i, '').toLowerCase() === t.name.toLowerCase();
          var names = bare ? [] : opts2.map(function (o) {
            return o.name.replace(/^Add\s+/i, '');
          });
          var choices = listOptions(names);
          var what = t.description
            ? '<span class="fs-what">' + esc(t.description) + '</span>' : '';
          return '<div class="fs-ln"><div class="fs-lbl">' + esc(t.name) + '</div>'
            + '<div class="fs-opts">' + choices + (choices && what ? ' ' : '') + what + '</div></div>';
        }).join('') + '</div>'
      : '';

    el.innerHTML = foilHtml + plainHtml
    + (opts.papers && opts.papers.length
        ? '<p class="fs-note">Available on ' + esc(listOf(opts.papers))
          + '. Chosen when you personalise your design, and charged once for the order rather '
          + 'than per card.</p>'
        : '');
  }

  global.FinishSection = { mount: mount };
})(window);
