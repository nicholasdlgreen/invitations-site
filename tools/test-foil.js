// Foiling: the colours our printer actually runs, and the panel that has to
// hold them.
//
// PrintedEasy run eight foils. We offered three, and the finishing panel was
// capped at a fixed 460px — which at phone width hid seven of the nine options
// behind the cap where they could not be reached at all.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-foil.js

var SRC = readFile('step3/step3.js');

function grab(name) {
  var needle = '\n  function ' + name + '(';
  var i = SRC.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + name);
  i += 1;
  var j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++) {
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/') { k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"') {
      var q = c;
      for (k++; k < SRC.length; k++) { if (SRC[k] === '\\') { k++; continue; } if (SRC[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1);
}

eval(grab('matStyle'));

var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}

print('\nEVERY FOIL OUR PRINTER RUNS CAN BE DRAWN');
// Read off PrintedEasy's own colour list, 1 October 2026.
var FOILS = ['Gold','Silver','Copper','Rose Gold','Red','Blue','Holographic','Green'];
var seen = {};
FOILS.forEach(function (c) {
  var css = matStyle('Foiling', c);
  is(typeof css === 'string' && css.length > 40, true, c + ' has a swatch of its own');
  is(!!seen[css], false, c + ' does not come out looking like another foil');
  seen[css] = true;
});

print('\nHOLOGRAPHIC IS NOT A METAL');
// A single linear ramp reads as a flat pastel and lies about what arrives: the
// whole point of the foil is that it changes with the angle.
var holo = matStyle('Foiling', 'Holographic');
is(/conic-gradient/.test(holo), true, 'it is drawn as a sweep through the hues');
is(/linear-gradient\(145deg/.test(holo), false, 'not with the metal ramp the others use');
is(/linear-gradient\(145deg/.test(matStyle('Foiling', 'Gold')), true,
   'while gold still is a metal');

print('\nAN UNKNOWN FOIL STILL DRAWS');
// A colour added in admin that nobody has written a swatch for must not come
// out blank — gold is the sane default for a foil.
is(matStyle('Foiling', 'Champagne'), matStyle('Foiling', 'Gold'),
   'an unrecognised foil falls back to gold rather than to nothing');

print('\nTHE PANEL HOLDS WHAT IS PUT IN IT');
is(/function sizeOpenFinPanel\(\)/.test(SRC), true,
   'the open height is worked out, not written down');
is(/panel\.style\.maxHeight = \(rows\[i\]\.className\.indexOf\('open'\) >= 0 && inner\)/.test(SRC),
   true, 'measured from the content of whichever row is open');
is(/\(inner\.scrollHeight \+ 2\) \+ 'px' : ''/.test(SRC), true,
   'and cleared when it closes, so the row still animates shut');
is(/sizeOpenFinPanel\(\);\n    open\('s2', true\)/.test(SRC), true,
   'run every time the finishing section is drawn, because the number of '
   + 'options changes with the paper');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
