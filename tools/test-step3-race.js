// Which paper ranges step 3 offers, and the race that used to decide it.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-step3-race.js
//
// initStep3 and PAPER_TIER are CUT OUT OF upload-and-print.html, and liveFeels
// out of step3/step3.js, so this tests the two files that ship. Arriving from
// the design studio mounted the step before the catalogue had loaded: every
// paper fell back to Signature, the range choice saw one range and removed
// itself, and the flag latched — so Luxury and Eco could not be bought at all
// for the rest of the visit.

var PAGE = readFile('upload-and-print.html');
var STEP = readFile('step3/step3.js');

function grabFrom(SRC, needle){
  var i = SRC.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + needle);
  var j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++){
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/'){ k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`'){
      var q = c;
      for (k++; k < SRC.length; k++){
        if (SRC[k] === '\\') { k++; continue; }
        if (SRC[k] === q) break;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1);
}

// ── the page, reduced to what decides the ranges ──
var CONFIG, publishedPapers, _step3Ready, _siteDataReady, mounted, initCalls;
var Step3 = { init: function(){ initCalls.push(A_SNAPSHOT()); }, setArtwork: function(){} };
var window = { Step3: Step3, addEventListener: function(){} };
var console = { error: function(){} };
var document = {
  getElementById: function(){ return { innerHTML: '', style: { setProperty: function(){} } }; },
  querySelector: function(){ return null; }
};
function fetch(){ return Promise.resolve({ ok: true, text: function(){ return Promise.resolve('<div></div>'); } }); }
function setRailOffset(){}
function step3Artwork(){ return null; }
function step3Adapter(){ return {}; }
function updatePrice(){}
function getComputedStyle(){ return { position: 'static' }; }

// PAPER_TIER is an arrow const in the page; eval scopes const to itself, so it
// is re-declared with var to make it visible to the rest of this file.
var PAPER_TIER;
eval(grabFrom(PAGE, 'const PAPER_TIER = name =>').replace('const PAPER_TIER', 'PAPER_TIER'));

function step3Papers(){ return (CONFIG.papers || []).slice(); }
eval(grabFrom(PAGE, 'async function initStep3()'));

// ── step3.js's own rule for which ranges appear ──
var FEELS = [{ id:'signature' }, { id:'luxury' }, { id:'kinder' }];
function liveFeels(papers){
  return FEELS.filter(function(f){
    return papers.filter(function(p){ return PAPER_TIER(p.name) === f.id; }).length;
  }).map(function(f){ return f.id; });
}
function A_SNAPSHOT(){ return liveFeels(step3Papers()); }

var CATALOGUE = [
  { name:'Uncoated', tier:'signature' }, { name:'Silk', tier:'signature' },
  { name:'Cartonboard', tier:'signature' }, { name:'Ice White', tier:'signature' },
  { name:'Tintoretto Gesso', tier:'luxury' }, { name:'Nettuno Bianco', tier:'luxury' },
  { name:'Acquerello Bianco', tier:'luxury' }, { name:'Sirio Pearl Polar Dawn', tier:'luxury' },
  { name:'Recycled Uncoated', tier:'kinder' }
];

var pass = 0, fail = 0;
function is(label, got, want){
  var g = JSON.stringify(got), w = JSON.stringify(want), ok = g === w;
  ok ? pass++ : fail++;
  if (!ok) print('  FAIL ' + label + '\n        got  ' + g + '\n        want ' + w);
}
// The catalogue lands after a delay, exactly as a fetch does.
function siteDataAfter(ticks){
  return new Promise(function(res){
    var n = 0;
    (function step(){
      if (n++ >= ticks){ CONFIG.papers = CATALOGUE.slice(); return res(); }
      Promise.resolve().then(step);
    })();
  });
}
function reset(){
  CONFIG = { papers: [] };
  _step3Ready = false;
  initCalls = [];
}

(async function(){
  print('\nThe catalogue is already there');
  reset(); CONFIG.papers = CATALOGUE.slice(); _siteDataReady = Promise.resolve();
  await initStep3();
  is('all three ranges offered   ', initCalls[0], ['signature','luxury','kinder']);
  is('the step is remembered     ', _step3Ready, true);

  print('\nThe catalogue is still in flight — the design studio case');
  reset(); _siteDataReady = siteDataAfter(6);
  await initStep3();
  is('it waited, three ranges    ', initCalls[0], ['signature','luxury','kinder']);
  is('and Luxury is buyable      ', initCalls[0].indexOf('luxury') > -1, true);
  is('and Eco is buyable         ', initCalls[0].indexOf('kinder') > -1, true);

  print('\nThe catalogue never arrives');
  reset(); _siteDataReady = Promise.resolve();
  await initStep3();
  is('nothing to offer           ', initCalls[0], []);
  is('so the step is NOT latched ', _step3Ready, false);

  print('\n...and the next look, once it has arrived, gets it right');
  CONFIG.papers = CATALOGUE.slice();
  await initStep3();
  is('built again                ', initCalls.length, 2);
  is('three ranges this time     ', initCalls[1], ['signature','luxury','kinder']);
  is('now it latches             ', _step3Ready, true);

  print('\nA site-data failure must not take the step down with it');
  reset(); _siteDataReady = Promise.reject(new Error('offline'));
  CONFIG.papers = CATALOGUE.slice();
  await initStep3();
  is('still drew the step        ', initCalls.length, 1);
  is('with what it had           ', initCalls[0], ['signature','luxury','kinder']);

  print('\nA product genuinely sold on one range still says so');
  reset(); CONFIG.papers = [{ name:'Foamex 5mm', tier:'signature' }]; _siteDataReady = Promise.resolve();
  await initStep3();
  is('one range, not three       ', initCalls[0], ['signature']);

  print('\nAn unknown stock falls back rather than vanishing');
  reset(); CONFIG.papers = [{ name:'Mystery', tier:null }]; _siteDataReady = Promise.resolve();
  await initStep3();
  is('filed as Signature         ', initCalls[0], ['signature']);


  print('\n' + pass + ' passed, ' + fail + ' failed\n');
})();

