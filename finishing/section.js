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
  var FOIL = {
    gold:   metal('#7E6018', '#FBEFC2', '#CBA52B', '#6E5414'),
    silver: metal('#6F757D', '#FBFCFD', '#C3C9D0', '#666C74'),
    rose:   metal('#8E5745', '#F6D6C6', '#D08E74', '#7E4A39')
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
  var GROUND = { gold: '#AFC3AE', silver: '#A79C92', rose: '#E0C2BB' };

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
      return '<span class="fs-sq" style="background:' + GROUND[k] + '">'
        + '<span class="fs-mono" style="background-image:' + FOIL[k] + '">A&amp;T</span>'
        + '<span class="fs-rule" style="background:' + FOIL[k] + '"></span>'
        + '<span class="fs-tiny" style="color:rgba(61,46,36,.58)">the fourteenth of june</span></span>';
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
    var types = all
      .filter(function (t) { return !allowed.length || allowed.indexOf(t.name.toLowerCase().trim()) >= 0; })
      .filter(function (t) {
        return (t.options || []).some(function (o) { return o.name && o.name.toLowerCase() !== 'none'; });
      });
    if (!types.length) { var s = el.closest('section'); if (s) s.style.display = 'none'; return; }

    var flat = [];
    el.innerHTML = types.map(function (t) {
      var opts2 = (t.options || []).filter(function (o) { return o.name && o.name.toLowerCase() !== 'none'; });
      return '<div class="fs-group"><div class="fs-gname">' + esc(t.name) + '</div>'
        + '<div class="fs-gdesc">' + esc(t.description || '') + '</div>'
        + '<div class="fs-row">' + opts2.map(function (o) {
            flat.push({ type: t.name, typeDesc: t.description || '', name: o.name,
                        desc: o.description || '' });
            return '<button class="fs-card" type="button" data-i="' + (flat.length - 1) + '">'
              + face(t.name, o.name, false)
              + '<span class="fs-lb">' + esc(o.name.replace(/^Add /, '')) + '</span></button>';
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
