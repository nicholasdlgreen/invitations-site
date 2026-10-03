// What the delivery page PROMISES, against what the basket actually CHARGES.
//
// delivery.html is a static marketing page; upload-and-print.html does the real
// arithmetic from the delivery_options table. Nothing connected the two, so the
// page advertised Express at a flat GBP 12.00 and Next Day at a flat GBP 18.00
// while the basket charged 20% and 40% of the order with GBP 20 / GBP 40
// minimums. On the GBP 236 order measured at PrintedEasy on 3 October 2026 the
// real charges are GBP 48 and GBP 95 — the page understated Express by GBP 36
// and Next Day by GBP 77, in writing, on a page a customer could hold us to.
//
// This test fails if the published words and the charged rule ever diverge
// again. It cannot reach the database, so the percentages and minimums below
// are the contract: if delivery_options changes, this test must be changed with
// it, and that is the point of it.

var PAGE = read('delivery.html');
var CART = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// The rule as held in delivery_options, and as PrintedEasy bill it to us.
var RULE = { express: { pct: 20, min: 20 }, nextDay: { pct: 40, min: 40 } };

print('\nTHE FLAT PRICES ARE GONE');
is('no flat GBP 12.00 anywhere on the page', /£12\.00/.test(PAGE), false);
is('no flat GBP 18.00 anywhere on the page', /£18\.00/.test(PAGE), false);

print('\nTHE CARDS SHOW A FROM-PRICE, AND IT IS THE MINIMUM WE CHARGE');
is('Express card reads "From £' + RULE.express.min + '"',
   new RegExp('>From £' + RULE.express.min + '<').test(PAGE), true);
is('Next Day card reads "From £' + RULE.nextDay.min + '"',
   new RegExp('>From £' + RULE.nextDay.min + '<').test(PAGE), true);
is('Standard is still free', />Free</.test(PAGE), true);

print('\nTHE RULE IS STATED, NOT HIDDEN');
var NOTE = (PAGE.match(/Express is 20% of your order value[^<]*/) || [''])[0];
is('the explanatory line is present', NOTE.length > 0, true);
is('it gives the Express percentage',  /20% of your order value/.test(NOTE), true);
is('it gives the Next Day percentage', /Next Day is 40%/.test(NOTE), true);
is('it gives both minimums',           /minimums of £20 and £40/.test(NOTE), true);
is('it promises the exact cost before paying',
   /exact delivery cost is shown before you pay/.test(NOTE), true);
// It must sit inside the Shipping Options card, not float at the foot of the page.
var card = PAGE.indexOf('Shipping Options');
var how  = PAGE.indexOf('How It Works');
is('the line sits inside the Shipping Options card',
   PAGE.indexOf(NOTE) > card && PAGE.indexOf(NOTE) < how, true);

print('\nTHE PAGE AGREES WITH WHAT THE BASKET CHARGES');
// Replay the shipped basket rule and check the page cannot understate it.
function deliveryPriceFor(opt, orderValue){
  var pct = parseFloat(opt.surcharge_pct) || 0;
  if (pct > 0) return Math.max(Math.ceil(orderValue * (pct / 100)), parseFloat(opt.surcharge_min) || 0);
  return parseFloat(opt.price) || 0;
}
is('the basket still rounds up, as this page assumes',
   /Math\.ceil\(orderValue \* \(pct \/ 100\)\)/.test(CART), true);
var EXPRESS = { price:'0.00', surcharge_pct:'20.00', surcharge_min:'20.00' };
var NEXTDAY = { price:'0.00', surcharge_pct:'40.00', surcharge_min:'40.00' };
// A "from" price is only honest if nothing is ever cheaper than it.
var cheapestExpress = Infinity, cheapestNextDay = Infinity;
for (var v = 0; v <= 4000; v += 5){
  cheapestExpress = Math.min(cheapestExpress, deliveryPriceFor(EXPRESS, v));
  cheapestNextDay = Math.min(cheapestNextDay, deliveryPriceFor(NEXTDAY, v));
}
is('nothing is ever cheaper than the Express from-price', cheapestExpress, RULE.express.min);
is('nothing is ever cheaper than the Next Day from-price', cheapestNextDay, RULE.nextDay.min);
is('the from-price is reachable, not theoretical', deliveryPriceFor(EXPRESS, 50), RULE.express.min);
is('and above it the percentage takes over', deliveryPriceFor(EXPRESS, 236), 48);

print('\nMUTATION: THE OLD PAGE MUST NOT PASS THIS TEST');
var OLD = PAGE.replace('>From £20<', '>£12.00<').replace('>From £40<', '>£18.00<');
is('the old flat Express price is caught', /£12\.00/.test(OLD), true);
is('the old page fails the from-price check', />From £20</.test(OLD), false);
// And a page that quotes a from-price BELOW what we charge must fail too.
var UNDER = PAGE.replace('>From £20<', '>From £15<');
is('a from-price under the minimum is caught', />From £20</.test(UNDER), false);

print('\nTHE CARDS STACK ON A PHONE, AND THE RULE CAN ACTUALLY REACH THEM');
// An inline style beats a media query, so if the grid keeps its columns inline
// the stacked layout silently never applies. That is the whole reason the rule
// moved to a class, and this is the assertion that keeps it there.
is('the options grid carries a class', /<div class="ship-grid">/.test(PAGE), true);
is('its columns are NOT set inline',
   /<div class="ship-grid"[^>]*style="[^"]*grid-template-columns/.test(PAGE), false);
is('three columns are declared in CSS',
   /\.ship-grid\{[^}]*grid-template-columns:repeat\(3,1fr\)/.test(PAGE), true);
is('and collapse to one on a narrow screen',
   /@media\(max-width:600px\)\{[\s\S]{0,200}\.ship-grid\{grid-template-columns:1fr/.test(PAGE), true);
// Guard the guard: a page without the media query must fail the check above.
var NOSTACK = PAGE.replace('@media(max-width:600px){', '@media(min-width:99999px){');
is('a page that never stacks is caught',
   /@media\(max-width:600px\)\{[\s\S]{0,200}\.ship-grid\{grid-template-columns:1fr/.test(NOSTACK), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
