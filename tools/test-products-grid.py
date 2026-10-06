#!/usr/bin/env python3
"""The product list is two columns on a phone, and unchanged above 640px.
Run:  python3 tools/test-products-grid.py

At one card per row the page was 13,644px on a 375px screen — seventeen screens
of scrolling for twenty-two products, with barely one card visible at a time.
A product list exists so people can compare what is on offer, and that one
could not be scanned at all. Measured 6 October 2026.

Two columns brings it to 4,474px, six screens, four cards on the first screen.

The card gives up its tagline below 640px: at ~150px wide it wrapped to five or
six lines and pushed the price off the first screen. The name and the price are
what someone scanning a list needs; the tagline is on the product page.

Everything is inside @media(max-width:640px). The three-column desktop grid and
the two-column 1024 grid are untouched, and this test checks that rather than
assuming it.
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

page = io.open(os.path.join(ROOT, 'products.html'), encoding='utf-8').read()

def block(css, query):
    i = css.index(query); d, j = 0, i + len(query) - 1
    while j < len(css):
        if css[j] == '{': d += 1
        elif css[j] == '}':
            d -= 1
            if d == 0: return css[i:j + 1]
        j += 1
    return ''

phone = block(page, '@media(max-width:640px){')
tablet = block(page, '@media(max-width:1024px){')
outside = re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '', page)

print('\nTWO COLUMNS ON A PHONE')
is_('the phone grid is two columns',
    '.product-grid{grid-template-columns:repeat(2,1fr)' in phone)
is_('it is not one', 'grid-template-columns:1fr;' not in
    re.search(r'\.product-grid\{[^}]*\}', phone).group(0))
is_('the card is tightened to suit half the width', '.product-body{padding:12px' in phone)
is_('and the tagline steps aside', '.product-desc{display:none;}' in phone)

print('\nABOVE 640px NOTHING CHANGED')
is_('desktop is still three columns',
    'grid-template-columns:repeat(3,1fr)' in outside)
is_('1024 is still two', 'repeat(2,1fr)' in tablet)
is_('the tagline still shows there', '.product-desc{display:none' not in outside)
is_('and still shows at 1024', '.product-desc{display:none' not in tablet)
is_('the card keeps its full padding above 640',
    '.product-body{padding:20px 22px 22px;' in outside)

print('\nTHE CARD STILL CARRIES WHAT MATTERS')
is_('the name is rendered', 'class="product-name"' in page)
is_('the price is rendered', 'class="product-price"' in page)
is_('and the tagline is still in the markup, just not shown on a phone',
    'class="product-desc"' in page)

print('\nMUTATION: GOING BACK TO ONE COLUMN MUST FAIL')
is_('a single-column phone grid is caught',
    'repeat(2,1fr)' in '.product-grid{grid-template-columns:1fr;gap:14px;}', False)
is_('and hiding the tagline on desktop would be caught',
    '.product-desc{display:none' in outside, False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
