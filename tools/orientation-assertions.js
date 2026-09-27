// ── a stand-in for pdf-lib, recording only what we assert about ──────────────
function fakeDoc(){
  return { addPage: function(sz){ return {
    _w: sz[0], _h: sz[1], rects: [], lines: [], trim: null, bleed: null,
    drawRectangle: function(o){ this.rects.push(o); },
    drawLine: function(o){ this.lines.push(o); },
    setTrimBox: function(x,y,w,h){ this.trim = [x,y,w,h]; },
    setBleedBox: function(x,y,w,h){ this.bleed = [x,y,w,h]; }
  }; } };
}
const rgb = function(){ return 'c'; };
const MM = 72/25.4;
const mm = function(pt){ return Math.round(pt / MM * 100) / 100; };

let pass = 0, fail = 0;
function eq(label, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label
        + (ok ? '' : '\n         got  ' + JSON.stringify(got)
                   + '\n         want ' + JSON.stringify(want)));
}

function lay(size, orient, family){
  selectedSize = size; selectedOrientation = orient; FAMILY = family;
  let art = null;
  const r = layOutPressPage(fakeDoc(), rgb, sizeSpec(size), function(pg, box){ art = box; });
  return { pageMm: r.pageMm, art: art, page: r.page, folded: r.folded };
}

print('\nThe card the customer is told they are buying');
selectedOrientation='portrait'; eq('A6 portrait  ', [sizeSpec('A6').mmW, sizeSpec('A6').mmH], [105,148]);
selectedOrientation='landscape'; eq('A6 landscape ', [sizeSpec('A6').mmW, sizeSpec('A6').mmH], [148,105]);
eq('Square never turns', [sizeSpec('Square').mmW, sizeSpec('Square').mmH], [148,148]);
eq('explicit beats the picker',
   [sizeSpec('A5','portrait').mmW, sizeSpec('A5','portrait').mmH], [148,210]);

print('\nFlat card — the press page is trim + 3mm bleed + 5mm marks each side');
var a = lay('A6','portrait','flat-card');
eq('A6 portrait page ', [a.pageMm.w, a.pageMm.h], [121, 164]);
var b = lay('A6','landscape','flat-card');
eq('A6 landscape page', [b.pageMm.w, b.pageMm.h], [164, 121]);
eq('landscape is the portrait page turned, not a new size',
   [b.pageMm.w, b.pageMm.h], [a.pageMm.h, a.pageMm.w]);
eq('artwork fills the sheet plus bleed',
   [mm(b.art.width), mm(b.art.height)], [148+6, 105+6]);
eq('trim box is the card itself', [mm(b.page.trim[2]), mm(b.page.trim[3])], [148, 105]);
eq('nothing painted out on a flat card', b.page.rects.length, 0);
eq('four corners, two marks each', b.page.lines.length, 8);

print('\nFolded leaflet — portrait creases down the side');
var f = lay('A6','portrait','folded-leaflet');
eq('sheet is two panels wide', [f.pageMm.w, f.pageMm.h], [105*2+16, 164]);
eq('front is the right-hand panel', mm(f.art.x), 5 + 105);
eq('front is one panel wide, full height', [mm(f.art.width), mm(f.art.height)], [111, 154]);
eq('the back half is painted blank', f.page.rects.length, 1);
eq('blank runs from the left edge to the crease',
   [mm(f.page.rects[0].x), mm(f.page.rects[0].width)], [0, 5+3+105]);
eq('crease marks added top and bottom', f.page.lines.length, 10);

print('\nFolded leaflet — landscape creases across the top');
var g = lay('A6','landscape','folded-leaflet');
eq('same sheet, turned', [g.pageMm.w, g.pageMm.h], [164, 105*2+16]);
eq('area matches the portrait sheet', g.pageMm.w * g.pageMm.h, f.pageMm.w * f.pageMm.h);
eq('front is the bottom panel', [mm(g.art.x), mm(g.art.y)], [5, 5]);
eq('front is full width, one panel tall', [mm(g.art.width), mm(g.art.height)], [154, 111]);
eq('the back half is painted blank', g.page.rects.length, 1);
eq('blank runs from the crease to the top edge',
   [mm(g.page.rects[0].y), mm(g.page.rects[0].height)], [5+3+105, 105+5+3]);
eq('crease marks added left and right', g.page.lines.length, 10);
eq('crease marks are horizontal ticks',
   g.page.lines.slice(8).map(function(l){ return mm(l.start.y) === mm(l.end.y); }), [true, true]);

print('\nWhen the choice may be offered at all');
selectedOrientation='portrait';
eq('A6 can turn        ', sizeCanRotate('A6'), true);
eq('Square cannot      ', sizeCanRotate('Square'), false);
eq('A3 has a twin, so no', sizeCanRotate('A3'), false);
eq('A3-L is already one ', sizeCanRotate('A3-L'), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
