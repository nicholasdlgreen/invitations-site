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

print('\nWHAT WE ACCEPT AS A FOIL LAYER');
// foilChecks lives on the page, not in the component. It is cut out of the
// shipped file so a copy cannot drift from it.
var HTML = readFile('upload-and-print.html');
function grabHost(name) {
  var needle = '\nfunction ' + name + '(';
  var i = HTML.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + name);
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
var foilLayer = null;
eval(grabHost('foilChecks'));
eval(grabHost('foilLayerAccepted'));

var A5 = { w: 154, h: 216 };           // A5 plus 3mm bleed all round
function layer(over) {
  var r = { ok:true, pageMm:{w:154,h:216}, want:A5, dark:0.027, offColour:0, box:{}, pages:1 };
  for (var k in (over||{})) r[k] = over[k];
  return { file:{name:'foil.pdf'}, report:r };
}
function statuses(){ return foilChecks().map(function(c){ return c.status + ':' + c.label; }); }

foilLayer = layer();
is(statuses(), ['ok:Size','ok:Colour','ok:What to foil'], 'a proper foil layer passes on all three');
is(foilLayerAccepted(), true, 'and is accepted');

foilLayer = layer({ pageMm:{w:148,h:210} });
is(statuses()[0], 'err:Size', 'trim size without the bleed is refused \u2014 it would not line up');
is(foilLayerAccepted(), false, 'and the order cannot go on it');

foilLayer = layer({ pageMm:{w:154.6,h:215.5} });
is(statuses()[0], 'ok:Size', 'half a millimetre out is still the same page, not a fault');

foilLayer = layer({ offColour:0.5, dark:0 });
is(foilLayerAccepted(), false, 'a colour copy of their artwork is refused');
is(statuses()[1], 'err:Colour', 'and says it is the colour that is wrong');

foilLayer = layer({ offColour:0.004 });
is(statuses()[1], 'ok:Colour',
   'a trace of colour is the anti-aliasing round the edge of lettering, not a fault');

foilLayer = layer({ dark:0 });
is(statuses()[2], 'err:What to foil', 'a blank page has nothing to foil');
is(foilLayerAccepted(), false, 'and is refused');

foilLayer = layer({ pages:3 });
is(statuses().pop(), 'warn:Pages', 'more than one page is a warning, not a refusal');
is(foilLayerAccepted(), true, 'because the first page is the one we use');

foilLayer = layer({ notPdf:true });
is(statuses(), ['err:File type'], 'anything but a PDF is refused outright');
foilLayer = layer({ ok:false });
is(statuses(), ['err:Foil layer'], 'and so is a PDF we cannot open');

foilLayer = null;
is(foilLayerAccepted(), false, 'with nothing uploaded, nothing is accepted');

print('\nWHERE THE BLOCK APPEARS');
is(/if \(!\/foil\/i\.test\(typeName\)\) return '';/.test(HTML), true,
   'only on the foiling row');
is(/if \(!chosen \|\| String\(chosen\)\.toLowerCase\(\) === 'none'\) return '';/.test(HTML), true,
   'and only once a colour has been chosen, so nobody who does not want foil '
   + 'is asked for a second file');
is(/foilBlock: foilBlock,/.test(HTML), true, 'handed to step 3 through the adapter');
is(/A\.foilBlock && A\.foilBlock\(t\.name, sel\)/.test(SRC), true,
   'which draws whatever comes back and knows nothing about uploads');
// The same line exists in rasterisePdfPage, so matching it anywhere in the
// file proved nothing: the first version of this assertion passed with the
// line deleted from the function under test. It is pinned to its own comment.
is(/untouched pixel reads as black and the whole card looks foiled\.\n    ctx\.fillStyle = '#ffffff'; ctx\.fillRect\(0, 0, cv\.width, cv\.height\);/.test(HTML),
   true, 'the foil layer is whited before rendering: a PDF is transparent where '
   + 'nothing is drawn, and every untouched pixel would otherwise read as black');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
