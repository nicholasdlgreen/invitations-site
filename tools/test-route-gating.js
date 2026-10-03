// Which finishes a route can actually be charged for, and what they cost.
//
// This suite was DEAD from some time before 1 October: it read two fixtures
// from a scratchpad directory that no longer exists, so it threw on line 1 and
// reported nothing. It is also the only test of lookupFinishSell, which is the
// function that decides whether a finish is offered at all — so the one test
// covering the riskiest part of finishing pricing was silently absent.
//
// It now cuts its subjects out of the shipped page at run time, like every
// other suite here, and builds its own payload. There is no fixture left to go
// missing.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-route-gating.js

var HTML = readFile('upload-and-print.html');

function grab(name) {
  var needle = '\nfunction ' + name + '(';
  var i = HTML.indexOf(needle);
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

var BITS = ['_eqf', 'finishSidesFor', 'familyForPaper', 'printingFamily',
            'finishPricedOn', 'finishHasLadder', 'optionHasLadder', 'envelopePricedOn',
            'lookupFinishSell', 'totalFinishSell', 'step3Finishes']
           .map(grab).join('\n\n');

// The payload shape the page is handed, built here rather than read from a
// published snapshot that ages. finish_prices is the ladder; finish_sells is
// the flat figure the ladder overrides.
function payloadFor(opts) {
  opts = opts || {};
  var rows = [];
  // Lamination: a real ladder on both folds, deliberately different per family
  // so a test can tell which one was used.
  ['flat-card', 'folded-card'].forEach(function (fam) {
    ['Matt', 'Gloss', 'Soft Touch'].forEach(function (o) {
      [25, 100, 250, 500].forEach(function (q) {
        rows.push({ family: fam, finish: 'Lamination', option: o, sides: 'both',
                    size: 'A5', qty: q, sell: fam === 'flat-card' ? 12 : 18 });
      });
    });
  });
  // Corners: flat-card only, which is why folded must return null for it.
  ['Rounded'].forEach(function (o) {
    [25, 100, 250, 500].forEach(function (q) {
      rows.push({ family: 'flat-card', finish: 'Corners', option: o, sides: 'front',
                  size: 'A5', qty: q, sell: 22 });
    });
  });
  // Envelopes: white and red on the two card families at the sizes that have
  // them, and nothing on folded-leaflet or Square-210 — which is what the
  // size and family checks below are about.
  ['flat-card', 'folded-card'].forEach(function (fam) {
    ['Brilliant White', 'Red'].forEach(function (o) {
      ['A6', 'A5', 'DL', 'Square'].forEach(function (sz) {
        [25, 100, 250, 500].forEach(function (q) {
          rows.push({ family: fam, finish: 'Envelopes', option: o, sides: 'front',
                      size: sz, qty: q, sell: o === 'Red' ? 24 : 10 });
        });
      });
    });
  });
  // Corners IS priced at Square-210, which one of the checks relies on.
  [25, 100, 250, 500].forEach(function (q) {
    rows.push({ family: 'flat-card', finish: 'Corners', option: 'Rounded', sides: 'front',
                size: 'Square-210', qty: q, sell: 22 });
  });
  if (opts.foilLadder) {
    ['Gold', 'Silver', 'Rose Gold'].forEach(function (o) {
      ['flat-card', 'folded-card'].forEach(function (fam) {
        [25, 100, 250, 500].forEach(function (q) {
          rows.push({ family: fam, finish: 'Foiling', option: o, sides: 'front',
                      size: 'A5', qty: q, sell: fam === 'flat-card' ? 96 : 94 });
        });
      });
    });
  }
  return {
    products: [{
      supplier_family: 'flat-card',
      folded_family: 'folded-card',
      finish_prices: rows,
      finish_sells: [{ name: 'Foiling', sell: 70 }, { name: 'Protective finish', sell: 13.60 },
                     { name: 'Corners', sell: 0 }, { name: 'Lamination', sell: 5 }],
      papers: []
    }],
    papers: [
      { name: 'Silk', weights: [{ id: 'silk-300', gsm: 300 }],
        finishes: ['Lamination', 'Foiling', 'Protective finish', 'Corners'] },
      { name: 'Tintoretto Gesso', weights: [{ id: 'tg-300', gsm: 300 }], finishes: [] }
    ]
  };
}

var payload = payloadFor();
var product = payload.products[0];
var results = [];

// The real finish_types from the database, with the options the customer sees.
var FINISH_TYPES = [
  { name:'Lamination', options:[{name:'None'},{name:'Matt'},{name:'Gloss'},{name:'Soft Touch'}] },
  { name:'Foiling',    options:[{name:'None'},{name:'Gold'},{name:'Silver'},{name:'Rose Gold'}] },
  // A finish with no ladder anywhere, which is the case this suite exists to
  // guard. Spot UV held this slot until it was withdrawn on 3 October.
  { name:'Protective finish', options:[{name:'None'},{name:'Add it'}] },
  { name:'Corners',    options:[{name:'Square'},{name:'Rounded'}] }
];
// Silk can take everything; the Fedrigoni stocks can take nothing.
var PUBLISHED_PAPERS = (payload.papers||[]).map(function(p){ return {name:p.name, finishes:p.finishes||[]}; });

function build(o) {
  var f = new Function('CONFIG','currentProduct','selectedPaper','selectedSize','selectedFold',
                       'selectedSides','selectedFinishes','uploadQty','publishedPapers','console',
                       'NEW_WIZARD','sheetSells',
    BITS + "\nreturn { step3Finishes, finishPricedOn, optionHasLadder, envelopePricedOn," +
           "  familyForPaper, printingFamily, lookupFinishSell, totalFinishSell };");
  return f(o.CONFIG, o.product, o.selectedPaper, o.size, o.fold, o.sides || 'single',
           o.finishes || {}, o.qty || 100, PUBLISHED_PAPERS,
           { warn: function(){}, log: function(){}, error: function(){} },
           true, function(){ return []; });
}
function world(over) {
  var papers = (payload.papers||[]).map(function(p,i){ return { id:'p'+i, name:p.name, weights:p.weights||[] }; });
  var silk = papers.filter(function(p){ return /silk/i.test(p.name); })[0] || papers[0];
  var o = { CONFIG:{ papers:papers, finishTypes:FINISH_TYPES }, product:product,
            selectedPaper: silk.id, size:'A5', fold:'flat', _silk:silk, _papers:papers };
  for (var k in (over||{})) o[k] = over[k];
  return o;
}
function check(name, fn) {
  var v; try { v = fn(); } catch (e) { v = 'threw: ' + e.message; }
  results.push((v === true ? 'PASS  ' : 'FAIL  ') + name + (v === true ? '' : '  -> ' + v));
}
function names(list){ return list.map(function(t){ return t.name; }).sort().join(', '); }
function optsOf(list, type){
  var t = list.filter(function(x){ return x.name === type; })[0];
  return t ? t.options.map(function(o){ return o.name; }).sort().join(', ') : '(type absent)';
}

// ── the bug: corners on a folded card ────────────────────────────────────
check('FLAT offers Corners (it is priced on flat-card)', function(){
  var w = world({ fold:'flat' }); var api = build(w);
  var list = api.step3Finishes(w._silk.name);
  return /Corners/.test(names(list)) ? true : 'got: ' + names(list);
});
// This check used to read "FOLDED does not offer Corners". That was true of
// the pre-wizard branch of step3Finishes, which filtered on finishPricedOn.
// The wizard branch does NOT: it marks a finish unavailable from the PAPER's
// capabilities alone and never asks whether the route can be charged for it.
// The wizard is now on for everything, so the filter the old check was
// guarding is no longer reached. What it actually does now is recorded here,
// and the money consequence is the check below it.
// Fixed 1 October. The wizard branch marked a finish unavailable from the
// PAPER's capabilities alone and never asked whether the ROUTE could be
// charged for it, so a folded card offered Corners, priced it at null, and
// totalFinishSell skipped the null — a £16.80 operation done for nothing.
// Three things have to hold for that to stay shut.
check('FOLDED marks Corners unavailable — the route cannot be charged for it', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var row = api.step3Finishes(w._silk.name).filter(function(t){ return t.name === 'Corners'; })[0];
  return (row && row.unavailable === true)
    ? true : 'Corners row: ' + JSON.stringify(row && { n: row.name, u: row.unavailable });
});
check('and Rounded is not left selectable underneath the greyed heading', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var row = api.step3Finishes(w._silk.name).filter(function(t){ return t.name === 'Corners'; })[0];
  var opts = (row.options || []).map(function(o){ return o.name; });
  return opts.indexOf('Rounded') < 0
    ? true : 'Rounded survived: ' + JSON.stringify(opts);
});
check('FLAT keeps Corners available, because flat-card IS priced', function(){
  var w = world({ fold:'flat' }); var api = build(w);
  var row = api.step3Finishes(w._silk.name).filter(function(t){ return t.name === 'Corners'; })[0];
  return (row && row.unavailable === false && (row.options||[]).some(function(o){ return o.name === 'Rounded'; }))
    ? true : 'flat lost it: ' + JSON.stringify(row && { u: row.unavailable });
});

