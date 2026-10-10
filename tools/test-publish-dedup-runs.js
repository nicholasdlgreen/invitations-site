// The publish builder EXECUTES here, against stubs, and each cost reaches the
// catalogue exactly once.
// Run:  jsc tools/test-publish-dedup-runs.js   (from the repo root)
//
// Why it runs rather than reads: a source test cannot see an unbound name, and
// the publish builder is a hundred lines of browser JavaScript nobody can run
// without pressing Publish on a live catalogue. Amy went down for a day on an
// unbound name a source test could not see.
//
// What it is guarding. Until 10 October the catalogue carried a complete copy
// of the price list for EVERY product: 26 MB, 220,240 rows that were really
// 9,556. Fourteen products added on 9 October introduced no new prices at all
// and still added 11 MB. The builder now writes each cost once and the margin
// is applied when a price is read.
//
// The test that matters is the LAST one: feed it two products in the same
// family and the catalogue must not grow. That is the property the whole
// change exists for, and it is the one that would silently rot.

var SRC = read('admin.html');   // run from the repo root, like every other test here

// ---- lift the builder out of publishHierarchical and make it callable -----
var from = SRC.indexOf('const rateSets = (sheetRates || [])');
var to   = SRC.indexOf('\n      });', SRC.indexOf('finish_sells:       finishSells'));
if (from < 0 || to < 0) { print('FAIL: cannot find the publish builder in admin.html'); quit(1); }
var BODY = SRC.slice(from, to + '\n      });'.length);

var buildCatalogue = new Function(
  'sheetRates', 'finishRates', 'papers', 'productTypes', 'finishTypes', 'finishOptions',
  BODY + '\n return { rate_sets: rateSets, finish_sets: finishSets,' +
         ' paper_weights: paperWeights, products: products };');

