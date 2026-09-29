// The design studio's three steps: opening one, closing it, and where the page
// ends up afterwards.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-studio-sections.js
//
// The two functions under test are cut out of design-studio-ai-create.html at
// run time. The CSS and the call sites are asserted against the source itself,
// because "which function is allowed to move the page" is the whole point and
// cannot be seen from behaviour alone.

var SRC = readFile('design-studio-ai-create.html');

function grab(name){
  var m = new RegExp('\\n[ \\t]*function ' + name + '\\(').exec(SRC);
  if (!m) throw new Error('could not find function ' + name);
  var i = m.index + 1;
  var j = SRC.indexOf('{', i), depth = 0, k = j;
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
  return SRC.slice(i, k + 1);
}

// ── a page with three sections ────────────────────────────
var placed = [], stepped = [];
function makeSec(n){
  var open = false;
  return { n: n,
    classList: { contains: function(c){ return c === 'open' && open; },
                 remove:   function(c){ if (c === 'open') open = false; },
                 add:      function(c){ if (c === 'open') open = true; } },
    set _open(v){ open = v; }, get _open(){ return open; },
    scrollIntoView: function(opts){ placed.push(n + ':' + opts.block + ':' + opts.behavior); } };
}
var SECS = [makeSec(0), makeSec(1), makeSec(2)];
var document = { querySelector: function(sel){
  var m = /data-sec="(\d)"/.exec(sel); return m ? SECS[+m[1]] : null;
} };
var REDUCED = false;
var window = { matchMedia: function(){ return { matches: REDUCED }; } };
function matchMedia(){ return { matches: REDUCED }; }
function requestAnimationFrame(fn){ fn(); }
function setStep(n){ stepped.push(n); SECS.forEach(function(s,i){ s._open = (i === n); }); }

eval(grab('placeSection') + '\n' + grab('toggleStep'));

// ── assertions ────────────────────────────────────────────
var pass = 0, fail = 0;
function is(got, want, what){
  if (JSON.stringify(got) === JSON.stringify(want)){ pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
}
function reset(openIdx){ placed = []; stepped = []; SECS.forEach(function(s,i){ s._open = (i === openIdx); }); }

print('\nOPENING A STEP');
reset(0);
toggleStep(1);
is(stepped, [1], 'opening step 2 moves the accordion to step 2');
is(placed, ['1:start:smooth'], 'and the section is placed at the top of the view');
is(SECS.map(function(s){ return s._open; }), [false, true, false], 'only one step is open');

reset(0);
toggleStep(2);
is(placed, ['2:start:smooth'], 'the same for step 3, whichever step you came from');

print('\nCLOSING A STEP');
reset(1);
toggleStep(1);
is(SECS[1]._open, false, 'clicking the open step closes it');
is(placed, [], 'and closing NEVER moves the page — you are already looking at it');
is(stepped, [], 'nor does it re-run the step change');

print('\nWHO IS ALLOWED TO MOVE THE PAGE');
reset(0);
setStep(2);
is(placed, [], 'setStep on its own scrolls nothing');
is(/function setStep\([\s\S]{0,400}?placeSection/.test(SRC), false,
   'setStep must not call placeSection — it runs on first load and after a design '
   + 'is generated, and neither should yank the page');
is(/toggleStep\([\s\S]{0,400}?placeSection\(sec\)/.test(SRC), true,
   'only a click on a header places a section');

print('\nTHE OFFSET THAT KEEPS IT CLEAR OF THE HEADER');
is(/\.ds-sec\{[^}]*scroll-margin-top:calc\(var\(--ds-head/.test(SRC), true,
   'sections carry a scroll offset built from the measured header height');
is(/scroll-margin-top:calc\(var\(--ds-head, 75px\) \+ 16px\)/.test(SRC), true,
   'header plus a 16px gap, so the section lands below it rather than under it');

print('\nREDUCED MOTION');
REDUCED = true;
reset(0);
toggleStep(1);
is(placed, ['1:start:instant'], 'someone who asked for less motion gets no animation');
REDUCED = false;

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
