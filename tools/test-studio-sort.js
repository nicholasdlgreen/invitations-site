// The Design Studio opens in A-Z.
//
// It opened in "Featured", which was not a curated order at all. The fetch
// sorts by display_order with no tiebreak, and 20 of the 22 products share
// display_order 0 — so those 20 come back in whatever order the database
// yields, which is arbitrary and not guaranteed stable between requests.
//
// Worse, the sort is ascending and the only two products carrying a deliberate
// order are Wedding Invitations (1) and Save the Date (2). So the two meant to
// lead were pushed to positions 21 and 22 of 22. Measured in the browser, not
// inferred: under Featured the page opened Welcome Signs, Table Plan, New
// Arrival Cards, and ended Wedding Invitations, Save the Date.
//
// A-Z is at least predictable. Featured is kept, one tap away, because fixing
// it means setting real display_order values in admin — a decision about the
// range, not a change to this page.

var SRC = read('design-studio.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

var BAR = SRC.slice(SRC.indexOf('<div class="studio-sort"'),
                    SRC.indexOf('</div>', SRC.indexOf('<div class="studio-sort"')) + 6);

print('\nA-Z COMES FIRST AND IS THE ONE SELECTED');
is('A-Z is the first button', BAR.indexOf('id="sort-az"') < BAR.indexOf('id="sort-featured"'), true);
is('A-Z is pressed in the markup',
   /id="sort-az" aria-pressed="true"/.test(BAR), true);
is('Featured is not pressed',
   /id="sort-featured" aria-pressed="false"/.test(BAR), true);
is('the page opens in that mode', /var sortMode = 'az';/.test(SRC), true);
// The markup and the variable have to agree, or the pill lies about the list
// underneath it until the first click.
is('markup and code agree on the opening order',
   /id="sort-az" aria-pressed="true"/.test(BAR) && /var sortMode = 'az';/.test(SRC), true);

print('\nFEATURED IS KEPT, AND STILL WORKS');
is('the Featured button is still there', /id="sort-featured"/.test(BAR), true);
is('both modes are still handled',
   /\[\[btnFeatured, 'featured'\], \[btnAz, 'az'\]\]/.test(SRC), true);
// The handler binds by id, so reordering the markup cannot mis-wire it.
is('the buttons are bound by id, not by position',
   /getElementById\('sort-featured'\)/.test(SRC) && /getElementById\('sort-az'\)/.test(SRC), true);
is('aria-pressed is rewritten from the mode on every click',
   /btnAz\.setAttribute\('aria-pressed', String\(sortMode === 'az'\)\)/.test(SRC), true);
is('the bar still hides itself with only one product', /list\.length > 1/.test(SRC), true);

print('\nWHY, RECORDED WHERE THE NEXT PERSON WILL LOOK');
is('the comment says Featured is not curated', /not currently a curated order/.test(SRC), true);
is('and that the flagships are pushed to the end', /pushed to the END/.test(SRC), true);

print('\nMUTATION: THE OLD DEFAULT MUST FAIL');
var OLD = SRC.replace("var sortMode = 'az';", "var sortMode = 'featured';");
is('opening on Featured is caught', /var sortMode = 'az';/.test(OLD), false);
var SWAPPED = BAR.replace('id="sort-az" aria-pressed="true"', 'id="sort-featured" aria-pressed="true"');
is('a pressed Featured button is caught',
   /id="sort-az" aria-pressed="true"/.test(SWAPPED), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
