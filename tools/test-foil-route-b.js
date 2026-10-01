// Route B: the foil layer made from the customer's own artwork.
//
// Route A asks for a second PDF. Plenty of people cannot make one, and the
// only answer on offer was "Replace". This is the way through for them, and
// it is where a non-technical customer meets us at their worst moment, so the
// refusals matter more than the extraction does.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-foil-route-b.js

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
function num(re, what) {
  var m = HTML.match(re);
  if (!m) throw new Error('could not read ' + what + ' out of the shipped file');
  return parseFloat(m[1]);
}

// The thresholds are read out of the shipped file, so a number moved there
// moves here too and these never quietly test something else.
var FOIL_PICK_TOL    = num(/const FOIL_PICK_TOL  = (\d+);/, 'the pick tolerance');
var FOIL_MIN_COVER   = num(/const FOIL_MIN_COVER = ([\d.]+);/, 'the minimum coverage');
var FOIL_SPECK_MM2   = num(/const FOIL_SPECK_MM2 = ([\d.]+);/, 'the speck size');
var FOIL_SPECK_SHARE = num(/const FOIL_SPECK_SHARE = ([\d.]+);/, 'the speck share');
var FOIL_EDGE_SHARE  = num(/const FOIL_EDGE_SHARE = ([\d.]+);/, 'the edge share');
var FOIL_MAX_MARKS   = num(/const FOIL_MAX_MARKS  = ([\d.]+);/, 'the mark ceiling');

eval(grabHost('foilPixelMatches'));
eval(grabHost('extractFoilMask'));
eval(grabHost('maskVerdict'));
eval(grabHost('rgbToSegment'));
eval(grabHost('artworkPalette'));
var FOIL_AA_TOL   = num(/const FOIL_AA_TOL    = (\d+);/, 'the anti-aliasing tolerance');
var FOIL_AA_SHARE = num(/const FOIL_AA_SHARE  = ([\d.]+);/, 'the anti-aliasing share');

var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}

// A card at the usual working size: A5 plus bleed, 154 x 216mm.
var PAGE = { w: 154, h: 216 };
var W = 462, H = 648;                       // 3px per mm, so 1mm = 9px

// White paper, with shapes painted on it.
function card(shapes) {
  var d = new Uint8ClampedArray(W * H * 4).fill(255);
  shapes.forEach(function (s) {
    for (var y = s.y; y < s.y + s.h; y++)
      for (var x = s.x; x < s.x + s.w; x++) {
        var i = (y * W + x) * 4;
        d[i] = s.rgb[0]; d[i+1] = s.rgb[1]; d[i+2] = s.rgb[2];
      }
  });
  return d;
}
var INK  = [38, 46, 62];        // the names, a near-black navy
var GOLD = [186, 150, 92];      // the monogram
var SAGE = [96, 134, 104];      // a sprig of leaves

print('\nPOINTING AT ONE COLOUR TAKES THAT COLOUR AND LEAVES THE REST');
var art = card([
  { x: 60, y: 120, w: 340, h: 60, rgb: INK  },     // the names
  { x: 190, y: 300, w: 80,  h: 80, rgb: GOLD },    // the monogram
  { x: 60, y: 500, w: 340, h: 40, rgb: SAGE }      // the sprig
]);
var m = extractFoilMask(art, W, H, [GOLD], FOIL_PICK_TOL);
function count(mask) { var n = 0; for (var i = 0; i < mask.length; i++) if (mask[i]) n++; return n; }
is(count(m), 80 * 80, 'pointing at the monogram takes the monogram, to the pixel');
is(m[(300 * W) + 190], 1, 'the monogram is in');
is(m[(140 * W) + 200], 0, 'the names are not');
is(m[(510 * W) + 200], 0, 'and neither is the sprig');

// The whole reason a customer points at a colour rather than drawing round a
// shape: it finds every repeat, including ones too small to mask by hand.
var repeats = card([
  { x: 190, y: 300, w: 80, h: 80, rgb: GOLD },
  { x: 20,  y: 20,  w: 6,  h: 6,  rgb: GOLD },
  { x: 436, y: 622, w: 6,  h: 6,  rgb: GOLD }
]);
is(count(extractFoilMask(repeats, W, H, [GOLD], FOIL_PICK_TOL)), 80*80 + 36 + 36,
   'and it finds the same colour everywhere it appears, not just where they clicked');

