// What a delivery upgrade costs, and whether it matches what we are charged.
//
// PrintedEasy bill Express at 20% and Express Plus at 40% of the ex-VAT goods
// value, ROUNDED UP to the whole pound, with GBP 20 / GBP 40 minimums. Solved
// on 3 October 2026 from a real order of theirs: goods GBP 236.00 produced
// GBP 48 and GBP 95, and of eight candidate rules (ex-VAT or inc-VAT base, by
// ceil / nearest / truncate / none) only ex-VAT-and-round-up reproduces both.
//
// We mirrored the percentages, the minimums and the order-value limits but not
// the rounding, so the site quoted GBP 47.20 where they quote GBP 48. Pennies,
// and in the customer's favour, but a delivery line reads better in whole
// pounds and there is no reason for the two rules to differ.
//
// Only one place in the codebase computes this (admin.html merely prints the
// percentage back), and checkout takes the browser's figure and excludes
// delivery from the price floor, so rounding here cannot desynchronise a
// basket from its Stripe session.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Cut the one function out, so every source assertion below is pinned to it
// and cannot be satisfied by a Math.ceil somewhere else in a 5,000-line file.
function grab(name){
  var at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  var i = SRC.indexOf('{', at), depth = 0, end = -1;
  for (var j = i; j < SRC.length; j++){
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) { end = j + 1; break; }
  }
  return SRC.slice(at, end);
}
var FN = grab('deliveryPriceFor');

print('\nTHE FUNCTION UNDER TEST IS THE ONE WE THINK IT IS');
is('deliveryPriceFor was found and is small', FN.length > 80 && FN.length < 600, true);
is('it reads the percentage', /surcharge_pct/.test(FN), true);
is('it reads the minimum',    /surcharge_min/.test(FN), true);
is('it falls back to a flat price', /opt\.price/.test(FN), true);

print('\nTHE PERCENTAGE IS ROUNDED UP, AS THEY ROUND IT');
is('Math.ceil is applied inside this function', /Math\.ceil/.test(FN), true);
is('it rounds the percentage, not the minimum',
   /Math\.ceil\(\s*orderValue \* \(pct \/ 100\)\s*\)/.test(FN), true);
is('the minimum is still a floor, not a replacement', /Math\.max\(/.test(FN), true);

// Replay the shipped rule rather than only describing it.
function deliveryPriceFor(opt, orderValue){
  var pct = parseFloat(opt.surcharge_pct) || 0;
  if (pct > 0) return Math.max(Math.ceil(orderValue * (pct / 100)), parseFloat(opt.surcharge_min) || 0);
  return parseFloat(opt.price) || 0;
}
// Guard: the replay must be the shipped text, or these numbers prove nothing.
is('the replayed body matches the shipped body',
   FN.replace(/\s+/g, ' ').indexOf('Math.max(Math.ceil(orderValue * (pct / 100)), parseFloat(opt.surcharge_min) || 0)') > 0,
   true);

// What PrintedEasy charge, from their confirmed rule.
function printedEasy(pct, min, goodsEx){ return Math.max(Math.ceil(goodsEx * pct / 100), min); }

var STANDARD = { price:'0.00', surcharge_pct:'0.00',  surcharge_min:'0.00'  };
var EXPRESS  = { price:'0.00', surcharge_pct:'20.00', surcharge_min:'20.00' };
var PLUS     = { price:'0.00', surcharge_pct:'40.00', surcharge_min:'40.00' };

print('\nWE NOW QUOTE WHAT THEY QUOTE, ON THE ORDER WE MEASURED');
is('Express on GBP 236',      deliveryPriceFor(EXPRESS, 236).toFixed(2), '48.00');
is('Express Plus on GBP 236', deliveryPriceFor(PLUS,    236).toFixed(2), '95.00');
is('Standard is still free',  deliveryPriceFor(STANDARD, 236).toFixed(2), '0.00');
is('Express matches their rule exactly',
   deliveryPriceFor(EXPRESS, 236) === printedEasy(20, 20, 236), true);
is('Express Plus matches their rule exactly',
   deliveryPriceFor(PLUS, 236) === printedEasy(40, 40, 236), true);

print('\nTHE ROUNDING ONLY EVER GOES UP, AND NEVER PAST THE NEXT POUND');
[[236,48],[150,30],[150.01,31],[100,20],[99.99,20],[104.99,21],[105,21],[105.01,22]].forEach(function(c){
  is('Express on GBP ' + c[0], deliveryPriceFor(EXPRESS, c[0]), c[1]);
});
is('an exact pound is not pushed to the next one', deliveryPriceFor(EXPRESS, 200), 40);

print('\nTHE MINIMUM STILL BITES ON SMALL ORDERS');
is('GBP 50 of goods pays the GBP 20 minimum', deliveryPriceFor(EXPRESS, 50), 20);
is('GBP 50 of goods pays the GBP 40 minimum on Plus', deliveryPriceFor(PLUS, 50), 40);
is('the minimum wins right up to where the percentage passes it',
   deliveryPriceFor(EXPRESS, 99.99), 20);
is('and the percentage takes over immediately after',
   deliveryPriceFor(EXPRESS, 100.01) > 20, true);
is('an empty basket shows the minimum, as before', deliveryPriceFor(EXPRESS, 0), 20);

print('\nA FLAT-PRICED SERVICE IS UNAFFECTED BY ANY OF THIS');
is('a flat fee is returned untouched and unrounded',
   deliveryPriceFor({ price:'7.45', surcharge_pct:'0', surcharge_min:'0' }, 236).toFixed(2), '7.45');
is('a missing price is zero, not NaN',
   deliveryPriceFor({ surcharge_pct:'0' }, 236), 0);

// MUTATION GUARD. Drop the ceil and the comparisons with their rule must fail,
// otherwise the numbers above are decoration.
print('\nMUTATION: WITHOUT THE ROUNDING, THIS TEST MUST FAIL');
function unrounded(opt, orderValue){
  var pct = parseFloat(opt.surcharge_pct) || 0;
  if (pct > 0) return Math.max(orderValue * (pct / 100), parseFloat(opt.surcharge_min) || 0);
  return parseFloat(opt.price) || 0;
}
is('the old rule disagrees with theirs on GBP 236',
   unrounded(EXPRESS, 236) === printedEasy(20, 20, 236), false);
is('the old rule quoted GBP 47.20', unrounded(EXPRESS, 236).toFixed(2), '47.20');
// And a rounding that goes the wrong way must not pass either.
is('rounding to nearest would undercharge',
   Math.round(236 * 0.20) === printedEasy(20, 20, 236), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
