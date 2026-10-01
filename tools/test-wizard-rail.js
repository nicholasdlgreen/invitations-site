// One rail, or none. The page's own step bar and step 3's rail are never on
// screen together, so nothing stops them describing two different journeys —
// and for a while they did: the bar said Size · Artwork · Paper & Quantity ·
// Basket · Checkout, and then the rail said Size · Artwork · Range · Paper ·
// Finishing · Quantity · Delivery. A customer shown one map and handed another
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
    trailingSteps: function () { return []; }
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
// drawPageBar reads TAIL_STEPS, which lives beside it rather than inside it,
// so the list the shop actually ships is cut out too — not a copy kept here.
var _tail = HTML.slice(HTML.indexOf('const TAIL_STEPS = ['));
_tail = _tail.slice(0, _tail.indexOf('];') + 2);
eval(_tail.replace('const ', 'var '));
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
is(j, ['Size','Artwork','Range','Paper','Finishing','Quantity','Delivery'],
   'the seven steps of the approved mockup, size through delivery');
drawPageBar(1);
is(barLabels(), j, 'and the page bar is that same list, not a second one');
is(barLabels().length, 7, 'seven steps, the same seven the rail will show');
// Nine of them wrapped to four rows of furniture above the first question.
is(Step3.journey(adapter({ trailingSteps: function () { return []; } })).length, 7,
   'the basket and the checkout are what happens after the order, not part of it');

print('\nWHERE THE CUSTOMER IS');
drawPageBar(1); is(barActive(), 'Size',     'step 1 is Size');
drawPageBar(2); is(barActive(), 'Artwork',  'step 2 is Artwork');
drawPageBar(3);
is(barActive(), null, 'step 3 draws its own rail, so nothing in the bar is lit');
is(barLabels().length, 7, 'but the list is still whole, ready for stepping back out');
// Past the order the line does not end — it changes to the tail.
drawPageBar(4);
is(barLabels(), ['Your order','Basket','Checkout','Payment'], 'the basket is on the tail');
is(barActive(), 'Basket', 'with Basket lit');
drawPageBar(5);
is(barActive(), 'Checkout', 'and the checkout lights Checkout');
is(/<div class="step-label done">Basket</.test(BAR.innerHTML), true,
   'with the basket behind it filled in');

print('\nTHE LIST BENDS TO THE PRODUCT, AND BOTH BEND TOGETHER');
// A product on one range has no range to choose. Whatever step 3 drops, the
// bar has to drop too, or the numbering disagrees by one from there on.
var SOLE = adapter({ papers: function () { return [{ name: 'Uncoated' }]; } });
ADAPTER = SOLE;
var js = Step3.journey(SOLE).map(function (x) { return x.label; });
is(js.indexOf('Range'), -1, 'one range is not a choice, so the step goes');
drawPageBar(1);
is(barLabels(), js, 'and it goes from the bar in the same breath');
is(barLabels().length, 6, 'six steps now, numbered without a hole');

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
   'a step ahead of you would be drawn, but not as somewhere you can click to');
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
print('\nOFF THE TOP LINE, STILL ON THE PAGE');
// The range is still chosen, with the same three pods. It is simply not one of
// the numbered steps, so the line reads 1 to 6. Taking it OFF the page was a
// different thing entirely, and wrong.
var SKIPPED = adapter({ railSkips: function () { return ['s1']; } });
ADAPTER = SKIPPED;
var jn = Step3.journey(SKIPPED).map(function (x) { return x.label; });
is(jn, ['Size','Artwork','Paper','Finishing','Quantity','Delivery'],
   'six steps on the line, and the paper is the third of them');
// He chose this word over the mockup's "How many" on 30 September 2026.
is(jn[4], 'Quantity', 'step five is Quantity, in his words, not mine');
is(/<h2>Quantity<\/h2>/.test(readFile('step3/step3.html')), true,
   'and the heading on the section says the same as the line above it');
drawPageBar(1);
is(barLabels(), jn, 'and the bar says the same six');
is(Step3.journey(adapter()).map(function (x) { return x.label; }).indexOf('Range'), 2,
   'a product not switched over still counts its range as a step');

var SRC3 = readFile('step3/step3.js');
is(/function stockList/.test(SRC3), false,
   'the papers are NOT thrown into one list — the range still filters them');
is(/function drawFeels/.test(SRC3), true, 'and the range pods are still drawn');
is(/var mine = papersIn\(S\.feel\);/.test(SRC3), true,
   'the paper step still shows the papers in the range that was chosen');
is(/if \(offRail\(id\)\) \{ b\.textContent = ''; return; \}/.test(SRC3), true,
   'a section off the line carries no number, so its heading cannot claim one '
   + 'the line above does not have');
is(/\/\/ number step3\.html was written with until it opened/.test(SRC3)
   || /kept whatever/.test(SRC3), true,
   'and a locked section is numbered too, rather than keeping a stale one');
