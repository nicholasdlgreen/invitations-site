// The four pods on the home page say four things, not two.
//
// "No Minimums" and "Tracked Delivery" carried a heading and nothing under it
// until 5 October 2026, so the strip sat lopsided beside two pods that had a
// supporting line each. Nicholas asked for text that balances.
//
// Both new claims were checked against the catalogue before being written,
// because copy that outruns the catalogue is how the site ended up promising
// wax seals it does not sell:
//   - sheet_rates holds prices from quantity 1 (30 distinct quantities, 1-500),
//     so "starting at one card" is literal rather than a flourish.
//   - delivery_options has Standard at price 0.00 and surcharge 0%, by tracked
//     courier, UK only — so "free standard delivery, tracked" is true, and it
//     is the strongest fact on the strip.

var SRC = read('index.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Just the strip, so a phrase elsewhere on a long home page cannot satisfy it.
var STRIP = (function () {
  var a = SRC.indexOf('<!-- QUALITY STRIP -->');
  return SRC.slice(a, SRC.indexOf('<!-- WHY US -->', a));
})();

var PODS = [
  ['Premium Papers',   'Smooth silk, soft uncoated, and textured Fedrigoni papers'],
  ['Checked by Hand',  'Every order reviewed before it goes to print'],
  ['No Minimums',      'Order exactly what you need, starting at one card'],
  ['Tracked Delivery', 'Free standard delivery, tracked from our door to yours']
];

print('\nALL FOUR PODS HAVE A HEADING AND A LINE');
is('the strip was found', STRIP.length > 500, true);
PODS.forEach(function (p) {
  is('"' + p[0] + '" is there',       STRIP.indexOf('>' + p[0] + '<') >= 0, true);
  is('  and says: ' + p[1],           STRIP.indexOf('>' + p[1] + '<') >= 0, true);
});
is('there are exactly four pods',
   (STRIP.match(/border-radius:20px;text-align:center;/g) || []).length, 4);
// A heading immediately followed by the closing div is a pod with no line —
// which is exactly what the two new ones were.
is('no pod is left with a heading and nothing under it',
   /margin-bottom:8px;">[^<]*<\/div>\s*<\/div>/.test(STRIP), false);

print('\nTHE FOUR LINES BALANCE');
var lens = PODS.map(function (p) { return p[1].length; });
is('the shortest is 44 characters', Math.min.apply(null, lens), 44);
is('the longest is 57',             Math.max.apply(null, lens), 57);
// The two written today must sit INSIDE the range the existing two set, or
// they read as a different length of thought.
is('the new lines sit inside that range',
   lens[2] >= lens[1] && lens[2] <= lens[0] && lens[3] >= lens[1] && lens[3] <= lens[0], true);
is('every line is 8 or 9 words',
   PODS.every(function (p) { var w = p[1].split(' ').length; return w === 8 || w === 9; }), true);
is('no line ends in a full stop',
   PODS.every(function (p) { return p[1].slice(-1) !== '.'; }), true);

print('\nTHE CLAIMS ARE ONES THE CATALOGUE CAN BACK');
is('we do not claim a minimum we do not have', /minimum order of|minimum of \d/.test(STRIP), false);
is('free delivery is named as STANDARD, not as all delivery',
   /Free standard delivery/.test(STRIP), true);
is('and we do not say free delivery unqualified',
   /Free delivery(?! ,)/.test(STRIP.replace('Free standard delivery', '')), false);

print('\nMUTATION: THE OLD STRIP MUST FAIL');
var OLD = STRIP.replace('<div style="font-size:var(--text-sm);color:rgba(255,255,255,.4);line-height:1.7;">Order exactly what you need, starting at one card</div>\n', '');
is('a pod with no line is caught',
   /margin-bottom:8px;">No Minimums<\/div>\s*<\/div>/.test(OLD), true);
is('and the line it should have is gone',
   OLD.indexOf('starting at one card') >= 0, false);

print('\nTHE STRIP WORKS ON A PHONE');
// The columns MUST NOT be inline. An inline style beats a media query, so a
// stacked layout written inline looks right in the source and silently never
// applies — the trap this page shared with delivery.html.
is('the grid carries a class', /<div class="quality-grid">/.test(STRIP), true);
is('its columns are NOT set inline',
   /<div class="quality-grid"[^>]*style="[^"]*grid-template-columns/.test(STRIP), false);
is('four columns are declared in CSS',
   /\.quality-grid\{display:grid;grid-template-columns:repeat\(4,1fr\)/.test(SRC), true);
is('two columns on a tablet',
   /@media\(max-width:768px\)\{\.quality-grid\{grid-template-columns:1fr 1fr;\}\}/.test(SRC), true);
is('one column on a phone',
   /@media\(max-width:480px\)\{\.quality-grid\{grid-template-columns:1fr;\}/.test(SRC), true);
is('and the padding comes in with it, so four stacked pods are not needlessly tall',
   /\.quality-grid > div\{padding:26px 24px;\}/.test(SRC), true);
// Breakpoints match .occasions-grid, so the page keeps one set of them.
is('the breakpoints match the grid above it',
   /@media\(max-width:768px\)\{\.occasions-grid/.test(SRC)
   && /@media\(max-width:480px\)\{\.occasions-grid/.test(SRC), true);

print('\nMUTATION: AN INLINE GRID MUST FAIL');
var INLINE = STRIP.replace('<div class="quality-grid">',
  '<div class="quality-grid" style="grid-template-columns:repeat(4,1fr)">');
is('columns put back inline are caught',
   /<div class="quality-grid"[^>]*style="[^"]*grid-template-columns/.test(INLINE), true);
var NOSTACK = SRC.replace('@media(max-width:480px){.quality-grid{grid-template-columns:1fr;}', '@media(min-width:99999px){.quality-grid{grid-template-columns:1fr;}');
is('a strip that never stacks is caught',
   /@media\(max-width:480px\)\{\.quality-grid\{grid-template-columns:1fr;\}/.test(NOSTACK), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