print('\nTHE SOFT EDGE OF LETTERING COMES WITH THE LETTER');
// Flat artwork is anti-aliased at every edge. Too tight a tolerance leaves the
// letters ragged and the foil a size smaller than the print it sits on.
var halfway = [Math.round((GOLD[0]+255)/2), Math.round((GOLD[1]+255)/2), Math.round((GOLD[2]+255)/2)];
var nearly  = [GOLD[0]+10, GOLD[1]-9, GOLD[2]+11];
is(foilPixelMatches(nearly[0], nearly[1], nearly[2], [GOLD], FOIL_PICK_TOL), true,
   'a pixel a shade off the colour they pointed at is the same mark');
is(foilPixelMatches(255, 255, 255, [GOLD], FOIL_PICK_TOL), false,
   'the paper never is');
is(foilPixelMatches(INK[0], INK[1], INK[2], [GOLD], FOIL_PICK_TOL), false,
   'and neither is a different colour in the same design');
is(foilPixelMatches(halfway[0], halfway[1], halfway[2], [GOLD], FOIL_PICK_TOL), false,
   'halfway to white is the edge fading out, and is left to fade');

print('\nTWO COLOURS A CUSTOMER CAN TELL APART ARE TWO COLOURS');
// The tolerance started at 64 and this is what that cost: a warm gold and a
// muted sage sit 62 apart in RGB, so pointing at the monogram foiled the
// leaves as well, and the palette offered the two of them as one swatch.
// These are the real distances between colours that turn up together on a
// wedding card. Widening the tolerance past any of them breaks this.
var PAIRS = [
  ['gold',  [186, 150,  92], 'sage',    [142, 160, 134]],   // 62 apart
  ['ink',   [ 38,  46,  62], 'charcoal',[ 72,  72,  74]],   // 42 apart
  ['blush', [224, 190, 185], 'ivory',   [240, 232, 214]]    // 37 apart
];
PAIRS.forEach(function (p) {
  var d = Math.round(Math.sqrt(
    Math.pow(p[1][0]-p[3][0], 2) + Math.pow(p[1][1]-p[3][1], 2) + Math.pow(p[1][2]-p[3][2], 2)));
  is(foilPixelMatches(p[3][0], p[3][1], p[3][2], [p[1]], FOIL_PICK_TOL), false,
     'pointing at ' + p[0] + ' does not also take ' + p[2] + ', ' + d + ' away');
  var both = card([
    { x: 60, y: 120, w: 160, h: 60, rgb: p[1] },
    { x: 60, y: 300, w: 160, h: 60, rgb: p[3] }
  ]);
  is(count(extractFoilMask(both, W, H, [p[1]], FOIL_PICK_TOL)), 160 * 60,
     'and foils only the ' + p[0] + ' of the two');
  is(artworkPalette(both, W, H, 6).length, 2,
     'and offers them as two swatches, not one');
});
// It still has to absorb what JPEG does to a flat colour.
is(foilPixelMatches(GOLD[0]+8, GOLD[1]-7, GOLD[2]+9, [GOLD], FOIL_PICK_TOL), true,
   'while still holding together a single colour that compression has roughened');

print('\nMORE THAN ONE THING CAN BE FOILED');
var two = extractFoilMask(art, W, H, [GOLD, SAGE], FOIL_PICK_TOL);
is(count(two), 80*80 + 340*40, 'pointing at two colours takes both');
is(extractFoilMask(art, W, H, [], FOIL_PICK_TOL).length, W * H,
   'pointing at nothing still returns a mask the right size');
is(count(extractFoilMask(art, W, H, [], FOIL_PICK_TOL)), 0, 'with nothing in it');

print('\nWHAT ROUTE B REFUSES');
// Nothing picked.
var v = maskVerdict(extractFoilMask(art, W, H, [], FOIL_PICK_TOL), W, H, PAGE);
is([v.ok, v.reason], [false, 'nothing'], 'an empty mask is refused, and says why');

