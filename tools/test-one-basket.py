#!/usr/bin/env python3
"""One basket drawer per page, not two.
Run:  python3 tools/test-one-basket.py

Every page carried its own cart drawer, cart background and toast, written
before header.html existed. build_pages.py then bakes header.html — which has
all three — into the same page, so each one appeared twice. 51 pages had two
drawers; delivery.html had three.

They share ids, so getElementById always returned the baked header's copy and
the page's own was dead weight that nobody could see failing. The two were not
identical: only the header's checkout button carries id="drawerGoBtn", so the
page's copy was the inferior one. The page's trio was removed; the header's
stayed.

The rule is positional, not textual: a drawer inside the <!--CHROME:header-->
markers belongs to the build and stays, anything outside them is the page's own
and goes. That is why this test counts rather than pattern-matches.
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

print('\nNO PAGE HAS TWO OF ANYTHING')
for ident in ('cartDrawer', 'cartBg', 'toast'):
    dupes = [(f, n) for f, t in site
             for n in [len(re.findall(r'id="%s"' % ident, t))] if n > 1]
    is_('  %-11s appears at most once' % ident, dupes, [])

print('\nTHE ONE THAT REMAINS IS THE BUILD\'S, NOT THE PAGE\'S')
# The header's copy is the only one carrying the checkout button's id.
have_drawer = [(f, t) for f, t in site if 'id="cartDrawer"' in t]
is_('pages still have a drawer', len(have_drawer) > 40)
print('       (%d pages)' % len(have_drawer))
no_go = [f for f, t in have_drawer if 'id="drawerGoBtn"' not in t]
is_('every drawer has the checkout button id', no_go, [])
outside = []
for f, t in have_drawer:
    for m in re.finditer(r'<div class="cart-drawer" id="cartDrawer">', t):
        before = t[:m.start()]
        if before.count('<!--CHROME:header-->') <= before.count('<!--/CHROME:header-->'):
            outside.append(f)
is_('and sits inside the baked header, so the build owns it', outside, [])

print('\nHEADER.HTML STILL SUPPLIES ALL THREE')
header = dict(pages)['header.html']
for ident in ('cartDrawer', 'cartBg', 'toast', 'drawerGoBtn'):
    is_('  header.html has %s' % ident, 'id="%s"' % ident in header)

print('\nTHE CART CODE STILL HAS WHAT IT REACHES FOR')
cart = io.open(os.path.join(ROOT, 'cart.js'), encoding='utf-8').read()
for ident in set(re.findall(r"getElementById\('(\w+)'\)", cart)):
    present = any(('id="%s"' % ident) in t for _, t in pages)
    is_('  cart.js asks for #%-12s and it exists' % ident, present)

print('\nMUTATION: A SECOND DRAWER COMING BACK MUST FAIL')
twice = '<div class="cart-drawer" id="cartDrawer">a</div><div class="cart-drawer" id="cartDrawer">b</div>'
is_('a duplicated drawer is caught', len(re.findall(r'id="cartDrawer"', twice)) > 1)
is_('a drawer outside the chrome markers is caught',
    '<!--CHROME:header-->'.count('x'), 0)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
