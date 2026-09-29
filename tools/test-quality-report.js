// The traffic light, the acknowledgement, and the button that waits for it.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-quality-report.js
//
// The functions under test are CUT OUT OF upload-and-print.html at run time,
// not copied here. A hand-copy is a test of the copy: it passes while the
// shipped page is broken, which is exactly how six paper-step attempts went.

var SRC = readFile('upload-and-print.html');

// Pull one `function name(...){...}` out of the page by matching braces.
// String and comment contents are skipped, or a `}` inside a quoted message
// would end the function early.
function grab(name){
  var i = SRC.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name + ' in the page');
  i += 1;
  var j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++){
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/'){ k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`'){
      var q = c;
      for (k++; k < SRC.length; k++){
        if (SRC[k] === '\\') { k++; continue; }
        if (SRC[k] === q) break;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1);
}

// ── a fake page, just big enough ──────────────────────────
var ROWS = [];
function row(label, status, val, note){
  return {
    getAttribute: function(a){ return a === 'data-check' ? label : null; },
    querySelector: function(sel){
      if (sel === '.check-icon') return { classList: { contains: function(c){ return c === status; } } };
      if (sel === '.check-label') return { textContent: label };
      if (sel === '.check-val')   return { textContent: val };
      if (sel === '.check-note')  return { textContent: note || '' };
      return null;
    }
  };
}
function el(){
  var e = { hidden: false, innerHTML: '', textContent: '', checked: false,
            _strong: { textContent: '' }, _span: { textContent: '' },
            style: {}, dataset: {}, _cls: {}, _attr: {} };
  e.classList = {
    add:      function(c){ e._cls[c] = true; },
    remove:   function(c){ delete e._cls[c]; },
    contains: function(c){ return !!e._cls[c]; }
  };
  e.setAttribute    = function(a,v){ e._attr[a] = v; };
  e.removeAttribute = function(a){ delete e._attr[a]; };
  e.querySelector   = function(sel){
    if (sel === '.tl-words strong') return e._strong;
    if (sel === '.tl-words span')   return e._span;
    return null;
  };
  e.scrollIntoView = function(){};
  e.focus = function(){};
  return e;
}
var DOM = {};
['checkLight','ackBox','ackCheck','ackHead','proceedBtn','proceedReason'].forEach(function(id){ DOM[id] = el(); });
var document = {
  getElementById:  function(id){ return DOM[id] || null; },
  querySelectorAll:function(sel){ return sel.indexOf('.check-row') > -1 ? ROWS : []; }
};
function setTimeout(){}

// ── the stubs the button leans on ─────────────────────────
var checksPassed = true, faceWasBad = {}, faceOk = {}, sideFiles = { front: {} };
var SIDES = [{ key:'front', label:'Front' }];
function sidesNeeded(){ return SIDES; }
function allFacesReady(){ return true; }

// ── the code under test, straight out of the page ─────────
var checksAcknowledged = false, acknowledgedFor = '', ackGivenAt = null;
// One eval at top level, so the declarations land in global scope rather than
// inside a forEach callback where nothing else can reach them.
eval([ 'checkCounts','flaggedSignature','setChecksAcknowledged','refreshCheckLight',
       'refreshAckBox','artworkAckRecord','updateProceedButton'
     ].map(grab).join('\n'));

