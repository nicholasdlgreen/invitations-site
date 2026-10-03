// Which way a card opens, and whether the basket says so.
//
// Four products — greeting, thank you, engagement and graduation cards — are
// folded cards. Their own copy says so: "a folded card, creased by us, with a
// page inside for your own message". They are printed as folded and charged as
// folded. But they carried the fold tag 'flat', because that tag keys the
// RATES and their only routes were the folded families. Nothing could be bought
// flat, so a thank you card cost the same as a folded wedding invitation —
// GBP 44.80 against GBP 23.20 for 100 A5 Silk 300gsm.
//
// Giving them a flat route fixes the price but creates a trap: the opening fold
// was hardcoded 'flat', so the moment they gained a flat route they would have
// OPENED flat, contradicting their own description and halving the thing on
// show. The opening fold now comes from the product's first route instead.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

print('\nA PRODUCT OPENS THE WAY IT IS NORMALLY SOLD');
is('the opening fold is taken from the first route',
   /currentProduct\.routes\[0\][\s\S]{0,180}selectedFold = currentProduct\.routes\[0\]\.fold === 'folded' \? 'folded' : 'flat'/.test(SRC), true);
is('it is guarded against a product with no routes',
   /Array\.isArray\(currentProduct\.routes\) && currentProduct\.routes\[0\]/.test(SRC), true);
is('anything other than folded still opens flat',
   /=== 'folded' \? 'folded' : 'flat'/.test(SRC), true);
// the declaration stays 'flat' so a product with no payload at all is unchanged
is("the default before any payload is still flat", /let selectedFold='flat';/.test(SRC), true);

// Replaying the rule, so this is not only a shape check.
function openingFold(routes){
  var selectedFold = 'flat';
  var currentProduct = { routes: routes };
  if (currentProduct && Array.isArray(currentProduct.routes) && currentProduct.routes[0]
      && currentProduct.routes[0].fold) {
    selectedFold = currentProduct.routes[0].fold === 'folded' ? 'folded' : 'flat';
  }
  return selectedFold;
}
print('\nTHE RULE ITSELF');
is('flat first opens flat (every product that offers the choice)',
   openingFold([{fold:'flat',family:'flat-card'},{fold:'folded',family:'folded-card'}]), 'flat');
is('folded first opens folded (the four folded cards)',
   openingFold([{fold:'folded',family:'folded-leaflet'},{fold:'folded',family:'folded-card'},
                {fold:'flat',family:'flat-card'}]), 'folded');
is('no routes at all opens flat', openingFold([]), 'flat');
is('a route with no fold opens flat', openingFold([{family:'flat-card'}]), 'flat');
is('a board opens flat', openingFold([{fold:'flat',family:'display-board'}]), 'flat');

print('\nTHE BASKET SAYS WHAT THE STEP SUMMARY SAYS');
// A folded-only product carries the tag 'flat', so reading the tag made the
// basket drop "Folded ·" from a card the summary above had just called folded.
is('the basket label asks isFoldedPiece()',
   /let paperLabel = \(isFoldedPiece\(\) \? 'Folded · ' : ''\) \+ paper\.name;/.test(SRC), true);
is('it no longer reads the raw fold tag',
   /paperLabel = \(selectedFold === 'folded'/.test(SRC), false);
// the step summary already asked the same question; they must not drift apart
is('the step summary asks it too',
   /isFoldedPiece\(\) \? 'folded' : 'flat'/.test(SRC), true);
is('isFoldedPiece still answers for the family, not just the tag',
   /return \/folded\/i\.test\(printingFamily\(\) \|\| ''\);/.test(SRC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
