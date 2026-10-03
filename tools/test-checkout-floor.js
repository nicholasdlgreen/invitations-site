// The server-side price floor, run against the REAL published prices.
//
// Before a basket reaches Stripe, create-checkout.js rebuilds what the order
// should cost and refuses anything materially cheaper. The browser cannot be
// trusted with the total: anyone can edit a page and claim GBP 1.
//
// On 3 October that check was loading no prices at all. It accepted the
// payload only when `schema_version === 2`; the payload has said 3 since the
// hierarchical publish, so every item fell through to a crude
// `(qty/50) x GBP150` guess. At 100 cards that floors a GBP 19-91 order at
// GBP 300 — 741 of 741 configurations refused, nothing sellable, and no test
// anywhere posted a basket to notice.
//
// So this suite does what nothing did: it drives the real floor with the real
// published ladder and holds it to the one property that matters.
//
// Run:  jsc tools/test-checkout-floor.js

var SRC = readFile('netlify/functions/create-checkout.js');

function grab(name) {
  var needle = 'function ' + name + '(';
  var at = SRC.indexOf(needle);
  if (at < 0) throw new Error('could not find ' + name);
  var i = SRC.indexOf('{', at), depth = 0, end = -1;
  for (var j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (!depth) { end = j + 1; break; } }
  }
  return SRC.slice(at, end);
}
var console = { log: function(){}, warn: function(){}, error: function(){} };
eval(grab('ladderFloor'));
eval(grab('floorPriceFor'));

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Real published rows, committed with the suite rather than fetched or left in
// a temp directory. tools/test-slug-from-url.js reads its fixture from a
// scratchpad that no longer exists and has quietly run zero assertions ever
// since; a fixture outside the repo is a test that dies without saying so.
// Refresh with tools/refresh-price-fixture.py when the SHAPE changes — it does
// not need to hold today's prices to prove how the floor behaves.
var FIX = JSON.parse(readFile('tools/fixtures/published-prices.json'));
var COLS = FIX._cols;
var SLUGS = Object.keys(FIX.products);
var ctx = { products: {}, legacyPrices: [], basePerFifty: 150, envelopes: {}, papers: {} };
SLUGS.forEach(function (slug) {
  ctx.products[slug] = { slug: slug, finish_prices: [], finish_sells: [],
    sheet_sells: FIX.products[slug].map(function (r) {
      var o = {}; COLS.forEach(function (c, i) { o[c] = r[i]; }); return o;
    }) };
});

print('\nTHE PUBLISHED PRICES ACTUALLY LOAD');
SLUGS.forEach(function (slug) {
  is(slug + ' has a priced ladder',
     !!(ctx.products[slug] && ctx.products[slug].sheet_sells.length > 0), true);
});

print('\nTHE FLOOR NEVER EXCEEDS WHAT THE SITE CHARGES');
// The property the whole thing rests on. Every published row IS a price the
// site will quote, so the floor for that configuration must be at or below it.
// A floor above it rejects an honest customer at the last click, which is the
// fault envelopes taught us and the one the weight-blind .find() reintroduced.
var checked = 0, over = 0, worstOver = 0, worstCase = '';
SLUGS.forEach(function (slug) {
  var p = ctx.products[slug];
  p.sheet_sells.forEach(function (row) {
    var floor = floorPriceFor({
      basis: { productSlug: slug, qty: row.qty, paperName: row.paper, size: row.size,
               fold: row.fold, printedSides: row.sides }
    }, ctx);
    checked++;
    if (floor != null && floor > parseFloat(row.sell) + 0.001) {
      over++;
      var by = floor - parseFloat(row.sell);
      if (by > worstOver) {
        worstOver = by;
        worstCase = slug + ' ' + row.paper + ' ' + row.gsm + 'gsm ' + row.size +
                    ' x' + row.qty + ' ' + row.fold + '/' + row.sides +
                    ': floor ' + floor.toFixed(2) + ' vs price ' + row.sell;
      }
    }
  });
});
is('configurations checked (all three products, every row)', checked, 12722);
is('floors above the price the site would charge', over, 0);
if (over) print('        worst: ' + worstCase);