// A colour that is barely there. One 2x2 mark is 0.44mm sq -- a fleck.
var trace = card([{ x: 100, y: 100, w: 2, h: 2, rgb: GOLD }]);
v = maskVerdict(extractFoilMask(trace, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is([v.ok, v.reason], [false, 'nothing'], 'a colour that is barely in the design is refused');

// The one that matters: a photograph, picked by colour. It dusts the whole
// card in single pixels, which look like coverage in a total and are nothing
// at all on a plate.
var speckles = [];
for (var i = 0; i < 2600; i++) {
  speckles.push({ x: (i * 97) % (W - 3), y: (i * 211) % (H - 3), w: 2, h: 2, rgb: GOLD });
}
var photo = card(speckles);
v = maskVerdict(extractFoilMask(photo, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.ok, false, 'a photograph picked by colour is refused');
is(v.reason, 'speckled', 'and is told apart from an empty one');
is(v.coverage > FOIL_MIN_COVER, true,
   'even though it covers more of the card than the minimum -- which is exactly '
   + 'why coverage alone is not asked to judge this');
is(v.speckShare > FOIL_SPECK_SHARE, true, 'because nearly all of it is flecks');

// The grid could not see this one, and a real photograph proved it. Grain is
// finer than a grid cell, so every cell registered a hit, the dust fused into
// one solid block, and 79% of the card came through as a legitimate All Over.
// What tells them apart is that a shape has a middle and grain is all edge.
var grain = new Uint8ClampedArray(W * H * 4).fill(255);
var seed = 12345;
function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
for (var gi = 0; gi < grain.length; gi += 4) {
  if (rnd() < 0.42) { grain[gi] = GOLD[0]; grain[gi+1] = GOLD[1]; grain[gi+2] = GOLD[2]; }
}
var gm = extractFoilMask(grain, W, H, [GOLD], FOIL_PICK_TOL);
var gv = maskVerdict(gm, W, H, PAGE);
is(gv.coverage > 0.3, true, 'grain covers a great deal of the card');
// The browser run is what proved this one. Counted on the coarse grid at
// 909px across, a cell spans more than one pixel of grain: every cell took a
// hit, tens of thousands of specks fused into ONE mark, and 79% of the card
// came back as a legitimate All Over. Counted at full resolution the same
// grain is what it actually is.
is(gv.marks > 1000, true, 'grain is thousands of separate marks, not one');
is(gv.speckShare > FOIL_SPECK_SHARE, true, 'and nearly all of it is specks');
is(gv.edgeShare > FOIL_EDGE_SHARE, true, 'with almost every pixel of it an edge');
is([gv.ok, gv.reason], [false, 'speckled'], 'so it is refused, on two measures rather than one');

// And the measure has to leave solid shapes alone, or it refuses real work.
var solid = maskVerdict(extractFoilMask(art, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(solid.edgeShare < FOIL_EDGE_SHARE, true, 'a solid monogram is mostly middle, not edge');
is(solid.ok, true, 'and is not caught by this');

print('\nAND WHAT IT LETS THROUGH');
v = maskVerdict(extractFoilMask(art, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.ok, true, 'a monogram is a foil design');
is(v.marks, 1, 'counted as one mark');
is(v.speckShare, 0, 'with nothing flecked about it');

v = maskVerdict(extractFoilMask(art, W, H, [GOLD, INK, SAGE], FOIL_PICK_TOL), W, H, PAGE);
is([v.ok, v.marks], [true, 3], 'so are three separate marks');

// Two marks down opposite edges of the card. The grid is walked as one long
// run of cells, so without a guard the last cell of a row is a neighbour of
// the first cell of the next one and the two edges join into a single mark.
// Nothing else in this file touched both edges, and the guard could be
// deleted with the whole suite still green.
// Every shape in this file until now was a rectangle, and a rectangle can be
// filled going only down, left and right. A shape that curves back upward
// cannot: reach the bottom of the left arm, travel along the foot, and the
// right arm is above you. The walk could lose a whole direction with the suite
// still green, and a U would have counted as two marks.
var uShape = card([
  { x: 150, y: 200, w: 30,  h: 200, rgb: GOLD },     // left arm
  { x: 150, y: 400, w: 160, h: 30,  rgb: GOLD },     // the foot
  { x: 280, y: 200, w: 30,  h: 200, rgb: GOLD }      // right arm, back up
]);
v = maskVerdict(extractFoilMask(uShape, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.marks, 1, 'a shape that doubles back on itself is one mark, not two');

// Fine line work: joined up, so not specks, and nowhere near the mark ceiling
// -- but every pixel of it is an edge. At this scale these rules are 0.33mm
// wide, well under the 7pt PrintedEasy will foil down to.
var hairlines = [];
for (var hx = 40; hx < W - 40; hx += 40) hairlines.push({ x: hx, y: 100, w: 1, h: 440 });
hairlines.push({ x: 40, y: 100, w: W - 80, h: 1 });          // joined along the top
var fine = card(hairlines.map(function (r) { r.rgb = GOLD; return r; }));
v = maskVerdict(extractFoilMask(fine, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.marks < FOIL_MAX_MARKS, true, 'hairline work is not caught by the mark ceiling');
is(v.speckShare < FOIL_SPECK_SHARE, true, 'nor by the size of the marks, being joined up');
is(v.edgeShare > FOIL_EDGE_SHARE, true, 'but it is all edge and no middle');
is([v.ok, v.reason], [false, 'speckled'],
   'so it is refused -- lines this fine cannot be foiled, and only this measure sees it');

// The two refusals are not the same rule twice, and this is the case that
// separates them. Everything above is drawn at 3 pixels to the millimetre,
// where any mark small enough to be a speck is also mostly edge, so the edge
// measure alone would have caught all of it. The artwork Route B actually
// works on is nearer 6, and finer still for a small card -- and at that
// resolution a mark can be comfortably solid and comfortably too small.
// Below is 12 pixels to the millimetre: marks of 0.84 sq mm, two thirds of
// each one interior. Only the speck measure sees them.
(function tooSmallToFoil(){
  var fw = 480, fh = 480, fpage = { w: 40, h: 40 };          // 12 px per mm
  var d = new Uint8ClampedArray(fw * fh * 4).fill(255);
  for (var my = 20; my < fh - 20; my += 40)
    for (var mx = 20; mx < fw - 20; mx += 40)
      for (var y = my; y < my + 11; y++)
        for (var x = mx; x < mx + 11; x++) {
          var i = (y * fw + x) * 4;
          d[i] = GOLD[0]; d[i+1] = GOLD[1]; d[i+2] = GOLD[2];
        }
  var fv = maskVerdict(extractFoilMask(d, fw, fh, [GOLD], FOIL_PICK_TOL), fw, fh, fpage);
  is(fv.edgeShare < FOIL_EDGE_SHARE, true, 'each mark is solid, not an outline');
  is(fv.speckShare > FOIL_SPECK_SHARE, true, 'but every one of them is under a square millimetre');
  is([fv.ok, fv.reason], [false, 'speckled'],
     'so it is refused on the size of the marks, which is the only measure that sees it');
})();

var edges = card([
  { x: 0,   y: 0, w: 6, h: H, rgb: GOLD },
  { x: 456, y: 0, w: 6, h: H, rgb: GOLD }
]);
v = maskVerdict(extractFoilMask(edges, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.marks, 2, 'a mark down each edge is two marks, not one wrapped round the page');

// A real design has small details alongside the big ones. Refusing it because
// some of the foil is small would refuse most wedding stationery.
var withDetail = card([
  { x: 190, y: 300, w: 80, h: 80, rgb: GOLD },
  { x: 20,  y: 20,  w: 5,  h: 5,  rgb: GOLD },
  { x: 100, y: 40,  w: 5,  h: 5,  rgb: GOLD },
  { x: 300, y: 60,  w: 5,  h: 5,  rgb: GOLD }
]);
v = maskVerdict(extractFoilMask(withDetail, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is(v.ok, true, 'a monogram with small flourishes around it is still a foil design');

// All Over is one of PrintedEasy's five tiers, so a heavily foiled card is a
// thing they make and sell. Refusing it would refuse an order they would take.
var allOver = card([{ x: 0, y: 0, w: W, h: H, rgb: GOLD }]);
v = maskVerdict(extractFoilMask(allOver, W, H, [GOLD], FOIL_PICK_TOL), W, H, PAGE);
is([v.ok, v.reason], [true, null], 'a fully foiled card is allowed -- All Over is a tier they sell');
is(v.coverage, 1, 'and it is measured honestly rather than capped');

print('\nTHE SWATCHES WE OFFER');
var pal = artworkPalette(art, W, H, 6);
is(pal.length, 3, 'the three colours in the design are offered, and nothing else');
function has(p, rgb) {
  return p.some(function (e) {
    var dr = e.rgb[0]-rgb[0], dg = e.rgb[1]-rgb[1], db = e.rgb[2]-rgb[2];
    return dr*dr + dg*dg + db*db <= FOIL_PICK_TOL*FOIL_PICK_TOL;
  });
}
is([has(pal, INK), has(pal, GOLD), has(pal, SAGE)], [true, true, true], 'all three of them');
is(pal[0].share >= pal[pal.length-1].share, true, 'commonest first');

// The paper is the biggest colour on almost every card, and the bleed is built
// by mirroring the edges outward, so white would head the list on a design
// that has none in it.
is(has(pal, [255, 255, 255]), false, 'the paper is not offered as something to foil');

// Two bins either side of a boundary are the same colour to the eye. Offering
// both as separate swatches is a puzzle, not a choice.
var shaded = card([
  { x: 60,  y: 120, w: 160, h: 60, rgb: [186, 150, 92] },
  { x: 220, y: 120, w: 160, h: 60, rgb: [190, 154, 96] }
]);
is(artworkPalette(shaded, W, H, 6).length, 1,
   'two shades a customer could not tell apart are offered once');

print('\nTHE FADE AT THE EDGE OF A LETTER IS NOT A COLOUR');
// Measured off a real invitation rendered through the actual pipeline: the
// first three swatches were the navy, the gold and the sage, and the next
// three were all greys off the navy's own edge. Every one of them would have
// been offered as a thing to foil, and picking one would have foiled a halo
// round the lettering and nothing else.
var REAL_AA = [[231, 232, 234], [100, 106, 117], [68, 74, 88]];
REAL_AA.forEach(function (c) {
  is(rgbToSegment(c, INK, [255, 255, 255]) <= FOIL_AA_TOL, true,
     'rgb(' + c.join(',') + ') lies on the line from the ink to the paper');
});
// And the three real colours do not, however close two of them look.
is(rgbToSegment(SAGE, INK,  [255, 255, 255]) > FOIL_AA_TOL, true, 'the sage is its own colour');
is(rgbToSegment(SAGE, GOLD, [255, 255, 255]) > FOIL_AA_TOL, true, 'and not a faded gold either');
is(rgbToSegment(GOLD, INK,  [255, 255, 255]) > FOIL_AA_TOL, true, 'nor is the gold a faded ink');

// The whole thing, end to end: ink on paper, anti-aliased the way a renderer
// actually does it, must still offer exactly one swatch.
var aa = card([{ x: 60, y: 120, w: 340, h: 60, rgb: INK }]);
(function fade(){
  for (var y = 180; y < 192; y++) for (var x = 60; x < 400; x++) {
    var t = (y - 179) / 13, i = (y * W + x) * 4;
    aa[i]   = Math.round(INK[0] + (255 - INK[0]) * t);
    aa[i+1] = Math.round(INK[1] + (255 - INK[1]) * t);
    aa[i+2] = Math.round(INK[2] + (255 - INK[2]) * t);
  }
})();
is(artworkPalette(aa, W, H, 6).length, 1,
   'one colour with a soft edge is offered as one swatch, not as a staircase of them');

// Lying on the line is not enough on its own, and this is the case that says
// so: a charcoal sits almost exactly on the line from black to the paper and
// is still a colour somebody chose. What tells a fade from a colour is size.
var two = card([
  { x: 60, y: 120, w: 160, h: 60, rgb: [38, 46, 62] },
  { x: 60, y: 300, w: 160, h: 60, rgb: [72, 72, 74] }
]);
is(rgbToSegment([72,72,74], [38,46,62], [255,255,255]) <= FOIL_AA_TOL, true,
   'the charcoal does lie on the line from the ink to the paper');
is(artworkPalette(two, W, H, 6).length, 2,
   'but it is as big as the ink is, so it is a colour and not an edge');
// Shrink it to the size a real fade would be and it becomes one.
var edged = card([
  { x: 60, y: 120, w: 160, h: 60, rgb: [38, 46, 62] },
  { x: 60, y: 300, w: 160, h: 12, rgb: [72, 72, 74] }
]);
is(artworkPalette(edged, W, H, 6).length, 1,
   'at a fifth the size the same colour is read as the edge it looks like');

// A swatch they can see is a swatch they can pick, so the two have to agree.
pal.forEach(function (e) {
  var hit = count(extractFoilMask(art, W, H, [e.rgb], FOIL_PICK_TOL));
  is(hit > 0, true, 'the swatch rgb(' + e.rgb.join(',') + ') actually selects something');
});

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
