// Does a delivery upgrade pay for itself? The whole money flow, end to end.
//
// Written 3 October 2026 to answer one question: our delivery charge follows
// PrintedEasy's formula, but applied to OUR prices, not theirs. Is that the
// same financial model as the rest of the site — their list less 20% — or does
// it quietly differ?
//
// Two things make this harder than it looks.
//
// 1. VAT. Our cart totals are VAT-INCLUSIVE (upload-and-print.html builds
//    subtotalEx by dividing by 1.2), so the percentage is taken on a
//    VAT-inclusive base AND the resulting charge is itself VAT-inclusive.
//    Those two cancel exactly, and the net is 20% of our ex-VAT price. It is
//    worth proving rather than believing, because a single-sided mistake here
//    is a 20% error in either direction.
//
// 2. The base. PrintedEasy bill their percentage on their LIST price, not on
//    what we pay. We buy at list less 20% but the delivery surcharge gets no
//    discount, so the 20% does not flow through the way it does on goods.

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function near(label, got, want, tol){
  var ok = Math.abs(got - want) <= (tol || 0.005);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + '  ' + got.toFixed(2)
        + (ok ? '' : '   want ' + want.toFixed(2)));
}

var VAT = 1.2;
// The shipped rule, copied from upload-and-print.html deliveryPriceFor.
function ourCharge(pct, min, orderValueIncVat){
  return Math.max(Math.ceil(orderValueIncVat * (pct / 100)), min);
}
// PrintedEasy's rule, confirmed against a real order of theirs.
function theirCharge(pct, min, listExVat){
  return Math.max(Math.ceil(listExVat * pct / 100), min);
}

print('\nVAT CANCELS: OUR NET DELIVERY REVENUE IS 20% OF OUR EX-VAT PRICE');
// The charge is computed on an inc-VAT base and is itself inc-VAT, so the net
// of VAT must come back to the plain percentage of the ex-VAT price.
[100, 188.80, 236, 500, 1000].forEach(function(sellEx){
  var incBase = sellEx * VAT;
  var chargeInc = ourCharge(20, 20, incBase);
  var chargeNet = chargeInc / VAT;
  var plain = Math.max(sellEx * 0.20, 20 / VAT);
  near('net on ex-VAT sell ' + sellEx.toFixed(2) + ' is ~20% of it', chargeNet, plain, 0.85);
});

print('\nTHE WORKED EXAMPLE: THE GBP 236 ORDER WE MEASURED AT PRINTEDEASY');
var LIST = 236.00;            // their list, ex VAT
var COST = LIST * 0.8;        // our cost, ex VAT — the site-wide model
near('our cost is list less 20%', COST, 188.80);
var theyBill = theirCharge(20, 20, LIST);
is('they bill us for Express', theyBill, 48);

// At zero margin, which is where the site is today.
var sellEx0  = COST;
var weChargeInc0 = ourCharge(20, 20, sellEx0 * VAT);
var weKeep0 = weChargeInc0 / VAT;
near('at zero margin we show the customer (inc VAT)', weChargeInc0, 46);
near('of which we keep, net of VAT', weKeep0, 38.33, 0.01);
near('and we pay PrintedEasy', theyBill, 48);
near('so we are short by', theyBill - weKeep0, 9.67, 0.01);

print('\nIS THAT THE SAME MODEL AS THE REST OF THE SITE?');
// Nicholas's description: "all you have done is reduce any charge we incur
// from them by 20%". Test it directly — their charge less 20%, against what we
// actually keep. Multiplication commutes, so 0.8 x (20% of list) and
// 20% of (0.8 x list) are the same number; only rounding separates them.
var theirChargeLess20 = theyBill * 0.8;
near('their charge less 20%', theirChargeLess20, 38.40);
near('what we actually keep', weKeep0, 38.33, 0.01);
is('the two agree to within the rounding', Math.abs(theirChargeLess20 - weKeep0) < 0.10, true);
// Prove it is algebraic, not a coincidence of this one order.
var drifts = [];
[50, 120, 236, 480, 900, 1800].forEach(function(list){
  var keep = ourCharge(20, 20, (list * 0.8) * VAT) / VAT;
  var less20 = theirCharge(20, 20, list) * 0.8;
  drifts.push(Math.abs(keep - less20));
});
is('it holds across six order sizes, to the pound',
   drifts.every(function(d){ return d < 1.0; }), true);

print('\nBUT GOODS BREAK EVEN AT ZERO MARGIN AND DELIVERY DOES NOT');
// On goods we pass their 20% discount to the customer and break even.
// On delivery we pass it on too — but they never gave it to us.
near('goods: we sell at cost, so we break even', sellEx0 - COST, 0);
near('delivery: we are short by 20% of what they charge us',
     theyBill - weKeep0, theyBill * 0.20, 0.10);
is('that shortfall is 4% of their list', Math.round((theyBill - weKeep0) / LIST * 1000) / 10, 4.1);

print('\nTHE SHORTFALL CLOSES AS MARGIN RISES, AND REVERSES AT 25%');
var rows = [];
[0, 10, 20, 25, 30, 50, 100].forEach(function(markup){
  var sellEx = COST * (1 + markup / 100);
  var keep = ourCharge(20, 20, sellEx * VAT) / VAT;
  rows.push({ markup: markup, keep: keep, net: keep - theyBill });
  print('  markup ' + String(markup + '%').padStart(5)
        + '  we keep ' + keep.toFixed(2).padStart(7)
        + '  we pay ' + theyBill.toFixed(2).padStart(7)
        + '  net ' + (keep - theyBill).toFixed(2).padStart(7));
});
is('at zero margin delivery loses money', rows[0].net < 0, true);
is('at a 25% markup it is within a pound of break-even',
   Math.abs(rows[3].net) < 1.0, true);
is('at a 50% markup it contributes', rows[5].net > 0, true);
// The crossover is where our sell price equals their list price.
near('break-even sell price equals their list', COST * 1.25, LIST);

print('\nTHE MINIMUM IS THE WORST CASE, BECAUSE THEIRS IS EX-VAT AND OURS IS NOT');
var smallSellEx = 60;
var keepMin = ourCharge(20, 20, smallSellEx * VAT) / VAT;
near('on a small order we keep, net of VAT', keepMin, 16.67, 0.01);
near('they still charge their GBP 20 minimum', theirCharge(20, 20, smallSellEx / 0.8), 20);
near('so the minimum loses', 20 - keepMin, 3.33, 0.01);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
