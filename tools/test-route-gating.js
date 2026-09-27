var BITS = readFile("/private/tmp/claude-501/-Users-nicholasgreen-Documents-GitHub-invitations-site/3b51a30d-10a2-4338-ac24-3c08757aec53/scratchpad/gatebits.js");
var payload = JSON.parse(readFile("/private/tmp/claude-501/-Users-nicholasgreen-Documents-GitHub-invitations-site/3b51a30d-10a2-4338-ac24-3c08757aec53/scratchpad/payload_wedding.json"))[0].payload;
var product = payload.products[0];
var results = [];

// The real finish_types from the database, with the options the customer sees.
var FINISH_TYPES = [
  { name:'Lamination', options:[{name:'None'},{name:'Matt'},{name:'Gloss'},{name:'Soft Touch'}] },
  { name:'Foiling',    options:[{name:'None'},{name:'Gold'},{name:'Silver'},{name:'Rose Gold'}] },
  { name:'Spot UV',    options:[{name:'None'},{name:'Add Spot UV'}] },
  { name:'Corners',    options:[{name:'Square'},{name:'Rounded'}] }
];
// Silk can take everything; the Fedrigoni stocks can take nothing.
var PUBLISHED_PAPERS = (payload.papers||[]).map(function(p){ return {name:p.name, finishes:p.finishes||[]}; });

function build(o) {
  var f = new Function('CONFIG','currentProduct','selectedPaper','selectedSize','selectedFold',
                       'selectedSides','selectedFinishes','uploadQty','publishedPapers','console',
    BITS + "\nreturn { step3Finishes, finishPricedOn, optionHasLadder, envelopePricedOn," +
           "  familyForPaper, printingFamily, lookupFinishSell, totalFinishSell };");
  return f(o.CONFIG, o.product, o.selectedPaper, o.size, o.fold, o.sides || 'single',
           o.finishes || {}, o.qty || 100, PUBLISHED_PAPERS,
           { warn: function(){}, log: function(){}, error: function(){} });
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
check('FOLDED does NOT offer Corners (no rate on folded-card)', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var list = api.step3Finishes(w._silk.name);
  return !/Corners/.test(names(list)) ? true : 'still offered: ' + names(list);
});

// ── the regression the fixture caught: flat-figure finishes must survive ──
check('FOLDED still offers Foiling and Spot UV (on no ladder, sold flat)', function(){
  var w = world({ fold:'folded' }); var api = build(w);
  var n = names(api.step3Finishes(w._silk.name));
  return (/Foiling/.test(n) && /Spot UV/.test(n)) ? true : 'got: ' + n;
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

print(results.join("\n"));