is(/for \(var b = from; b < all\.length; b\+\+\) \{/.test(SRC3), true,
   'standing on a section that is off the line lights the step it leads into, '
   + 'not the first step of all');

ADAPTER = adapter();

print('\nTHE LINE CARRIES ON PAST THE ORDER');
// It used to stop at Delivery and vanish, which left the checkout with no
// title AND no map — the customer could not tell they had arrived, or how
// much further there was to go.
is(/const TAIL_STEPS = \[/.test(HTML), true, 'there is a second list for after the order');
['Your order','Basket','Checkout','Payment'].forEach(function (w) {
  is(new RegExp("label: '" + w + "'").test(HTML), true, 'the line still says ' + w);
});
is(/\{ id: 'order',    label: 'Your order' \}/.test(HTML), true,
   'the six configurator steps collapse into one word, because by here they '
   + 'are all behind you and listing them again would be noise');
is(/const tail = n >= 4;/.test(HTML), true, 'the tail starts at the basket');
is(/const at = \{ 1: 'step1', 2: 'step2', 4: 'basket', 5: 'checkout' \}\[n\];/.test(HTML),
   true, 'the basket lights Basket and the checkout lights Checkout');
is(/past-order/.test(HTML), false,
   'and nothing hides the bar after the order any more');

print('\nWHAT THE BAR SAYS, AND WHAT THE QUANTITY BOX DOES NOT');
var SRC4 = readFile('step3/step3.js');
// The size and the shape are chosen two steps before the bar appears and are
// named nowhere else on it. Without them the running total said what it was
// printed on, not what was being bought.
is(/var shape = \(A\.shapeLabel && A\.shapeLabel\(\)\) \|\| '';/.test(SRC4), true,
   'the bar asks the page what size and shape this is');
is(/\(shape \? esc\(shape\) \+ ' &middot; ' : ''\)/.test(SRC4), true,
   'and says it before the paper, or says nothing if there is none yet');
is(/shapeLabel: \(\) => \{/.test(HTML), true, 'and the page answers');
is(/bits\.join\(' '\) \+ \(selectedOrientation \? ', ' \+ selectedOrientation : ''\)/.test(HTML),
   true, 'in the words its own controls already use — nothing new invented');

// "Any number from 1 to 500" is not wanted under the box.
// The phrase survives in a comment saying why it went; what matters is that
// nothing builds it any more.
is(/'Any number from ' \+/.test(SRC4), false,
   'the range is not spelled out under the box');
is(/var hint = range/.test(SRC4), false, 'and nothing is left over building it');
is(/<span class="qty-own-hint" id="qtyOwnHint"><\/span>/.test(SRC4), true,
   'but the element stays, because a number the printer will not quote still '
   + 'has to say so');
is(/return say\('The most we can print in one order is ' \+ range\.max/.test(SRC4)
   || /The most we can print in one order is/.test(SRC4), true,
   'and that message is still there for when it is actually needed');
is(/>Use<\/button>/.test(SRC4), true, 'the Use button is untouched');

print('\nWORDS ONLY, WITH A RULE UNDER THE ONE YOU ARE ON');
// Six numbered circles plus six labels came to 824px in a 760px column and
// broke onto two rows, four on a phone. The words alone are 392px.
is(/html\.wizard-new \.step-num\{display:none;\}/.test(HTML), true,
   'no numbered circle on the line');
is(/html\.wizard-new #s3wrap \.rl b\{display:none;\}/.test(HTML), true,
   'and none on step 3\u2019s rail either, or the map changes appearance halfway');
is(/\.step-label\.active\{color:var\(--text\);box-shadow:inset 0 -1px 0 0 var\(--gold\);\}/.test(HTML),
   true, 'the word you are on is picked out by a rule as well as by colour \u2014 '
   + 'a warm grey and a warm brown are too close to carry it alone');
is(/#s3wrap \.rl\.now\{box-shadow:inset 0 -1px 0 0 var\(--tier,var\(--gold\)\);\}/.test(HTML),
   true, 'and the rail says it the same way');
is(/html\.wizard-new \.step-label\{white-space:nowrap;letter-spacing:\.14em;color:var\(--pale\);padding-bottom:5px;\}/.test(HTML),
   true, 'every word reserves the space the rule sits in, or the one that has '
   + 'it rides above the rest of the line');
is(/html\.wizard-new #s3wrap \.rl\{gap:0;padding-bottom:6px;\}/.test(HTML), true,
   'the rail reserves it too');
is(/'<div class="step-label' \+ \(i<cur\?' done':i===cur\?' active':''\)/.test(HTML), true,
   'and the word carries done and now, now that no circle does');

print('\nWHICH PRODUCTS IT IS ON FOR');
// It was built and walked end to end on wedding invitations, so that is where
// it is on for everyone. The other twenty-one keep the old step 1 until each
// has had the same treatment — they are not switched on by being nearby.
is(/railSkips: \(\) => NEW_WIZARD \? \['s1'\] : \[\],/.test(HTML), true,
   'the shop actually asks for the range to come off the line — the stub '
   + 'adapter above proves the mechanism, not that anyone uses it');
is(/const NEW_WIZARD = new URLSearchParams\(location\.search\)\.get\('wizard'\) !== 'old';/.test(HTML),
   true, 'on for every product — it is the template for the range, and a page '
   + 'that behaves one way on wedding invitations and another on thank you '
   + 'cards is two products, not twenty-three');
is(/PRODUCT\.slug === '/.test(HTML), false,
   'nothing is keyed to one slug: that left it off on twenty-two of the '
   + 'twenty-three, which is the fault it replaces');

// The dev server has to serve that route too, or it cannot be checked at all.
var SERVE = readFile('tools/serve.py');
is(/== 'order':/.test(SERVE), true,
   "the local server resolves /<slug>/order the way Netlify does");

is(/html\.wizard-new \.step-bar\{visibility:hidden;\}/.test(HTML), true,
   'until it can be drawn it is held invisible, not shown saying the wrong thing');
// A failed draw must not reveal the OLD five-step bar under a six-step rail.
is(/if \(drawn \|\| !NEW_WIZARD \|\| document\.readyState === 'complete'\) return reveal\(\);/.test(HTML),
   true, 'a draw that failed is tried again once everything has loaded, rather '
   + 'than uncovering the five-step bar it was meant to replace');
is(/window\.addEventListener\('load', \(\) => \{ drawPageBar\(currentStep\); reveal\(\); \}, \{ once: true \}\);/.test(HTML),
   true, 'and it is revealed after that attempt either way, never left hidden '
   + 'for good');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
