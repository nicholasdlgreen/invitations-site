// Which product a landing page decides it is, from the address in the bar.
//
// The parser lives in product.html, which tools/build_pages.py copies into all
// 23 landing pages, so the template is the thing to test and the generated
// pages are output. This file used to read a scratch copy out of a temp
// directory that no longer exists, which meant it could not run at all --
// and a scratch copy would not have caught a change to the real page anyway.
//
// The bug it was written for (commit 5373d4b): Netlify serves each landing
// page at BOTH /wedding-invitations and /wedding-invitations.html. The dot
// test was there to skip asset paths and it skipped our own pages too, so the
// .html address returned 200 and rendered "Product not found" on all 23,
// indexable and linkable. A trailing .html is now dropped before the dot test.
//
// Note this is NOT the parser in upload-and-print.html, which is deliberately
// different: it keeps the dot test undropped (stripping .html there would turn
// that page's own address into a product slug) and falls back to
// wedding-invitations instead of to nothing.

var TEMPLATE = 'product.html';
var BUILT    = 'wedding-invitations.html';

var passed = 0, failed = 0;

function extract(file) {
  var src = readFile(file);
  var start = src.indexOf('const PRODUCT = (function() {');
  if (start < 0) return null;
  var end = src.indexOf('\n})();', start);
  if (end < 0) return null;
  return src.slice(start, end + '\n})();'.length);
}

// Run the real parser with a fake window, exactly as the browser would.
function slugFor(bits, pathname, search) {
  var f = new Function('window', 'URLSearchParams',
    bits.replace('const PRODUCT =', 'var PRODUCT =') + '\nreturn PRODUCT;');
  return f({ location: { pathname: pathname, search: search || '' } },
           function (qs) {
             var m = {};
             String(qs || '').replace(/^\?/, '').split('&').forEach(function (kv) {
               if (!kv) return;
               var p = kv.split('=');
               m[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
             });
             return { get: function (k) { return k in m ? m[k] : null; } };
           });
}

function ok(name, cond) {
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
  return cond;
}

// Every case, as one list, so the mutation run can replay them silently.
var CASES = [
  ['the clean URL',             '/wedding-invitations',          '',                        'wedding-invitations'],
  ['THE BUG: the .html twin',   '/wedding-invitations.html',     '',                        'wedding-invitations'],
  ['.HTML in capitals',         '/Wedding-Invitations.HTML',     '',                        'wedding-invitations'],
  ['a trailing slash',          '/wedding-invitations/',         '',                        'wedding-invitations'],
  ['the query-param form',      '/upload-and-print.html',        '?product=greeting-cards', 'greeting-cards'],
  ['query param wins',          '/signage.html',                 '?product=table-plans',    'table-plans'],
  ['the site root',             '/',                             '',                        ''],
  ['a nested path is refused',  '/guides/how-to-choose',         '',                        ''],
  ['an asset path is refused',  '/wedding-invitations-hero.jpg', '',                        ''],
  ['a css file is refused',     '/style.css',                    '',                        ''],
  ['a dotted name is refused',  '/foo.bar.baz',                  '',                        '']
];

function runCases(bits, loud) {
  var bad = 0;
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i], got;
    try { got = slugFor(bits, c[1], c[2]).slug; }
    catch (e) { got = 'threw: ' + e.message; }
    var good = got === c[3];
    if (!good) bad++;
    if (loud) {
      if (good) { passed++; print('  ok   ' + c[0] + '  ' + JSON.stringify(c[1] + c[2])); }
      else      { failed++; print('  FAIL ' + c[0] + '  ' + JSON.stringify(c[1] + c[2])
                                  + '  expected ' + JSON.stringify(c[3]) + ', got ' + JSON.stringify(got)); }
    }
  }
  return bad;
}

print('THE PARSER COMES FROM THE PAGE THAT SHIPS');
var bits = extract(TEMPLATE);
ok('product.html still has a PRODUCT block', !!bits);
if (!bits) { print('\n' + passed + ' passed, ' + (failed + 1) + ' failed'); throw new Error('no parser'); }
ok('it drops a trailing .html before the dot test', /\.html\$\/i/.test(bits));

print('\nEVERY ADDRESS A LANDING PAGE IS SERVED AT');
runCases(bits, true);

print('\nTHE BUILT PAGES CARRY THE SAME PARSER');
// build_pages.py copies the template into all 23. If the template is edited
// and the site is not rebuilt, the pages a visitor gets still hold the old one.
var built = extract(BUILT);
ok('wedding-invitations.html has the block', !!built);
ok('and it is identical to the template', built === bits);

print('\nMUTATION: THE BUG COMING BACK MUST FAIL');
// the original fault: no .html dropped, so the dot test rejects our own page
var noStrip = bits.replace(".replace(/\\.html$/i, '')", '');
ok('the undropped .html is caught', noStrip !== bits && runCases(noStrip, false) > 0);
// and the dot test itself still has to be doing its job
var noDot = bits.replace("!path.includes('.') && ", '');
ok('dropping the dot test is caught', noDot !== bits && runCases(noDot, false) > 0);
// a fallback here would hide every refusal
var withFallback = bits.replace("slug = (slug || '').toLowerCase()",
                                "slug = (slug || 'wedding-invitations').toLowerCase()");
ok('a wedding-invitations fallback is caught',
   withFallback !== bits && runCases(withFallback, false) > 0);

print('\n' + passed + ' passed, ' + failed + ' failed');
