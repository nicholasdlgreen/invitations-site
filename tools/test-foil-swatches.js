// The foil colours on the landing pages must match the ones at the order step.
//
// They did not. finishing/section.js, which draws the swatches on 24 product
// landing pages, knew gold, silver and rose and nothing else — so Copper, Red,
// Blue, Green and Holographic ALL drew as gold. Five of the eight colours we
// sell, wrong, on every page that offers foiling. step3/step3.js had had the
// right eight since 1 October; the landing pages were never brought with it.
//
// The two files are loaded by different pages and the colours are duplicated
// rather than shared. This is what keeps the duplicate honest: if either set
// changes and the other does not, this fails.

var SEC  = read('finishing/section.js');
var STEP = read('step3/step3.js');

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '\n         got  ' + got + '\n         want ' + want));
}

// Pull every metal(...) argument set out of a file, in order.
function metals(src, from, to){
  var slice = src.slice(src.indexOf(from), to ? src.indexOf(to, src.indexOf(from)) : undefined);
  var out = [], m, re = /metal\('(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})'\)/g;
  while ((m = re.exec(slice))) out.push(m[1] + ' ' + m[2] + ' ' + m[3] + ' ' + m[4]);
  return out;
}
// and the colour each NAME maps to, so a reordering is caught too
function mapping(src, from, to){
  var slice = src.slice(src.indexOf(from), to ? src.indexOf(to, src.indexOf(from)) : undefined);
  var out = {}, m;
  var re = /if \(\/(\w+)\/\.test\(o\)\)\s*return metal\('(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})'\)/g;
  while ((m = re.exec(slice))) out[m[1]] = m[2] + ' ' + m[3] + ' ' + m[4] + ' ' + m[5];
  return out;
}

var secMap  = mapping(SEC,  'function foilOf(name)');
var stepMap = mapping(STEP, "if (/foil/i.test(type))", 'if (/spot/i.test(type))');

print('\nTHE SAME SEVEN NAMED METALS, THE SAME COLOURS');
var NAMES = ['rose','silver','copper','red','blue','green'];
NAMES.forEach(function(n){
  is(n + ' matches the order step', secMap[n], stepMap[n]);
});
is('every named colour is present on the landing pages',
   NAMES.filter(function(n){ return !secMap[n]; }).length, 0);

print('\nHOLOGRAPHIC IS THE SAME HUE SWEEP, NOT A FLAT RAMP');
function holo(src){
  var m = src.match(/conic-gradient\(from 210deg,([^)]*)\)/);
  return m ? m[1] : 'missing';
}
is('the landing pages have a conic sweep', holo(SEC) !== 'missing', true);
is('and it is the order step\'s sweep',    holo(SEC), holo(STEP));

print('\nTHE GOLD FALLBACK IS THE SAME GOLD');
function fallback(src, from, to){
  var all = metals(src, from, to);
  return all[all.length - 1];           // the unguarded return at the end
}
is('gold matches', fallback(SEC, 'function foilOf(name)'),
                   fallback(STEP, "if (/foil/i.test(type))", 'if (/spot/i.test(type))'));

print('\nEIGHT COLOURS, NOT THREE');
// six named + holographic + the gold fallback
is('the landing pages draw eight distinct foils',
   Object.keys(secMap).length + 1 /* holo */ + 1 /* gold fallback */, 8);
is('the old three-colour table is gone', /var FOIL = \{/.test(SEC), false);
is('and so is the old sheen()',          /function sheen\(/.test(SEC), false);

print('\nTHE ROW IS FOUR ACROSS, AND ONLY THE FOIL ROW');
var CSS = read('finishing/section.css');
is('the foil row is four columns', /\.fs-row\.is-foil\{grid-template-columns:repeat\(4,1fr\);max-width:540px\}/.test(CSS), true);
is('the base row rule is still there for the grid',
   /\.fs-row\{display:grid;grid-template-columns:repeat\(3,1fr\)/.test(CSS), true);
// everything that is not foil is a line now, not a cell in that grid
is('non-foil finishes are lines, not grid cells', /\.fs-ln\{display:flex/.test(CSS), true);
is('and the old grid-cell styles are gone',       /\.fs-t\{text-align:left/.test(CSS), false);
// The grid is now built in the foil branch only, so the class is unconditional
// there and cannot appear anywhere else. Checked by making sure the markup is
// written once, inside the foil map, and that nothing else emits fs-row.
is('the foil grid is written once',
   (SEC.match(/class="fs-row is-foil"/g) || []).length, 1);
is('nothing else emits an fs-row',
   (SEC.match(/class="fs-row/g) || []).length, 1);
is('non-foil finishes render as lines', /class="fs-ln"/.test(SEC), true);
is('and the old grid-cell markup is gone', /class="fs-t"/.test(SEC), false);
is('it steps down rather than shrinking on small screens',
   /max-width:600px\)\{\.fs-row\.is-foil\{grid-template-columns:repeat\(3,1fr\)/.test(CSS), true);

print('\nTHE STYLE ATTRIBUTE IS NOT DOUBLED UP');
// foilOf returns a full "background:..." declaration now, so the markup must
// not prepend another one — that would produce style="background:background:..."
is('markup uses the declaration as-is', /style="' \+ foilOf\(o\.name\) \+ '"/.test(SEC), true);
is('and does not prepend background:',  /style="background:' \+ foilOf/.test(SEC), false);
is('foilOf returns a declaration',      /return 'background:'/.test(SEC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