var passed = 0, failed = 0;
function is(label, got, want) {
  var ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++; else failed++;
  print((ok ? '  ok   ' : '  FAIL ') + label +
        (ok ? '' : '   got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)));
}

// ---- stubs ----------------------------------------------------------------
function rate(f, paper, gsm, size, sides, qty, cost, active) {
  return { supplier_family: f, paper_name: paper, weight_gsm: gsm, size: size,
           printed_sides: sides, quantity: qty, cost: cost, active: active !== false };
}
function frate(f, finish, option, applies, size, qty, cost) {
  return { supplier_family: f, finish_name: finish, option_name: option,
           applies_to: applies, size: size, quantity: qty, cost: cost, active: true };
}
function product(slug, extra) {
  var p = { slug: slug, name: slug, active: true, margin_pct: 0,
            supplier_family: 'flat-card', folded_family: null, routes: null,
            available_sizes: ['A5'], available_papers: ['Silk'],
            available_finishes: ['Lamination'], sides_offered: true,
            envelopes_offered: true };
  for (var k in (extra || {})) p[k] = extra[k];
  return p;
}

var SHEETS = [
  rate('flat-card', 'Silk', 300, 'A5', 'single', 100, 23.2),
  rate('flat-card', 'Silk', 300, 'A5', 'single', 250, 41.0),
  rate('flat-card', 'Silk', 400, 'A5', 'single', 100, 30.0),   // weight not sold
  rate('flat-card', 'Silk', 300, 'A5', 'single',  50, 19.0, false) // switched off
];
var FINS = [
  frate('flat-card', 'Lamination', 'Matt',  'both',  'A5', 100, 12.0),
  frate('flat-card', 'Lamination', 'Matt',  'front', 'A5', 100, 12.0), // wrong side
  frate('flat-card', 'Lamination', 'Gloss', 'both',  'A5', 100, 12.0), // not offered
  frate('flat-card', 'Envelopes',  'White', 'front', 'A5', 100,  8.0)
];
var PAPERS = [
  { name: 'Silk', active: true,  weights: [{ gsm: 300 }] },
  { name: 'Retired Stock', active: false, weights: [{ gsm: 270 }] }
];
var TYPES   = [{ name: 'Lamination', active: true, options: [{ name: 'Matt' }] }];
var OPTIONS = [{ name: 'Lamination', cost_modifier: 5 }];

var out = buildCatalogue(SHEETS, FINS, PAPERS, [product('wedding-invitations')], TYPES, OPTIONS);

print('THE BUILDER RUNS, AND STORES COSTS NOT SELL PRICES');
is('it produced a rate set', Array.isArray(out.rate_sets), true);
is('a rate switched off never reaches the catalogue', out.rate_sets.length, 3);
is('the cost is RAW, not a sell price', out.rate_sets[0].cost, 23.2);
is('no rate carries a sell price', out.rate_sets.filter(function (r) {
  return 'sell' in r; }).length, 0);
// Rounding after the margin, not before: a cost stored rounded and then
// multiplied rounds twice and can land a penny out.
is('costs keep their full precision', buildCatalogue(
  [rate('flat-card', 'Silk', 300, 'A5', 'single', 100, 23.456)],
  [], PAPERS, [product('x')], TYPES, OPTIONS).rate_sets[0].cost, 23.456);

print('\nTHE TWO GLOBAL FINISHING FILTERS ARE APPLIED ONCE, NOT PER PRODUCT');
is('the side we do not sell is dropped', out.finish_sets.filter(function (f) {
  return f.finish === 'Lamination' && f.sides === 'front'; }).length, 0);
is('an option not offered is dropped', out.finish_sets.filter(function (f) {
  return f.option === 'Gloss'; }).length, 0);
is('envelopes survive without being in available_finishes',
   out.finish_sets.filter(function (f) { return f.finish === 'Envelopes'; }).length, 1);

print('\nRETIRED PAPERS KEEP THEIR WEIGHTS');
// payload.papers carries only ACTIVE stocks, but a product may still name an
// inactive paper. Lose its weights and the weight filter stops filtering.
is('an inactive paper is still in paper_weights', out.paper_weights['Retired Stock'], [270]);
is('and an active one is too', out.paper_weights['Silk'], [300]);

print('\nTHE PRODUCT CARRIES THE FACTS THE FILTER NEEDS, AND NO PRICES');
var p0 = out.products[0];
is('no per-product sheet price list', 'sheet_sells' in p0, false);
is('no per-product finishing price list', 'finish_prices' in p0, false);
is('sides_offered travels with the product', p0.sides_offered, true);
is('envelopes_offered travels with the product', p0.envelopes_offered, true);
is('the legacy finish_sells stays, with the margin in it', p0.finish_sells, [{ name: 'Lamination', sell: 5 }]);
is('routes fall back to the old family pair',
   buildCatalogue(SHEETS, FINS, PAPERS,
     [product('y', { folded_family: 'folded-card' })], TYPES, OPTIONS).products[0].routes,
   [{ family: 'flat-card', fold: 'flat' }, { family: 'folded-card', fold: 'folded' }]);

print('\nTHE WHOLE POINT: A SECOND PRODUCT ADDS NO PRICES');
var one  = buildCatalogue(SHEETS, FINS, PAPERS, [product('a')], TYPES, OPTIONS);
var four = buildCatalogue(SHEETS, FINS, PAPERS,
             [product('a'), product('b'), product('c'), product('d')], TYPES, OPTIONS);
is('four products, same costs', four.rate_sets.length, one.rate_sets.length);
is('four products, same finishing costs', four.finish_sets.length, one.finish_sets.length);
is('and four products in the catalogue', four.products.length, 4);
// The exact property, stated so it cannot pass by being roughly right: what an
// extra product COSTS must not depend on how many prices there are. A size
// comparison at stub scale is too loose -- a copied list of three rates is
// still small -- and "roughly right" is how this regresses.
function costOfAnExtraProduct(rates) {
  var a = buildCatalogue(rates, FINS, PAPERS, [product('a')], TYPES, OPTIONS);
  var b = buildCatalogue(rates, FINS, PAPERS, [product('a'), product('b')], TYPES, OPTIONS);
  return JSON.stringify(b).length - JSON.stringify(a).length;
}
var manyRates = [];
for (var q = 1; q <= 200; q++) manyRates.push(rate('flat-card', 'Silk', 300, 'A5', 'single', q, 10 + q));
var small = costOfAnExtraProduct(SHEETS);
var large = costOfAnExtraProduct(manyRates);
is('an extra product costs the same whatever the price list holds', small, large);
print('         4 prices: +' + small + ' bytes per product; 200 prices: +' + large + ' bytes');

print('\nMUTATION: THE OLD BEHAVIOUR, PUT BACK INTO THE REAL BUILDER, MUST FAIL');
// Not a hand-made object -- the actual source, mutated to copy the price list
// onto each product the way it did until 10 October. If the checks above
// cannot see that, they are decoration.
var mutatedBody = BODY.replace('finish_sells:       finishSells',
                               'finish_sells:       finishSells,\n          sheet_sells: rateSets');
if (mutatedBody === BODY) { print('  FAIL could not mutate the builder'); failed++; }
var mutatedBuild = new Function(
  'sheetRates', 'finishRates', 'papers', 'productTypes', 'finishTypes', 'finishOptions',
  mutatedBody + '\n return { rate_sets: rateSets, finish_sets: finishSets,' +
                ' paper_weights: paperWeights, products: products };');
function mutatedCostOfAnExtraProduct(rates) {
  var a = mutatedBuild(rates, FINS, PAPERS, [product('a')], TYPES, OPTIONS);
  var b = mutatedBuild(rates, FINS, PAPERS, [product('a'), product('b')], TYPES, OPTIONS);
  return JSON.stringify(b).length - JSON.stringify(a).length;
}
is('the per-product price list is caught',
   'sheet_sells' in mutatedBuild(SHEETS, FINS, PAPERS, [product('a')], TYPES, OPTIONS).products[0], true);
var mSmall = mutatedCostOfAnExtraProduct(SHEETS);
var mLarge = mutatedCostOfAnExtraProduct(manyRates);
is('and an extra product now costs more when there are more prices', mSmall === mLarge, false);
print('         mutated -- 4 prices: +' + mSmall + ' bytes per product; 200 prices: +' +
      mLarge + ' bytes. That gap IS the 26 MB.');

print('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) quit(1);