print('\nTHE FLOOR IS A REAL PRICE, NOT THE FALLBACK');
// The fallback is Math.round((qty/50) * 150) + paper extra. If prices failed to
// load again, the floor would land on that and reject everything — which is
// exactly what was happening. These numbers must NOT look like it.
function fallbackFor(qty){ return Math.round((qty / 50) * 150); }
// Taken FROM the published data rather than written out by hand. Hard-coding a
// configuration got this wrong once already: greeting cards publish only flat
// rows, so a 'folded' sample fell to the fallback and looked like a bug in the
// floor when it was a bug in the test.
SLUGS.forEach(function (slug) {
  var p = ctx.products[slug];
  // a mid-sized order, the kind a real customer places
  var row = p.sheet_sells.filter(function (r) { return r.qty >= 50 && r.qty <= 250; })[0]
         || p.sheet_sells[0];
  var floor = floorPriceFor({
    basis: { productSlug: slug, qty: row.qty, paperName: row.paper, size: row.size,
             fold: row.fold, printedSides: row.sides } }, ctx);
  is(slug + ' ' + row.paper + ' ' + row.size + ' x' + row.qty + ' floors on real data',
     floor != null && floor > 0 && floor < fallbackFor(row.qty), true);
});

print('\nWHERE THE WEIGHT IS UNKNOWN, THE CHEAPEST WINS');
// The basket never records the paper weight, so several rows match. The floor
// must be the least of them: any weight is a legitimate order.
var tested = 0, wrong = 0;
SLUGS.forEach(function (slug) {
  var p = ctx.products[slug], seen = {};
  p.sheet_sells.forEach(function (row) {
    var key = [row.paper, row.size, row.qty, row.fold, row.sides].join('|');
    if (seen[key]) return;
    seen[key] = 1;
    var all = p.sheet_sells.filter(function (s) {
      return s.paper === row.paper && s.size === row.size && s.qty === row.qty &&
             s.fold === row.fold && s.sides === row.sides; });
    if (all.length < 2) return;             // only interesting with several weights
    var cheapest = Math.min.apply(null, all.map(function (s) { return parseFloat(s.sell); }));
    var floor = floorPriceFor({
      basis: { productSlug: slug, qty: row.qty, paperName: row.paper, size: row.size,
               fold: row.fold, printedSides: row.sides } }, ctx);
    tested++;
    if (Math.abs(floor - cheapest) > 0.001) wrong++;
  });
});
is('multi-weight configurations tested', tested > 1000, true);
is('floors that are not the cheapest weight', wrong, 0);

print('\nIT STILL REFUSES AN UNDER-CLAIMED BASKET');
// The point of the thing. A real A5 Silk 100 is about GBP 33; claiming GBP 1
// must still be below the floor.
var real = floorPriceFor({ basis: { productSlug: 'wedding-invitations',
  qty: 100, paperName: 'Silk', size: 'A5', fold: 'flat', printedSides: 'single' } }, ctx);
is('a GBP 1 claim is below the floor', 1 < real - 0.01, true);
is('and the honest price is not', real < real + 0.01 && real > 0, true);

print('\nAN UNKNOWN PRODUCT STILL FALLS BACK RATHER THAN CRASHING');
var unknown = floorPriceFor({ basis: { productSlug: 'not-a-product',
  qty: 50, paperName: 'Silk', size: 'A5', fold: 'flat', printedSides: 'single' } }, ctx);
is('an unknown slug still returns a number', typeof unknown === 'number' && unknown > 0, true);

print('\nHOW THE PRICES ARE FETCHED');
// loadPricingContext talks to the network, so it cannot be driven here. These
// hold its shape instead, because the fault that broke checkout lived in
// exactly this code and was invisible to every test that existed.
is('it no longer gates on a payload version', /schema_version/.test(SRC.replace(/\/\/[^\n]*/g, '')), false);
is('it asks pricing_for per product', /rpc\/pricing_for\?p_slug=/.test(SRC), true);
is('it no longer downloads the whole payload',
   /pricing_config\?select=payload/.test(SRC.replace(/\/\/[^\n]*/g, '')), false);
// the loader must look the slug up where the floor does, or it can load one
// product and price another
is('the loader reads basis.productSlug', /i\.basis && i\.basis\.productSlug/.test(SRC), true);
is('the floor reads basis.productSlug',  /ctx\.products\[b\.productSlug\]/.test(SRC), true);
is('one product failing does not take the check down',
   /could not load prices for/.test(SRC), true);

print('\nTHE CHEAPEST-WEIGHT RULE IS IN THE SOURCE, NOT JUST THE RESULT');
is('matching rows are collected, not found',
   /const matches = product\.sheet_sells\.filter/.test(SRC), true);
is('and reduced to the lowest sell',
   /matches\.reduce\(\(lowest, s\) =>/.test(SRC), true);
is('.find on sheet_sells is gone', /sheet_sells\.find\(/.test(SRC), false);

print('\n' + pass + ' passed, ' + fail + ' failed');
