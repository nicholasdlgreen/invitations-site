// The basket drawer's button: where it goes, and what it says it will do.
//
// It used to send every click to the basket step. That was right from the
// three steps before the basket and wrong from the two after it: on the basket
// it sent you to the basket you were already looking at, so nothing happened
// and the button read as broken; on the checkout it threw you backwards out of
// a delivery address you were part way through typing.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-drawer-checkout.js
//
// Everything under test is CUT OUT of upload-and-print.html at run time.

var HTML = readFile('upload-and-print.html');

function grab(name, kind) {
  var needle = '\n  ' + (kind || 'function ') + name + (kind ? ' = ' : '(');
  var i = HTML.indexOf(needle);
  if (i < 0) { needle = '\n' + (kind || 'function ') + name + (kind ? ' = ' : '('); i = HTML.indexOf(needle); }
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

var currentStep = 1;
eval(grab('drawerGoesTo'));

// The words, read straight out of the shipped markup rather than copied here.
function labelFor(step) {
  currentStep = step;
  var to = drawerGoesTo();
  return to === 5 ? 'Continue to Checkout' : to === 4 ? 'Continue to Basket' : 'Back to Checkout';
}

var pass = 0, fail = 0;
function is(got, want, what) {
  var g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++;
  print('  FAIL  ' + what + '\n        got  ' + g + '\n        want ' + w);
}

print('\nONE STEP FORWARD, NEVER BACKWARDS');
currentStep = 1; is(drawerGoesTo(), 4, 'from the size, to the basket');
currentStep = 2; is(drawerGoesTo(), 4, 'from the artwork, to the basket');
currentStep = 3; is(drawerGoesTo(), 4, 'from the paper, to the basket');
currentStep = 4; is(drawerGoesTo(), 5, 'FROM THE BASKET, TO THE CHECKOUT — the bug');
currentStep = 5; is(drawerGoesTo(), null,
   'from the checkout, nowhere: it closes the drawer and leaves them where '
   + 'they are. Sending someone back to the basket from a half-filled address '
   + 'form is worse than doing nothing');

print('\nAND IT SAYS WHERE IT IS GOING');
is(labelFor(1), 'Continue to Basket', 'it no longer promises the checkout from step 1');
is(labelFor(3), 'Continue to Basket', 'nor from the paper step');
is(labelFor(4), 'Continue to Checkout', 'it promises the checkout where it delivers one');
is(labelFor(5), 'Back to Checkout', 'and on the checkout it offers the way back to it');

print('\nWHAT THE PAGE WIRES UP');
is(/id="drawerGoBtn"/.test(HTML), true, 'the button has a handle so its words can change');
// The comment above it is not the guard. Only the guard is the guard.
is(/if \(to\) goStep\(to\);/.test(HTML), true, 'a null destination moves nobody');
is(/if \(typeof paintDrawerButton === 'function'\) paintDrawerButton\(\);/.test(HTML), true,
   'the words are repainted on every move');
is(HTML.indexOf('currentStep=n;') < HTML.indexOf('paintDrawerButton();'), true,
   'after the step has changed, not before, or it would describe the step '
   + 'the customer just left');
is(/\n  paintDrawerButton\(\);\n\n  \/\/ Keep a handle on the original/.test(HTML), true,
   'and set once on load, because goStep runs before this block is installed');
is(/if \(!live\.length\) \{/.test(HTML), true, 'an empty basket is still refused');
is(/showToast\('Your basket is empty'\)/.test(HTML), true, 'and says so');

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' assertion(s) failed');
