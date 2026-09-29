// The ready-made colour bundles in step 3, and how they get along with the
// swatches underneath them.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-studio-palette.js
//
// pairIsOn / applyPair / paintPairs / wireChips are CUT OUT OF design-studio-ai-create.html
// at run time. A hand-copy would pass while the shipped page stripped a colour
// out of a bundle the customer could still see lit.

var SRC = readFile('design-studio-ai-create.html');

function grab(name){
  var i = SRC.indexOf('\n  function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name + ' in the page');
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

// ── the smallest page these functions can run against ──
// The click handler is the page's own wireChips, not a copy of it: an earlier
// version of this test wired the swatches itself and happily passed while the
// shipped page had stopped repainting the bundles entirely.
function El(v, text){
  this.dataset = { v: v };
  this.textContent = text || v;
  this._on = false;
  this._handlers = [];
  var self = this;
  this.classList = {
    toggle: function(c, want){ self._on = (want === undefined) ? !self._on : !!want; },
    add:    function(){ self._on = true; },
    remove: function(){ self._on = false; },
    contains: function(){ return self._on; }
  };
  this.addEventListener = function(type, fn){ if (type === 'click') self._handlers.push(fn); };
  this.click = function(){ self._handlers.forEach(function(f){ f(); }); };
}
function Group(group, values, single){
  this.dataset = { group: group };
  if (single) this.dataset.single = '1';
  this.children = values.map(function(v){ return new El(v); });
  var kids = this.children;
  this.querySelectorAll = function(){ return { forEach: function(f){ kids.forEach(f); } }; };
}
var PAIRS, SWATCHES, GROUPS, sel;
var document = {
  querySelector: function(q){
    return q.indexOf('"pair"') > -1 ? PAIRS : (q.indexOf('"colour"') > -1 ? SWATCHES : null);
  },
  querySelectorAll: function(q){
    if (q === '.ds-chips') return { forEach: function(f){ GROUPS.forEach(f); } };
    return { forEach: function(){} };
  },
  getElementById: function(){ return null; }
};
function logEvent(){}
function buildBrief(){}

eval(grab('pairNames'));
eval(grab('pairIsOn'));
eval(grab('paintSwatches'));
eval(grab('paintPairs'));
eval(grab('applyPair'));
eval(grab('wireChips'));

var PALETTE = ['sage green','cream','gold','blush','dusty blue','terracotta'];
var BUNDLES = ['sage green|cream', 'gold|cream', 'blush|gold', 'dusty blue|terracotta'];
function reset(){
  PAIRS = new Group('pair', BUNDLES);
  SWATCHES = new Group('colour', PALETTE);
  GROUPS = [PAIRS, SWATCHES];
  sel = { pair: [], colour: [] };
  wireChips();
}
function lit(){ return PAIRS.children.filter(function(e){ return e._on; }).map(function(e){ return e.dataset.v; }); }
function ticked(){ return SWATCHES.children.filter(function(e){ return e._on; }).map(function(e){ return e.dataset.v; }); }
function clickPair(i){ PAIRS.children[i].click(); }
function clickSwatch(i){ SWATCHES.children[i].click(); }

var pass = 0, fail = 0;
function is(label, got, want){
  var g = JSON.stringify(got), w = JSON.stringify(want), ok = g === w;
  ok ? pass++ : fail++;
  if (!ok) print('  FAIL ' + label + '\n        got  ' + g + '\n        want ' + w);
}

print('\nOne bundle');
reset(); clickPair(0);
is('its two colours are chosen ', sel.colour, ['sage green','cream']);
is('its swatches are ticked    ', ticked(), ['sage green','cream']);
is('it is the only one lit     ', lit(), ['sage green|cream']);

print('\nA second bundle adds to the first, it does not replace it');
clickPair(2);
is('four colours now           ', sel.colour, ['sage green','cream','blush','gold']);
is('three bundles lit          ', lit(), ['sage green|cream','gold|cream','blush|gold']);

print('  (gold & cream lights up on its own, because both of its colours are chosen)');

print('\nTurning one off keeps what another still needs');
reset(); clickPair(0); clickPair(1);          // sage+cream, then gold+cream
is('three colours              ', sel.colour, ['sage green','cream','gold']);
clickPair(1);                                  // drop gold & cream
is('cream survives for sage    ', sel.colour, ['sage green','cream']);
is('sage bundle still lit      ', lit(), ['sage green|cream']);

print('\nTurning off the last one that wants a colour does drop it');
reset(); clickPair(1); clickPair(1);
is('back to nothing            ', sel.colour, []);
is('nothing lit                ', lit(), []);
is('nothing ticked             ', ticked(), []);

print('\nA swatch picked by hand can complete a bundle');
reset(); clickSwatch(2); clickSwatch(1);       // gold, cream
is('two colours by hand        ', sel.colour, ['gold','cream']);
is('gold & cream lights itself ', lit(), ['gold|cream']);

print('\nA swatch dropped by hand unlights the bundle that needed it');
reset(); clickPair(0);
is('lit before                 ', lit(), ['sage green|cream']);
clickSwatch(1);                                // untick cream
is('cream gone                 ', sel.colour, ['sage green']);
is('bundle no longer lit       ', lit(), []);
is('sage still ticked          ', ticked(), ['sage green']);

print('\nBundles that share no colour are independent');
reset(); clickPair(0); clickPair(3);
is('all four colours           ', sel.colour, ['sage green','cream','dusty blue','terracotta']);
is('both lit                   ', lit(), ['sage green|cream','dusty blue|terracotta']);
clickPair(3);
is('dropping one leaves the other', sel.colour, ['sage green','cream']);
is('and it stays lit           ', lit(), ['sage green|cream']);

print('\nClicking the same bundle twice is a no-op, not a mess');
reset(); clickPair(2); clickPair(2);
is('nothing chosen             ', sel.colour, []);
reset(); clickPair(2); clickPair(2); clickPair(2);
is('odd number leaves it on    ', sel.colour, ['blush','gold']);

print('\nEvery colour still reaches the brief in the order it was chosen');
reset(); clickPair(0); clickSwatch(2);
is('order preserved            ', sel.colour, ['sage green','cream','gold']);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
