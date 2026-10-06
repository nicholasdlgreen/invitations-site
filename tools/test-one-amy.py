#!/usr/bin/env python3
"""One Amy per page, not two.
Run:  python3 tools/test-one-amy.py

Same cause as the duplicated basket: pages carried their own copy of the widget
from before footer.html existed, and build_pages.py bakes footer.html — which
has one — into the same page. 52 pages showed two launchers and two panels.

They share ids, so getElementById always bound the buttons to the first panel
and the second Amy sat inert.

Unlike the drawers, the two blocks here ARE identical once whitespace is
normalised, on every page but one. Verified before removing anything — an
earlier, cruder comparison using fixed line ranges said they differed, which
was the comparison being wrong rather than the markup.

design-studio-ai-create.html is the exception and is deliberately still
duplicated here. Its own copy is an older fork — "Amy — foreverprint" rather
than "Amy", and prompts for paper and delivery instead of order tracking and
artwork — and its JavaScript is inlined rather than loaded from help-widget.js.
Markup and script have to be removed together or the newer prompts call a
handler that cannot serve them. That is stage 4.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORK = 'design-studio-ai-create.html'
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

pages = []
for dp, dn, fns in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'scratch', 'docs',
                                        'tools', 'netlify', 'supabase')]
    for fn in sorted(fns):
        if fn.endswith('.html'):
            p = os.path.join(dp, fn)
            pages.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))
site = [(f, t) for f, t in pages if f not in ('header.html', 'footer.html')]

print('\nNO PAGE SHOWS TWO AMYS')
for ident in ('hw-btn', 'hw-panel', 'hw-contact-form'):
    dupes = [(f, n) for f, t in site if f != FORK
             for n in [len(re.findall(r'id="%s"' % ident, t))] if n > 1]
    is_('  %-16s appears at most once' % ident, dupes, [])

print('\nTHE ONE THAT REMAINS IS THE BUILD\'S')
have = [(f, t) for f, t in site if 'id="hw-btn"' in t and f != FORK]
is_('pages still have Amy', len(have) > 40)
print('       (%d pages)' % len(have))
outside = []
for f, t in have:
    for m in re.finditer(r'<button id="hw-btn"', t):
        before = t[:m.start()]
        if before.count('<!--CHROME:footer-->') <= before.count('<!--/CHROME:footer-->'):
            outside.append(f)
is_('and it sits inside the baked footer', outside, [])
footer = dict(pages)['footer.html']
is_('footer.html still supplies her', 'id="hw-btn"' in footer and 'id="hw-panel"' in footer)

print('\nSHE IS THE CURRENT AMY, NOT THE OLD FORK')
# The fork greets as "Amy — foreverprint" and offers paper/delivery prompts.
old = [f for f, t in have if 'Amy — foreverprint' in t]
is_('no page carries the old greeting', old, [])
is_('the footer offers the order-tracking prompt', 'Where is my order?' in footer)
is_('and the artwork prompt', 'Setting up my artwork' in footer)

print('\nTHE ONE PAGE HELD BACK FOR STAGE 4')
fork = dict(pages).get(FORK, '')
is_('%s still has two' % FORK, len(re.findall(r'id="hw-btn"', fork)), 2)
is_('because its script is inlined, not loaded', 'function hwToggle' in fork)
print('       (removing its markup without its script would break the prompts)')

print('\nMUTATION: A SECOND AMY COMING BACK MUST FAIL')
two = '<button id="hw-btn">?</button><button id="hw-btn">?</button>'
is_('a duplicated launcher is caught', len(re.findall(r'id="hw-btn"', two)) > 1)
is_('the old greeting would be caught',
    'Amy — foreverprint' not in '<div>Amy — foreverprint</div>', False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
