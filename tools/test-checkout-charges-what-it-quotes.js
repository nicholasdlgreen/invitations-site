// Stripe is asked for exactly the figure the customer was shown.
//
// Found 8 October 2026 by posting a real basket through the live site — the
// first time anything ever had. The site quoted £23.20 for 100 cards and the
// Stripe session asked for £23.00.
//
// The line was priced per CARD and multiplied back up:
//
//   unit_amount: Math.round((item.total / item.qty) * 100),   quantity: item.qty
//
// Rounding a per-card price to whole pence and multiplying by the quantity
// amplifies the error by the quantity. Against our own published ladder it
// undercharged at some quantities and OVERCHARGED at others — 500 cards at
// £39.20 would have taken £40.00. Overcharging is the serious half: it takes
// more than the price displayed.
//
// It also put the order row and the payment permanently out of step. The row
// recorded £23.20 while Stripe collected £23.00, so the two could never
// reconcile and the discrepancy would have surfaced as an accounting mystery
// months later rather than as a bug.
//
// This runs the REAL builder out of create-checkout.js. A test that read the
// source would not have caught the original, because the source looked
// perfectly reasonable; only the arithmetic gave it away.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-checkout-charges-what-it-quotes.js

var SRC = read('netlify/functions/create-checkout.js');

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Lift the two builders out of the shipped file, braces balanced.
function grab(name, src){
  var H = src || SRC;
  var i = H.indexOf('\nfunction ' + name + '(');
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

eval(grab('stripeLineItems'));
eval(grab('lineItemsTotalPence'));

function basket(rows){
  return rows.map(function(r, n){
    return { name: 'line ' + (n+1), qty: r[0], total: r[1], paper: 'Silk · Classic 300gsm' };
  });
}
function charged(cart){ return lineItemsTotalPence(stripeLineItems(cart)); }
function quoted(cart){ return Math.round(cart.reduce(function(s,i){ return s + i.total; }, 0) * 100); }

// Every quantity on the real Silk A5 ladder, plus the totals WITH envelopes,
// because those are the figures a customer actually sees.
var LADDER = [
  [25, 18.40], [50, 19.20], [100, 23.20], [150, 24.80], [200, 27.20],
  [250, 29.60], [500, 39.20],
  [25, 20.80], [50, 24.00], [100, 30.40], [150, 36.00], [250, 48.00], [500, 74.40]
];

print('\nEVERY QUANTITY ON THE REAL LADDER CHARGES THE QUOTED FIGURE');
LADDER.forEach(function(r){
  var c = basket([r]);
  is(r[0] + ' at £' + r[1].toFixed(2), charged(c), quoted(c));
});

print('\nTHE FIGURES THAT WERE ACTUALLY WRONG');
// Named individually so a regression says which case came back.
[[100, 23.20, 2320], [200, 27.20, 2720], [500, 39.20, 3920], [250, 48.00, 4800]]
  .forEach(function(r){
    is(r[0] + ' cards is charged ' + r[2] + 'p', charged(basket([[r[0], r[1]]])), r[2]);
  });

print('\nBASKETS WITH MORE THAN ONE LINE');
var multi = basket([[100, 23.20], [150, 36.00], [25, 20.80]]);
is('three lines still total exactly', charged(multi), quoted(multi));
is('and that is 8000p', charged(multi), 8000);
is('one line per basket item', stripeLineItems(multi).length, 3);

print('\nTHE QUANTITY IS NOT USED AS A MULTIPLIER');
// The whole fault was quantity doing arithmetic. It must only ever be 1.
var qtys = stripeLineItems(basket([[100, 23.20], [500, 39.20]])).map(function(l){ return l.quantity; });
is('every line is quantity 1', qtys.join(','), '1,1');
// ...but the customer still sees what they bought.
is('the description still names the quantity',
   /100 invitations/.test(stripeLineItems(basket([[100, 23.20]]))[0].price_data.product_data.description), true);

print('\nAWKWARD AMOUNTS');
is('a penny line', charged(basket([[1, 0.01]])), 1);
is('an odd total that does not divide evenly', charged(basket([[3, 10.00]])), 1000);
is('a free line', charged(basket([[10, 0]])), 0);

print('\nTHE GUARD IN THE HANDLER REFUSES RATHER THAN CHARGING SOMETHING ELSE');
is('it compares the charge with the quote', /chargePence !== quotedPence/.test(SRC), true);
is('and returns without creating a session',
   /chargePence !== quotedPence[\s\S]{0,400}?statusCode: 500/.test(SRC), true);
is('and says nothing has been charged', /Nothing has been charged/.test(SRC), true);

print('\nMUTATION: PUT THE OLD FORMULA BACK AND CONFIRM IT IS CAUGHT');
var BROKEN = SRC
  .replace('unit_amount: Math.round(item.total * 100),',
           'unit_amount: Math.round((item.total / item.qty) * 100),')
  .replace('    quantity: 1,\n  }));', '    quantity: item.qty,\n  }));');
is('the mutation changed the source', BROKEN !== SRC, true);
(function(){
  var stripeLineItems;                       // shadow the fixed one
  eval(grab('stripeLineItems', BROKEN));
  var c = basket([[100, 23.20]]);
  var old = stripeLineItems(c).reduce(function(p,l){ return p + l.price_data.unit_amount * l.quantity; }, 0);
  is('the old formula charges 2300p for a £23.20 basket, and is caught', old, 2300);
  var c2 = basket([[500, 39.20]]);
  var old2 = stripeLineItems(c2).reduce(function(p,l){ return p + l.price_data.unit_amount * l.quantity; }, 0);
  is('and OVERCHARGES 4000p for a £39.20 basket, and is caught', old2, 4000);
})();

print('\n' + pass + ' passed, ' + fail + ' failed');
