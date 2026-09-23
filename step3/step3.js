// STEP 3 — direction A.
//
// One renderer, used by BOTH the preview page and upload-and-print.html.
// It takes a plain model and writes the DOM. It knows nothing about Supabase,
// the basket or the upload flow — the host page builds the model and passes
// the click handlers in. That is what makes "what was approved" and "what
// ships" provably the same thing: same CSS file, same markup file, same
// render function, only the data differs.
//
// Every class name below comes from the approved prototype. If a class is not
// in step3.css, it does not belong here.
(function (global) {
  'use strict';

  var SEP = '::';   // separates finishing type from option in a data-val

  function el(id) { return document.getElementById(id); }
  function set(id, text) { var e = el(id); if (e) e.textContent = text == null ? '' : text; }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Handlers the host page supplies. Wired once, by delegation, so
  // re-rendering never leaves a dead button behind.
  var on = {};

  function bind() {
    var root = el('s3');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = '1';
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var fn = on[b.dataset.act];
      if (typeof fn === 'function') fn(b.dataset.val, b);
    });
  }

  function renderTiers(list) {
    el('s3tiers').innerHTML = (list || []).map(function (t) {
      return '<button type="button" class="tier' + (t.on ? ' on' : '') + '" data-act="tier" data-val="' + esc(t.id) + '">'
           +   '<span class="th"' + (t.img ? ' style="background-image:url(\'' + esc(t.img) + '\')"' : '') + '></span>'
           +   '<span style="min-width:0"><span class="tn">' + esc(t.name) + '</span>'
           +   '<span class="tx">' + esc(t.hint) + '</span></span>'
           + '</button>';
    }).join('');
  }

  function renderPapers(papers, weights, weightNote) {
    var html = (papers || []).map(function (p) {
      return '<button type="button" class="pill' + (p.on ? ' on' : '') + '" data-act="paper" data-val="' + esc(p.id) + '">'
           + esc(p.name) + '</button>';
    }).join('');
    if (weights && weights.length) {
      html += '<span class="sep"></span>' + weights.map(function (w) {
        return '<button type="button" class="pill' + (w.on ? ' on' : '') + '" data-act="weight" data-val="' + esc(w.id) + '">'
             + esc(w.label) + '</button>';
      }).join('');
    } else if (weightNote) {
      html += '<span class="sep"></span><span class="pnote">' + esc(weightNote) + '</span>';
    }
    el('s3papers').innerHTML = html;
  }

  function renderFinishing(fin) {
    var box = el('s3fin');
    if (!fin || fin.note) {
      box.innerHTML = '<div class="nofin">' + esc(fin ? fin.note : '') + '</div>';
      return;
    }
    box.innerHTML = (fin.rows || []).map(function (r) {
      var opts = (r.options || []).map(function (o) {
        return '<button type="button" class="pill' + (o.on ? ' on' : '') + '"'
             + ' data-act="finish" data-val="' + esc(r.type + SEP + o.name) + '">'
             + esc(o.label) + '</button>';
      }).join('');
      return '<div class="frow"><span class="fname">' + esc(r.type) + '</span>'
           + '<span class="row">' + opts + '</span></div>';
    }).join('');
  }

  function renderEnvelopes(env) {
    var row = el('s3envRow');
    if (!env || env.show === false) { row.style.display = 'none'; el('s3envs').innerHTML = ''; return; }
    row.style.display = '';
    el('s3envs').innerHTML = (env.items || []).map(function (e) {
      return '<button type="button" class="pill' + (e.on ? ' on' : '') + '" data-act="env" data-val="' + esc(e.id) + '">'
           + (e.hex ? '<span class="sw" style="background:' + esc(e.hex) + '"></span>' : '')
           + esc(e.label) + '</button>';
    }).join('');
  }

  function renderQuantities(list, customLabel, note) {
    el('s3qtys').innerHTML = (list || []).map(function (q) {
      return '<button type="button" class="pill' + (q.on ? ' on' : '') + '" data-act="qty" data-val="' + esc(q.n) + '">'
           + esc(q.n) + '</button>';
    }).join('')
    + '<button type="button" class="pill' + (customLabel && customLabel.on ? ' on' : '') + '" data-act="qtyCustom">'
    + esc(customLabel ? customLabel.label : 'Another number') + '</button>';
    set('s3qnote', note);
  }

  function renderDeliveries(list) {
    el('s3dels').innerHTML = (list || []).map(function (d) {
      return '<button type="button" class="del' + (d.on ? ' on' : '') + '" data-act="del" data-val="' + esc(d.id) + '"'
           + (d.disabled ? ' disabled style="opacity:.45;cursor:not-allowed"' : '') + '>'
           +   '<span class="a">' + esc(d.name) + '</span>'
           +   '<span class="b">' + esc(d.when) + '</span>'
           +   '<span class="c">' + esc(d.cost) + '</span>'
           + '</button>';
    }).join('');
  }

  function render(m) {
    if (!el('s3')) return;
    bind();
    m = m || {};

    // ---- left: the paper, the words, the price
    var photo = el('s3photo');
    if (photo) photo.style.backgroundImage = m.photo && m.photo.url ? "url('" + m.photo.url + "')" : 'none';
    var art = el('s3art');
    if (art) art.style.display = (m.photo && m.photo.artwork) ? 'block' : 'none';
    if (m.photo && m.photo.art) {
      set('s3artKicker', m.photo.art.kicker);
      var names = el('s3artNames');
      if (names) names.innerHTML = esc(m.photo.art.names).replace(/\n/g, '<br>');
      var det = el('s3artDetail');
      if (det) det.innerHTML = esc(m.photo.art.detail).replace(/\n/g, '<br>');
    }
    set('s3tag', m.photo && m.photo.tag);

    set('s3name', m.copy && m.copy.name);
    set('s3spec', m.copy && m.copy.spec);
    set('s3feel', m.copy && m.copy.feel);
    set('s3note', m.copy && m.copy.note);

    set('s3total', m.money && m.money.total);
    set('s3per',   m.money && m.money.per);
    var cta = el('s3cta');
    if (cta && m.money) {
      cta.textContent = m.money.cta || 'Continue';
      cta.disabled = !!m.money.ctaDisabled;
      cta.style.opacity = m.money.ctaDisabled ? '.45' : '';
      cta.style.cursor  = m.money.ctaDisabled ? 'not-allowed' : '';
    }

    // ---- right: the choices
    set('s3sub', m.sub);
    renderTiers(m.tiers);
    renderPapers(m.papers, m.weights, m.weightNote);
    renderFinishing(m.finishing);
    renderEnvelopes(m.envelopes);
    renderQuantities(m.quantities, m.qtyCustom, m.qtyNote);
    renderDeliveries(m.deliveries);
    var foot = el('s3foot');
    if (foot) foot.innerHTML = m.foot || '';

    // Rows are numbered by what is actually on screen, so a product with no
    // envelopes reads 1-5 rather than skipping 4.
    var titles = m.labels || [];
    var n = 0, i = 0;
    ['s3lab1', 's3lab2', 's3lab3', 's3lab4', 's3lab5', 's3lab6'].forEach(function (id) {
      var lab = el(id);
      if (!lab) { i++; return; }
      var row = lab.parentElement;
      var hidden = row && row.style.display === 'none';
      if (!hidden) { n++; lab.textContent = n + ' · ' + (titles[i] || ''); }
      i++;
    });
  }

  global.Step3 = { render: render, handlers: on, SEP: SEP };
})(window);
