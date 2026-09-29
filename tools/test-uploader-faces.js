// The folded-card uploader: which slots a job has, which panels the press gets,
// and what one dropped file is read as.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-uploader-faces.js
//
// Everything under test is CUT OUT OF upload-and-print.html at run time. A copy
// would pass while the shipped page was broken.

var SRC = readFile('upload-and-print.html');

function grab(name, kind){
  var needle = '\n' + (kind || 'function ') + name + (kind ? ' = ' : '(');
  var i = SRC.indexOf(needle);
  if (i < 0) throw new Error('could not find ' + name);
  i += 1;
  var j = SRC.indexOf(kind ? '{' : '{', i), depth = 0, k = j;
  for (; k < SRC.length; k++){
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/'){ k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`'){
      var q = c;
      for (k++; k < SRC.length; k++){ if (SRC[k] === '\\'){ k++; continue; } if (SRC[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1) + (kind ? ';' : '');
}

// ── stubs ─────────────────────────────────────────────────
var selectedSides = 'single', selectedFold = 'flat', selectedOrientation = 'portrait';
var FOLDED = false;
function isFoldedPiece(){ return FOLDED; }
var SPEC = { mmW: 148, mmH: 210 };
function sizeSpec(){ return SPEC; }
var sideFiles = {};

eval([ grab('SIDE_SETS', 'const '), grab('PANEL_SETS', 'const '),
       grab('jobKey'), grab('sidesNeeded'), grab('panelsNeeded'),
       grab('panelSource'), grab('mapPagesToSlots') ].join('\n'));

// ── assertions ────────────────────────────────────────────
var pass = 0, fail = 0;
function is(got, want, what){
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w){ pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}
function job(folded, sides){ FOLDED = folded; selectedSides = sides; }
function slotKeys(){ return sidesNeeded().map(function(s){ return s.key; }); }
function pg(w, h){ return { mmW: w, mmH: h }; }

print('\nWHAT THE CUSTOMER IS ASKED FOR');
job(false, 'single'); is(slotKeys(), ['front'], 'a flat card, one side: just a front');
job(false, 'double'); is(slotKeys(), ['front','back'], 'a flat card, both sides: front and back');
job(true, 'single');
is(slotKeys(), ['front','back'], 'OUTSIDE ONLY still has a back — it is on the same sheet side');
job(true, 'double');
is(slotKeys(), ['front','back','inside'], 'outside and inside: three slots, never four');
is(sidesNeeded().map(function(s){ return s.group; }), ['Outside','Outside','Inside'], 'grouped by sheet side');
is(sidesNeeded()[2].spread, true, 'and the inside is one spread');

print('\nWHAT THE PRESS FILE GETS');
job(true, 'double');
is(panelsNeeded(), ['front','inside-left','inside-right','back'],
   'still a page per panel, in reading order — the printer sees no change');
job(true, 'single'); is(panelsNeeded(), ['front','back'], 'outside only is two panels');
job(false, 'single'); is(panelsNeeded(), ['front'], 'a flat single-sided card is one');

print('\nTURNING SLOTS INTO PANELS');
job(true, 'double');
sideFiles = { front:{file:'F',page:1}, back:{file:'B',page:1},
              inside:{file:'I',page:2,pageRight:3} };
is(panelSource('front').entry, {file:'F',page:1,half:null}, 'the front is just the front');
is(panelSource('inside-left').entry,  {file:'I',page:2}, 'two inside pages: left is the first');
is(panelSource('inside-right').entry, {file:'I',page:3}, 'and right is the second');

sideFiles.inside = { file:'S', page:2, spread:true };
is(panelSource('inside-left').entry,  {file:'S',page:2,half:'left'},  'a spread is cut down the crease');
is(panelSource('inside-right').entry, {file:'S',page:2,half:'right'}, 'both halves come off the same page');

sideFiles.inside = { file:'P', page:1 };
is(panelSource('inside-left'), null, 'one panel on the inside leaves the LEFT page blank');
is(panelSource('inside-right').entry, {file:'P',page:1}, 'because a message goes on the right');

sideFiles = { front:{file:'F',page:1} };
is(panelSource('back'), null, 'an unsupplied back is blank, not an error');
is(panelSource('inside-left'), null, 'and so is an unsupplied inside');

print('\nREADING ONE DROPPED FILE');
job(true, 'double');
var K = slotKeys();
is(mapPagesToSlots([pg(154,216),pg(154,216),pg(154,216),pg(154,216)], K, SPEC, 'portrait'),
   { front:{page:1}, inside:{page:2,pageRight:3}, back:{page:4} },
   'four panels in reading order — what every design tool exports');
is(mapPagesToSlots([pg(148,210),pg(148,210),pg(148,210),pg(148,210)], K, SPEC, 'portrait'),
   { front:{page:1}, inside:{page:2,pageRight:3}, back:{page:4} },
   'and the same without bleed');
is(mapPagesToSlots([pg(302,216),pg(302,216)], K, SPEC, 'portrait'),
   { front:{page:1,half:'right'}, back:{page:1,half:'left'}, inside:{page:2,spread:true} },
   'two sheet sides — the back is on the LEFT of the outside');
is(mapPagesToSlots([pg(154,216),pg(154,216),pg(154,216)], K, SPEC, 'portrait'), null,
   'three pages is a guess, so we do not make it');
is(mapPagesToSlots([pg(154,216),pg(154,216),pg(154,216),pg(154,216),pg(154,216)], K, SPEC, 'portrait'),
   null, 'FIVE pages no longer silently loses page five');
is(mapPagesToSlots([pg(154,216)], K, SPEC, 'portrait'), null, 'one panel cannot be a whole card');
is(mapPagesToSlots([pg(999,999),pg(999,999),pg(999,999),pg(999,999)], K, SPEC, 'portrait'), null,
   'four pages of the wrong size are not four panels');

selectedOrientation = 'landscape';
is(mapPagesToSlots([pg(154,426),pg(154,426)], K, SPEC, 'landscape'),
   { front:{page:1,half:'right'}, back:{page:1,half:'left'}, inside:{page:2,spread:true} },
   'turned landscape, the spread is twice as TALL');
is(mapPagesToSlots([pg(302,216),pg(302,216)], K, SPEC, 'landscape'), null,
   'and a twice-as-wide file is no longer a spread');
selectedOrientation = 'portrait';

job(true, 'single');
var K2 = slotKeys();
is(mapPagesToSlots([pg(302,216)], K2, SPEC, 'portrait'),
   { front:{page:1,half:'right'}, back:{page:1,half:'left'} },
   'outside only: one spread splits into front and back');
is(mapPagesToSlots([pg(154,216),pg(154,216)], K2, SPEC, 'portrait'),
   { front:{page:1}, back:{page:2} }, 'or two panels, front then back');
is(mapPagesToSlots([pg(154,216)], K2, SPEC, 'portrait'), null,
   'a single panel cannot fill both — they place it');

job(false, 'double');
var K3 = slotKeys();
is(mapPagesToSlots([pg(154,216),pg(154,216)], K3, SPEC, 'portrait'),
   { front:{page:1}, back:{page:2} }, 'a flat card: front then back');
is(mapPagesToSlots([pg(302,216)], K3, SPEC, 'portrait'), null,
   'a flat card has no spread to split');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
