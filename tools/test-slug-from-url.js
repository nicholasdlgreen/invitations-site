var BITS = readFile("/private/tmp/claude-501/-Users-nicholasgreen-Documents-GitHub-invitations-site/3b51a30d-10a2-4338-ac24-3c08757aec53/scratchpad/slugbits.js");
var results = [];
function slugFor(pathname, search) {
  var f = new Function('window', 'URLSearchParams',
    BITS.replace('const PRODUCT =', 'var PRODUCT =') + '\nreturn PRODUCT;');
  return f({ location: { pathname: pathname, search: search || '' } },
           function (qs) {
             var m = {};
             String(qs || '').replace(/^\?/, '').split('&').forEach(function (kv) {
               if (!kv) return; var p = kv.split('='); m[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
             });
             return { get: function (k) { return k in m ? m[k] : null; } };
           });
}
function check(name, pathname, search, expectSlug) {
  var got;
  try { got = slugFor(pathname, search).slug; } catch (e) { got = 'threw: ' + e.message; }
  var ok = got === expectSlug;
  results.push((ok ? 'PASS  ' : 'FAIL  ') + name + '  ' + JSON.stringify(pathname + (search||''))
               + (ok ? '' : '  expected ' + JSON.stringify(expectSlug) + ', got ' + JSON.stringify(got)));
}

check('the clean URL',            '/wedding-invitations',      '', 'wedding-invitations');
check('THE BUG: the .html twin',  '/wedding-invitations.html', '', 'wedding-invitations');
check('.HTML in capitals',        '/Wedding-Invitations.HTML', '', 'wedding-invitations');
check('a trailing slash',         '/wedding-invitations/',     '', 'wedding-invitations');
check('the query-param form',     '/upload-and-print.html',    '?product=greeting-cards', 'greeting-cards');
check('query param wins',         '/signage.html',             '?product=table-plans',    'table-plans');
check('the site root',            '/',                         '', '');
check('a nested path is refused', '/guides/how-to-choose',     '', '');
check('an asset path is refused', '/wedding-invitations-hero.jpg', '', '');
check('a css file is refused',    '/style.css',                '', '');
check('a dotted name is refused', '/foo.bar.baz',              '', '');
print(results.join("\n"));
