// Preparing the artwork while the customer chooses their paper.
//
// Add to basket was measured on 1 October at 1.3s for a small flat card and
// 8.7s for a folded double-sided one — 12.8MB going UP the customer's own
// connection on a click that should answer at once. None of it can be made
// faster. All of it can happen earlier, because nothing it depends on can
// change after the customer leaves the file check.
//
// The guarantee these tests exist to hold: prepared work is used ONLY if a
// fingerprint of everything it was built from still matches. The worst case is
// the old behaviour, and a stale file can never be sent.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-artwork-prepare.js
//
// Everything under test is CUT OUT of upload-and-print.html at run time.

var HTML = readFile('upload-and-print.html');

function grab(name, kind) {
  var needle = '\n' + (kind || 'function ') + name + (kind ? ' = ' : '(');
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
  return HTML.slice(i, k + 1) + (kind ? ';' : '');
}

// ── the page, as far as these functions can see it ────────────────────────
var currentFile = null, designMode = false;
var selectedSize = 'A5', selectedFold = 'flat', selectedOrientation = 'portrait',
    selectedSides = 'single';
var sideFiles = {}, faceAdjust = {}, artworkAdjust = { mode:'fill', zoom:1, dx:0, dy:0 };
var activeFace = 'front';
var SIDES = 1;
function sidesNeeded(){ return SIDES === 1 ? [{key:'front'}] : [{key:'front'},{key:'back'},{key:'inside'}]; }
function file(name, size){ return { name:name, size:size, lastModified:1, type:'image/jpeg' }; }

eval(grab('_fileId'));
eval(grab('artworkFingerprint'));

// ── assertions ────────────────────────────────────────────────────────────
var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}
function changes(fn, what) {
  var before = artworkFingerprint();
  fn();
  var after = artworkFingerprint();
  is(before !== after, true, what);
}
function holds(fn, what) {
  var before = artworkFingerprint();
  fn();
  is(artworkFingerprint(), before, what);
}

print('\nWHAT INVALIDATES PREPARED WORK');
currentFile = file('invite.jpg', 7340032);
changes(function(){ currentFile = file('other.jpg', 7340032); }, 'a different file');
changes(function(){ currentFile = file('other.jpg', 900); }, 'the same name at a different size — a re-export');
changes(function(){ selectedSize = 'A6'; },        'going back and choosing another size');
changes(function(){ selectedFold = 'folded'; },    'switching flat to folded');
changes(function(){ selectedOrientation = 'landscape'; }, 'turning it landscape');
changes(function(){ selectedSides = 'double'; },   'printing both sides');
changes(function(){ artworkAdjust = { mode:'fit', zoom:1.4, dx:12, dy:-3 }; },
        'nudging or zooming the artwork in the frame');
changes(function(){ sideFiles = { front:{ file:file('f.jpg',10), page:1 } }; },
        'a file dropped into a face slot');
changes(function(){ sideFiles.front.spread = true; },
        'and the same file read as a spread across the crease instead');

print('\nWHAT DOES NOT');
holds(function(){ /* nothing at all */ }, 'asking twice gives the same answer');
holds(function(){ designMode = true; designMode = false; }, 'a value that takes no part in it');

print('\nTHE BUG THIS FOUND');
// buildPressFileForAllFaces writes the position on screen into faceAdjust
// before imposing anything. So the BUILD changed the fingerprint as a side
// effect of running: the first prepare always looked stale, the work was
// thrown away and done again, and the measured saving was zero.
SIDES = 3;
sideFiles = { front:{file:file('f.jpg',10),page:1}, back:{file:file('b.jpg',10),page:1},
              inside:{file:file('i.jpg',10),page:1} };
faceAdjust = {};
artworkAdjust = { mode:'fill', zoom:1, dx:0, dy:0 };
activeFace = 'front';
var beforeBuild = artworkFingerprint();
faceAdjust[activeFace] = Object.assign({}, artworkAdjust);   // what the builder does, first thing
is(artworkFingerprint(), beforeBuild,
   'the press builder syncing the face on screen does NOT invalidate the work '
   + 'it just did');
// But a real move by the customer still must.
artworkAdjust = { mode:'fill', zoom:2.2, dx:40, dy:0 };
is(artworkFingerprint() !== beforeBuild, true,
   'while an actual nudge by the customer still does');
SIDES = 1;

print('\nWHAT THE PAGE WIRES UP');
is(/prepareArtworkInBackground\(\);\n  goStep\(3\);/.test(HTML), true,
   'the prepare runs where the customer presses on to the paper, after every '
   + 'early return — an unticked acknowledgement or a missing face is not '
   + 'someone saying they are happy with their artwork');
is(/if \(designMode \|\| !currentFile\) return;/.test(HTML), true,
   'never for the design studio, which reaches step 3 its own way and uploads '
   + 'its own SVG');
is(/if \(_preparedArtwork && _preparedArtwork\.fp === fp\) return;/.test(HTML), true,
   'and never twice for the same job — going back and forth does not re-send it');
is(/_preparedArtwork = \{ fp: fp, job: job \};/.test(HTML), true,
   'what is kept is the JOB, not the result: Add to basket may be pressed '
   + 'while it is still in flight and must wait on the same one rather than '
   + 'starting a second');
is(/if \(_preparedArtwork && _preparedArtwork\.fp === artworkFingerprint\(\)\)/.test(HTML), true,
   'and the basket checks the fingerprint before trusting any of it');
is(/if \(r && r\.artworkUrl\) return r;/.test(HTML), true,
   'a prepare that came back with nothing is a failed upload, not a finished '
   + 'one, so it is done again rather than ordering with no artwork');
is(/return _doPrepareArtwork\(\);/.test(HTML), true,
   'and with nothing usable prepared, the work happens at Add to basket '
   + 'exactly as it always did');

print('\nONE IMPLEMENTATION, NOT TWO');
// The two-maps bug of 30 September came from the same work existing twice.
is((HTML.match(/body: currentFile }\)/g) || []).length, 1,
   'the original is uploaded in one place');
is((HTML.match(/body: built\.blob }\)/g) || []).length, 1,
   'and the press file in one place');
is(/async function _doPrepareArtwork\(\)\{?/.test(HTML)
   || /async function _doPrepareArtwork\(\)/.test(HTML), true,
   'both paths call the same pair');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
