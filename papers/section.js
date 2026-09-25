// "Our paper stocks" — the section that replaced "Simple, honest pricing".
//
// One script, loaded by every product landing page. The page tells it which
// stocks the product is sold on; it fetches what each stock is and draws them.
// Clicking a stock opens its full description over the page.
//
// It is one file rather than the same code pasted into twenty-one pages, so a
// change to this section happens once and every page gets it.
(function (global) {
  'use strict';

  // Photographs we hold, by exact stock name as the admin writes it. All ten
  // live stocks are covered; a name missing here returns null and the card says
  // so rather than borrowing another paper's grain.
  var PHOTO = {
    'Uncoated': 'uncoated', 'Silk': 'silk', 'Gloss': 'gloss',
    'Foamex 5mm': 'foamex',
    'Cartonboard': 'cartonboard', 'Ice White': 'icewhite',
    'Recycled Uncoated': 'recycled', 'Tintoretto Gesso': 'tintoretto',
    'Nettuno Bianco': 'nettuno', 'Acquerello Bianco': 'acquerello',
    'Sirio Pearl Polar Dawn': 'polardawn'
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function photo(name) { return PHOTO[name] ? '/img/paper/' + PHOTO[name] + '.jpg' : null; }

  // Paper is measured in gsm, board in millimetres of thickness. The weight
  // carries its own unit, so the stock says which it is without a second list
  // here to keep in step.
  function isBoard(p) {
    var ws = p.weights || [];
    return ws.length > 0 && ws.every(function (w) { return w && w.unit === 'mm'; });
  }

  // opts: { names: [stock names this product is sold on], url, key, intro }
  async function mount(el, opts) {
    if (!el) return;
    var names = (opts.names || []).filter(Boolean);
    if (!names.length) { el.closest('section').style.display = 'none'; return; }

    var stocks = [];
    try {
      var r = await fetch(opts.url + '/rest/v1/paper_stocks'
        + '?select=name,subtitle,description,weights&active=eq.true&order=display_order',
        { headers: { apikey: opts.key, Authorization: 'Bearer ' + opts.key } });
      if (r.ok) stocks = await r.json();
    } catch (e) { /* fall through: names alone still draw a usable section */ }

    // Only the stocks this product is sold on, in the order the admin lists them.
    var papers = names.map(function (n) {
      var s = null;
      for (var i = 0; i < stocks.length; i++) if (stocks[i].name === n) s = stocks[i];
      return { name: n, subtitle: (s && s.subtitle) || '', description: (s && s.description) || '',
               weights: (s && s.weights) || [], src: photo(n) };
    });

    // "Our paper stocks" is wrong over a sheet of foamex. A stock measured in
    // millimetres is a board, and the section says so itself rather than every
    // product page having to know. Any future board gets this for free.
    if (papers.length && papers.every(isBoard)) {
      var sec = el.closest('section');
      var h = sec && sec.querySelector('.lp-strip-h');
      if (h) h.textContent = papers.length > 1 ? 'Our boards' : 'Our board';
      var tag = sec && sec.querySelector('.lp-strip-tag');
      if (tag && /^paper$/i.test(tag.textContent.trim())) tag.textContent = 'Board';
      var intro = document.getElementById('lp-papers-intro');
      if (intro && intro.textContent) {
        intro.textContent = intro.textContent
          .replace(/^The stock\b/, 'The board')
          .replace(/^The (\d+) stocks\b/, 'The $1 boards')
          .replace(/ and what each one feels like in the hand\.$/, '.');
      }
    }

    el.innerHTML = '<div class="ps-grid">' + papers.map(function (p, i) {
      return '<button class="ps-card" type="button" data-i="' + i + '">'
        + (p.src
            ? '<span class="ps-shot" style="background-image:url(\'' + esc(p.src) + '\')">'
              + '<span class="ps-cue" aria-hidden="true">View</span></span>'
            : '<span class="ps-shot ps-shot-none"><span>Photograph to come</span></span>')
        + '<span class="ps-name">' + esc(p.name) + '</span>'
        + (p.subtitle ? '<span class="ps-sub">' + esc(p.subtitle) + '</span>' : '')
        + '</button>';
    }).join('') + '</div>';

    var dlg = document.createElement('dialog');
    dlg.className = 'ps-dialog';
    dlg.innerHTML = '<div class="ps-dialog-shot"></div><div class="ps-dialog-body">'
      + '<h3></h3><div class="ps-dialog-sub"></div><p></p>'
      + '<button class="ps-dialog-close" type="button">Close</button></div>';
    document.body.appendChild(dlg);

    var shot = dlg.querySelector('.ps-dialog-shot'),
        h3   = dlg.querySelector('h3'),
        sub  = dlg.querySelector('.ps-dialog-sub'),
        para = dlg.querySelector('p');

    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('.ps-card'); if (!b) return;
      var p = papers[+b.dataset.i]; if (!p) return;
      shot.style.backgroundImage = p.src ? "url('" + p.src + "')" : 'none';
      shot.style.display = p.src ? '' : 'none';
      h3.textContent = p.name;
      sub.textContent = p.subtitle;
      sub.style.display = p.subtitle ? '' : 'none';
      para.textContent = p.description;
      // showModal gives the focus trap and Escape for free; the fallback keeps
      // the panel usable on a browser too old for <dialog>.
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });

    function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    dlg.querySelector('.ps-dialog-close').addEventListener('click', close);
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) close(); });
  }

  global.PaperSection = { mount: mount, photo: photo };
})(window);
