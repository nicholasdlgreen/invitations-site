// The shape of a card stops being a question once a design is in hand.
//
// A design made in the studio is drawn at one size, one way up, flat or folded.
// The press file, the artwork and the foil layer are all built to that shape.
// Turning the card afterwards does not turn the design — it leaves a portrait
// A6 design on a landscape A6 order.
//
// Found 3 October while chasing a foil error Nicholas hit twice on live work.
// The foil layer's size check was the ONLY thing that noticed, so a customer
// who did not choose foiling could have ordered a card their design does not
// fit, and nothing would have said a word.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function fn(name){
  var a = SRC.indexOf('function ' + name + '(');
  if (a < 0) return '';
  var b = SRC.indexOf('\n}', a);
  return b < 0 ? SRC.slice(a) : SRC.slice(a, b);
}

print('\nTHERE IS ONE PLACE THAT DECIDES');
is('shapeIsLockedByDesign exists', /function shapeIsLockedByDesign\(\)/.test(SRC), true);
var lock = fn('shapeIsLockedByDesign');
is('it needs a design to be in play', /designMode && designState/.test(lock), true);
is('it recognises a studio design',   /source === 'ai-studio'/.test(lock), true);
// the old customise route hands over an SVG built at checkout, not a press file
// drawn at a fixed shape, so it is matched on carrying artwork instead
is('and an AI design without the newer marker', /artworkUrl && !designState\.thumbnailSvg/.test(lock), true);

print('\nEVERY HANDLER REFUSES, NOT JUST THE BUTTONS');
// Hiding a button is not locking anything: a stale button, a keyboard, or an
// old cached page would still get through to the handler.
['selectOrientation', 'selectSides', 'selectFold'].forEach(function(name){
  is(name + ' refuses while locked', /if \(shapeIsLockedByDesign\(\)\) return;/.test(fn(name)), true);
});
is('selectSize refuses a DIFFERENT size while locked',
   /if \(shapeIsLockedByDesign\(\) && id !== selectedSize\) return;/.test(fn('selectSize')), true);
// re-selecting the size it already is must stay harmless, or the first paint
// of a design that sets its own size would be refused by its own guard
is('and still allows the size it already is',
   /id !== selectedSize/.test(fn('selectSize')), true);

print('\nNOTHING IS OFFERED THAT CANNOT BE DELIVERED');
is('only the chosen fold is drawn',
   /shapeIsLockedByDesign\(\) \? folds\.filter\(f => f === selectedFold\) : folds/.test(SRC), true);
is('only the chosen sides are drawn',
   /shapeIsLockedByDesign\(\) \? sides\.filter\(x => x === selectedSides\) : sides/.test(SRC), true);
is('only the chosen orientation is drawn',
   /shapeIsLockedByDesign\(\) \? \[selectedOrientation\] : \['portrait','landscape'\]/.test(SRC), true);
is('only the designed size tile is drawn',
   /shapeIsLockedByDesign\(\) && selectedSize && keys\.includes\(selectedSize\)[\s\S]{0,80}keys = \[selectedSize\]/.test(SRC), true);

print('\nTHE CUSTOMER IS TOLD WHY, ONCE');
is('there is a note', /function designShapeNoteHtml\(\)/.test(SRC), true);
var note = fn('designShapeNoteHtml');
is('it says nothing when nothing is locked', /if \(!shapeIsLockedByDesign\(\)\) return '';/.test(note), true);
is('it names the shape they designed at', /Your design was made as a/.test(note), true);
is('it offers the way to a different shape', /design-studio/.test(note), true);
// renderSizeCards runs on every fold, size and orientation change
is('a previous note is cleared before another is added',
   /querySelectorAll\('\.designShapeNote'\)[\s\S]{0,160}\.remove\(\)/.test(SRC), true);

print('\nTHE UPLOAD ROUTE IS NOT TOUCHED');
// Every lock is a conditional on shapeIsLockedByDesign, never an unconditional
// change, so a customer with no design keeps every choice they had.
var guards = (SRC.match(/shapeIsLockedByDesign\(\)/g) || []).length;
is('the lock is asked about, not assumed', guards >= 8, true);
is('no size filter without the condition',
   /keys = \[selectedSize\];/.test(SRC) && /shapeIsLockedByDesign\(\) && selectedSize/.test(SRC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
