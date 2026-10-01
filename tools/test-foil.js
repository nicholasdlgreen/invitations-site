// Foiling: the colours our printer actually runs, and the panel that has to
// hold them.
//
// PrintedEasy run eight foils. We offered three, and the finishing panel was
// capped at a fixed 460px — which at phone width hid seven of the nine options
// behind the cap where they could not be reached at all.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-foil.js

var SRC = readFile('step3/step3.js');

function grab(name) {
  var needle = '\n  function ' + name + '(';
  var i = SRC.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + name);
  i += 1;
  var j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++) {
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/') { k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"') {
      var q = c;
      for (k++; k < SRC.length; k++) { if (SRC[k] === '\\') { k++; continue; } if (SRC[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1);
}

eval(grab('matStyle'));

var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}

print('\nEVERY FOIL OUR PRINTER RUNS CAN BE DRAWN');
// Read off PrintedEasy's own colour list, 1 October 2026.
var FOILS = ['Gold','Silver','Copper','Rose Gold','Red','Blue','Holographic','Green'];
var seen = {};
FOILS.forEach(function (c) {
  var css = matStyle('Foiling', c);
  is(typeof css === 'string' && css.length > 40, true, c + ' has a swatch of its own');
  is(!!seen[css], false, c + ' does not come out looking like another foil');
  seen[css] = true;
});

print('\nHOLOGRAPHIC IS NOT A METAL');
// A single linear ramp reads as a flat pastel and lies about what arrives: the
// whole point of the foil is that it changes with the angle.
var holo = matStyle('Foiling', 'Holographic');
is(/conic-gradient/.test(holo), true, 'it is drawn as a sweep through the hues');
is(/linear-gradient\(145deg/.test(holo), false, 'not with the metal ramp the others use');
is(/linear-gradient\(145deg/.test(matStyle('Foiling', 'Gold')), true,
   'while gold still is a metal');

print('\nAN UNKNOWN FOIL STILL DRAWS');
// A colour added in admin that nobody has written a swatch for must not come
// out blank — gold is the sane default for a foil.
is(matStyle('Foiling', 'Champagne'), matStyle('Foiling', 'Gold'),
   'an unrecognised foil falls back to gold rather than to nothing');

print('\nTHE PANEL HOLDS WHAT IS PUT IN IT');
is(/function sizeOpenFinPanel\(\)/.test(SRC), true,
   'the open height is worked out, not written down');
is(/panel\.style\.maxHeight = \(rows\[i\]\.className\.indexOf\('open'\) >= 0 && inner\)/.test(SRC),
   true, 'measured from the content of whichever row is open');
is(/\(inner\.scrollHeight \+ 2\) \+ 'px' : ''/.test(SRC), true,
   'and cleared when it closes, so the row still animates shut');
is(/\}\)\.join\(''\);\n    sizeOpenFinPanel\(\);/.test(SRC), true,
   'run every time the finishing section is drawn, because the number of '
   + 'options changes with the paper');

print('\nWHAT WE ACCEPT AS A FOIL LAYER');
// foilChecks lives on the page, not in the component. It is cut out of the
// shipped file so a copy cannot drift from it.
var HTML = readFile('upload-and-print.html');
function grabHost(name) {
  var needle = '\nfunction ' + name + '(';
  var i = HTML.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + name);
  i += 1;
  var j = HTML.indexOf('{', i), depth = 0, k = j;
  for (; k < HTML.length; k++) {
    var c = HTML[k];
    if (c === '/' && HTML[k+1] === '/') { k = HTML.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`') {
      var q = c;
      for (k++; k < HTML.length; k++) { if (HTML[k] === '\\') { k++; continue; } if (HTML[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  return HTML.slice(i, k + 1);
}
var foilLayer = null;
// foilChecks works out what the layer SHOULD be from the card as it stands,
// so the harness has to know what card we are on.
var PRINT_BLEED_MM = 3;
var selectedSize = 'A5';
var SIZES = { 'A5': { mmW:148, mmH:210 }, 'A6': { mmW:105, mmH:148 } };
function sizeSpec(k){ return SIZES[k] || null; }
eval(grabHost('foilChecks'));
eval(grabHost('foilLayerAccepted'));

var A5 = { w: 154, h: 216 };           // A5 plus 3mm bleed all round
function layer(over) {
  var r = { ok:true, pageMm:{w:154,h:216}, want:A5, dark:0.027, offColour:0, box:{}, pages:1 };
  for (var k in (over||{})) r[k] = over[k];
  return { file:{name:'foil.pdf'}, report:r };
}
function statuses(){ return foilChecks().map(function(c){ return c.status + ':' + c.label; }); }

foilLayer = layer();
is(statuses(), ['ok:Size','ok:Colour','ok:What to foil'], 'a proper foil layer passes on all three');
is(foilLayerAccepted(), true, 'and is accepted');

foilLayer = layer({ pageMm:{w:148,h:210} });
is(statuses()[0], 'err:Size', 'trim size without the bleed is refused \u2014 it would not line up');
is(foilLayerAccepted(), false, 'and the order cannot go on it');

foilLayer = layer({ pageMm:{w:154.6,h:215.5} });
is(statuses()[0], 'ok:Size', 'half a millimetre out is still the same page, not a fault');

foilLayer = layer({ offColour:0.5, dark:0 });
is(foilLayerAccepted(), false, 'a colour copy of their artwork is refused');
is(statuses()[1], 'err:Colour', 'and says it is the colour that is wrong');

foilLayer = layer({ offColour:0.004 });
is(statuses()[1], 'ok:Colour',
   'a trace of colour is the anti-aliasing round the edge of lettering, not a fault');

foilLayer = layer({ dark:0 });
is(statuses()[2], 'err:What to foil', 'a blank page has nothing to foil');
is(foilLayerAccepted(), false, 'and is refused');

foilLayer = layer({ pages:3 });
is(statuses().pop(), 'warn:Pages', 'more than one page is a warning, not a refusal');
is(foilLayerAccepted(), true, 'because the first page is the one we use');

foilLayer = layer({ notPdf:true });
is(statuses(), ['err:File type'], 'anything but a PDF is refused outright');
foilLayer = layer({ ok:false });
is(statuses(), ['err:Foil layer'], 'and so is a PDF we cannot open');

foilLayer = null;
is(foilLayerAccepted(), false, 'with nothing uploaded, nothing is accepted');

print('\nHOW MANY AREAS, AND HOW BIG');
// "Areas" cannot mean marks. Charlotte & James is sixteen marks and one area
// to anyone looking at the card, and the printer's tiers are One, Two, Three,
// Foil on Foil, All Over — places on the card, not letters.
eval(grabHost('measureFoilAreas'));

// A page of RGBA pixels, white, with black rectangles painted on it.
function page(wPx, hPx, rects) {
  var d = new Uint8ClampedArray(wPx * hPx * 4).fill(255);
  rects.forEach(function (r) {
    for (var y = r.y; y < r.y + r.h; y++)
      for (var x = r.x; x < r.x + r.w; x++) {
        var i = (y * wPx + x) * 4;
        d[i] = d[i+1] = d[i+2] = 0;
      }
  });
  return d;
}
// 154 x 216mm at 1px per mm keeps the arithmetic legible.
var MM = { w: 154, h: 216 };
function measure(rects) { return measureFoilAreas(page(154, 216, rects), 154, 216, MM); }

// Nine letters 6mm apart, then a second line 4mm below: one block.
var letters = [];
for (var i = 0; i < 9; i++) letters.push({ x: 48 + i*6, y: 90, w: 4, h: 8 });
for (var i = 0; i < 5; i++) letters.push({ x: 62 + i*6, y: 102, w: 4, h: 8 });
var r1 = measure(letters);
is(r1.areas.length, 1, 'two lines of lettering are ONE area, not fourteen marks');
is(r1.areas[0].wMm >= 50 && r1.areas[0].wMm <= 56, true, 'measured across the whole block');
is(r1.areas[0].hMm >= 18 && r1.areas[0].hMm <= 24, true, 'and down both lines');
is(r1.bleeds, false, 'and it is nowhere near the edge');

// The same names, plus a rule right down at the foot: two places on the card.
var r2 = measure(letters.concat([{ x: 50, y: 190, w: 54, h: 2 }]));
is(r2.areas.length, 2, 'a rule at the foot is a second area');
is(r2.areas[0].wMm >= r2.areas[1].wMm * 0.5, true, 'and they are reported largest first');

// Grouping must not inflate the measurement: the size comes from the marks.
var r3 = measure([{ x: 60, y: 100, w: 20, h: 10 }]);
is(r3.areas[0].wMm <= 22 && r3.areas[0].hMm <= 12, true,
   'one mark measures its own size \u2014 the 6mm used to group is not added to it');

// Anything in the 3mm bleed margin is foil over the cut, which the printer asks about.
is(measure([{ x: 0, y: 100, w: 40, h: 10 }]).bleeds, true, 'a mark off the left edge bleeds');
is(measure([{ x: 60, y: 0,  w: 30, h: 8  }]).bleeds, true, 'and off the top');
is(measure([{ x: 60, y: 100, w: 30, h: 8 }]).bleeds, false, 'while one in the middle does not');

print('\nWHAT THE BASKET WAITS FOR');
var selectedFinishes = {};
// addBlockedReason now asks unpricedBlockReason first, so a finish this route
// cannot be charged for stops the order before the foiling checks are reached.
var selectedFinishes = { Foiling: 'Gold' };
function lookupFinishSell(){ return 0; }   // priced; the foiling checks are what this suite is about
eval(grabHost('unpricedFinish'));
eval(grabHost('unpricedBlockReason'));
eval(grabHost('addBlockedReason'));
foilLayer = null; foilBusy = false;
selectedFinishes = {};
is(addBlockedReason(), null, 'no foil chosen, nothing to wait for');
selectedFinishes = { Foiling: 'None' };
is(addBlockedReason(), null, 'and None is not a choice of foil');
selectedFinishes = { Foiling: 'Gold' };
is(addBlockedReason(), 'Add your foil layer', 'gold with no layer holds the basket');
foilBusy = true;
is(/Checking/.test(addBlockedReason()), true, 'and says so while it is being checked');
foilBusy = false;
foilLayer = layer({ pageMm:{w:148,h:210} });
is(addBlockedReason(), 'Fix your foil layer', 'a refused layer holds it too');
foilLayer = layer();
is(addBlockedReason(), null, 'a good one lets it through');

print('\nEVERY COLOUR, NOT JUST THE FIRST ONE');
// Gold was the one that got walked through. These are the two places colour
// is turned into something on screen, checked for all eight.
var selectedFinishes = {};
eval(grabHost('foilDotStyle'));
var seenDot = {};
FOILS.forEach(function (c) {
  var dot = foilDotStyle(c);
  is(typeof dot === 'string' && dot.length > 8, true, c + ' has a dot');
  is(!!seenDot[dot], false, c + ' is not the same dot as another colour');
  seenDot[dot] = true;
});
is(/conic-gradient/.test(foilDotStyle('Holographic')), true,
   'and holographic is a sweep here too, not a flat pastel');
is(foilDotStyle('Champagne'), foilDotStyle('Gold'),
   'an unrecognised foil falls back to gold rather than to no dot at all');

print('\nTHE VERDICT IS MADE NOW, NOT WHEN THE FILE ARRIVED');
// The customer can go back from the rail and change the size. The foil layer
// they already gave us is then the wrong size, but the verdict was frozen at
// upload time: an A5 layer sailed through on an A6 card and the basket
// released.
selectedSize = 'A5';
foilLayer = layer();                       // a 154 x 216mm layer, right for A5
is(foilLayerAccepted(), true, 'the layer is right for the card it was made for');
selectedSize = 'A6';                       // they go back and change the size
is(foilLayerAccepted(), false,
   'and wrong for the card once the size has changed underneath it');
is(statuses()[0], 'err:Size', 'which is said as a size fault');
is(/111 \u00d7 154mm/.test(foilChecks()[0].note), true,
   'quoting what the layer should be for the NEW size, not the old one');
selectedSize = 'A5';
is(foilLayerAccepted(), true, 'and right again if they change back');
is(/r\.want\.w/.test(HTML), false,
   'the size captured at upload time is never used for the verdict');

print('\nNO COLOUR, NO FOIL');
// Switching to a paper that cannot be foiled clears the colour but keeps the
// uploaded layer in hand, which is right. What was not right: the order then
// carried a foil spec with no colour, and a foil plate the press would have
// made for a job with no foiling in it.
is(/const colour = selectedFinishes && selectedFinishes\['Foiling'\];\n  if \(!colour \|\| String\(colour\)\.toLowerCase\(\) === 'none'\) return null;/.test(HTML),
   true, 'no foil spec at all unless a colour is actually chosen');

print('\nWHAT REACHES THE ORDER');
is(/foil\.url = await uploadFoilLayer\(\);/.test(HTML), true,
   'the foil layer is sent to storage, so it survives the trip to checkout');
is(/if \(printSpec\) printSpec\.foil = foil;/.test(HTML), true,
   'and is recorded on the print spec with what we measured');
is(/foil: foil \|\| null,/.test(HTML), true,
   'and on the price basis, because the cost of foiling moves with the area');
is(/foilLayerUrl: foil \? foil\.url : null,/.test(HTML), true,
   'and on the basket line itself');
// Found by walking a colour through that had not been walked through before.
// printSpec is null whenever the press file did not build, and the foil was
// hung off it — so the order had a foil layer uploaded, a colour on the line,
// and nothing anywhere saying what to foil.
is(/foilSpec: foil \|\| null,/.test(HTML), true,
   'the foil spec is on the line in its own right, not only inside the press '
   + 'spec, which is null whenever the press file did not build');
// foilSummary opens with the same line, so matching it anywhere in the file
// proved nothing — the second time today that a loose source assertion passed
// against the wrong function. Pinned to this one.
is(/async function uploadFoilLayer\(\)\{\n  if \(!foilLayer \|\| !foilLayerAccepted\(\)\) return null;/.test(HTML),
   true, 'nothing is uploaded for a layer we refused');
is(/var blocked = \(A\.addBlocked && A\.addBlocked\(\)\) \|\| null;/.test(SRC), true,
   'step 3 asks the page whether it may take the money');
is(/&& !blocked;/.test(SRC), true, 'and will not while the answer is a reason');

print('\nTHE ROW STAYS OPEN WHILE THERE IS MORE TO ASK');
// Choosing a colour closed the row, which shut the panel on the foil-layer
// upload the choice had just revealed. The customer had to reopen the row to
// find the thing they now had to do.
is(/var more = \(A\.foilBlock && A\.foilBlock\(t, o\)\) \|\| '';/.test(SRC), true,
   'choosing an option asks the host whether anything is left to answer');
is(/S\.openFin = more \? t : null;/.test(SRC), true,
   'and the row stays open while there is, and closes when there is not');
is(/S\.finishes\[t\] = o; S\.openFin = null;/.test(SRC), false,
   'never closed unconditionally again');

print('\nTHE CANVAS SURVIVES A REDRAW');
// Route B's panel holds a canvas the customer points at. The finishing body is
// redrawn by replacing its innerHTML, which destroys everything inside it —
// including a canvas and everything painted on it. The host is told, every
// time, rather than left hoping a redraw never happens.
is(/\}\)\.join\(''\);\n    sizeOpenFinPanel\(\);\n(.*\n)*?    if \(A\.afterPaint\) A\.afterPaint\(\);/.test(SRC),
   true, 'step 3 tells the host once the finishing body has been replaced');
is(/afterPaint: function\(\)\{ paintFoilPick\(\); paintStudioFoilCard\(\); \}/.test(HTML), true,
   'and the host answers it by painting BOTH canvases back — Route B’s picker and '
   + 'the studio’s card both live inside the body that was just replaced');

print('\nTHE TEMPLATE IS A FUNCTION OF TWO NUMBERS');
// There is no library of template files and there does not need to be one. The
// product does not come into it, the fold does not change the page — the foil
// layer is one page at the FINISHED size, so a folded A5 wants the same page as
// a flat one — and neither do the printed sides. Orientation is already in the
// two numbers, because sizeSpec swaps them for landscape before we get here.
function num(re, what) {
  var m = HTML.match(re);
  if (!m) throw new Error('could not read ' + what + ' out of the shipped file');
  return parseFloat(m[1]);
}
var GUIDE_GREY = num(/const FOIL_GUIDE_GREY = (\d+) \/ 255;/, 'the guide grey');
var TINT_GREY  = num(/const FOIL_TINT_GREY  = (\d+) \/ 255;/, 'the bleed tint');
var FOIL_SAFE_MM  = num(/const FOIL_SAFE_MM    = ([\d.]+);/, 'the safe inset');
var FOIL_GUIDE_MM = num(/const FOIL_GUIDE_MM   = ([\d.]+);/, 'the guide weight');
// The plan is cut out of the shipped file and run against the shipped numbers,
// so neither the geometry nor the greys can be right here and wrong there.
var FOIL_GUIDE_GREY = GUIDE_GREY / 255, FOIL_TINT_GREY = TINT_GREY / 255;
eval(grabHost('foilTemplatePlan'));

var pA5 = foilTemplatePlan(148, 210), pLand = foilTemplatePlan(210, 148),
    pCard = foilTemplatePlan(85, 55);
is([pA5.pageW, pA5.pageH], [154, 216], 'A5 is the card plus 3mm of bleed all round');
is([pLand.pageW, pLand.pageH], [216, 154], 'landscape is that page turned, and nothing else');
is([pCard.pageW, pCard.pageH], [91, 61],
   'the smallest card in the catalogue needs no special case of its own');

is([pA5.trim.x, pA5.trim.y, pA5.trim.w, pA5.trim.h], [3, 3, 148, 210],
   'the trim line is where the knife falls, inset by the bleed on every edge');
is([pA5.safe.x, pA5.safe.y, pA5.safe.w, pA5.safe.h], [7, 7, 140, 202],
   'and the safe line is ' + FOIL_SAFE_MM + 'mm inside the trim on every edge');
is(pA5.trim.dash, null, 'the trim line is solid');
is(!!pA5.safe.dash, true, 'and the safe line is dashed, so the two cannot be confused');

print('\nAND IT DOES NOT ARRIVE LOOKING BLANK');
// It did. The old template was four 0.4pt corner ticks in 0.80 grey: 207
// non-white pixels out of 1,068,552, which is 0.019% of the page. He
// downloaded it and asked whether a blank page was correct.
function inked(p) {    // the share of the page the lines cover
  return (2 * (p.trim.w + p.trim.h) * p.trim.weight
       +  2 * (p.safe.w + p.safe.h) * p.safe.weight / 2) / (p.pageW * p.pageH);
}
is(inked(pA5) > 0.004, true,
   'the lines cover enough of the page to be seen — and to be found again by the '
   + 'check below');
is(inked(pCard) > 0.004, true, 'on the smallest card too, not just on A5');
is(FOIL_GUIDE_MM >= 0.3, true, 'at a weight a printer would recognise as a guide');
is(/borderColor:grey, borderWidth:r\.weight\*MM/.test(HTML), true,
   'and the weight in the plan is the weight that is drawn');
// Dropping plan.safe from this one line passed every other assertion in the
// suite: the plan still described a safe line and a label still named it, but
// nothing drew it. A plan is not a page.
is(/\[plan\.trim, plan\.safe\]\.forEach\(function\(r\)\{/.test(HTML), true,
   'both lines are drawn, not just the trim');

is(pA5.tint === TINT_GREY / 255 && pA5.tint > 0 && pA5.tint < 1, true,
   'the bleed carries a tint of its own');
is(TINT_GREY > GUIDE_GREY, true,
   'lighter than the lines, so it reads as a hint rather than as a mark');
is(/width:plan\.pageW\*MM, height:plan\.pageH\*MM,\s*\n\s*color:L\.rgb\(plan\.tint/.test(HTML),
   true, 'the whole page is laid down in it — this is what stopped the template '
   + 'arriving as a white rectangle');
is(/width:plan\.trim\.w\*MM, height:plan\.trim\.h\*MM, color:L\.rgb\(1,1,1\) \}\);/.test(HTML),
   true, 'and the card is knocked back to white over it, leaving only the bleed tinted');

is(pA5.labels.map(function (l) { return l.text; }), ['BLEED', 'TRIM', 'SAFE AREA'],
   'all three guides are named, in the agreed words and only those');
// Each word has to sit above its own line and below the next one. Three lines
// and three words with nothing joining them up is a puzzle, not a template.
var PT = 25.4 / 72, CAP = 0.717;            // Helvetica cap height, in em
function top(l) { return l.y + l.size * CAP * PT; }
is(top(pA5.labels[0]) < pA5.trim.y, true, 'BLEED sits in the strip that is cut away');
is(pA5.labels[1].y > pA5.trim.y && top(pA5.labels[1]) < pA5.safe.y, true,
   'TRIM sits in the channel between the trim line and the safe line');
is(pA5.labels[2].y > pA5.safe.y, true, 'SAFE AREA sits inside the safe line');
is(/plan\.labels\.forEach\(function\(t\)\{\s*\n\s*page\.drawText\(t\.text,/.test(HTML), true,
   'and every one of them is actually drawn');

print('\nTHE CHECK FINDS OUR OWN GUIDES AGAIN');
// The guides are drawn light enough that neither the foil test nor the colour
// test objects to them, which is deliberate — a template is not refused for
// marks we put there ourselves. That makes the numbers a pair: move the grey
// and the check goes blind. Both are read out of the shipped file, so they
// cannot drift apart quietly.
var DARK = num(/if \(mx < (\d+)\) \{\s*\n\s*dark\+\+;/, 'the dark threshold');
var branch = HTML.match(/else if \(\(mx - mn\) <= 2 &&[^\n]*guide\+\+;/);
is(!!branch, true, 'there is a branch of its own that counts the guides');
var bands = ((branch ? branch[0] : '').match(/mx >= \d+ && mx <= \d+/g) || [])
  .map(function (b) { var m = b.match(/(\d+).*?(\d+)/); return [ +m[1], +m[2] ]; });
is(bands.length, 2, 'and it looks for both the greys we draw with');
[['lines and labels', GUIDE_GREY], ['bleed tint', TINT_GREY]].forEach(function (pair) {
  is(bands.some(function (b) { return pair[1] >= b[0] && pair[1] <= b[1]; }), true,
     'the grey the ' + pair[0] + ' are drawn in falls inside a band the check looks for');
  is(pair[1] >= DARK, true,
     'and is light enough that the ' + pair[0] + ' are never counted as foil');
});
is(/r\.guides > 0\.0025/.test(HTML), true,
   'a file still carrying them is flagged well below the 1.3% a template leaves');
is(/status:'warn', label:'Template guides'/.test(HTML), true,
   'as a warning — it is an unfinished file, not a wrong one, and foilLayerAccepted '
   + 'only blocks on an error');

print('\nWHAT REACHES THE PRINTER');
is(/async function downloadFoilTemplate\(\)\{/.test(HTML), true,
   'there is a template to start from — the thing PrintedEasy do not give '
   + 'their own customers');
is(/const plan = foilTemplatePlan\(spec\.mmW, spec\.mmH\);/.test(HTML), true,
   'drawn from the size the customer has actually chosen, at trim plus bleed, '
   + 'not from a stored file that could be for another card');
is(/'foil-template-' \+ String\(selectedSize\)\.toLowerCase\(\)/.test(HTML), true,
   'named for the size it is for');
is(/facesForFoil\(\) > 1/.test(HTML), true,
   'a piece with more than one face is told which one is foiled \u2014 the foil '
   + 'layer is a single page at the finished size, so it can only be the front, '
   + 'and that was assumed silently');

var WH = readFile('netlify/functions/stripe-webhook.js');
is(/const foil     = it\.foilSpec \|\| \(spec && spec\.foil\) \|\| null;/.test(WH), true,
   'the job ticket reads the foil from the line, falling back to the press spec');
is(/Download FOIL LAYER/.test(WH), true, 'and gives the printer the file itself');
is(/NO FOIL LAYER RECORDED/.test(WH), true,
   'and says so loudly when foiling was ordered and no layer was recorded, '
   + 'rather than leaving the row off and the job looking ordinary');
is(/Measured from the supplied foil layer/.test(WH), true,
   'the areas and sizes are presented as measured, not as the customer\u2019s guess');

print('\nWHERE THE BLOCK APPEARS');
is(/if \(!\/foil\/i\.test\(typeName\)\) return '';/.test(HTML), true,
   'only on the foiling row');
is(/if \(!chosen \|\| String\(chosen\)\.toLowerCase\(\) === 'none'\) return '';/.test(HTML), true,
   'and only once a colour has been chosen, so nobody who does not want foil '
   + 'is asked for a second file');
is(/foilBlock: foilBlock,/.test(HTML), true, 'handed to step 3 through the adapter');
is(/A\.foilBlock && A\.foilBlock\(t\.name, sel\)/.test(SRC), true,
   'which draws whatever comes back and knows nothing about uploads');
// The same line exists in rasterisePdfPage, so matching it anywhere in the
// file proved nothing: the first version of this assertion passed with the
// line deleted from the function under test. It is pinned to its own comment.
is(/untouched pixel reads as black and the whole card looks foiled\.\n    ctx\.fillStyle = '#ffffff'; ctx\.fillRect\(0, 0, cv\.width, cv\.height\);/.test(HTML),
   true, 'the foil layer is whited before rendering: a PDF is transparent where '
   + 'nothing is drawn, and every untouched pixel would otherwise read as black');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
