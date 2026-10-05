// Back goes back one step, not out of the order.
//
// The whole order happens on one page. Until 5 October 2026 moving between
// steps recorded nothing — no history entry, no change of URL. Measured in the
// browser: walking four steps created ZERO entries. So the browser's Back
// button did not go back a step, it left the order and lost the lot; from the
// basket it landed on the product page.
//
// Nicholas also reported the breadcrumb not following. It always did — the
// highlight is correct at every step — but with no history to move through,
// Back never gave it anything to follow. One entry per step fixes both, and a
// refresh keeping your place falls out of it for free.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

print('\nEVERY STEP RECORDS WHERE YOU ARE');
is('goStep takes a fromHistory flag', /function goStep\(n, fromHistory\)\{/.test(SRC), true);
is('it pushes an entry', /history\.pushState\(\{ fpStep: n \}/.test(SRC), true);
is('and puts the step in the address bar', /q\.set\('step', n\)/.test(SRC), true);
// The first write must REPLACE. Pushing on the first would leave a dead entry
// pointing at the step just left, so the first Back would appear to do nothing.
is('the first step replaces rather than pushes',
   /if \(_steppedOnce && _historyStarted\) history\.pushState[\s\S]{0,120}else \{ history\.replaceState/.test(SRC), true);
is('a history failure cannot block the step itself',
   /catch \(e\) \{ \/\* a history failure must never block the step itself \*\/ \}/.test(SRC), true);

print('\nSTEP 1 IS IN THE HISTORY, OR BACK FROM STEP 2 LEAVES THE ORDER');
// Found by testing rather than by reading: the first version seeded no entry
// for step 1, so Back from step 2 went to the product page.
is('an ordinary arrival seeds step 1',
   /history\.replaceState\(\{ fpStep: 1 \}/.test(SRC), true);
is('and marks history as started, so step 2 pushes',
   /history\.replaceState\(\{ fpStep: 1 \}[\s\S]{0,120}_historyStarted = true;/.test(SRC), true);

print('\nBACK AND FORWARD ARE READ BACK');
is('there is a popstate listener', /addEventListener\('popstate'/.test(SRC), true);
is('it moves to the step the browser remembered', /goStep\(n, true\);/.test(SRC), true);
// Without fromHistory the listener would push a fresh entry for a move the
// browser already recorded — Forward becomes unreachable and you are trapped.
var POP = SRC.slice(SRC.indexOf("addEventListener('popstate'"), SRC.indexOf("addEventListener('popstate'") + 400);
is('and passes fromHistory so it does not re-push', /goStep\(n, true\)/.test(POP), true);
is('a popstate for the step we are on is ignored', /if \(!n \|\| n === currentStep\) return;/.test(POP), true);

print('\nA LINKED OR REFRESHED STEP IS HONOURED, BUT ONLY IF IT MAKES SENSE');
is('the step is read from the url', /get\('step'\), 10\)/.test(SRC), true);
is('only steps 1-5 are accepted', /want >= 1 && want <= 5/.test(SRC), true);
// The steps are not independent — the basket lives in this page.
is('basket and checkout need something in the basket',
   /if \(n >= 4 && \(!Array\.isArray\(cart\) \|\| !cart\.length\)\) n = 1;/.test(SRC), true);
is('the paper step needs a size', /if \(n === 3 && !selectedSize\) n = 1;/.test(SRC), true);
is('and the url is corrected to where we actually are',
   /The entry has to describe where we ACTUALLY are/.test(SRC), true);

print('\nTHE FIFTEEN EXISTING CALLERS ARE UNTOUCHED');
// Every other call site passes one argument and must keep working.
var callers = (SRC.match(/goStep\((\d)\)/g) || []).length;
is('single-argument calls still present', callers > 8, true);
is('none of them were given a second argument', /goStep\(\d, (true|false)\)/.test(SRC), false);

print('\nMUTATION: THE OLD BEHAVIOUR MUST FAIL');
var NOPUSH = SRC.replace(/history\.pushState\(\{ fpStep: n \}[^;]*;/, '');
is('a flow that pushes nothing is caught',
   /history\.pushState\(\{ fpStep: n \}/.test(NOPUSH), false);
var NOPOP = SRC.replace("addEventListener('popstate'", "addEventListener('nothing'");
is('a flow that never listens is caught', /addEventListener\('popstate'/.test(NOPOP), false);
// And a listener that re-pushes would trap the customer.
is('re-pushing on popstate would be caught',
   /goStep\(n, true\)/.test(POP.replace('goStep(n, true)', 'goStep(n)')), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
