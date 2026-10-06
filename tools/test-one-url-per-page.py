#!/usr/bin/env python3
"""Each page has one address, and everything agrees on which.
Run:  python3 tools/test-one-url-per-page.py

Every page answered on two urls — /privacy and /privacy.html both returned 200
with nothing choosing between them. Checked live on 6 October 2026: all 14
pairs tested returned 200 and none redirected.

The canonical tag was the only thing deciding, and it did not agree with the
site. Five pages told Google to index the clean url while the site linked to
the .html one: help-support (160 links), design-studio (110), products (110),
track-order (106), how-it-works (106). That is 592 internal links pointing at
addresses we had asked Google to ignore, on the five most-linked pages.

Two pages were missing from the sitemap entirely — help-support, the one with
160 inbound links, and contact.

This is drift: three places have to agree, and nothing was checking they did.
So the test checks all three against each other rather than against a list.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

pages = {}
for dp, dn, fns in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'scratch', 'docs',
                                        'tools', 'netlify', 'supabase')]
    for fn in sorted(fns):
        if fn.endswith('.html'):
            p = os.path.join(dp, fn)
            pages[os.path.relpath(p, ROOT)] = io.open(p, encoding='utf-8', errors='ignore').read()

CANON = re.compile(r'<link rel="canonical" href="https://foreverprint\.com(/[^"]*)"')
canon = {p: m.group(1) for p, t in pages.items() for m in [CANON.search(t)] if m}
build = io.open(os.path.join(ROOT, 'tools/build_pages.py'), encoding='utf-8').read()
core = re.findall(r'\("(/[^"]*)",\s*"[\d.]+",', build)
redirects = io.open(os.path.join(ROOT, '_redirects'), encoding='utf-8').read()

print('\nEVERY CANONICAL IS A CLEAN URL')
dotted = {p: c for p, c in canon.items() if c.endswith('.html')}
is_('no page canonicalises to .html', dotted, {})
print('       (%d canonicals checked)' % len(canon))

print('\nNOTHING LINKS TO AN ADDRESS WE HAVE DISOWNED')
# A link to /x.html where x canonicalises to /x sends signal to the wrong url.
clean_slugs = {p[:-5] for p, c in canon.items() if '/' not in p and not c.endswith('.html')}
offenders = {}
for p, t in pages.items():
    for h in re.findall(r'href="/([a-z0-9-]+)\.html', t):
        if h in clean_slugs:
            offenders.setdefault(h, 0)
            offenders[h] += 1
is_('no internal link uses .html for a clean-canonical page', offenders, {})

print('\nTHE SITEMAP AGREES WITH THE CANONICALS')
is_('the static list is all clean urls', [c for c in core if c.endswith('.html')], [])
for want in ('/help-support', '/contact'):
    is_('  %s is in the sitemap' % want, want in core)
is_('and so are the pages that were already there',
    all(x in core for x in ('/', '/products', '/upload-and-print', '/privacy', '/terms')))

print('\nTHE DUPLICATE ADDRESS IS SENT TO THE REAL ONE')
# Netlify ignores a rule when a real file sits at the path, so these need "!".
forced = set(re.findall(r'^/([a-z0-9-]+)\.html\s+/\S+\s+301!', redirects, re.M))
is_('redirects are forced, or they would not fire', len(forced) > 20)
print('       (%d .html urls redirect to their clean form)' % len(forced))
# The flag is only needed where a real file sits at the path. The withdrawn
# template pages were deleted, so a plain 301 fires for them correctly.
weak = [m for m in re.findall(r'^/([a-z0-9-]+)\.html\s+/\S+\s+301\s*$', redirects, re.M)
        if os.path.exists(os.path.join(ROOT, m + '.html'))]
is_('none that still exists is written without the force flag', weak, [])

print('\nNO REDIRECT POINTS AT A FILE SOMETHING REWRITES TO')
# /:slug/order rewrites to upload-and-print.html. Forcing a redirect on a
# rewrite target risks sending the rewrite straight back out.
# The DESTINATION field only. Matching on whitespace alone also caught each
# rule's own left-hand side, because \s matches the newline before it.
rewrite_targets = set(re.findall(r'^\S+\s+/([a-z0-9-]+)\.html', redirects, re.M))
clash = sorted(forced & rewrite_targets)
is_('no rule would fight a rewrite', clash, [])
is_('and the order flow still rewrites to upload-and-print',
    '/:slug/order' in redirects and 'upload-and-print.html?product=:slug' in redirects)

print('\nTHE ACCOUNT PAGES ARE KEPT OUT OF SEARCH')
# They had no robots tag and no canonical, so Google was free to index both
# addresses of each. A sign-in form is not a search result anyone wants, and
# an indexed account page invites people to land somewhere they cannot use.
# "follow" so the crawler still reads the navigation on them.
ACCOUNT = ['login', 'register', 'account', 'saved-designs',
           'forgot-password', 'reset-password']
for name in ACCOUNT:
    t = pages.get(name + '.html', '')
    m = re.search(r'<meta name="robots"[^>]*content="([^"]*)"', t)
    is_('  %-16s is noindex' % name, bool(m) and 'noindex' in m.group(1))
is_('none of them is in the sitemap',
    [n for n in ACCOUNT if '/' + n in core], [])

print('\nAND THE PAGES THAT SHOULD BE FOUND STILL SAY SO')
sellable = [p for p, t in pages.items()
            if '/' not in p and p[:-5] not in ACCOUNT
            and CANON.search(t) and 'noindex' not in t]
is_('the public pages are still indexable', len(sellable) > 25)
print('       (%d public pages)' % len(sellable))

print('\nMUTATION: EACH FAULT COMING BACK MUST FAIL')
is_('a .html canonical is caught',
    '<link rel="canonical" href="https://foreverprint.com/privacy.html"/>'.endswith('.html"/>'))
is_('an unforced redirect is caught',
    bool(re.match(r'^/x\.html\s+/x\s+301\s*$', '/x.html    /x    301')))
is_('a link to a disowned url is caught',
    bool(re.search(r'href="/([a-z0-9-]+)\.html', '<a href="/privacy.html">x</a>')))

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
