// The tweak page shows the customer's wording where the customer put it.
// Run:  jsc tools/test-tweak-wording.js
//
// The tweak page used to match state.wording against a hardcoded
// [host, line, names, date, time, venue, reception, dress, rsvp, custom].
// That is the create page's FALLBACK order, not the order studio_fields
// returns. Checked against the live table on 6 October 2026: wedding
// invitations begin names, host, line — so the couple's names rendered in the
// small grey italic host line and "request the pleasure of your company"
// rendered as the 32px headline. A birthday begins celebrant, age; a place
// card names, table, meal. Order of service has fifteen front fields against
// this page's ten slots, so five were dropped entirely.
//
// Nobody noticed because the hardcoded list here and the fallback there agreed
// with each other, and only disagreed with the database.
//
// The create page now sends the lines it actually rendered — style and value,
// in card order — and this page builds from those. It never maps by position
// again, which is the whole point: a test that pinned the right ORDER would
// go stale the moment a product's fields changed in admin.

function read(f){ return readFile(f); }
var CREATE = read('design-studio-ai-create.html');
var TWEAK  = read('design-studio-tweak.html');

var passed = 0, failed = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  if (ok) passed++; else failed++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

print('\nTHE CREATE PAGE SENDS WHAT IT RENDERED');
is('captureDesign includes a lines array', /lines:\s*FIELD_MAP\.map/.test(CREATE), true);
is('each line carries its style', /style:\s*style/.test(CREATE), true);
is('each line carries its value', /value:\s*inp\s*\?\s*inp\.value/.test(CREATE), true);
is('and its key, for debugging', /key:\s*p\[0\]\.replace/.test(CREATE), true);
is('the style is read off the rendered preview line',
   /ln\.className\.replace\(/.test(CREATE), true);
is('wording is still sent, so an open tab mid-flow still works',
   /wording:\s*FIELD_MAP\.map/.test(CREATE), true);

print('\nTHE TWEAK PAGE BUILDS FROM THEM, NOT FROM A GUESS');
is('it checks for the lines array', /Array\.isArray\(state\.lines\)/.test(TWEAK), true);
is('it builds the stack itself', /stackEl\.innerHTML\s*=\s*''/.test(TWEAK), true);
is('using the style it was given', /'tln '\s*\+\s*\(l\.style/.test(TWEAK), true);
is('and skips empty boxes', /if\s*\(!val\)\s*return;/.test(TWEAK), true);

print('\nTHE OLD POSITIONAL MAPPING SURVIVES ONLY AS A FALLBACK');
// A tab opened before this change still has a state without `lines`.
var hard = TWEAK.indexOf("var order = ['host','line','names'");
is('the hardcoded order still exists', hard > -1, true);
var guard = TWEAK.indexOf('Array.isArray(state.lines)');
is('but it sits AFTER the lines check, in the else branch', hard > guard, true);
is('and is labelled as a fallback', /captured before this change/.test(TWEAK), true);

print('\nEVERY STYLE THE CREATE PAGE CAN EMIT HAS A RULE HERE');
// Ten in studio_fields on 6 Oct, plus the create page's 'body' default.
['host','request','names','date','time','venue','reception','dress','rsvp','custom','body']
  .forEach(function(s){ is('  .tln.' + s, TWEAK.indexOf('.tln.' + s + '{') > -1, true); });

print('\nTHE PAGE NO LONGER CARES HOW MANY FIELDS A PRODUCT HAS');
// Order of service has 15 front fields; the markup had 10 .tln divs.
is('it does not iterate a fixed list of slots when lines are present',
   /querySelectorAll\('#tw-stack \.tln'\)\.forEach[\s\S]{0,200}Array\.isArray/.test(TWEAK), false);
is('it appends one element per supplied line', /stackEl\.appendChild\(el\)/.test(TWEAK), true);

print('\nMUTATION: GOING BACK TO POSITIONAL MAPPING MUST FAIL');
is('a page without the lines check is caught',
   /Array\.isArray\(state\.lines\)/.test("var order=['host','line'];"), false);
is('a create page not sending lines is caught',
   /lines:\s*FIELD_MAP\.map/.test('wording: FIELD_MAP.map(function(p){})'), false);

print('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) throw new Error(failed + ' failed');