// ── the regression the fixture caught: flat-figure finishes must survive ──
// A finish the ladder does not cover ANYWHERE must still be offered and still
// be charged. The danger is the opposite of the Corners leak below: there the
// ladder existed and the route was missing, so refusing was right; here no
// ladder exists at all, and refusing would silently drop a finish we sell.
check('FOLDED still offers a finish that has no ladder at all', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var n = names(api.step3Finishes(w._silk.name));
  return (/Foiling/.test(n) && /Protective finish/.test(n)) ? true : 'got: ' + n;
});
check('Foiling is still priced at its flat figure, not zero', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var v = api.lookupFinishSell('Foiling', 'Gold');
  return v === 70 ? true : 'expected 70, got ' + v;
});
check('Lamination is priced from the ladder on BOTH folds', function(){
  var flat = build(world({ fold:'flat'   })).lookupFinishSell('Lamination','Matt');
  var fold = build(world({ fold:'folded' })).lookupFinishSell('Lamination','Matt');
  return (flat > 0 && fold > 0 && flat !== fold)
    ? true : 'flat=' + flat + ' folded=' + fold + ' (expected two different positive figures)';
});
check('Corners on folded returns null, never the zero from finish_sells', function(){
  var api = build(world({ fold:'folded' }));
  var v = api.lookupFinishSell('Corners','Rounded');
  return v === null ? true : 'expected null, got ' + v;
});
check('a null never reaches the total as NaN', function(){
  var api = build(world({ fold:'folded', finishes:{ Corners:'Rounded', Foiling:'Gold' } }));
  var t = api.totalFinishSell();
  return t === 70 ? true : 'expected 70 (foiling only), got ' + t;
});

