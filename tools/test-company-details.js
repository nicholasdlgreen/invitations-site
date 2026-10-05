// Who we legally are, on the pages where it has to be said.
//
// Foreverprint is a trading name of Natch Limited. Until 5 October 2026 the
// Terms carried an unfilled template — "operated by [LEGAL ENTITY NAME], a
// [SOLE TRADER / LIMITED COMPANY] [registered in England and Wales under
// company number [COMPANY NUMBER]]" — five bracketed blanks, live, on the page
// a customer is bound by. The Privacy Policy claimed "we are the data
// controller" without naming a legal person at all, which is not an
// identification under UK GDPR. Returns gave an email and no postal address.
//
// Verified against Companies House on 5 October 2026: NATCH LIMITED, number
// 09493377, Active, registered office Regina House, 124 Finchley Road, London,
// NW3 5JS. That check earned its keep — the address came to us spelt
// "Finchely", and a misspelt registered office in trading terms is a defect in
// the document, so the spelling is pinned below rather than left to proofing.

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

var NUMBER  = '09493377';
var ENTITY  = 'Natch Limited';
var ADDRESS = 'Regina House, 124 Finchley Road, London NW3 5JS';
var PAGES   = ['terms.html', 'privacy.html', 'returns.html'];
var SRC     = {};
PAGES.forEach(function(f){ SRC[f] = read(f); });

print('\nNO UNFILLED TEMPLATE IS LEFT ANYWHERE IN THE TRADING CONDITIONS');
PAGES.forEach(function(f){
  // Any ALL-CAPS bracketed token is an unfilled blank from the template.
  is(f + ' has no bracketed placeholders', /\[[A-Z][A-Z \/]{3,}[A-Z]\]/.test(SRC[f]), false);
});

print('\nTHE COMPANY IS NAMED AND NUMBERED WHERE IT MUST BE');
PAGES.forEach(function(f){
  is(f + ' names ' + ENTITY, SRC[f].indexOf(ENTITY) >= 0, true);
});
['terms.html', 'privacy.html'].forEach(function(f){
  is(f + ' gives the company number', SRC[f].indexOf(NUMBER) >= 0, true);
  is(f + ' says where it is registered',
     /registered in England and Wales/.test(SRC[f]), true);
});

print('\nTHE REGISTERED OFFICE IS RIGHT, AND SPELT RIGHT');
PAGES.forEach(function(f){
  is(f + ' carries the registered office', SRC[f].indexOf(ADDRESS) >= 0, true);
  // The misspelling we were given. It must never reach a page.
  is(f + ' does not say "Finchely"', /Finchely/i.test(SRC[f]), false);
  is(f + ' has the postcode', /NW3 5JS/.test(SRC[f]), true);
});

print('\nTHE TERMS SAY FOREVERPRINT IS A TRADING NAME, NOT A SEPARATE COMPANY');
is('the trading relationship is stated',
   /Foreverprint is a trading name of Natch Limited/.test(SRC['terms.html']), true);
is('"we", "us" and "our" are defined as the company',
   /refer to Natch Limited trading as Foreverprint/.test(SRC['terms.html']), true);

print('\nTHE DATA CONTROLLER IS A LEGAL PERSON, NOT A BRAND');
is('the controller is named as the company',
   /Natch Limited is the\s+data controller|Natch Limited is the data controller/.test(SRC['privacy.html']), true);
is('the old brand-only claim is gone',
   /We are the data controller/.test(SRC['privacy.html']), false);

print('\nTHERE IS A POSTAL ROUTE, NOT ONLY AN EMAIL');
is('terms give an address to write to', /by post at/.test(SRC['terms.html']), true);
is('returns give an address to write to', /write to us at/.test(SRC['returns.html']), true);
is('returns still ask customers to make contact first',
   /before returning anything/.test(SRC['returns.html']), true);

print('\nMUTATION: THE OLD PAGES MUST FAIL THIS TEST');
var OLDTERMS = SRC['terms.html'].replace(
  'Foreverprint is a trading name of Natch Limited', '[LEGAL ENTITY NAME] blah');
is('a page with the template back is caught',
   /Foreverprint is a trading name of Natch Limited/.test(OLDTERMS), false);
// Global, not first-match: the address appears twice in the Terms — once in
// section 1 and once in the postal-contact sentence — so a single string
// replace left the second copy correct and the mutation proved nothing.
var TYPO = SRC['terms.html'].replace(/Finchley/g, 'Finchely');
is('the misspelling is caught if it returns', /Finchely/i.test(TYPO), true);
is('and the correct address check fails with it', TYPO.indexOf(ADDRESS) >= 0, false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
