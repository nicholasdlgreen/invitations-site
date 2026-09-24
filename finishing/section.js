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

  // A smooth diagonal sheen: dark at the corners, bright through the middle.
  // Deliberately not a crumpled-foil texture — that read as tinfoil rather
  // than as a finish, which is the opposite of what this brand sells.
  function sheen(dark, mid, bright) {
    return 'linear-gradient(135deg,' + dark + ' 0%,' + mid + ' 32%,' + bright + ' 50%,'
         + mid + ' 68%,' + dark + ' 100%)';
  }
  var FOIL = {
    gold:   sheen('#8A6A1C', '#C9A536', '#FBF0C8'),
    silver: sheen('#767C84', '#BFC5CC', '#FBFCFD'),
    rose:   sheen('#A66B55', '#D08E74', '#F8DDD0')
  };

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
    if (o.indexOf('rose') >= 0)   return FOIL.rose;
    if (o.indexOf('silver') >= 0) return FOIL.silver;
    return FOIL.gold;
  }

  // Foiling leads: it is the one people come for and the only finish with real
  // colour. The database orders lamination first for the order step; sorting
  // here leaves that data alone.
  var FIRST = ['foiling', 'lamination', 'spot uv'];

  // opts: { url, key, allowed:[type names this product offers],
  //         papers:[stocks that can take finishing] }
  async function mount(el, opts) {
    if (!el) return;
    var all = [];
    try {
      var r = await fetch(opts.url + '/rest/v1/finish_types'
        + '?select=name,description,options&order=display_order',
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

    el.innerHTML = types.map(function (t) {
      var opts2 = (t.options || []).filter(function (o) {
        return o.name && o.name.toLowerCase() !== 'none';
      });
      var isFoil = /foil/i.test(t.name);

      // A type with one option whose name only repeats the heading has nothing
      // to add — Spot UV's single "Add Spot UV" read as "Spot UV / Spot UV".
      // Its own description says it, so the row is dropped.
      var bare = !isFoil && opts2.length === 1
        && opts2[0].name.replace(/^Add\s+/i, '').toLowerCase() === t.name.toLowerCase();

      var body = bare ? '' : '<div class="fs-row">' + opts2.map(function (o) {
        if (isFoil) {
          return '<div class="fs-o">'
            + '<span class="fs-sw" style="background:' + foilOf(o.name) + '"></span>'
            + '<span class="fs-n">' + esc(o.name) + ' foil</span></div>';
        }
        return '<div class="fs-t">'
          + '<span class="fs-tn">' + esc(o.name.replace(/^Add\s+/i, '')) + '</span>'
          + (o.description ? '<span class="fs-td">' + esc(o.description) + '</span>' : '')
          + '</div>';
      }).join('') + '</div>';

      return '<div class="fs-group"><div class="fs-gname">' + esc(t.name) + '</div>'
        + '<div class="fs-gdesc">' + esc(t.description || '') + '</div>'
        + body + '</div>';
    }).join('')
    + (opts.papers && opts.papers.length
        ? '<p class="fs-note">Available on ' + esc(listOf(opts.papers))
          + '. Chosen when you personalise your design, and charged once for the order rather '
          + 'than per card.</p>'
        : '');
  }

  global.FinishSection = { mount: mount };
})(window);
