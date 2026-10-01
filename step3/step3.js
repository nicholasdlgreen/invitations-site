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

  // Signature, Luxury and Eco — the choice that decides which stocks follow.
  // The ids are what paper_stocks.tier stores; 'kinder' is historical and the
  // customer sees Eco. A tier with no papers behind it never appears.
  var FEELS = [
    { id: 'signature', name: 'Signature', flag: 'Most popular',
      sub: 'Smooth, crisp and substantial. Colour prints sharp and type stays clean.' },
    { id: 'luxury',    name: 'Luxury', flag: '',
      sub: 'Italian mill papers with a grain you feel before you read a word. Made by Fedrigoni.' },
    { id: 'kinder',    name: 'Eco', flag: 'Kinder',
      sub: 'Wholly recycled and thick with it, flecked with natural fibre you can see.' }
  ];

  function el(id) { return document.getElementById(id); }
  // Sections the host wants left out of the numbered line at the top. They are
  // still drawn, still answered, still part of the order — the range is chosen
  // exactly as before. They are simply not counted as one of the steps, so the
  // line reads 1 to 6 and the section itself carries no number.
  function offRail(id) {
    var list = (A && A.railSkips && A.railSkips()) || [];
    for (var i = 0; i < list.length; i++) if (list[i] === id) return true;
    return false;
  }
  // Most stocks are paper and measured in gsm; a display board is measured in
  // millimetres of thickness. The weight carries its own unit so "5mm" never
  // comes out as "5gsm".
  function unitOf(w) { return (w && w.unit) || 'gsm'; }
  function thickness(w) { return w ? w.gsm + unitOf(w) : ''; }

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
  // A product sold on a single stock — a welcome sign on one board — has
  // nothing to decide here. Asking anyway puts a click and a whole step in
  // front of the only real question, which is how many.
  function soleFeel() {
    var f = liveFeels();
    return f.length === 1 ? f[0].id : null;
  }
  // True when the stock step has no choice in it either: one paper, one
  // weight. It still draws, because seeing the design on the stock is the
  // point of it, but it is not something the customer has to answer.
  function stockIsFixed() {
    if (!soleFeel()) return false;
    var mine = papersIn(soleFeel());
    if (mine.length !== 1) return false;
    var ws = (A.weightsFor && A.weightsFor(mine[0])) || [];
    return ws.length <= 1;
  }
  function currentPaper() {
    var list = A.papers() || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === S.paper) return list[i];
    return list[0] || null;
  }

  // The artwork used to be laid here and printed through the paper's grain.
  // Measured, the difference between stocks under artwork is about 1% and does
  // not improve with size, so it never showed what it promised — it only
  // covered the photograph of the stock the customer came here to look at.
  // The stock is now shown on its own, which is the one thing this step is for.

  // ---- 1 · the tier ---------------------------------------------------------
  // Each pod carries the real stocks in its tier, side by side. It used to show
  // the customer's artwork printed through one stock's grain — cropped, tilted,
  // and claiming a paper they had not chosen yet. Measured, the difference
  // between stocks under artwork is about 1% and does not improve with size, so
  // there was nothing to see even at full width. The swatches say more.
  function drawFeels() {
    var box = el('feels'); if (!box) return;
    box.innerHTML = liveFeels().map(function (f) {
      var mine = papersIn(f.id);
      var swatches = mine.map(function (p) {
        return '<span class="sw" style="background-image:url(\'' + esc(A.imageFor(p.name) || '') + '\')"></span>';
      }).join('');
      // No price on the range pod. A figure here is a figure before the
      // specification is finished — the size, the stock, the finishing and the
      // quantity all still to come — so it is a number nobody can act on, and
      // it is not the number they will pay. Only a full price builder would
      // earn one. A.tierFrom is left on the adapter unused, so this is one
      // line to put back if that changes.
      var count = mine.length + (mine.length === 1 ? ' paper' : ' papers');
      return '<button class="feel ' + f.id + (S.feel === f.id ? ' on' : '') + '" onclick="Step3.feel(\'' + f.id + '\')">'
        + (f.flag ? '<span class="flag">' + esc(f.flag) + '</span>' : '')
        + '<span class="sws">' + swatches + '</span>'
        + '<span class="tick">&#10003;</span>'
        + '<span class="cap"><span class="nm">' + esc(f.name) + '</span>'
        + '<span class="sub">' + esc(f.sub) + '</span>'
        + '<span class="meta"><span class="cnt">' + count + '</span>'
        + '</span></span></button>';
    }).join('');
  }

  // ---- 2 · the paper and its weight -----------------------------------------
  function drawStocks() {
    if (!S.feel) return;
    var head = el('stocks') && el('stocks').querySelector('.num h2');
    if (head) head.textContent = stockLabel() === 'Board' ? 'Your board' : 'Your paper';
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
    for (var u = 0; u < ws.length; u++) {
      if (ws[u].gsm === S.weight) S.weightUnit = unitOf(ws[u]);
    }
    el('weights').innerHTML = ws.length > 1
      ? '<div class="opts">' + ws.map(function (w) {
          return '<button class="opt' + (w.gsm === S.weight ? ' on' : '') + '" onclick="Step3.weight(' + w.gsm + ')">'
            + '<span class="a">' + thickness(w) + '</span><span class="b">' + esc(w.name || '') + '</span></button>';
        }).join('') + '</div>'
      : '<div class="one">' + (ws[0] ? thickness(ws[0]) + (ws[0].name ? ' · ' + ws[0].name : '') : '')
        + (ws[0] && unitOf(ws[0]) === 'mm'
            ? ' — the thickness this board comes in.</div>'
            : ' — the only weight this paper comes in.</div>');
  }

  // Push state back to the page after this module changes it by itself, rather
  // than in response to a click. updatePrice() does not call back into here, so
  // this cannot loop.
  function tellPage() {
    try { if (A && typeof A.onSelect === 'function') A.onSelect(S); }
    catch (e) { /* the page is not ready to be told; the next click will tell it */ }
  }

  // ---- 3 · finishing ---------------------------------------------------------
  function drawFinishing() {
    if (!S.paper) { open('s2', false); return; }
    var types = A.finishTypesFor(S.paper) || [];
    // Forget a pick this route can no longer do.
    //
    // Rounded corners exist on a flat card and not on a creased one, so going
    // back to change the fold can take an option away underneath a choice
    // already made. Left alone it stayed in the summary and went to the basket
    // with no price behind it. Same reasoning as the abandoned face tabs: the
    // state has to follow what is actually on the page.
    var offered = {};
    types.forEach(function (t) {
      offered[t.name] = {};
      (t.options || []).forEach(function (o) { offered[t.name][o.name] = true; });
    });
    var dropped = [];
    Object.keys(S.finishes).forEach(function (k) {
      var v = S.finishes[k];
      if (!v || String(v).toLowerCase() === 'none') return;
      if (!offered[k] || !offered[k][v]) { delete S.finishes[k]; dropped.push(k + ': ' + v); }
    });
    if (dropped.length) {
      if (S.openFin && !offered[S.openFin]) S.openFin = null;
      tellPage();
    }
    if (!types.length || !types.some(function (t) { return !t.unavailable; })) {
      // Nothing that can actually be applied. A section of nothing but dead
      // rows is worse than no section, so it still goes.
      open('s2', false); renumber(); return;
    }
    el('finBody').innerHTML = types.map(function (t) {
      // An option the chosen paper cannot take. Shown, and shown to be
      // unavailable, rather than quietly removed — a customer who never sees
      // foiling cannot tell whether we do not offer it or this paper will not
      // hold it. The reason itself is not given here: what is unavailable and
      // why is a rules question, and this only draws what it is told.
      if (t.unavailable) {
        return '<div class="finRow cant"><button class="finBtn" type="button" disabled>'
          + '<span><span class="h">' + esc(t.name) + '</span><br>'
          + '<span class="d">' + esc(t.description || '') + '</span></span>'
          + '<span class="v">Not available</span><span class="c"></span></button></div>';
      }
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
                      : (shapeSwatch(t.name, o.name)
                         || '<span class="mat" style="' + matStyle(t.name, o.name) + '"></span>'))
              + '</span><span class="cap"><span class="nm">' + esc(o.name) + '</span>'
              + '<span class="sub">' + esc(o.description || '') + '</span></span></button>';
          }).join('')
        + '</div></div></div></div>';
    }).join('');
    sizeOpenFinPanel();
    open('s2', true); renumber();
  }

  // The open panel's height was a fixed 460px in the stylesheet, which is what
  // the animation needs to slide against. It is also a guillotine: foiling has
  // nine options, and at phone width they stack one per column and come to
  // 1,813px — so seven of the eight colours were cut off and could not be
  // reached at all. It was already too tight for four options before the five
  // new foils were added.
  //
  // The cap is now measured from the content rather than guessed, so the
  // animation still has something to slide against and nothing is ever hidden
  // behind it.
  function sizeOpenFinPanel() {
    var rows = document.querySelectorAll('#s3wrap .finRow');
    for (var i = 0; i < rows.length; i++) {
      var panel = rows[i].querySelector('.finPanel');
      if (!panel) continue;
      var inner = panel.firstChild;
      panel.style.maxHeight = (rows[i].className.indexOf('open') >= 0 && inner)
        ? (inner.scrollHeight + 2) + 'px' : '';
    }
  }

  // Corners and fold change the SHAPE of the card, not what it is made of, so
  // the material disc says nothing about them — square corners came out as a
  // circle, identical to rounded. These draw the card instead. Returns null
  // for everything else, which falls through to the disc.
  function shapeSwatch(type, opt) {
    var o = String(opt).toLowerCase();
    if (/corner/i.test(type)) {
      return '<span class="shape' + (/round/.test(o) ? ' r' : '') + '"></span>';
    }
    if (/^fold$/i.test(type)) {
      if (/tent/.test(o))  return '<span class="shape tent"></span>';
      if (/short/.test(o)) return '<span class="shape"><i class="crease h"></i></span>';
      return '<span class="shape"><i class="crease v"></i></span>';
    }
    return null;
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
      // The eight foils PrintedEasy actually run, read off their own colour
      // list on 1 October. We offered three of them.
      if (/rose/.test(o))   return metal('#8E5745', '#F6D6C6', '#D08E74', '#7E4A39');
      if (/silver/.test(o)) return metal('#6F757D', '#FBFCFD', '#C3C9D0', '#666C74');
      if (/copper/.test(o)) return metal('#6F3317', '#F4C9A4', '#C0713F', '#5E2B12');
      if (/red/.test(o))    return metal('#6E101B', '#F8B9BF', '#C32C3B', '#5C0C16');
      if (/blue/.test(o))   return metal('#0F2F57', '#BFD9F7', '#2A6CB4', '#0B2446');
      if (/green/.test(o))  return metal('#114027', '#C2E8CF', '#2B8955', '#0D3320');
      // Holographic is not one metal. It is a sheen that changes with the
      // angle, so a single linear ramp reads as a flat colour and lies about
      // what arrives. The hue sweep is the honest picture of it.
      if (/holo/.test(o))
        return 'background:'
          + 'radial-gradient(circle at 33% 25%,rgba(255,255,255,.92) 0%,rgba(255,255,255,.30) 28%,rgba(255,255,255,0) 54%),'
          + 'conic-gradient(from 210deg,#8FD9E8,#C7A8E8,#F2A8C4,#F6D79B,#BFE8A8,#8FD9E8)';
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
    var wrap = el('envsWrap');
    // And forget a colour this route cannot supply. Luxury Folded sells white
    // and no red, so changing to that stock must not leave red selected.
    if (S.env && S.env !== 'none' && !list.some(function (e) { return e.id === S.env; })) {
      S.env = list.length ? null : 'none';
      tellPage();
    }
    // Envelopes live inside Finishing now, so this shows and hides its own
    // block rather than a whole numbered stage.
    if (!S.paper || !S.weight || !list.length) {
      if (wrap) wrap.style.display = 'none';
      el('envs').innerHTML = '';
      return;
    }
    if (wrap) wrap.style.display = '';
    var said = S.env !== null;
    var yes  = said && S.env !== 'none';
    // Its own heading, because it sits under the finishing options now and
    // would otherwise read as two more finishing buttons.
    var html = '<h3 class="envHead">Envelopes</h3>'
      + '<div class="envAsk">'
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
  }

  // ---- 5 · how many ----------------------------------------------------------
  // Tiles for the common amounts, and a box for anyone who needs a number that
  // is not on them. The printer takes any quantity, so the shop does too.
  function drawQty() {
    if (!S.paper || !S.weight) { open('s3', false); renumber(); return; }
    var steps = A.quantities() || [];
    var onTile = steps.indexOf(S.qty) >= 0;
    var range = (A.quantityRange && A.quantityRange()) || null;

    var tiles = steps.map(function (n) {
      var per = A.perCardAt(n);
      return '<button class="qty' + (S.qty === n ? ' on' : '') + '" onclick="Step3.qty(' + n + ')">'
        + '<span class="n">' + n + '</span>'
        + '<span class="e">' + (per == null ? '' : gbp(per) + ' each') + '</span></button>';
    }).join('');

    // The typed amount gets its own tile once chosen, so the page always shows
    // what is selected rather than leaving every tile looking unpicked.
    if (S.qty && !onTile) {
      var per2 = A.perCardAt(S.qty);
      tiles += '<button class="qty on qty-own">'
        + '<span class="n">' + S.qty + '</span>'
        + '<span class="e">' + (per2 == null ? '' : gbp(per2) + ' each') + '</span></button>';
    }

    tiles += '<div class="qty-own-wrap">'
      + '<label class="qty-own-lb" for="qtyOwn">A different amount</label>'
      + '<span class="qty-own-row">'
      + '<input id="qtyOwn" class="qty-own-in" type="number" inputmode="numeric" min="'
      + (range ? range.min : 1) + '" max="' + (range ? range.max : 9999) + '" step="1"'
      + ' placeholder="e.g. 87"'
      // Left empty on purpose. Once a typed amount has its own tile, repeating
      // it in the box reads as two orders of the same thing — 87 beside 87.
      // The tile is the record of the choice; the box is for changing it.
      + ' value=""'
      + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();Step3.ownQty(this.value)}">'
      + '<button class="qty-own-go" type="button" onclick="Step3.ownQty(document.getElementById(\'qtyOwn\').value)">Use</button>'
      + '</span>'
      // Empty. The range used to be spelled out here — "Any number from 1 to
      // 500" — and it is not wanted. The element stays because a number
      // outside what the printer will quote still has to say so; see ownQty.
      + '<span class="qty-own-hint" id="qtyOwnHint"></span></div>';

    el('qtys').innerHTML = tiles;
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
    // Start after the host's own steps, so a page that owns size and artwork
    // numbers its first stage 3 rather than 1 and the journey reads as one.
    var n = ((A.leadingSteps && A.leadingSteps()) || []).length;
    ['s1', 'stocks', 's2', 's3', 's4'].forEach(function (id) {
      var sec = el(id); if (!sec) return;
      // A step hidden because it had nothing to decide must not take a number
      // with it, or the first thing on screen is headed 2.
      if (sec.style.display === 'none') return;
      var b = sec.querySelector('.num b'); if (!b) return;
      // Off the top line means off the numbering too, or the heading beside
      // the range would claim a number the line above does not have.
      if (offRail(id)) { b.textContent = ''; return; }
      // A locked step used to be left alone, which meant it kept whatever
      // number step3.html was written with until it opened. Beside a top line
      // that had already moved on, it read as a mistake — "2 Your paper" under
      // a line calling paper step 3. It is numbered whether it is open or not.
      n += 1; b.textContent = n;
    });
    drawRail();
  }
  // The whole journey from the first moment. It does not grow as you go — the
  // steps are all there and the highlight moves along them.
  function journey(withHidden) {
    var noEnv = !((A.envelopes && A.envelopes()) || []).length;
    // Finishing holds the envelopes as well, so it is only skipped when this
    // stock can take neither.
    var noFinish = !!S.paper
      && (A.finishTypesFor(S.paper) || []).length === 0
      && noEnv;
    // The steps the HOST page owns, before this one begins — size and artwork
    // on the shop. Supplied by the adapter so this file does not need to know
    // what they are, and so a host that supplies none behaves exactly as
    // before: the journey starts at Range and is numbered from 1.
    var lead = (A.leadingSteps && A.leadingSteps()) || [];
    // And the steps the host owns AFTER this one — basket and checkout. They
    // are named here so the rail and the page's own bar can be drawn from one
    // list. A map that changes shape halfway through is not a map.
    var trail = (A.trailingSteps && A.trailingSteps()) || [];
    return lead.concat([
      { id: 's1', label: 'Range', skip: !!soleFeel() },
      { id: 'stocks', label: stockLabel() },
      { id: 's2', label: 'Finishing', skip: noFinish },
      { id: 's3', label: 'Quantity' },
      { id: 's4', label: 'Delivery' }
    ]).concat(trail).filter(function (x) {
      return !x.skip && (withHidden || !offRail(x.id));
    });
  }
  // "Paper" over a sheet of foamex is wrong. The weight carries its unit, so
  // the stock says which it is without a second list to keep in step.
  function stockLabel() {
    var p = currentPaper();
    var ws = (p && A.weightsFor && A.weightsFor(p)) || [];
    return ws.length && ws.every(function (w) { return w && w.unit === 'mm'; }) ? 'Board' : 'Paper';
  }
  function advanceTo(id) {
    var ids = journey().map(function (x) { return x.id; });
    S.at = ids.indexOf(id) >= 0 ? id : ids[ids.length - 1];
  }
  function drawRail() {
    var steps = journey(), cur = 0;
    // The customer can be standing on a section that is not on the line — the
    // range. Lighting nothing would send the highlight back to the first step,
    // which is what it did: choosing a range lit "Size". So it moves forward
    // to the step that section leads into, which for the range is the paper.
    var all = journey(true), from = 0;
    for (var a = 0; a < all.length; a++) if (all[a].id === S.at) from = a;
    var atId = S.at;
    for (var b = from; b < all.length; b++) {
      if (!offRail(all[b].id)) { atId = all[b].id; break; }
    }
    for (var i = 0; i < steps.length; i++) if (steps[i].id === atId) cur = i;
    var r = el('rail'); if (!r) return;
    r.innerHTML = '<div class="railIn">' + steps.map(function (x, i) {
      var sec = el(x.id);
      // A host step lives outside this component and has no locked class. One
      // behind us is done by definition — we could not be standing here
      // otherwise — so it stays clickable to go back to. One ahead of us has
      // not been reached and must not look as though it has.
      var isOpen = x.host ? !x.ahead : (sec && !sec.classList.contains('locked'));
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
    if (((A.envelopes && A.envelopes()) || []).length) return 's2';
    return 's3';
  }

  // Only ever on a click of theirs. Nothing here moves the page by itself.
  function jump(id) {
    // A step the host owns is not in this component's markup, and the page
    // may well have hidden its panel. Scrolling to it would look like the
    // click did nothing, so it is handed back to the host to act on.
    if (A && A.goToHostStep && A.goToHostStep(id)) return;
    var e = el(id); if (!e) return;
    window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }

  // The range the customer picked colours the rest of the step, so the choice
  // they made at the top is still visible at the bottom. One property on the
  // wrapper; every accent reads it and falls back to gold.
  var TIER_COLOUR = { signature: '#B8976A', luxury: '#8A6A72', kinder: '#7A8B6F' };
  function paintTier() {
    var w = el('s3wrap'); if (!w) return;
    w.style.setProperty('--tier', TIER_COLOUR[S.feel] || TIER_COLOUR.signature);
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

    // The size and the shape were chosen two steps before this bar appeared
    // and are named nowhere else on it, so the running summary did not say
    // what was being bought — only what it was printed on.
    var shape = (A.shapeLabel && A.shapeLabel()) || '';
    el('sum').innerHTML = (S.paper && S.weight)
      ? (shape ? esc(shape) + ' &middot; ' : '')
        + '<b>' + esc(S.paper) + '</b> &middot; ' + S.weight + (S.weightUnit || 'gsm') + ' &middot; '
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
    paintTier();
    drawFeels(); drawStocks(); drawFinishing(); drawEnvelopes(); drawQty(); drawDelivery(); paint();
  }

  // ---- what the host calls ---------------------------------------------------
  global.Step3 = {
    init: function (adapter) {
      A = adapter;
      el('add').onclick = function () { if (A.onAdd) A.onAdd(); };

      // Settle whatever the customer has no say in, so the page opens on the
      // first thing they actually choose rather than on a card with one option.
      var only = soleFeel();
      if (only && !S.feel) {
        S.feel = only;
        S.paper = (papersIn(only)[0] || {}).name || null;
        if (el('s1')) el('s1').style.display = 'none';
        redraw();
        // drawStocks settles the weight when there is only one, so the
        // quantity step can open behind it.
        open('stocks', true);
        advanceTo(stockIsFixed() ? afterPaper(S.paper) : 'stocks');
        if (stockIsFixed()) { drawFinishing(); drawEnvelopes(); drawQty(); }
        A.onSelect(S);
      } else {
        drawFeels();
      }
      paint(); renumber();
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
      paintTier();
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
      advanceTo('s3');
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
    // A typed amount. Anything outside what the printer will quote is refused
    // with the reason, rather than silently snapping to a number they did not
    // ask for and then charging for it.
    ownQty: function (v) {
      var n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      var range = (A.quantityRange && A.quantityRange()) || { min: 1, max: 9999 };
      var hint = el('qtyOwnHint');
      function say(msg) { if (hint) { hint.textContent = msg; hint.className = 'qty-own-hint bad'; } }
      if (!n || n < 1)          return say('Enter how many you need.');
      if (n < range.min)        return say('The smallest we can print is ' + range.min + '.');
      if (n > range.max)        return say('The most we can print in one order is ' + range.max
                                           + '. Get in touch for more.');
      S.qty = n; advanceTo('s4'); A.onSelect(S); redraw(); renumber();
    },
    delivery: function (id) { S.del = id; advanceTo('s4'); A.onSelect(S); redraw(); renumber(); },
    jump: jump,
    // The journey as this file sees it, so the host page's own bar is drawn
    // from the very same code rather than a copy of it kept in step by hand.
    // Pass an adapter to ask before the step has been started; without one it
    // answers for the step as it stands, and null if it has not started.
    journey: function (adapter) {
      if (!adapter) return A ? journey() : null;
      var wasA = A, wasS = S;
      A = adapter;
      S = { feel: null, paper: null, weight: null, finishes: {}, env: null,
            qty: null, del: null, openFin: null, at: 's1' };
      try { return journey(); } finally { A = wasA; S = wasS; }
    },
    redraw: redraw
  };
})(window);
