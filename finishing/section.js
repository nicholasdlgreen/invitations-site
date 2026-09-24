// "Finishing touches" — one block showing the finishes themselves.
//
// No invitation, no monogram, no printed ground. Earlier versions built a fake
// card and pressed fake foil into fake type, which was three pretences stacked
// on each other and looked like it. A swatch has one job.
//
// One file, loaded by every product landing page. It draws only what the
// product offers AND what its papers can physically take, both supplied by the
// host page, so it cannot promise a finish the printer would refuse.
(function (global) {
  'use strict';

  // The metals are photographs of rendered crumpled foil rather than CSS
  // gradients. A gradient is one smooth ramp with perhaps thirty levels in it;
  // metal reads as metal through the range its folds create. It is the only
  // reason gold, silver and rose gold are tellable apart at this size.
  var FOIL = {
    gold:   "url('/img/foil/gold.jpg')",
    silver: "url('/img/foil/silver.jpg')",
    rose:   "url('/img/foil/rose.jpg')"
  };
  // Laminates and spot UV have no texture to show, so they stay flat. Three
  // near-identical pale squares is honest: a laminate is a reflection, and a
  // still image of one has nothing in it.
  var SURFACE = {
    matt:  'linear-gradient(145deg,#EDE9E3,#E0DAD1)',
    gloss: 'radial-gradient(circle at 32% 24%,rgba(255,255,255,.95),rgba(255,255,255,.2) 40%,'
         + 'rgba(255,255,255,0) 62%),linear-gradient(145deg,#E9E9EC,#FFFFFF 46%,#DEDEE3)',
    soft:  'linear-gradient(145deg,#F2EDE6,#E4DCD1)',
    uv:    'radial-gradient(circle at 34% 26%,rgba(255,255,255,.98),rgba(255,255,255,.28) 38%,'
         + 'rgba(255,255,255,.04) 62%),linear-gradient(145deg,#EDE9E2,#FBFAF8 45%,#E6E1D8)'
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fill(type, opt) {
    var o = String(opt).toLowerCase();
    if (/foil/i.test(type)) {
      if (o.indexOf('rose') >= 0)   return FOIL.rose;
      if (o.indexOf('silver') >= 0) return FOIL.silver;
      return FOIL.gold;
    }
    if (/spot/i.test(type)) return SURFACE.uv;
    if (o.indexOf('gloss') >= 0) return SURFACE.gloss;
    if (o.indexOf('soft') >= 0)  return SURFACE.soft;
    return SURFACE.matt;
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
      return '<div class="fs-group"><div class="fs-gname">' + esc(t.name) + '</div>'
        + '<div class="fs-gdesc">' + esc(t.description || '') + '</div>'
        + '<div class="fs-row">' + opts2.map(function (o) {
            var label = /foil/i.test(t.name) ? o.name + ' foil' : o.name.replace(/^Add /, '');
            return '<div class="fs-o">'
              + '<span class="fs-sw" style="background:' + fill(t.name, o.name) + ' center/cover"></span>'
              + '<span class="fs-n">' + esc(label) + '</span>'
              + (o.description ? '<span class="fs-d">' + esc(o.description) + '</span>' : '')
              + '</div>';
          }).join('') + '</div></div>';
    }).join('')
    + (opts.papers && opts.papers.length
        ? '<p class="fs-note">Available on ' + esc(opts.papers.join(' and '))
          + '. Chosen when you personalise your design, and charged once for the order rather '
          + 'than per card.</p>'
        : '');
  }

  global.FinishSection = { mount: mount };
})(window);