// ── option-level gating, not just whole types ────────────────────────────
check('Corners keeps BOTH options on flat \u2014 Square is the free default', function(){
  var w = world({ fold:'flat' }); var api = build(w);
  return optsOf(api.step3Finishes(w._silk.name), 'Corners') === 'Rounded, Square'
    ? true : 'got: ' + optsOf(api.step3Finishes(w._silk.name), 'Corners');
});

// ── the route actually resolves per paper ────────────────────────────────
check('familyForPaper follows the fold', function(){
  var a = build(world({ fold:'flat'   })); var w = world({ fold:'folded' }); var b = build(w);
  var fa = a.familyForPaper(w._silk.name), fb = b.familyForPaper(w._silk.name);
  return (fa === 'flat-card' && fb === 'folded-card') ? true : 'flat->' + fa + ' folded->' + fb;
});

// ── envelopes ────────────────────────────────────────────────────────────
check('both envelope colours are offered where both are published', function(){
  var api = build(world({ fold:'flat' }));
  return (api.envelopePricedOn('Brilliant White','flat-card') &&
          api.envelopePricedOn('Red','flat-card')) ? true : 'one was refused';
});
check('no envelope colour survives on a family with none published', function(){
  var api = build(world({ fold:'flat' }));
  var w = api.envelopePricedOn('Brilliant White','folded-leaflet');
  var r = api.envelopePricedOn('Red','folded-leaflet');
  return (w === false && r === false) ? true : 'white=' + w + ' red=' + r;
});
check('a colour nobody publishes is refused', function(){
  var api = build(world({ fold:'flat' }));
  return api.envelopePricedOn('Champagne Gold','flat-card') === false ? true : 'it was allowed';
});

// ── size matters too: Square-210 has no envelope ─────────────────────────
check('Square-210 offers no envelope colour', function(){
  var api = build(world({ fold:'flat', size:'Square-210' }));
  return (api.envelopePricedOn('Brilliant White','flat-card') === false)
    ? true : 'white was offered at Square-210';
});
check('Square-210 still offers Corners (it IS priced there)', function(){
  var w = world({ fold:'flat', size:'Square-210' }); var api = build(w);
  return /Corners/.test(names(api.step3Finishes(w._silk.name)))
    ? true : 'got: ' + names(api.step3Finishes(w._silk.name));
});

// ── fail open on an old payload ──────────────────────────────────────────
check('a payload with no ladder keeps every finish', function(){
  var stripped = JSON.parse(JSON.stringify(product)); stripped.finish_prices = [];
  var w = world({ fold:'folded', product: stripped }); var api = build(w);
  var n = names(api.step3Finishes(w._silk.name));
  return (/Corners/.test(n) && /Lamination/.test(n)) ? true : 'got: ' + n;
});

// ── foiling, once it has a ladder of its own (1 October) ─────────────────
//
// Until now Foiling had no rows in finish_rates and fell through to a flat
// £70 from finish_sells. Measured against PrintedEasy it is £80-£95 list,
// £64-£76 after our 20%, and it moves with size, quantity and family. Putting
// real rows in changes the shape of the answer, and one of those changes is
// dangerous, so it is pinned here.
function foiled(over){
  var pay = payloadFor({ foilLadder: true });
  var o = world(over || {});
  o.product = pay.products[0];
  o.product.supplier_family = 'flat-card';
  o.product.folded_family = 'folded-card';
  return build(o);
}

