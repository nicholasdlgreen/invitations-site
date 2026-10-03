// What the order page does when the foil layer is OURS — drawn from the design
// in the studio — rather than a file the customer uploaded.
//
// Nicholas hit this twice on live work with an RSVP card. Choosing foiling sat
// on "Checking your foil layer..." and never finished; when it did fail it told
// him the file was the wrong size and offered to "Fix it", which answered "We
// could not read your artwork". His question was the right one: we generate
// that file, so how can it ever need fixing, and what is there for him to fix?
//
// Three separate faults produced that, and these checks hold each one shut.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function slice(from, to){
  var a = SRC.indexOf(from); if (a < 0) return '';
  var b = SRC.indexOf(to, a + 1); return b < 0 ? SRC.slice(a) : SRC.slice(a, b);
}

print('\nA HANG IS A FAILURE, NOT A WAIT');
// Reading the layer sat forever when pdf.js was refused its worker. Nothing
// threw, so no catch ran, so the panel never moved off "Checking...".
is('there is a timeout helper', /function withTimeout\(promise, ms, what\)/.test(SRC), true);
is('it rejects rather than resolving', /reject\(new Error\(what \+ ' took longer than '/.test(SRC), true);
is('it clears its timer', /\.finally\(function\(\)\{ clearTimeout\(timer\); \}\)/.test(SRC), true);
var load = slice('async function loadStudioFoilLayer', 'function retryStudioFoilLayer');
is('reading the layer is wrapped in it', /withTimeout\(rasteriseStudioFoil\(url\)/.test(load), true);
is('the timeout is a named constant', /const STUDIO_FOIL_TIMEOUT_MS = \d+/.test(SRC), true);

print('\nA MISS IS NOT FINAL');
// It used to latch: "Once only. A failed fetch falls back to asking for an
// upload." One miss and the rest of the session asked for a file we were
// supposed to be making.
is('failure is recorded so the panel can offer another go', /studioFoilFailed = true;/.test(load), true);
is('there is a retry', /function retryStudioFoilLayer\(\)/.test(SRC), true);
var retry = slice('function retryStudioFoilLayer', '\n}');
is('retry clears the latch',        /studioFoilTried = false;/.test(retry), true);
is('retry clears the failed flag',  /studioFoilFailed = false;/.test(retry), true);
is('retry drops the stale raster',  /studioFoilArt = null;/.test(retry), true);
is('retry actually tries again',    /loadStudioFoilLayer\(\);/.test(retry), true);
is('the old once-only comment is gone', /Once only\. A failed fetch/.test(SRC), false);

print('\nOUR FILE IS NEVER THE CUSTOMER\'S FAULT');
is('a failed load is an error, not a warning',
   /console\.error\('\[studio-foil\] our own foil layer did not load:'/.test(load), true);
is('our layer failing its own checks is shouted about',
   /console\.error\('\[studio-foil\] the layer WE generated failed its own checks:'/.test(SRC), true);

print('\n"FIX IT" IS NEVER OFFERED ON A FILE WE MADE');
// It reads the artwork the CUSTOMER uploaded. A studio design has none, so
// panelSource('front') is null and it can only ever say it could not read it.
is('layers are tagged with who made them', /function takeFoilLayer\(file, origin\)/.test(SRC), true);
is('the tag is stored', /origin: origin \|\| 'upload'/.test(SRC), true);
is('there is a test for our own file', /function foilLayerIsOurs\(\)/.test(SRC), true);
var wayout = slice('function foilWayOutHtml', '\n}');
is('the way out refuses our own file', /if \(foilLayerIsOurs\(\)\) return '';/.test(wayout), true);
// every caller must say where the file came from, or the default hides a bug
is("the studio caller says 'studio'", /takeFoilLayer\(file, 'studio'\)/.test(SRC), true);
is("Route B says 'fix'",             /takeFoilLayer\(file, 'fix'\)/.test(SRC), true);
is("the upload caller says 'upload'", /takeFoilLayer\(this\.files\[0\], 'upload'\)/.test(SRC), true);
// every occurrence minus the definition itself must carry a tag
var allMentions = (SRC.match(/takeFoilLayer\(/g) || []).length - 1;
var tagged      = (SRC.match(/takeFoilLayer\([^)]*, '(studio|fix|upload)'\)/g) || []).length;
is('no caller is left untagged', tagged, allMentions);

print('\nTHEY ARE TOLD PLAINLY AND GIVEN ANOTHER GO');
is('there is a panel for our own failure', /function studioFoilProblemHtml\(\)/.test(SRC), true);
var prob = slice('function studioFoilProblemHtml', '\n}');
is('it does not blame their design', /Nothing is wrong with your design/.test(prob), true);
is('it offers another go',           /onclick="retryStudioFoilLayer\(\)"/.test(prob), true);
is('it offers no checklist',         /foilChecks\(\)/.test(prob), false);
is('it offers no "Fix it"',          /openFoilPicker/.test(prob), false);
// used on BOTH routes to failure: never loaded, and loaded but failed checks
is('shown when the layer never loaded',
   /studioFoilFailed\) \{[\s\S]{0,260}studioFoilProblemHtml\(\)/.test(SRC), true);
// our file + did not pass -> our panel. Anchored on the branch that decides it,
// so moving the decision elsewhere fails this rather than passing quietly.
is('ours is computed from who drew it, not just from the raster',
   /const ours\s+= mine \|\| foilLayerIsOurs\(\);/.test(SRC), true);
is('shown when our layer fails its own checks',
   /\} else if \(ours\) \{[\s\S]{0,700}studioFoilProblemHtml\(\)/.test(SRC), true);
is('a passing layer of ours is never given the checklist',
   /if \(ours && !wrong\) \{[\s\S]{0,320}studioFoilPanelHtml\(chosen\) : foilSummaryHtml\(chosen\)/.test(SRC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