// ── assertions ────────────────────────────────────────────
var pass = 0, fail = 0;
function is(got, want, what){
  if (got === want){ pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
}
function lamp(){
  var h = DOM.checkLight.innerHTML;
  if (DOM.checkLight.hidden) return 'off';
  if (h.indexOf('red on')   > -1 || h.indexOf('tl-lamp red on')   > -1) return 'red';
  if (h.indexOf('amber on') > -1) return 'amber';
  if (h.indexOf('green on') > -1) return 'green';
  return '?';
}
function reset(rows){
  ROWS = rows;
  checksAcknowledged = false; acknowledgedFor = ''; ackGivenAt = null;
  DOM.ackCheck.checked = false;
  updateProceedButton();
}

var OK   = function(l,v){ return row(l,'ok',v); };
var WARN = function(l,v,n){ return row(l,'warn',v,n); };
var ERR  = function(l,v,n){ return row(l,'err',v,n); };

print('\nTHE LAMP');
reset([OK('Artwork size','148 x 210 mm'), OK('Resolution','412 DPI'), OK('File size','4.2 MB')]);
is(lamp(), 'green', 'three passes light green');
is(DOM.checkLight._strong.textContent, 'Good to print', 'green says good to print');
is(DOM.checkLight._span.textContent, '3 checks · nothing needs your attention', 'green counts the checks');

reset([WARN('Resolution','241 DPI'), OK('File size','4.2 MB'), OK('Bleed','Added')]);
is(lamp(), 'amber', 'one warning lights amber');
is(DOM.checkLight._strong.textContent, '1 thing to check', 'singular, not "1 things"');
is(DOM.checkLight._span.textContent, '2 of 3 checks passed', 'amber shows the good news too');

reset([WARN('Resolution','241 DPI'), WARN('File format','JPG'), OK('File size','4.2 MB')]);
is(DOM.checkLight._strong.textContent, '2 things to check', 'plural when there are two');

reset([ERR('Resolution','96 DPI'), WARN('Dimensions','1200 x 1600 px'), OK('File size','4.2 MB')]);
is(lamp(), 'red', 'an error beats a warning to the lamp');
is(DOM.checkLight._strong.textContent, '1 thing to fix', 'red leads with what must be fixed');
is(DOM.checkLight._span.textContent, '1 more to check · 1 passed', 'red still reports the rest');

reset([]);
is(DOM.checkLight.hidden, true, 'no checks yet, no lamp');

reset([OK('Prepress review','Manual check'), row('Dimensions','info','Will be checked')]);
is(lamp(), 'green', 'an info row is not a problem');
is(DOM.checkLight._span.textContent, '2 checks · nothing needs your attention', 'info counts as passed');

print('\nTHE TICK BOX');
reset([OK('Resolution','412 DPI'), OK('File size','4.2 MB')]);
is(DOM.ackBox.hidden, true, 'a clean file never sees the box');
is(DOM.proceedBtn.dataset.blocked, '', 'a clean file is not held up');
is(DOM.proceedBtn.classList.contains('needs-ack'), false, 'and the button looks live');

reset([WARN('Resolution','241 DPI'), OK('File size','4.2 MB')]);
is(DOM.ackBox.hidden, false, 'a warning raises the box');
is(DOM.ackHead.textContent,
   'I’ve read the point flagged above and I’d like to go ahead anyway.',
   'one flag reads as "the point", not "the 1 things"');
is(DOM.proceedBtn.dataset.blocked, 'ack', 'and the button waits');
is(DOM.proceedBtn.classList.contains('needs-ack'), true, 'and stops looking like the way forward');
is(DOM.proceedBtn._attr['aria-disabled'], 'true', 'and says so to a screen reader');
is(DOM.proceedBtn.textContent, 'Continue to Paper & Quantity', 'a warning is not "Continue Anyway"');
is(DOM.proceedReason.textContent, 'Tick the box above and we’ll carry on.', 'and the reason is in words');

setChecksAcknowledged(true);
is(DOM.proceedBtn.dataset.blocked, '', 'ticked, and the way is clear');
is(DOM.proceedBtn.classList.contains('needs-ack'), false, 'the button wakes up');
is(DOM.proceedReason.textContent, '', 'and stops nagging');

reset([ERR('Resolution','96 DPI'), WARN('Dimensions','1200 x 1600 px')]);
is(DOM.ackHead.textContent,
   'I’ve read the 2 things flagged above and I’d like to go ahead anyway.',
   'two flags, counted');
is(DOM.proceedBtn.textContent, 'Continue Anyway', 'an error changes the words on the button');
is(DOM.proceedBtn.dataset.blocked, 'ack', 'an error needs the tick too, not just a warning');

print('\nA TICK IS FOR ONE SET OF PROBLEMS');
reset([WARN('Resolution','241 DPI')]);
setChecksAcknowledged(true);
is(checksAcknowledged, true, 'ticked for a soft image');
ROWS = [WARN('Artwork size','A4 supplied for an A5 card')];   // different file
updateProceedButton();
is(checksAcknowledged, false, 'a different problem clears the tick');
is(DOM.ackCheck.checked, false, 'and unticks the box on screen');
is(DOM.proceedBtn.dataset.blocked, 'ack', 'and holds the button again');

reset([WARN('Resolution','241 DPI','soft')]);
setChecksAcknowledged(true);
ROWS = [WARN('Resolution','203 DPI','soft')];                 // same check, worse value
updateProceedButton();
is(checksAcknowledged, false, 'the same check with a worse number is a new problem');

reset([WARN('Resolution','241 DPI')]);
setChecksAcknowledged(true);
ROWS = [WARN('Resolution','241 DPI'), OK('File size','4.2 MB')];  // a pass appears
updateProceedButton();
is(checksAcknowledged, true, 'a check that PASSES does not clear the tick');

reset([WARN('Resolution','241 DPI')]);
setChecksAcknowledged(true);
ROWS = [OK('Resolution','412 DPI')];                          // fixed it
updateProceedButton();
is(checksAcknowledged, false, 'fixing the problem retires the tick');
is(DOM.ackBox.hidden, true, 'and puts the box away');
is(DOM.proceedBtn.dataset.blocked, '', 'and lets them through');

print('\nWHAT THE ORDER RECORDS');
reset([WARN('Resolution','241 DPI','Below our 300 DPI recommendation.'), OK('File size','4.2 MB')]);
is(artworkAckRecord(), null, 'nothing recorded until they tick');
setChecksAcknowledged(true);
var rec = artworkAckRecord();
is(!!rec, true, 'ticked, so there is a record');
is(rec.flagged.length, 1, 'it holds the one thing we flagged');
is(rec.flagged[0].check, 'Resolution', 'named');
is(rec.flagged[0].level, 'warning', 'and graded');
is(rec.flagged[0].value, '241 DPI', 'with the measurement they saw');
is(rec.flagged[0].note, 'Below our 300 DPI recommendation.', 'and the words they read');
is(rec.wording, DOM.ackHead.textContent, 'and what they agreed to');
is(typeof rec.at, 'string', 'and when');
ROWS = [WARN('Artwork size','wrong size')];
is(artworkAckRecord(), null, 'a stale tick never rides along with a different file');

reset([OK('Resolution','412 DPI')]);
is(artworkAckRecord(), null, 'a clean file records nothing');

print('\nTHE MISSING BACK STILL WINS');
SIDES = [{ key:'front', label:'Front' }, { key:'back', label:'Back' }];
allFacesReady = function(){ return false; };
sideFiles = { front: {} };
reset([WARN('Resolution','241 DPI')]);
is(DOM.proceedBtn.dataset.blocked, '1', 'a missing side blocks ahead of the tick box');
SIDES = [{ key:'front', label:'Front' }];
allFacesReady = function(){ return true; };

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
