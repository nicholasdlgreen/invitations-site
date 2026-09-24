// "Finishing touches" — square cards showing the actual colours, and a close-up
// on click. One file, loaded by every product landing page.
//
// It draws only what the product offers AND what its papers can physically
// take, both supplied by the host page, so it cannot promise a finish the
// printer would refuse.
(function (global) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // A metal reads as metal because of the highlight arc across it, not the
  // colour underneath. Same gradients the order step uses.
  function metal(a, b, c, d) {
    return 'radial-gradient(circle at 33% 25%,rgba(255,255,255,.96) 0%,rgba(255,255,255,.35) 26%,'
         + 'rgba(255,255,255,0) 52%),'
         + 'linear-gradient(145deg,' + a + ' 0%,' + b + ' 26%,' + c + ' 48%,' + b + ' 64%,' + d + ' 100%)';
  }
  function metalType(dark, bright, mid) {
    return 'linear-gradient(180deg,' + bright + ' 0%,' + mid + ' 30%,' + dark + ' 56%,'
         + mid + ' 78%,' + bright + ' 100%)';
  }
  var FOIL = {
    gold:   metal('#7E6018', '#FBEFC2', '#CBA52B', '#6E5414'),
    silver: metal('#6F757D', '#FBFCFD', '#C3C9D0', '#666C74'),
    rose:   metal('#8E5745', '#F6D6C6', '#D08E74', '#7E4A39')
  };
  // Real metal, not a gradient. A CSS gradient is one smooth ramp and can only
  // muster about thirty levels of variation; metal reads as metal because of
  // the range its folds create, near-black in a crease to blown white on a
  // facet. These are rendered crumpled sheets, and they are tonally compressed
  // so a crease falling across a thin stroke can never take it to nothing.
  var FOIL_TYPE = {
    gold:   "url('/img/foil/gold.jpg')",
    silver: "url('/img/foil/silver.jpg')",
    rose:   "url('/img/foil/rose.jpg')"
  };

  // The printed ground under each foil, drawn from the site's own accents:
  // sage, a warm grey from the palette's --pale, and blush. Mid-tones, not
  // darks — the earlier deep green, charcoal and claret were too loud beside
  // the rest of the page, and a single dark brown among two pastels sat heavy.
  //
  // The honest consequence: gold and rose gold are themselves mid-tones, so on
  // a soft ground they are quiet at this size, and silver quieter still. That
  // is what these foils look like on a pale card. The close-up is where they
  // read — which is why the card opens.
  // Each ground is chosen so its own metal stays legible everywhere, measured
  // against the darkest two per cent of that foil rather than judged by eye:
  //   gold   on deep sage   darkest stroke sits 41 levels ABOVE the ground
  //   silver on deep taupe  59 above
  //   rose   on deep rose   49 above
  // Rose was tried on a pale blush first. On paper it looked right — the metal
  // is darker than the card on average — but it straddled it: the brightest
  // tenth of the foil was LIGHTER than the blush and disappeared into it, so
  // the letters broke up exactly as they did on the other two. All three metals
  // are light, so all three want a ground below them. Muted, not bold.
  var GROUND = { gold: '#4C5D53', silver: '#5F574D', rose: '#63494A' };
  // All three grounds are deep now, so the date line is pale on all three.
  var PALE_ON = { gold: true, silver: true, rose: true };

  // The ornament above the names, as a mask: the metal gradient shows through
  // it, so the sprig is foil rather than a picture of foil.
  var SPRIG = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20120%2042%22%3E%3Cg%20fill%3D%22%23000%22%3E%3Cpath%20d%3D%22M60.0%2034.0%20Q%2038.0%2036.0%2014.0%2012.0%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%2F%3E%3Cellipse%20cx%3D%2250.0%22%20cy%3D%2230.5%22%20rx%3D%226.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-2.0%2050.0%2030.5%29%22%2F%3E%3Cellipse%20cx%3D%2250.0%22%20cy%3D%2237.3%22%20rx%3D%226.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%2866.0%2050.0%2037.3%29%22%2F%3E%3Cellipse%20cx%3D%2241.4%22%20cy%3D%2228.5%22%20rx%3D%225.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-11.0%2041.4%2028.5%29%22%2F%3E%3Cellipse%20cx%3D%2241.4%22%20cy%3D%2235.3%22%20rx%3D%225.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%2857.0%2041.4%2035.3%29%22%2F%3E%3Cellipse%20cx%3D%2232.7%22%20cy%3D%2224.7%22%20rx%3D%225.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-20.0%2032.7%2024.7%29%22%2F%3E%3Cellipse%20cx%3D%2232.7%22%20cy%3D%2231.5%22%20rx%3D%225.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%2848.0%2032.7%2031.5%29%22%2F%3E%3Cellipse%20cx%3D%2223.9%22%20cy%3D%2219.0%22%20rx%3D%224.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-29.0%2023.9%2019.0%29%22%2F%3E%3Cellipse%20cx%3D%2223.9%22%20cy%3D%2225.8%22%20rx%3D%224.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%2839.0%2023.9%2025.8%29%22%2F%3E%3Cellipse%20cx%3D%2214.9%22%20cy%3D%2211.4%22%20rx%3D%224.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-38.0%2014.9%2011.4%29%22%2F%3E%3Cellipse%20cx%3D%2214.9%22%20cy%3D%2218.2%22%20rx%3D%224.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%2830.0%2014.9%2018.2%29%22%2F%3E%3Cpath%20d%3D%22M60.0%2034.0%20Q%2082.0%2036.0%20106.0%2012.0%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%2F%3E%3Cellipse%20cx%3D%2270.0%22%20cy%3D%2230.5%22%20rx%3D%226.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-66.0%2070.0%2030.5%29%22%2F%3E%3Cellipse%20cx%3D%2270.0%22%20cy%3D%2237.3%22%20rx%3D%226.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%282.0%2070.0%2037.3%29%22%2F%3E%3Cellipse%20cx%3D%2278.6%22%20cy%3D%2228.5%22%20rx%3D%225.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-57.0%2078.6%2028.5%29%22%2F%3E%3Cellipse%20cx%3D%2278.6%22%20cy%3D%2235.3%22%20rx%3D%225.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%2811.0%2078.6%2035.3%29%22%2F%3E%3Cellipse%20cx%3D%2287.3%22%20cy%3D%2224.7%22%20rx%3D%225.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-48.0%2087.3%2024.7%29%22%2F%3E%3Cellipse%20cx%3D%2287.3%22%20cy%3D%2231.5%22%20rx%3D%225.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%2820.0%2087.3%2031.5%29%22%2F%3E%3Cellipse%20cx%3D%2296.1%22%20cy%3D%2219.0%22%20rx%3D%224.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-39.0%2096.1%2019.0%29%22%2F%3E%3Cellipse%20cx%3D%2296.1%22%20cy%3D%2225.8%22%20rx%3D%224.7%22%20ry%3D%222.5%22%20transform%3D%22rotate%2829.0%2096.1%2025.8%29%22%2F%3E%3Cellipse%20cx%3D%22105.1%22%20cy%3D%2211.4%22%20rx%3D%224.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%28-30.0%20105.1%2011.4%29%22%2F%3E%3Cellipse%20cx%3D%22105.1%22%20cy%3D%2218.2%22%20rx%3D%224.2%22%20ry%3D%222.5%22%20transform%3D%22rotate%2838.0%20105.1%2018.2%29%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

  function foilKey(name) {
    var o = String(name).toLowerCase();
    if (o.indexOf('rose') >= 0) return 'rose';
    if (o.indexOf('silver') >= 0) return 'silver';
    if (o.indexOf('gold') >= 0) return 'gold';
    return null;
  }
  function lamKey(name) {
    var o = String(name).toLowerCase();
    if (o.indexOf('gloss') >= 0) return 'gloss';
    if (o.indexOf('soft') >= 0) return 'soft';
    if (o.indexOf('matt') >= 0) return 'matt';
    return 'uv';
  }

  // One square card. Foils print the monogram in metal on a coloured ground;
  // laminates and spot UV leave the card as it is and move light across it.
  function face(type, optName, big) {
    var mono = big ? '' : '';
    if (/foil/i.test(type)) {
      var k = foilKey(optName) || 'gold';
      var pale = PALE_ON[k];
      return '<span class="fs-sq fs-foil" style="background:' + GROUND[k] + '">'
        + '<span class="fs-sprig" style="background-image:' + FOIL_TYPE[k]
        + ';-webkit-mask-image:url(\'' + SPRIG + '\');mask-image:url(\'' + SPRIG + '\')"></span>'
        + '<span class="fs-names" style="background-image:' + FOIL_TYPE[k] + '">Amelia &amp; Thomas</span>'
        + '<span class="fs-rule" style="background:' + FOIL[k] + '"></span>'
        + '<span class="fs-tiny" style="color:' + (pale ? 'rgba(255,255,255,.72)' : 'rgba(61,46,36,.58)')
        + '">the fourteenth of june</span></span>';
    }
    var lk = /spot/i.test(type) ? 'uv' : lamKey(optName);
    return '<span class="fs-sq fs-l-' + lk + '" style="background-color:#F1EAE2'
      + (PAPER ? ';background-image:url(\'' + esc(PAPER) + '\');background-size:max(100%,760px);background-position:center' : '')
      + '">'
      + '<span class="fs-mono fs-ink">A&amp;T</span>'
      + '<span class="fs-rule fs-rule-ink"></span>'
      + '<span class="fs-tiny" style="color:rgba(61,46,36,.55)">the fourteenth of june</span>'
      + '<span class="fs-gl"></span></span>';
  }

  var PAPER = null;   // the paper photograph laminates sit on

  // opts: { url, key, allowed:[type names this product offers],
  //          papers:[stocks that can take finishing], paperSrc }
  async function mount(el, opts) {
    if (!el) return;
    PAPER = opts.paperSrc || null;

    var all = [];
    try {
      var r = await fetch(opts.url + '/rest/v1/finish_types'
        + '?select=name,description,options&order=display_order',
        { headers: { apikey: opts.key, Authorization: 'Bearer ' + opts.key } });
      if (r.ok) all = await r.json();
    } catch (e) { /* the section hides itself below if nothing arrives */ }

    // What this product offers, narrowed to what its papers can take. A finish
    // that survives neither test never appears.
    var allowed = (opts.allowed || []).map(function (x) { return String(x).toLowerCase().trim(); });
    var FIRST = ['foiling', 'lamination', 'spot uv'];
    var types = all
      .filter(function (t) { return !allowed.length || allowed.indexOf(t.name.toLowerCase().trim()) >= 0; })
      .sort(function (a, b) {
        var ia = FIRST.indexOf(a.name.toLowerCase().trim());
        var ib = FIRST.indexOf(b.name.toLowerCase().trim());
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
      .filter(function (t) {
        return (t.options || []).some(function (o) { return o.name && o.name.toLowerCase() !== 'none'; });
      });
    if (!types.length) { var s = el.closest('section'); if (s) s.style.display = 'none'; return; }

    var flat = [];
    el.innerHTML = types.map(function (t) {
      var opts2 = (t.options || []).filter(function (o) { return o.name && o.name.toLowerCase() !== 'none'; });
      return '<div class="fs-group"><div class="fs-gname">' + esc(t.name) + '</div>'
        + '<div class="fs-gdesc">' + esc(t.description || '')
        + (/foil/i.test(t.name)
            ? ' <span class="fs-shown">Shown here on a printed card, at the size it would be pressed.</span>'
            : (/lamin/i.test(t.name)
                ? ' <span class="fs-shown">A laminate is a reflection, so the light has to move for you to see it \u2014 hover, or open one.</span>'
                : '')) + '</div>'
        + '<div class="fs-row">' + opts2.map(function (o) {
            flat.push({ type: t.name, typeDesc: t.description || '', name: o.name,
                        desc: o.description || '' });
            var label = /foil/i.test(t.name) ? o.name + ' foil'
                      : (/spot/i.test(t.name) ? o.name.replace(/^Add /, '')
                      : o.name + ' lamination');
            return '<button class="fs-card" type="button" data-i="' + (flat.length - 1) + '">'
              + face(t.name, o.name, false)
              + '<span class="fs-lb">' + esc(label) + '</span></button>';
          }).join('') + '</div></div>';
    }).join('')
    + (opts.papers && opts.papers.length
        ? '<p class="fs-note">Available on ' + esc(opts.papers.join(', '))
          + '. Added when you personalise your design, and charged once for the order, not per card.</p>'
        : '');

    var dlg = document.createElement('dialog');
    dlg.className = 'fs-dialog';
    dlg.innerHTML = '<div class="fs-bigwrap"></div><div class="fs-dialog-body">'
      + '<h3></h3><div class="fs-dialog-sub"></div><p></p>'
      + '<button class="fs-dialog-close" type="button">Close</button></div>';
    document.body.appendChild(dlg);
    var wrap = dlg.querySelector('.fs-bigwrap'),
        h3   = dlg.querySelector('h3'),
        sub  = dlg.querySelector('.fs-dialog-sub'),
        para = dlg.querySelector('p');

    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('.fs-card'); if (!b) return;
      var f = flat[+b.dataset.i]; if (!f) return;
      wrap.innerHTML = face(f.type, f.name, true);
      var sq = wrap.querySelector('.fs-sq');
      sq.classList.add('fs-big');
      h3.textContent = f.name.replace(/^Add /, '');
      sub.textContent = f.type;
      para.textContent = f.desc || f.typeDesc;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      // Run the light across once on open, so a laminate shows what it is
      // without the viewer having to know to hover.
      setTimeout(function () { sq.classList.add('fs-play'); }, 240);
      setTimeout(function () { sq.classList.remove('fs-play'); }, 1600);
    });

    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    dlg.querySelector('.fs-dialog-close').addEventListener('click', close);
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) close(); });
  }

  global.FinishSection = { mount: mount };
})(window);
