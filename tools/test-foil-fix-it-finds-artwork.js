// "Fix it" can find the customer's artwork — on a ONE-SIDED order too.
//
// Found 7 October 2026 by reproducing a real order on the live site. A
// single-sided A5 invitation, artwork uploaded and rendering happily, the
// artwork re-uploaded by mistake as the foil layer, red on Colour, "Fix it"
// offered — and pressing it did nothing. It failed SILENTLY: no console
// output, and a panel saying "We could not read your artwork. Please upload a
// foil layer instead", which is the one thing the customer could not do.
//
// The cause was one line in handleFiles. With a single face to fill it called
// handleFile and returned, never recording the file in sideFiles. Everything on
// screen still worked, because the preview and the quality checks read the file
// directly — so nothing looked wrong. But Route B asks panelSource('front'),
// panelSource reads sideFiles, and on a one-sided order it found nothing.
//
// Proven both ways on the live site before the fix:
//   single sided (1 slot)  sideFiles {}        panelSource null   Fix it FAILS
//   double sided (2 slots) sideFiles {front}   panelSource found  Fix it WORKS
// So this had never worked for most orders, and worked on double-sided and
// folded only because those populate sideFiles for their own reasons.
//
// This runs the real handleFiles against stubs, because a source-reading test
// cannot tell whether the assignment happens on the path that matters.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-foil-fix-it-finds-artwork.js

var HTML = read('upload-and-print.html');

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Lift a function out of the shipped page, braces balanced, comments and
// strings skipped — the same cutter the other foil test uses.
function grabHost(name, src){
  var H = src || HTML;
  var needle = '\nfunction ' + name + '(';
  var i = H.indexOf(needle);
  if (i < 0) { needle = '\nasync function ' + name + '('; i = H.indexOf(needle); }
  if (i < 0) throw new Error('could not find ' + name);
  i += 1;
  var j = H.indexOf('{', i), depth = 0, k = j;
  for (; k < H.length; k++){
    var c = H[k];
    if (c === '/' && H[k+1] === '/'){ k = H.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`'){
      var q = c;
      for (k++; k < H.length; k++){ if (H[k] === '\\'){ k++; continue; } if (H[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) break; }
  }
  return H.slice(i, k + 1);
}

// ── the world handleFiles runs in ───────────────────────────────────────────
var sideFiles, handled, SLOTS, placementCalls, mapResult;

function reset(){ sideFiles = {}; handled = []; placementCalls = 0; }
function sidesNeeded(){ return SLOTS; }
function handleFile(f){ handled.push(f && f.name); }
function openPlacement(){ placementCalls++; return Promise.resolve(); }
function mapOneFile(){ return Promise.resolve(mapResult); }
function renderSideSlots(){}
function renderFaceTabs(){}
var filePool = [], pickedFile = null, placementOpen = false, activeFace = null;

eval(grabHost('handleFiles'));
eval(grabHost('panelSource'));

function upload(files){
  reset();
  var done = false;
  handleFiles(files).then(function(){ done = true; });
  drainMicrotasks();
  return done;
}

var FILE = { name:'our-invitation.pdf', type:'application/pdf' };

print('\nONE FACE TO FILL — THE CASE THAT WAS BROKEN');
SLOTS = [{ key:'front', label:'Front' }];
upload([FILE]);
is('the artwork is still shown', handled[0], 'our-invitation.pdf');
is('AND it is recorded on the front face', !!sideFiles.front, true);
is('with the file itself, not a copy of the name', sideFiles.front && sideFiles.front.file.name, 'our-invitation.pdf');
is('on page 1', sideFiles.front && sideFiles.front.page, 1);
is('nobody is sent to the placement screen', placementCalls, 0);

print('\nSO FIX IT CAN FIND IT');
var src = panelSource('front');
is('panelSource(\'front\') is no longer null', !!src, true);
is('and hands back the uploaded file', src && src.entry.file.name, 'our-invitation.pdf');
is('frontFaceForFoil would therefore have something to open', !!(src && src.entry.file), true);

print('\nTHE FACE IT RECORDS IS THE ONE THE JOB ASKED FOR');
// Not hard-coded to 'front': a product whose single face is something else must
// record it there, or this fixes one case and invents another.
SLOTS = [{ key:'inside-right', label:'Inside' }];
upload([FILE]);
is('a single inside face is recorded as inside, not front', !!sideFiles['inside-right'], true);
is('and nothing is invented on the front', !!sideFiles.front, false);

print('\nTHE MULTI-FACE PATHS ARE UNTOUCHED');
SLOTS = [{ key:'front', label:'Front' }, { key:'back', label:'Back' }];
mapResult = { front: { file:FILE, page:1 } };
upload([FILE]);
is('one file that covers the job is still mapped', !!sideFiles.front, true);
is('and still shown', handled[0], 'our-invitation.pdf');

mapResult = null;
upload([FILE]);
is('one file that cannot cover it still goes to placement', placementCalls, 1);

upload([FILE, { name:'back.pdf' }]);
is('several files still go to placement', placementCalls, 1);
is('and are never guessed at', Object.keys(sideFiles).length, 0);

print('\nNOTHING AT ALL, STILL NOTHING');
upload([]);
is('an empty drop records nothing', Object.keys(sideFiles).length, 0);
is('and shows nothing', handled.length, 0);

print('\nMUTATION: PUT THE BUG BACK AND CONFIRM IT IS CAUGHT');
var BROKEN = HTML.replace(
  /if \(slots\.length < 2\)\{\s*\n\s*const only[\s\S]*?\n  \}/,
  'if (slots.length < 2){ handleFile(files[0]); return; }');
is('the mutation changed the source', BROKEN !== HTML, true);
(function(){
  var handleFiles;                       // shadow the fixed one
  eval(grabHost('handleFiles', BROKEN));
  reset();
  SLOTS = [{ key:'front', label:'Front' }];
  handleFiles([FILE]); drainMicrotasks();
  is('the old one shows the artwork', handled[0], 'our-invitation.pdf');
  is('but records nothing — which is the bug, and it is caught',
     !!sideFiles.front, false);
  is('so panelSource is null again', panelSource('front'), null);
})();

print('\nTHE SILENT FAILURE IS CLOSED TOO');
// openFoilPicker only recovered from a NULL. A throw escaped an async onclick
// handler and left busy:true, so the panel said "Opening your artwork..." for
// ever. Read from the shipped source because the catch is the whole point.
var OPEN = grabHost('openFoilPicker');
is('frontFaceForFoil is wrapped in try/catch', /try\s*\{[\s\S]*frontFaceForFoil[\s\S]*\}\s*catch/.test(OPEN), true);
is('and a failure is logged rather than swallowed', /console\.error\(/.test(OPEN), true);
is('and it still ends in the failed state the panel can show',
   /failed:\s*true/.test(OPEN), true);
var NOCATCH = OPEN.replace(/try \{\n\s*art = await frontFaceForFoil\(selectedSize\);\n\s*\} catch \(e\) \{/,
                           'if (1) {\n    art = await frontFaceForFoil(selectedSize);\n  } else {');
is('the mutation changed the source', NOCATCH !== OPEN, true);
is('without the catch it is caught', /try\s*\{[\s\S]*frontFaceForFoil[\s\S]*\}\s*catch/.test(NOCATCH), false);

print('\n' + pass + ' passed, ' + fail + ' failed');