check('with a ladder, foiling is priced from it and not from the flat figure', function(){
  var v = foiled({ fold:'flat' }).lookupFinishSell('Foiling','Gold');
  return v === 96 ? true : 'expected the ladder rung 96, got ' + v;
});
check('and the folded route gets its own rung, not the flat one', function(){
  var v = foiled({ fold:'folded' }).lookupFinishSell('Foiling','Gold');
  return v === 94 ? true : 'expected 94, got ' + v;
});

// THE TRAP. optionHasLadder asks only whether the finish and option appear
// ANYWHERE in the ladder — it does not look at size. So the moment one Foiling
// row exists, every size the ladder does not cover returns null, and null means
// WITHDRAWN. Before this change those sizes quietly charged £70; after it they
// stop offering foiling at all. A size missing from the scrape is therefore not
// a small pricing error, it is a product disappearing.
check('a size the foiling ladder does NOT cover withdraws foiling entirely', function(){
  var v = foiled({ fold:'flat', size:'A4' }).lookupFinishSell('Foiling','Gold');
  return v === null
    ? true : 'expected null for an uncovered size, got ' + v
           + ' — if this is now 70 the ladder is being bypassed, if it is a number '
           + 'the scrape covered a size this test thought it did not';
});
// A MISSING SIZE AND A MISSING COLOUR FAIL DIFFERENTLY, which is worth knowing
// before trusting either. optionHasLadder matches on finish AND option, so a
// colour with no rows at all makes it FALSE and the flat figure stands — the
// order quietly takes £70 instead of the measured rate. A missing size leaves
// it TRUE and the finish is withdrawn. Neither is acceptable; they are just
// differently bad, and only one of them is visible to a customer.
check('a colour the ladder does not carry falls back to the flat figure instead', function(){
  var v = foiled({ fold:'flat' }).lookupFinishSell('Foiling','Holographic');
  return v === 70
    ? true : 'expected the flat 70 — a colour with no rows makes optionHasLadder '
           + 'false, so the ladder is not consulted at all. Got ' + v;
});
check('so every colour we sell must be written, not just one', function(){
  var api = foiled({ fold:'flat' });
  var got = ['Gold','Silver','Rose Gold'].map(function(c){ return api.lookupFinishSell('Foiling', c); });
  return got.every(function(v){ return v === 96; })
    ? true : 'the three colours in the fixture priced ' + JSON.stringify(got);
});
check('a null foiling price never reaches the basket as NaN', function(){
  var api = foiled({ fold:'flat', size:'A4', finishes:{ Foiling:'Gold' } });
  var t = api.totalFinishSell();
  return t === 0 ? true : 'expected 0, got ' + t;
});

// ── and the basket's own guard, for a selection made before any of that ──
// The UI should no longer offer it. If one is ever selected anyway — a stale
// choice, or a payload that changed under the customer — the order must not
// complete at a price that quietly left the work out.
check('an unpriceable selection is reported rather than silently skipped', function(){
  var api2 = new Function('CONFIG','currentProduct','selectedPaper','selectedSize','selectedFold',
                          'selectedSides','selectedFinishes','uploadQty','publishedPapers','console',
                          'NEW_WIZARD','sheetSells',
    BITS + '\n' + grab('unpricedFinish') +
    "\nreturn { unpricedFinish: unpricedFinish, lookupFinishSell: lookupFinishSell, totalFinishSell: totalFinishSell };");
  var w = world({ fold:'folded', finishes:{ Corners:'Rounded', Lamination:'Matt' } });
  var a = api2(w.CONFIG, w.product, w.selectedPaper, w.size, w.fold, 'single',
               w.finishes, 100, PUBLISHED_PAPERS,
               { warn:function(){}, log:function(){}, error:function(){} },
               true, function(){ return []; });
  return (a.unpricedFinish() === 'Corners' && a.totalFinishSell() === 18)
    ? true : 'unpriced=' + a.unpricedFinish() + ' total=' + a.totalFinishSell()
           + ' (expected Corners reported, and the lamination still charged)';
});
check('and nothing is reported when every choice has a price', function(){
  var api2 = new Function('CONFIG','currentProduct','selectedPaper','selectedSize','selectedFold',
                          'selectedSides','selectedFinishes','uploadQty','publishedPapers','console',
                          'NEW_WIZARD','sheetSells',
    BITS + '\n' + grab('unpricedFinish') +
    "\nreturn { unpricedFinish: unpricedFinish };");
  var w = world({ fold:'flat', finishes:{ Corners:'Rounded' } });
  var a = api2(w.CONFIG, w.product, w.selectedPaper, w.size, w.fold, 'single',
               w.finishes, 100, PUBLISHED_PAPERS,
               { warn:function(){}, log:function(){}, error:function(){} },
               true, function(){ return []; });
  return a.unpricedFinish() === null ? true : 'got ' + a.unpricedFinish();
});

print(results.join("\n"));
