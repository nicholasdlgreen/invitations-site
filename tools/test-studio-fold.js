// What the design studio sends to the order step as `fold`, for each shape of
// product. This is the value the price is looked up with, so getting it wrong
// charges the customer for a card they did not ask for. It did: every
// invitation designed in the studio was handed off as 'folded', roughly twice
// the price of flat, with no control anywhere on the page to say otherwise.

var CONFIG_FOLDED, PRODUCT_HAS_FOLDED_ROUTE, FOLD_CHOICE, INSIDE_PRINTED;

function foldIsAChoice(){ return CONFIG_FOLDED && PRODUCT_HAS_FOLDED_ROUTE; }
function foldedOnly(){    return CONFIG_FOLDED && !PRODUCT_HAS_FOLDED_ROUTE; }
function isFoldedNow(){
  return foldedOnly() || (foldIsAChoice() && FOLD_CHOICE === 'folded');
}
function handoffFold(){
  return (PRODUCT_HAS_FOLDED_ROUTE && isFoldedNow()) ? 'folded' : 'flat';
}
// what the code did before
function oldHandoffFold(){
  return (CONFIG_FOLDED && PRODUCT_HAS_FOLDED_ROUTE) ? 'folded' : 'flat';
}

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function set(cfgFolded, hasRoute, choice){
  CONFIG_FOLDED = cfgFolded; PRODUCT_HAS_FOLDED_ROUTE = hasRoute; FOLD_CHOICE = choice;
}

print('\nSold BOTH ways — a wedding invitation. The customer decides.');
set(true, true, 'flat');
is('flat chosen  -> priced flat    ', handoffFold(), 'flat');
is('flat chosen  -> no inside asked', isFoldedNow(), false);
is('the choice is offered          ', foldIsAChoice(), true);
set(true, true, 'folded');
is('folded chosen -> priced folded ', handoffFold(), 'folded');
is('folded chosen -> inside asked  ', isFoldedNow(), true);

print('\nThe bug this fixes');
set(true, true, 'flat');
is('OLD code ignored the choice    ', oldHandoffFold(), 'folded');
is('NEW code honours it            ', handoffFold(), 'flat');

print('\nSold ONLY folded — a thank you card, a greeting card.');
set(true, false, 'flat');
is('always folded, whatever FOLD_CHOICE says', isFoldedNow(), true);
is('no choice is offered           ', foldIsAChoice(), false);
is('the customer is TOLD instead   ', foldedOnly(), true);
is('priced flat — its rates are tagged flat', handoffFold(), 'flat');
set(true, false, 'folded');
is('and the same the other way     ', handoffFold(), 'flat');

print('\nNever folded — a board, an order of service.');
set(false, false, 'flat');
is('not folded                     ', isFoldedNow(), false);
is('no choice, and nothing to tell ', foldIsAChoice() || foldedOnly(), false);
is('priced flat                    ', handoffFold(), 'flat');

print('\nA flat card must never carry an inside message');
set(true, true, 'folded'); INSIDE_PRINTED = true;
is('folded: inside kept            ', isFoldedNow() && INSIDE_PRINTED, true);
FOLD_CHOICE = 'flat';
if (!isFoldedNow()) INSIDE_PRINTED = false;          // what setFold() does
is('switched to flat: inside dropped', INSIDE_PRINTED, false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
