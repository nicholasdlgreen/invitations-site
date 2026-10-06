// The two buttons on the home page's gold strip behave like buttons.
//
// "Ready to begin?" carried two hand-written <a> tags with every style inline
// and no class on either. So none of the site's ten :hover rules reached them:
// measured in the browser, transition was 0s, box-shadow none, gap normal, and
// nothing at all happened on hover — on a page where every other button
// darkens or fills. They looked like buttons and behaved like text.
//
// Fixed by giving them classes rather than more inline styles. .btn-light and
// .btn-out-light live in header.html beside .btn and .btn-out, so they reach
// every page and the next button on a coloured ground inherits the behaviour
// instead of quietly not having it.
//
// The palette is inverted on purpose: the strip is gold, so .btn would be gold
// on gold and .btn-out's gold border would all but vanish.

var HDR = read('header.html');
var IDX = read('index.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

print('\nTHE BUTTONS USE CLASSES, NOT INLINE STYLE');
is('the filled one is .btn-light',
   /<a class="btn-light" href="\/upload-and-print">Upload My Design<\/a>/.test(IDX), true);
is('the outline one is .btn-out-light',
   /<a class="btn-out-light" href="\/design-studio">Open the Studio<\/a>/.test(IDX), true);
// The whole fault was styling written inline, which no :hover rule can reach.
var STRIP = IDX.slice(IDX.indexOf('<!-- CTA STRIP -->'), IDX.indexOf('</section>', IDX.indexOf('<!-- CTA STRIP -->')));
is('neither carries an inline style attribute', /<a [^>]*style="[^"]*"[^>]*>(Upload My Design|Open the Studio)/.test(STRIP), false);

print('\nTHE CLASSES EXIST WHERE EVERY PAGE CAN SEE THEM');
// header.html is injected into all pages at build time, which is why .btn is
// defined there. A class defined only on index.html would help one page.
is('.btn-light is defined in header.html',    /\.btn-light\{/.test(HDR), true);
is('.btn-out-light is defined in header.html',/\.btn-out-light\{/.test(HDR), true);
is('and they sit beside .btn and .btn-out',
   HDR.indexOf('.btn-light{') > HDR.indexOf('.btn-out:hover'), true);

print('\nTHEY RESPOND TO THE CURSOR, WHICH IS WHAT THEY DID NOT DO');
is('the filled one has a hover rule',  /\.btn-light:hover\{/.test(HDR), true);
is('the outline one has a hover rule', /\.btn-out-light:hover\{/.test(HDR), true);
is('the filled one darkens to brown on hover, as .btn does',
   /\.btn-light:hover\{background:var\(--brown\)/.test(HDR), true);
is('the outline one fills, as .btn-out does',
   /\.btn-out-light:hover\{background:#fff;color:var\(--gold\);\}/.test(HDR), true);
is('both transition rather than snapping',
   /\.btn-light\{[^}]*transition:background \.25s,color \.25s,box-shadow \.25s/.test(HDR)
   && /\.btn-out-light\{[^}]*transition:all \.25s/.test(HDR), true);

print('\nAND THEY MATCH THE REAL BUTTONS AT REST');
is('the filled one carries a resting shadow, as .btn does',
   /\.btn-light\{[^}]*box-shadow:0 4px 18px/.test(HDR), true);
is('the outline border is solid, not 60% transparent',
   /\.btn-out-light\{[^}]*border:1px solid #fff/.test(HDR), true);
is('both leave room for an icon, as .btn does',
   /\.btn-light\{[^}]*gap:8px/.test(HDR) && /\.btn-out-light\{[^}]*gap:8px/.test(HDR), true);
is('the padding matches .btn and .btn-out, border included',
   /\.btn-light\{[^}]*padding:15px 38px/.test(HDR) && /\.btn-out-light\{[^}]*padding:14px 37px/.test(HDR), true);

print('\nMUTATION: THE OLD BUTTONS MUST FAIL');
var OLD = '<a href="/upload-and-print.html" style="display:inline-flex;padding:15px 38px;background:#fff;">Upload My Design</a>';
is('an inline-styled button is caught',
   /<a [^>]*style="[^"]*"[^>]*>(Upload My Design|Open the Studio)/.test(OLD), true);
var NOHOVER = HDR.replace(/\.btn-light:hover\{[^}]*\}/, '');
is('a class with no hover rule is caught', /\.btn-light:hover\{/.test(NOHOVER), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
