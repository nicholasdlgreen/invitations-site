// The four occasion cards go where they say they go.
//
// Until 5 October 2026 all four — Weddings, New Arrivals, Milestone Birthdays,
// Celebrations & Parties — pointed at /design-studio.html. Four cards
// describing four different things, all doing the same thing: someone clicking
// "Milestone Birthdays" expecting birthday cards landed on a blank design tool
// asking them to describe a look.
//
// They now go to their category on the products page. ?cat= is the site-wide
// convention already — the mega-menu on every page uses the same three values.

var SRC = read('index.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

var BLOCK = (function () {
  var a = SRC.indexOf('<!-- OCCASIONS -->');
  return SRC.slice(a, SRC.indexOf('<!-- QUALITY STRIP -->', a));
})();

// Each card is found by the words ON it, so a link cannot be checked against
// the wrong card if the order ever changes.
function hrefOfCardTitled(title) {
  var i = BLOCK.indexOf('>' + title + '<');
  if (i < 0) return null;
  var j = BLOCK.lastIndexOf('<a class="occasion-card', i);
  if (j < 0) return null;
  var m = BLOCK.slice(j, BLOCK.indexOf('>', j)).match(/href="([^"]*)"/);
  return m ? m[1] : null;
}

print('\nEACH CARD GOES TO ITS OWN CATEGORY');
[['Weddings',                  '/products.html?cat=weddings'],
 ['New Arrivals',              '/products.html?cat=announcements'],
 ['Milestone Birthdays',       '/products.html?cat=celebrations'],
 ['Celebrations &amp; Parties','/products.html?cat=celebrations']
].forEach(function (p) {
  is(p[0].replace('&amp;','&') + ' -> ' + p[1], hrefOfCardTitled(p[0]), p[1]);
});

print('\nNONE OF THEM GOES TO THE DESIGN STUDIO ANY MORE');
is('no occasion card points at the studio', /occasion-card[^>]*href="\/design-studio/.test(BLOCK), false);
is('there are still four cards', (BLOCK.match(/<a class="occasion-card/g) || []).length, 4);

print('\nTHE CATEGORIES ARE THE ONES THE SITE ALREADY USES');
// Three values, matching product_types.category and the mega-menu. A fourth
// would mean a category with one product in it; Nicholas chose to keep three.
['weddings','celebrations','announcements'].forEach(function (c) {
  is('"' + c + '" is a category the mega-menu also links to',
     new RegExp('products\\.html\\?cat=' + c).test(SRC), true);
});
is('no card invents a category that does not exist',
   /cat=(birthdays|parties|milestones|new-arrivals)/.test(BLOCK), false);

print('\nTWO CARDS SHARING A DESTINATION IS DELIBERATE, AND SAID SO');
var hrefs = ['Weddings','New Arrivals','Milestone Birthdays','Celebrations &amp; Parties']
              .map(hrefOfCardTitled);
is('three distinct destinations across four cards',
   (function(){ var s = {}; hrefs.forEach(function(h){ s[h] = 1; }); return Object.keys(s).length; })(), 3);
is('and a note records why rather than leaving it looking like a slip',
   /share \?cat=celebrations\s*\n?\s*DELIBERATELY/.test(SRC), true);

print('\nMUTATION: THE OLD LINKS MUST FAIL');
var OLD = BLOCK.replace(/href="\/products\.html\?cat=[a-z]+"/g, 'href="/design-studio.html"');
is('all four pointing at the studio is caught',
   /occasion-card[^>]*href="\/design-studio/.test(OLD), true);
is('and the weddings link is gone with it',
   /cat=weddings/.test(OLD), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
