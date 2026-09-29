// Where the fold question is asked, for every product.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-fold-question.js
//
// It used to be asked in two places and in neither. Flat-or-folded was in the
// studio's step 1 for fourteen products; which-way-it-opens was in the order
// page's Finishing step for five; Christmas cards asked both, two steps apart,
// and thirteen products sold a folded card without ever asking which way it
// opened. This pins the answer for all twenty-two.
//
// The rules are cut out of the two shipped pages. The expectations below are
// the review, written down.

var STUDIO = readFile('design-studio-ai-create.html');
var ORDER  = readFile('upload-and-print.html');

function grab(SRC, needle, indent){
  var i = SRC.indexOf('\n' + (indent || '  ') + needle);
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

// ── the studio's rules ───────────────────────────────────────────────────────
var CONFIG_FOLDED, PRODUCT_HAS_FOLDED_ROUTE, FOLD_CHOICE, PRODUCT_SLUG;
eval(grab(STUDIO, 'function foldIsAChoice()'));
eval(grab(STUDIO, 'function foldedOnly()'));
eval(grab(STUDIO, 'function isFoldedNow()'));
eval(grab(STUDIO, 'function openOptions()'));
var TENT_PRODUCTS = JSON.parse(
  (STUDIO.match(/var TENT_PRODUCTS = (\[[^\]]*\]);/) || [])[1].replace(/'/g, '"'));

// ── the order page's rules ───────────────────────────────────────────────────
// Which finish types survive to the Finishing step. Everything except the
// fold filter is stubbed, because this is only asking whether Fold is offered.
var ORDER_DROPS_FOLD = /\.filter\(t => \(t\.name\|\|''\)\.toLowerCase\(\)\.trim\(\) !== 'fold'\)/
  .test(ORDER.replace(/\s+/g, ' ').replace(/ \|\| /g, '||').replace(/\(t\) =>/g, 't =>'));
var ORDER_TENT = JSON.parse(
  (ORDER.match(/const TENT_PRODUCTS = (\[[^\]]*\]);/) || [])[1].replace(/'/g, '"'));
var ORDER_CARRIES_STUDIO = /if \(saved\.foldDirection\) selectedFinishes\.Fold = saved\.foldDirection;/
  .test(ORDER);
var ORDER_KEEPS_FOLD_THROUGH_PRUNE = /if \(k\.toLowerCase\(\)\.trim\(\) === 'fold'\) return;/.test(ORDER);

// ── the review, as data ──────────────────────────────────────────────────────
// choice  : the studio asks flat or folded
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
function setProduct(slug, shape, choice){
  PRODUCT_SLUG = slug;
  FOLD_CHOICE = choice || 'flat';
  CONFIG_FOLDED            = shape !== 'never';
  PRODUCT_HAS_FOLDED_ROUTE = shape === 'choice';
}

print('\nEvery product is one of three shapes, and the studio treats it that way');
is('the review covers all 22', PRODUCTS.length, 22);
PRODUCTS.forEach(function(p){
  var slug = p[0], shape = p[1];
  setProduct(slug, shape);
  if (shape === 'choice'){
    is(slug + ': is asked flat or folded', foldIsAChoice(), true);
    is(slug + ': is not told instead    ', foldedOnly(), false);
  } else if (shape === 'always'){
    is(slug + ': is told, not asked     ', foldedOnly(), true);
    is(slug + ': folded without choosing', isFoldedNow(), true);
  } else {
    is(slug + ': asked nothing          ', foldIsAChoice() || foldedOnly(), false);
    is(slug + ': never folded           ', isFoldedNow(), false);
  }
});

print('\nWhich way it opens is asked exactly when the card is folded');
PRODUCTS.forEach(function(p){
  var slug = p[0], shape = p[1];
  setProduct(slug, shape, 'flat');
  is(slug + ': flat → not asked        ', isFoldedNow(), shape === 'always');
  if (shape === 'choice'){
    setProduct(slug, shape, 'folded');
    is(slug + ': folded → asked          ', isFoldedNow(), true);
  }
});

print('\nThe opens-question draws itself only on a folded card');
// The real render, against the smallest DOM it will run on — a regex on the
// source would have passed while the guard inside it was deleted.
var BOXES = {};
function El(){
  var self = this;
  this.style = {}; this.innerHTML = ''; this._h = [];
  this.querySelectorAll = function(){ return { forEach: function(f){ self._btns().forEach(f); } }; };
  this._btns = function(){
    return (self.innerHTML.match(/data-open="[^"]*"/g) || []).map(function(m){
      return { dataset: { open: m.slice(11, -1) }, addEventListener: function(){} };
    });
  };
}
var document = { getElementById: function(id){ return BOXES[id] || (BOXES[id] = new El()); } };
eval(grab(STUDIO, 'function renderOpenChoice()'));
var OPEN_CHOICE;

function drawFor(shape, choice){
  BOXES = {}; OPEN_CHOICE = 'Long edge';
  setProduct('christmas-cards', shape, choice);
  renderOpenChoice();
  var box = BOXES['ds-open'] || new El();
  return { shown: box.style.display !== 'none' && box.style.display !== undefined,
           opts: ((BOXES['ds-open-pills'] || new El()).innerHTML.match(/data-open="([^"]*)"/g) || [])
                   .map(function(m){ return m.slice(11, -1); }) };
}
var flat = drawFor('choice', 'flat');
is('a flat card is not asked  ', flat.shown, false);
is('and nothing is drawn      ', flat.opts, []);
var folded = drawFor('choice', 'folded');
is('a folded card is asked    ', folded.shown, true);
is('with both ways to open    ', folded.opts, ['Long edge', 'Short edge']);
var always = drawFor('always', 'flat');
is('an always-folded card too ', always.shown, true);
var never = drawFor('never', 'flat');
is('a board is never asked    ', never.shown, false);
BOXES = {}; OPEN_CHOICE = 'Long edge';
setProduct('place-cards', 'choice', 'folded'); renderOpenChoice();
is('a place card can stand up ',
   ((BOXES['ds-open-pills'].innerHTML.match(/data-open="([^"]*)"/g) || [])
      .map(function(m){ return m.slice(11, -1); })), ['Long edge', 'Short edge', 'Tent']);
// An answer that no longer exists must not survive the product changing.
BOXES = {}; OPEN_CHOICE = 'Tent';
setProduct('wedding-invitations', 'choice', 'folded'); renderOpenChoice();
is('a tent answer is dropped where there is no tent', OPEN_CHOICE, 'Long edge');

print('\nA tent fold only where a card stands on a table');
PRODUCTS.forEach(function(p){
  setProduct(p[0], p[1], 'folded');
  var names = openOptions().map(function(o){ return o[0]; });
  var wantTent = p[0] === 'place-cards' || p[0] === 'table-numbers';
  is(p[0] + ': tent offered = ' + wantTent, names.indexOf('Tent') > -1, wantTent);
  is(p[0] + ': book and top always     ',
     names.indexOf('Long edge') > -1 && names.indexOf('Short edge') > -1, true);
});
is('the two pages agree on where a tent belongs', TENT_PRODUCTS.slice().sort(), ORDER_TENT.slice().sort());

print('\nAnd it is asked in one place only');
is('the finishing step drops Fold        ', ORDER_DROPS_FOLD, true);
is('the studio hands its answer across   ', ORDER_CARRIES_STUDIO, true);
is('the paper prune cannot eat the fold  ', ORDER_KEEPS_FOLD_THROUGH_PRUNE, true);
is('the studio sends foldDirection       ', /foldDirection: isFoldedNow\(\) \? OPEN_CHOICE : null/.test(STUDIO), true);
is('...on every handoff it makes         ', (STUDIO.match(/foldDirection:/g) || []).length, 3);

print('\nThe two questions are a labelled pair, not two loose rows');
is('flat or folded is labelled ', /<div class="ds-fold-q">Flat or folded\?<\/div>/.test(STUDIO), true);
is('which way up is labelled   ', /<div class="ds-fold-q">Which way up\?<\/div>/.test(STUDIO), true);
is('they share one row         ', /<div class="ds-shape">/.test(STUDIO), true);
is('the opens question is its own row', /id="ds-open"/.test(STUDIO), true);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
