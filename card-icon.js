// One drawing of a card, used everywhere a card is pictured: the size step in
// the uploader and in the design studio, and the flat-or-folded choice.
//
// "Option 1 — Ajar", chosen 27 September from three mocked-up directions. The
// card stands with its back panel splayed behind it, the way a card sits on a
// mantelpiece. The front stays a TRUE rectangle, which matters: the size step's
// first job is to show whether A5 is taller than A6, and a drawing in full
// perspective throws that away. The panel behind carries the depth instead.
//
// This is the approved drawing itself, not a copy of it — the mock-up and the
// site render from the same code.
//
//   ratio  width / height of the FINISHED card, already turned if the customer
//          chose landscape. A ratio above 1 is a landscape card, so nothing
//          needs to tell this function which way round it is.
//   folded is there a crease
//   sel    selected, so the swatch picks up the gold like the tile around it
//   H      the LONG side, in pixels
(function (root) {
  'use strict';

  function cardIcon(opts) {
    var o = opts || {};
    var ratio = o.ratio > 0 ? o.ratio : 0.71;
    var H = o.H || 56, sel = !!o.sel, folded = !!o.folded;

    // The long side is always H, so an A6 and an A5 tile are drawn to the same
    // height and can be compared. A landscape card lies down; a square is square.
    var W, Hh;
    if (ratio >= 1) { W = H; Hh = H / ratio; }
    else            { Hh = H; W = H * ratio; }

    var ink    = sel ? '#B8976A' : '#CDBFB2';   // the drawn edge
    var paper  = sel ? '#F6EFE6' : '#FFFFFF';   // the face towards us
    var behind = sel ? '#EADFCF' : '#F4EEE7';   // a face turned away catches less light

    var pad = 7, x = pad, y = pad;
    var vbW = W + pad * 2, vbH = Hh + pad * 2;

    var shadow = '<ellipse cx="' + r(x + W / 2) + '" cy="' + r(y + Hh + 3) + '" rx="' + r(W * 0.42)
               + '" ry="2.1" fill="#3D2E24" opacity="' + (sel ? '.14' : '.09') + '"/>';

    var front = '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(W) + '" height="' + r(Hh)
              + '" rx="1.5" fill="' + paper + '" stroke="' + ink + '" stroke-width="1.4"/>';

    // A flat card is a true rectangle and nothing else. It keeps the shadow so
    // that flat and folded read as the same family of object.
    if (!folded) return svg(vbW, vbH, shadow + front);

    var d = Math.max(5, W * 0.30);          // how far the back panel is splayed
    var rise = Math.max(3, H * 0.085);      // and how far it is tipped
    // The panel behind always splays to the LEFT, whichever way round the card
    // is. Two other versions were tried for a landscape card, where the crease
    // is really across the top: a panel below read as a tray the card sat in,
    // and a panel above read as an envelope flap. Neither said "folded card".
    //
    // So this is a symbol for "this one folds", not a technical drawing of
    // which edge is creased. Where the crease actually runs is said in words
    // right beneath it, and the press file is what has to be exact.
    var d = Math.max(5, W * 0.30);          // how far the back panel is splayed
    var rise = Math.max(3, Hh * 0.115);     // and how far it is tipped
    var back = 'M' + r(x) + ',' + r(y) + ' L' + r(x) + ',' + r(y + Hh)
             + ' L' + r(x - d) + ',' + r(y + Hh - rise)
             + ' L' + r(x - d) + ',' + r(y - rise) + ' Z';
    var extraW = d, extraH = 0, shiftX = d, shiftY = 0;

    return svg(vbW + extraW, vbH + extraH,
      '<g transform="translate(' + r(shiftX) + ',' + r(shiftY) + ')">'
      + shadow
      + '<path d="' + back + '" fill="' + behind + '" stroke="' + ink
        + '" stroke-width="1.2" stroke-linejoin="round"/>'
      + front
      + '</g>');
  }

  function r(n) { return Math.round(n * 100) / 100; }

  function svg(w, h, inner) {
    return '<svg viewBox="0 0 ' + r(w) + ' ' + r(h) + '" width="' + r(w) + '" height="' + r(h)
         + '" xmlns="http://www.w3.org/2000/svg" role="presentation" '
         + 'style="overflow:visible;display:block">' + inner + '</svg>';
  }

  root.cardIcon = cardIcon;
})(window);
