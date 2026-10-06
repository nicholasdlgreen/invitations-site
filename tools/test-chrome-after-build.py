#!/usr/bin/env python3
"""After the build runs, every page has exactly one of each shared component.
Run:  python3 tools/test-chrome-after-build.py

The other three tests read the repo. This one reads what a visitor gets, which
is not the same thing: build_pages.py bakes header.html and footer.html into
every page, so a page can look right in source and be wrong once deployed.

That is exactly how the duplication arose. Pages carried their own basket
drawer and Amy from before the shared files existed; the build then added the
shared copies alongside them. 51 pages ended up with two drawers, 52 with two
Amys, and delivery.html with three drawers. Because the copies share ids,
getElementById always returned the first and the rest sat inert — invisible,
which is why it survived.

This simulates inline_chrome() in memory rather than running the real build,
which writes to the repo. The swap patterns are copied from build_pages.py and
asserted to still match it, so if the build changes shape this test says so
instead of quietly testing something that no longer happens.

It checks for absence as well as duplication. swap()'s third pattern matches
any <header> or <footer> ELEMENT, not just a placeholder, so a page with its
own <footer> gets the shared one dropped in its place — and a page with
neither a placeholder nor an element gets no chrome at all.
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

build = io.open(os.path.join(ROOT, 'tools/build_pages.py'), encoding='utf-8').read()
header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read().strip()
footer = io.open(os.path.join(ROOT, 'footer.html'), encoding='utf-8').read().strip()

# Copied from inline_chrome(). Asserted below to still be what the build uses.
def swap(kind, markup, page):
    wrapped = "<!--CHROME:%s-->%s<!--/CHROME:%s-->" % (kind, markup, kind)
    patterns = [
        r'<(?:div|%s)\s+id="site-%s"[^>]*>\s*</(?:div|%s)>' % (kind, kind, kind),
        r'<!--CHROME:%s-->.*?<!--/CHROME:%s-->' % (kind, kind),
        r'<%s\b[^>]*>.*?</%s>' % (kind, kind),
    ]
    for pat in patterns:
        new, n = re.subn(pat, lambda m: wrapped, page, count=1, flags=re.S)
        if n: return new
    return page

print('\nTHIS TEST IS STILL SIMULATING THE REAL BUILD')
is_('inline_chrome exists', 'def inline_chrome' in build)
is_('it wraps what it inserts in CHROME markers', '<!--CHROME:{kind}-->' in build)
for frag in (r'id="site-%s"', r'<!--CHROME:%s-->.*?<!--/CHROME:%s-->', r'<%s\b[^>]*>.*?</%s>'):
    is_('  build still uses pattern %s' % frag[:22], frag in build)
SKIP = set(re.findall(r'CHROME_SKIP = \{([^}]*)\}', build)[0].replace('"', '').replace(' ', '').split(','))
is_('CHROME_SKIP read from the build', len(SKIP) >= 2)
print('       (skipped: %s)' % ', '.join(sorted(SKIP)))

# Two pages legitimately receive no chrome:
#   googlecd0e00ef0ed17096.html is a 53-byte Google Search Console verification
#     file, not a page. Adding a header to it would break the verification.
#   design-studio-tweak.html is a full-screen editing step reached from the
#     studio. It has no header, footer, basket or Amy. That may be deliberate
#     — an immersive editor — or it may be a gap, since it sits inside the
#     buying flow. Flagged for Nicholas on 6 October rather than decided here.
NO_CHROME = {'googlecd0e00ef0ed17096.html', 'design-studio-tweak.html'}

pages = []
for fn in sorted(os.listdir(ROOT)):
    if fn.endswith('.html') and fn not in SKIP and fn not in NO_CHROME:
        pages.append((fn, io.open(os.path.join(ROOT, fn), encoding='utf-8', errors='ignore').read()))
gdir = os.path.join(ROOT, 'guides')
if os.path.isdir(gdir):
    for fn in sorted(os.listdir(gdir)):
        if fn.endswith('.html'):
            pages.append(('guides/' + fn, io.open(os.path.join(gdir, fn), encoding='utf-8', errors='ignore').read()))

built = [(f, swap('footer', footer, swap('header', header, t))) for f, t in pages]
print('       (%d pages simulated)' % len(built))

print('\nEXACTLY ONE OF EACH, ONCE THE BUILD HAS RUN')
for ident in ('cartDrawer', 'cartBg', 'toast', 'hw-btn', 'hw-panel', 'hw-contact-form'):
    counts = {f: len(re.findall(r'id="%s"' % ident, t)) for f, t in built}
    too_many = {f: n for f, n in counts.items() if n > 1}
    none_at_all = [f for f, n in counts.items() if n == 0]
    is_('  %-16s never appears twice' % ident, too_many, {})
    is_('  %-16s never missing entirely' % ident, none_at_all, [])

print('\nTHE CHROME ACTUALLY LANDS ON EVERY PAGE')
no_header = [f for f, t in built if '<!--CHROME:header-->' not in t]
no_footer = [f for f, t in built if '<!--CHROME:footer-->' not in t]
is_('every page receives the header', no_header, [])
is_('every page receives the footer', no_footer, [])

print('\nTHE TWO PAGES DELIBERATELY WITHOUT CHROME')
for fn in sorted(NO_CHROME):
    exists = os.path.exists(os.path.join(ROOT, fn))
    is_('  %s still exists (exemption still needed)' % fn, exists)
is_('the google verification file is still just its one line',
    len(io.open(os.path.join(ROOT, 'googlecd0e00ef0ed17096.html'),
                encoding='utf-8').read().strip().splitlines()), 1)

print('\nMUTATION: EITHER FAILURE MODE MUST BE CAUGHT')
dupe = swap('footer', footer, '<div id="site-footer"></div>' + footer)
is_('a page that already had its own copy is caught',
    len(re.findall(r'id="hw-btn"', dupe)) > 1)
bare = swap('footer', footer, '<p>no placeholder, no footer element</p>')
is_('a page the build cannot reach is caught',
    '<!--CHROME:footer-->' not in bare)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
