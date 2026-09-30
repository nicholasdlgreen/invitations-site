// One rail, or none. The page's own step bar and step 3's rail are never on
// screen together, so nothing stops them describing two different journeys —
// and for a while they did: the bar said Size · Artwork · Paper & Quantity ·
// Basket · Checkout, and then the rail said Size · Artwork · Range · Paper ·
// Finishing · How many · Delivery. A customer shown one map and handed another
// halfway has no map.
//
// Both are now drawn from Step3.journey(). These tests hold them to it.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-wizard-rail.js
//
// Everything under test is CUT OUT of the shipped files at run time.

var HTML = readFile('upload-and-print.html');

function grab(name) {
  var i = HTML.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name + ' in upload-and-print.html');
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

// ── the real step 3 ───────────────────────────────────────
var window = this, document = { getElementById: function () { return null; } };
eval(readFile('step3/step3.js'));
var Step3 = window.Step3;

// ── a product, as the shop hands it over ──────────────────
var TIER = { Uncoated: 'signature', Silk: 'signature', Nettuno: 'luxury', Recycled: 'kinder' };
var FINISHES = ['Lamination'];
function adapter(over) {
  var a = {
    papers:      function () { return Object.keys(TIER).map(function (n) { return { name: n }; }); },
    feelOf:      function (n) { return TIER[n]; },
    weightsFor:  function () { return [{ gsm: 300, unit: 'gsm' }]; },
    envelopes:   function () { return []; },
    finishTypesFor: function () { return FINISHES.map(function (n) { return { name: n }; }); },
    leadingSteps:  function () { return [{ id: 'step1', label: 'Size', host: true },
                                         { id: 'step2', label: 'Artwork', host: true }]; },
    trailingSteps: function () { return [{ id: 'basket', label: 'Basket', host: true, ahead: true },
                                         { id: 'checkout', label: 'Checkout', host: true, ahead: true }]; }
  };
  for (var k in (over || {})) a[k] = over[k];
  return a;
}

// ── the real page bar ─────────────────────────────────────
var NEW_WIZARD = true, designMode = false, currentStep = 1;
function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
var BAR = { innerHTML: '' };
var ADAPTER = adapter();
function step3Adapter() { return ADAPTER; }
document.querySelector = function (sel) { return sel === '.step-bar' ? BAR : null; };
document.documentElement = { classList: { add: function () {} } };
eval(grab('drawPageBar'));

function barLabels() {
  var out = [], re = /<div class="step-label[^"]*">([^<]*)</g, m;
  while ((m = re.exec(BAR.innerHTML))) out.push(m[1]);
  return out;
}
function barActive() {
  var m = /<div class="step-label active">([^<]*)</.exec(BAR.innerHTML);
  return m ? m[1] : null;
}

// ── assertions ────────────────────────────────────────────
var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}

print('\nONE LIST, DRAWN TWICE');
var j = Step3.journey(ADAPTER).map(function (x) { return x.label; });
is(j, ['Size','Artwork','Range','Paper','Finishing','How many','Delivery','Basket','Checkout'],
   'the journey runs from the size to the checkout without a gap');
drawPageBar(1);
is(barLabels(), j, 'and the page bar is that same list, not a second one');
is(barLabels().length, 9, 'nine steps, the same nine the rail will show');

print('\nWHERE THE CUSTOMER IS');
drawPageBar(1); is(barActive(), 'Size',     'step 1 is Size');
drawPageBar(2); is(barActive(), 'Artwork',  'step 2 is Artwork');
drawPageBar(4); is(barActive(), 'Basket',   'the basket is step 8 of 9, not step 4 of 5');
drawPageBar(5); is(barActive(), 'Checkout', 'and the checkout is the last of them');
drawPageBar(4);
is(/step-num done">3</.test(BAR.innerHTML), true,
   'everything between artwork and the basket is behind you by then');
drawPageBar(3);
is(barActive(), null, 'step 3 draws its own rail, so nothing in the bar is lit');
is(barLabels().length, 9, 'but the list is still whole, ready for stepping back out');

print('\nTHE LIST BENDS TO THE PRODUCT, AND BOTH BEND TOGETHER');
// A product on one range has no range to choose. Whatever step 3 drops, the
// bar has to drop too, or the numbering disagrees by one from there on.
var SOLE = adapter({ papers: function () { return [{ name: 'Uncoated' }]; } });
ADAPTER = SOLE;
var js = Step3.journey(SOLE).map(function (x) { return x.label; });
is(js.indexOf('Range'), -1, 'one range is not a choice, so the step goes');
drawPageBar(1);
is(barLabels(), js, 'and it goes from the bar in the same breath');
is(barLabels().length, 8, 'eight steps now, numbered without a hole');

var NOFIN = adapter({ finishTypesFor: function () { return []; } });
is(Step3.journey(NOFIN).map(function (x) { return x.label; }).indexOf('Finishing') >= 0, true,
   'finishing stays while no paper is chosen — what it can take is not known yet');

print('\nA RAIL YOU CANNOT CLICK IS HALF A RAIL');
// Asking for the journey must not disturb a step that is already running, or
// drawing the bar would reach into step 3 and move the customer.
ADAPTER = adapter();
var before = JSON.stringify(Step3.journey(ADAPTER));
Step3.journey(adapter({ papers: function () { return [{ name: 'Nettuno' }]; } }));
is(JSON.stringify(Step3.journey(ADAPTER)), before,
   'asking on behalf of another adapter leaves the running step untouched');
is(Step3.journey(), null, 'and before step 3 has started, it says so rather than guessing');

var SRC = readFile('step3/step3.js');
is(/var isOpen = x\.host \? !x\.ahead :/.test(SRC), true,
   'a step ahead of you is drawn, but not as somewhere you can click to');
is(/if \(A && A\.goToHostStep && A\.goToHostStep\(id\)\) return;/.test(SRC), true,
   'and clicking a step the PAGE owns is handed back to the page — scrolling '
   + 'to a panel the page has hidden looks like the click did nothing');

print('\nTHE BAR KNOWS WHEN IT CANNOT BE DRAWN');
// Left to guess, it would draw the wrong journey and look authoritative.
var boom = adapter({ papers: function () { throw new Error('catalogue not here yet'); } });
ADAPTER = boom;
BAR.innerHTML = 'UNTOUCHED';
is(drawPageBar(1), false, 'a catalogue that has not arrived is a no, not a guess');
is(BAR.innerHTML, 'UNTOUCHED', 'and the markup is left exactly as it was');

ADAPTER = adapter();
designMode = false; NEW_WIZARD = false;
is(drawPageBar(1), false, 'with the flag off it does nothing at all');
NEW_WIZARD = true; designMode = true;
is(drawPageBar(1), false, 'and the design-studio route keeps its own renumbered bar');
designMode = false;
is(drawPageBar(1), true, 'otherwise it draws');

is(/if \(!drawPageBar\(n\)\) \[1,2,3,4,5\]\.forEach/.test(HTML), true,
   'and when it will not draw, the five steps in the markup are left alone');
is(/html\.wizard-new \.step-bar\{visibility:hidden;\}/.test(HTML), true,
   'until it can be drawn it is held invisible, not shown saying the wrong thing');
is(/\.then\(\(\) => \{ document\.documentElement\.classList\.add\('bar-ready'\); \}\)/.test(HTML), true,
   'and revealed either way, so a failed catalogue does not leave a headless page');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
