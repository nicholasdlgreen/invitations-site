// STEP 3 — the paper, finishing, quantity and delivery step.
//
// This file draws the step and nothing else. It holds no prices, knows nothing
// about Supabase, the basket or the upload flow, and never decides what is
// available. Everything it shows is handed to it by the host page through
// Step3.init(), and every click is handed straight back.
//
// That split is deliberate. Six earlier attempts failed because the approved
// design was rebuilt by hand inside upload-and-print.html, so the thing that
// was approved and the thing that shipped were two pieces of code with nothing
// tying them together. The preview page and the shop both load this file.
(function (global) {
  'use strict';

  var A = null;   // the adapter supplied by the host
  var S = { feel: null, paper: null, weight: null, finishes: {}, env: null, qty: null,
            del: null, openFin: null, at: 's1' };
  var ART = null;

  // ---- the three types. A type with no papers behind it never appears. ----
  var FEELS = [
    { id: 'signature', name: 'Smooth and clean',
      sub: 'Crisp, substantial and understated. What most couples choose.' },
    { id: 'textured',  name: 'Textured and Italian',
      sub: 'A grain you feel before you read a word. Made by Fedrigoni.' },
    { id: 'kinder',    name: 'Kinder',
      sub: 'Wholly recycled, flecked with natural fibre. Quietly green.' }
  ];

  function el(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function q(v) { return String(v == null ? '' : v).replace(/'/g, "\\'"); }
  function gbp(n) { return '£' + (Number(n) || 0).toFixed(2); }

  function papersIn(feelId) {
    return (A.papers() || []).filter(function (p) { return A.feelOf(p.name) === feelId; });
  }
  function liveFeels() {
    return FEELS.filter(function (f) { return papersIn(f.id).length; });
  }
  function currentPaper() {
    var list = A.papers() || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === S.paper) return list[i];
    return list[0] || null;
  }

  // ---- the artwork, laid on the paper and printed through its grain ----
  function artOn(paperName, cls) {
    if (!ART) {
      return '<span class="await">Your design appears here<br>once you have uploaded it</span>';
    }
    var t = A.imageFor(paperName);
    var layers = t
      ? '<span class="grain" style="background-image:url(\'' + esc(t) + '\')"></span>'
        + '<span class="tone" style="background-image:url(\'' + esc(t) + '\')"></span>'
      : '';
    return '<span class="' + (cls || 'inv') + '"><img src="' + esc(ART) + '" alt="Your design">'
         + layers + '</span>';
  }

  // ---- 1 · type -------------------------------------------------------------
  function drawFeels() {
    var box = el('feels'); if (!box) return;
    box.innerHTML = liveFeels().map(function (f) {
      var p = papersIn(f.id)[0];
      return '<button class="feel' + (S.feel === f.id ? ' on' : '') + '" onclick="Step3.feel(\'' + f.id + '\')">'
        + '<span class="shot" style="background-image:url(\'' + esc(A.imageFor(p.name) || '') + '\')">'
        + artOn(p.name) + '</span>'
        + '<span class="tick">&#10003;</span>'
        + '<span class="cap"><span class="nm">' + esc(f.name) + '</span>'
        + '<span class="sub">' + esc(f.sub) + '</span></span></button>';
    }).join('');
  }

  // ---- 2 · the paper and its weight -----------------------------------------
  function drawStocks() {
    if (!S.feel) return;
    var mine = papersIn(S.feel);
    if (!mine.length) return;
    var paper = null;
    for (var i = 0; i < mine.length; i++) if (mine[i].name === S.paper) paper = mine[i];
    if (!paper) { paper = mine[0]; S.paper = paper.name; }

    el('swatches').innerHTML = mine.map(function (p) {
      return '<button class="sw' + (p.name === paper.name ? ' on' : '') + '" onclick="Step3.paper(\'' + q(p.name) + '\')">'
        + '<span class="im" style="background-image:url(\'' + esc(A.imageFor(p.name) || '') + '\')"></span>'
        + '<span class="tx">' + esc(p.name.replace(/^Sirio Pearl /, '')) + '</span></button>';
    }).join('');

    el('pic').style.backgroundImage = "url('" + (A.imageFor(paper.name) || '') + "')";
    var big = el('bigart');
    big.outerHTML = ART ? artOn(paper.name, 'bigart') : '<span class="bigart" id="bigart"></span>';
    if (!ART) { var b = el('bigart'); if (b) b.innerHTML = ''; }
    else { var nb = el('s3wrap').querySelector('.pic .bigart'); if (nb) nb.id = 'bigart'; }

    el('pName').textContent = paper.name;
    el('pDesc').textContent = paper.description || paper.subtitle || '';

    var ws = A.weightsFor(paper) || [];
    var found = false;
    for (var j = 0; j < ws.length; j++) if (ws[j].gsm === S.weight) found = true;
    if (!found) {
      var pop = null;
      for (var k = 0; k < ws.length; k++) if (ws[k].popular) pop = ws[k];
      S.weight = (pop || ws[0] || {}).gsm;
    }
    el('weights').innerHTML = ws.length > 1
      ? '<div class="opts">' + ws.map(function (w) {
          return '<button class="opt' + (w.gsm === S.weight ? ' on' : '') + '" onclick="Step3.weight(' + w.gsm + ')">'
            + '<span class="a">' + w.gsm + 'gsm</span><span class="b">' + esc(w.name || '') + '</span></button>';
        }).join('') + '</div>'
      : '<div class="one">' + (ws[0] ? ws[0].gsm + 'gsm' + (ws[0].name ? ' · ' + ws[0].name : '') : '')
        + ' — the only weight this paper comes in.</div>';
  }

  // ---- 3 · finishing ---------------------------------------------------------
  function drawFinishing() {
    if (!S.paper) { open('s2', false); return; }
    var types = A.finishTypesFor(S.paper) || [];
    if (!types.length) {
      // Nothing can be applied to this paper, so the section is simply not
      // here. We show what IS available and say nothing about what is not.
      open('s2', false); renumber(); return;
    }
    el('finBody').innerHTML = types.map(function (t) {
      var sel = S.finishes[t.name] || 'None';
      var isSet = String(sel).toLowerCase() !== 'none';
      var opened = (S.openFin === t.name);
      var dot = '';
      if (isSet && /foil/i.test(t.name)) {
        var c = /rose/i.test(sel) ? '#D8A390' : (/silver/i.test(sel) ? '#C9CCD1' : '#C9A227');
        dot = '<span class="dot" style="display:inline-block;vertical-align:-1px;margin-right:6px;background:' + c + '"></span>';
      }
      return '<div class="finRow' + (opened ? ' open' : '') + '">'
        + '<button class="finBtn" onclick="Step3.toggleFin(\'' + q(t.name) + '\')">'
        +   '<span><span class="h">' + esc(t.name) + '</span><br>'
        +   '<span class="d">' + esc(t.description || '') + '</span></span>'
        +   '<span class="v' + (isSet ? ' set' : '') + '">' + dot + esc(isSet ? sel : 'Not added')
        +   '</span><span class="c"></span></button>'
        + '<div class="finPanel"><div class="finPanelIn"><div class="fins">'
        + (t.options || []).map(function (o) {
            var none = String(o.name).toLowerCase() === 'none';
            return '<button class="fin' + (sel === o.name ? ' on' : '') + '"'
              + ' onclick="Step3.finish(\'' + q(t.name) + '\',\'' + q(o.name) + '\')">'
              + '<span class="shot" style="background-image:url(\'' + esc(A.imageFor(S.paper) || '') + '\')">'
              + (none ? '<span class="none">Left plain</span>'
                      : '<span class="mat" style="' + matStyle(t.name, o.name) + '"></span>')
              + '</span><span class="cap"><span class="nm">' + esc(o.name) + '</span>'
              + '<span class="sub">' + esc(o.description || '') + '</span></span></button>';
          }).join('')
        + '</div></div></div></div>';
    }).join('');
    open('s2', true); renumber();
  }

  // A finishing swatch shows the MATERIAL, never the customer's design wearing
  // it: we cannot know which parts they would foil, so tinting the whole thing
  // gold would promise something we have not seen and cannot print.
  function matStyle(type, opt) {
    var o = String(opt).toLowerCase();
    function metal(a, b, c, d) {
      return 'background:'
        + 'radial-gradient(circle at 33% 25%,rgba(255,255,255,.96) 0%,rgba(255,255,255,.35) 26%,rgba(255,255,255,0) 52%),'
        + 'linear-gradient(145deg,' + a + ' 0%,' + b + ' 26%,' + c + ' 48%,' + b + ' 64%,' + d + ' 100%)';
    }
    if (/foil/i.test(type)) {
      if (/rose/.test(o))   return metal('#8E5745', '#F6D6C6', '#D08E74', '#7E4A39');
      if (/silver/.test(o)) return metal('#6F757D', '#FBFCFD', '#C3C9D0', '#666C74');
      return metal('#7E6018', '#FBEFC2', '#CBA52B', '#6E5414');
    }
    if (/spot/i.test(type))
      return 'background:radial-gradient(circle at 34% 26%,rgba(255,255,255,.98),rgba(255,255,255,.28) 38%,rgba(255,255,255,.04) 62%),'
           + 'linear-gradient(145deg,#EDE9E2,#FBFAF8 45%,#E6E1D8);box-shadow:inset 0 0 0 1px rgba(61,46,36,.10)';
    if (/gloss/.test(o))
      return 'background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.95),rgba(255,255,255,.2) 40%,rgba(255,255,255,0) 62%),'
           + 'linear-gradient(145deg,#E9E9EC,#FFFFFF 46%,#DEDEE3)';
    if (/soft/.test(o)) return 'background:linear-gradient(145deg,#F2EDE6,#E4DCD1)';
    if (/matt/.test(o)) return 'background:linear-gradient(145deg,#EDE9E3,#E0DAD1)';
    if (/anti/.test(o)) return 'background:linear-gradient(145deg,#E9E5DF,#DAD4CA)';
    return 'background:#EFEBE5';
  }

  // ---- 4 · envelopes ---------------------------------------------------------
  // Asked before the quantity, because the answer is yes or no — how many is
  // settled by the card order, so we never ask for the number twice. A product
  // the printer supplies no envelope for has no section at all.
  function drawEnvelopes() {
    var list = (A.envelopes && A.envelopes()) || [];
    if (!S.paper || !S.weight || !list.length) { open('s5', false); renumber(); return; }
    var said = S.env !== null;
    var yes  = said && S.env !== 'none';
    var html = '<div class="envAsk">'
      + '<button class="' + (S.env === 'none' ? 'on' : '') + '" onclick="Step3.env(\'none\')">'
      + 'No envelopes, thank you</button>'
      + '<button class="' + (yes ? 'on' : '') + '" onclick="Step3.env(\'yes\')">'
      + 'Add envelopes</button></div>';
    if (yes) {
      html += '<div class="envCols">' + list.map(function (e) {
        return '<button class="env' + (S.env === e.id ? ' on' : '') + '"'
          + ' onclick="Step3.env(\'' + q(e.id) + '\')">'
          + '<span class="sq" style="background:' + q(e.hex || '#fff') + '"></span>'
          + '<span class="nm">' + esc(e.name) + '</span></button>';
      }).join('') + '</div>';
    }
    el('envs').innerHTML = html;
    open('s5', true); renumber();
  }

  // ---- 5 · how many ----------------------------------------------------------
  function drawQty() {
    if (!S.paper || !S.weight) { open('s3', false); renumber(); return; }
    var steps = A.quantities() || [];
    el('qtys').innerHTML = steps.map(function (n) {
      var per = A.perCardAt(n);
      return '<button class="qty' + (S.qty === n ? ' on' : '') + '" onclick="Step3.qty(' + n + ')">'
        + '<span class="n">' + n + '</span>'
        + '<span class="e">' + (per == null ? '' : gbp(per) + ' each') + '</span></button>';
    }).join('');
    open('s3', true); renumber();
  }

  // ---- 5 · delivery ----------------------------------------------------------
  function drawDelivery() {
    if (!S.qty) { open('s4', false); renumber(); return; }
    var opts = A.deliveries() || [];
    el('dels').innerHTML = opts.map(function (o) {
      return '<button class="del' + (o.id === S.del ? ' on' : '') + (o.disabled ? ' off' : '') + '"'
        + (o.disabled ? ' disabled' : ' onclick="Step3.delivery(\'' + q(o.id) + '\')"') + '>'
        + '<div class="n">' + esc(o.name) + '</div>'
        + '<div class="b">' + esc(o.blurb || '') + '</div>'
        + '<div class="a">' + esc(o.disabled ? 'Not available on orders this size' : 'Arrives ' + o.arrival) + '</div>'
        + '<div class="c">' + esc(o.cost) + '</div></button>';
    }).join('');
    open('s4', true); renumber();
  }

  // ---- frame -----------------------------------------------------------------
  function open(id, on) {
    var e = el(id); if (e) e.className = 'stage ' + (on ? 'open' : 'locked');
  }
  function renumber() {
    var n = 0;
    ['s1', 'stocks', 's2', 's5', 's3', 's4'].forEach(function (id) {
      var sec = el(id); if (!sec) return;
      var b = sec.querySelector('.num b'); if (!b) return;
      if (sec.classList.contains('locked') && id !== 's1') return;
      n += 1; b.textContent = n;
    });
    drawRail();
  }
  // The whole journey from the first moment. It does not grow as you go — the
  // steps are all there and the highlight moves along them.
  function journey() {
    var noFinish = !!S.paper && (A.finishTypesFor(S.paper) || []).length === 0;
    var noEnv = !((A.envelopes && A.envelopes()) || []).length;
    return [
      { id: 's1', label: 'Type' },
      { id: 'stocks', label: 'Paper' },
      { id: 's2', label: 'Finishing', skip: noFinish },
      { id: 's5', label: 'Envelopes', skip: noEnv },
      { id: 's3', label: 'How many' },
      { id: 's4', label: 'Delivery' }
    ].filter(function (x) { return !x.skip; });
  }
  function advanceTo(id) {
    var ids = journey().map(function (x) { return x.id; });
    S.at = ids.indexOf(id) >= 0 ? id : ids[ids.length - 1];
  }
  function drawRail() {
    var steps = journey(), cur = 0;
    for (var i = 0; i < steps.length; i++) if (steps[i].id === S.at) cur = i;
    var r = el('rail'); if (!r) return;
    r.innerHTML = '<div class="railIn">' + steps.map(function (x, i) {
      var sec = el(x.id);
      var isOpen = sec && !sec.classList.contains('locked');
      var cls = (i < cur ? 'done' : (i === cur ? 'now' : '')) + (isOpen ? ' can' : '');
      return (i ? '<span class="rsep">&mdash;</span>' : '')
        + '<button class="rl ' + cls.trim() + '"'
        + (isOpen ? ' onclick="Step3.jump(\'' + x.id + '\')"' : ' disabled') + '>'
        + '<b>' + (i + 1) + '</b>' + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }
  // Where the highlight goes once a paper is settled: finishing if this stock
  // can take any, then envelopes if the product has them, then the quantity.
  function afterPaper(name) {
    if ((A.finishTypesFor(name) || []).length) return 's2';
    if (((A.envelopes && A.envelopes()) || []).length) return 's5';
    return 's3';
  }

  // Only ever on a click of theirs. Nothing here moves the page by itself.
  function jump(id) {
    var e = el(id); if (!e) return;
    window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }

  function paint() {
    var m = A.money() || {};
    var picks = Object.keys(S.finishes)
      .filter(function (k) { return S.finishes[k] && S.finishes[k].toLowerCase() !== 'none'; })
      .map(function (k) { return S.finishes[k]; });
    var delName = '';
    (A.deliveries() || []).forEach(function (o) { if (o.id === S.del) delName = o.name; });
    var envName = '';
    if (S.env && S.env !== 'none') {
      ((A.envelopes && A.envelopes()) || []).forEach(function (e) {
        if (e.id === S.env) envName = e.name + ' envelopes';
      });
    }

    el('sum').innerHTML = (S.paper && S.weight)
      ? '<b>' + esc(S.paper) + '</b> &middot; ' + S.weight + 'gsm &middot; '
        + (picks.length ? esc(picks.join(' & ')) : 'no finishing')
        + (envName ? ' &middot; ' + esc(envName) : '')
        + (S.qty ? ' &middot; ' + S.qty + ' cards' : '')
        + (S.qty && delName ? ' &middot; ' + esc(delName) : '')
      : '';
    var ready = !!(S.paper && S.weight && S.qty && S.del);
    el('tot').innerHTML = (ready && m.total != null)
      ? gbp(m.total) + '<small>' + gbp(m.total / S.qty) + ' a card · inc. VAT</small>' : '';
    el('bar').className = 'bar' + ((S.paper && S.weight) ? ' up' : '');
    var add = el('add');
    add.disabled = !ready;
    add.textContent = ready ? 'Add to basket' : (S.qty ? 'Choose delivery' : 'Choose a quantity');
    drawRail();
  }

  function redraw() {
    drawFeels(); drawStocks(); drawFinishing(); drawEnvelopes(); drawQty(); drawDelivery(); paint();
  }

  // ---- what the host calls ---------------------------------------------------
  global.Step3 = {
    init: function (adapter) {
      A = adapter;
      var f = liveFeels()[0];
      if (f && !S.feel) { /* nothing chosen yet — the type cards lead */ }
      el('add').onclick = function () { if (A.onAdd) A.onAdd(); };
      drawFeels(); paint(); renumber();
    },
    setArtwork: function (url) { ART = url || null; redraw(); },
    state: S,

    feel: function (id) {
      var first = S.feel !== id;
      S.feel = id;
      if (first) {
        S.paper = papersIn(id)[0].name; S.weight = null; S.finishes = {};
      }
      A.onSelect(S);
      drawFeels(); drawStocks(); drawFinishing(); drawQty(); drawDelivery();
      open('stocks', true); advanceTo('stocks'); paint(); renumber();
    },
    paper: function (n) {
      S.paper = n; S.weight = null; S.finishes = {};
      advanceTo(afterPaper(n));
      A.onSelect(S); redraw(); renumber();
    },
    weight: function (g) {
      S.weight = g;
      advanceTo(afterPaper(S.paper));
      A.onSelect(S); redraw(); renumber();
    },
    toggleFin: function (t) { S.openFin = (S.openFin === t ? null : t); drawFinishing(); },
    finish: function (t, o) {
      S.finishes[t] = o; S.openFin = null;
      advanceTo(((A.envelopes && A.envelopes()) || []).length ? 's5' : 's3');
      A.onSelect(S); redraw(); renumber();
    },
    env: function (id) {
      var list = (A.envelopes && A.envelopes()) || [];
      // 'yes' opens the colours without choosing one; the first colour is
      // pre-selected so the price never moves without the customer seeing why.
      if (id === 'yes') {
        S.env = list.length ? list[0].id : null;
      } else if (id === 'none') {
        S.env = 'none';
      } else {
        // A colour the printer no longer stocks would otherwise sit in the
        // state unpriced and unhighlighted: chosen as far as the page is
        // concerned, invisible to the customer.
        var known = false;
        for (var i = 0; i < list.length; i++) if (list[i].id === id) known = true;
        if (!known) return;
        S.env = id;
      }
      advanceTo('s3'); A.onSelect(S); redraw(); renumber();
    },
    qty: function (n) { S.qty = n; advanceTo('s4'); A.onSelect(S); redraw(); renumber(); },
    delivery: function (id) { S.del = id; advanceTo('s4'); A.onSelect(S); redraw(); renumber(); },
    jump: jump,
    redraw: redraw
  };
})(window);
