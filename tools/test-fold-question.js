// Where the fold question is asked, for every product.
//
// Flat-or-folded is asked once, at the size step, on all twenty-two.
//
// Which way it opens is NOT asked anywhere, and must not come back. It reads
// like a missing question and is really a duplicate one: the crease axis is
// derived from the orientation and from nothing else — buildPressFile does
// `acrossTheMiddle = selectedOrientation === 'landscape'` — so a portrait card
// creases down its side and a landscape one across its middle, always.
// Offering the choice separately puts an instruction in the order spec that
// contradicts the imposed PDF sent with it. It was offered, in the Finishing
// step, on five products, and briefly at the size step on all of them, until
// 30 September.
//
// The rules are cut out of the two shipped pages. The expectations are the
// per-product review, written down.

var STUDIO = readFile('design-studio-ai-create.html');
var ORDER  = readFile('upload-and-print.html');

function grab(SRC, needle){
  var i = SRC.indexOf('\n  ' + needle);
  if (i < 0) throw new Error('could not find ' + needle);
  i += 1;
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

var CONFIG_FOLDED, PRODUCT_HAS_FOLDED_ROUTE, FOLD_CHOICE;
eval(grab(STUDIO, 'function foldIsAChoice()'));
eval(grab(STUDIO, 'function foldedOnly()'));
eval(grab(STUDIO, 'function isFoldedNow()'));

// The one place the crease axis is decided.
var AXIS_FROM_ORIENTATION =
  /const acrossTheMiddle = selectedOrientation === 'landscape';/.test(ORDER);
var STUDIO_NO_OPEN_QUESTION = !/renderOpenChoice|OPEN_CHOICE/.test(STUDIO);
var ORDER_NO_OPEN_QUESTION  = !/renderOpenToggle|selectOpen|openOptionsFor/.test(ORDER);
var FINISHING_DROPS_FOLD    = /!== 'fold'\)/.test(ORDER);
var NO_FOLD_HANDOFF         = !/foldDirection/.test(STUDIO) && !/foldDirection/.test(ORDER);
var NOTHING_WRITES_FOLD     = !/selectedFinishes\.Fold *=/.test(ORDER);
var NO_TENT                 = !/TENT_PRODUCTS/.test(STUDIO) && !/TENT_PRODUCTS/.test(ORDER);

// choice  : the size step asks flat or folded
// always  : always folded, so it is stated rather than asked
// never   : not a folded thing at all
var PRODUCTS = [
  ['wedding-invitations','choice'], ['christmas-cards','choice'], ['birthday-invitations','choice'],
  ['party-invitations','choice'],   ['save-the-dates','choice'],  ['rsvp-cards','choice'],
  ['menu-cards','choice'],          ['place-cards','choice'],     ['table-numbers','choice'],
  ['moving-cards','choice'],        ['new-arrival-cards','choice'],['baby-shower-invitations','choice'],
  ['christening-invitations','choice'], ['engagement-party-invitations','choice'],
  ['greeting-cards','always'],      ['thank-you-cards','always'], ['graduation-cards','always'],
  ['engagement-cards','always'],
  ['order-of-service','never'],     ['signage','never'],          ['table-plans','never'],
  ['welcome-signs','never']
];

var pass = 0, fail = 0;
function is(label, got, want){
  var g = JSON.stringify(got), w = JSON.stringify(want), ok = g === w;
  ok ? pass++ : fail++;
  if (!ok) print('  FAIL ' + label + '\n        got  ' + g + '\n        want ' + w);
}
function setProduct(shape, choice){
  FOLD_CHOICE = choice || 'flat';
  CONFIG_FOLDED            = shape !== 'never';
  PRODUCT_HAS_FOLDED_ROUTE = shape === 'choice';
}

print('\nEvery product is one of three shapes, and the size step treats it that way');
is('the review covers all 22', PRODUCTS.length, 22);
PRODUCTS.forEach(function(p){
  var slug = p[0], shape = p[1];
  setProduct(shape);
  if (shape === 'choice'){
    is(slug + ': is asked flat or folded', foldIsAChoice(), true);
    is(slug + ': is not told instead    ', foldedOnly(), false);
    setProduct(shape, 'folded');
    is(slug + ': choosing folded takes  ', isFoldedNow(), true);
  } else if (shape === 'always'){
    is(slug + ': is told, not asked     ', foldedOnly(), true);
    is(slug + ': folded without choosing', isFoldedNow(), true);
  } else {
    is(slug + ': asked nothing          ', foldIsAChoice() || foldedOnly(), false);
    is(slug + ': never folded           ', isFoldedNow(), false);
  }
});

print('\nWhich way it opens is not asked, because the orientation already says');
is('the crease axis comes from orientation', AXIS_FROM_ORIENTATION, true);
is('the studio does not ask             ', STUDIO_NO_OPEN_QUESTION, true);
is('the order page does not ask         ', ORDER_NO_OPEN_QUESTION, true);
is('the finishing step does not ask     ', FINISHING_DROPS_FOLD, true);
is('nothing hands a direction across    ', NO_FOLD_HANDOFF, true);
is('nothing writes a Fold instruction   ', NOTHING_WRITES_FOLD, true);
is('no tent fold is offered             ', NO_TENT, true);

print('\nAnd the page says what the orientation is quietly deciding');
var LINE = 'A portrait card opens like a book; a landscape card opens upwards.';
is('the studio says it            ', STUDIO.indexOf(LINE) > -1, true);
is('the order page says it        ', ORDER.indexOf(LINE) > -1, true);
is('only on a folded card, studio ', /if \(!isFoldedNow\(\) \|\| !canChoose\)/.test(STUDIO), true);
is('only on a folded card, order  ', /isFoldedPiece\(\)\s*\?\s*' A portrait card opens/.test(ORDER), true);
// A square has no other way up, so the toggle hides itself and a line about
// portrait and landscape underneath it would explain a choice that is not
// there. The note reads the toggle rather than re-deriving the rule.
is('tied to the toggle it explains', /var canChoose = !!\(turn && turn\.offsetParent !== null\);/.test(STUDIO), true);

// The size tiles are rebuilt from the database, which throws away the click
// handler wired at load and replaces it. Patching only the one in the markup
// left the note stuck on for a square — every handler that redraws the turn
// toggle has to redraw the note with it.
var turnCalls = (STUDIO.match(/renderTurnToggle\(\);[^\n]*/g) || [])
  .filter(function(l){ return /paintSizeCards|applySize/.test(l); });
is('every size handler redraws the note', turnCalls.length > 0
   && turnCalls.every(function(l){ return l.indexOf('renderShapeNote()') > -1; }), true);
is('...and there is more than one of them', turnCalls.length >= 3, true);

print('\nThe two questions that remain are a labelled pair, not two loose rows');
is('flat or folded is labelled ', /<div class="ds-fold-q">Flat or folded\?<\/div>/.test(STUDIO), true);
is('which way up is labelled   ', /<div class="ds-fold-q">Which way up\?<\/div>/.test(STUDIO), true);
is('they share one row         ', /<div class="ds-shape">/.test(STUDIO), true);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
