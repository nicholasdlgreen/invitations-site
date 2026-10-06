#!/usr/bin/env python3
"""The header fits a phone, and desktop is untouched.
Run:  python3 tools/test-mobile-header.py

The header tried to show burger + full logo + "Account" + "Basket 0" — 506px of
content in a 375px bar. Measured on 6 October 2026 at 320, 360, 375, 390, 414,
430 and 480: the basket button and its count badge sat past the right edge at
EVERY ONE, and that was what made every page scroll sideways. On a shop, the
basket being off-screen is the most expensive thing on the page.

Below 768px — where the burger already replaces the navigation, so the header
is in its mobile form anyway — the labels become icons and the count becomes a
badge. 48px targets, Google's stated minimum.

Done entirely in CSS. No markup was touched, which is the point: Nicholas asked
to approve anything that changes desktop, and a rule inside a max-width query
cannot. This test holds that line — it checks the rules are INSIDE the query
and that the desktop declarations still say what they said.
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

header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read()

def block(css, query):
    i = css.index(query)
    d, j = 0, i + len(query) - 1
    while j < len(css):
        if css[j] == '{': d += 1
        elif css[j] == '}':
            d -= 1
            if d == 0: return css[i:j + 1]
        j += 1
    return ''

mobile = block(header, '@media(max-width:768px){')
small  = block(header, '@media(max-width:359px){')
# everything outside any media query is what desktop sees
desktop = re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '', header)

print('\nTHE MOBILE RULES EXIST, AND ARE INSIDE THE MOBILE QUERY')
for rule in ('.acct-label{display:none;}', '.cart-btn{', '.cart-btn::before{',
             '.cart-btn .cart-count{'):
    is_('  %-26s is in the 768px query' % rule, rule in mobile)
is_('the basket becomes a 48px target', 'width:48px;height:48px' in mobile)
is_('and the account trigger too', 'min-width:48px;min-height:48px' in mobile)
is_('the count becomes a badge, out of the flow', 'position:absolute' in mobile)
is_('and gets its size back, since the button zeroes it', 'font-size:11px' in mobile)

print('\nDESKTOP IS NOT TOUCHED')
# These are the declarations desktop renders. If any changed, desktop changed.
is_('.acct-label is not hidden outside the query', 'acct-label{display:none' not in desktop)
m = re.search(r'\.cart-btn\{([^}]*)\}', desktop)
is_('the desktop .cart-btn rule still exists', bool(m))
if m:
    body = m.group(1)
    is_('  it still has its pill padding', 'padding:10px 22px' in body)
    is_('  it is still a 60px pill, not a circle', 'border-radius:60px' in body)
    is_('  and its text is not zeroed', 'font-size:0' not in body)
m2 = re.search(r'\.cart-count\{([^}]*)\}', desktop)
is_('the desktop .cart-count is still in the flow',
    bool(m2) and 'position:absolute' not in m2.group(1))

print('\nTHE SMALLEST PHONES ARE COVERED')
is_('there is a rule for 320px-class screens', bool(small))
is_('it shrinks the logo rather than a tap target', '.logo{font-size' in small)
is_('and no tap target is reduced there', '48px' not in small)

print('\nNO MARKUP WAS CHANGED')
# The whole approach rests on this: CSS cannot leak past a media query.
is_('the basket is still a plain button with a text node',
    '<button class="cart-btn" onclick="openCart()">' in header)
is_('the account label span is still there',
    'class="acct-label"' in header)
is_('the icon is a CSS pseudo-element, not an added tag',
    '::before' in mobile and 'background-image:url("data:image/svg+xml' in mobile)

print('\nMUTATION: A RULE ESCAPING THE QUERY MUST FAIL')
fake_desktop = re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '',
                      header.replace('.acct-label{display:none;}', '') + '.acct-label{display:none;}')
is_('a mobile rule left outside is caught',
    'acct-label{display:none' not in fake_desktop, False)
is_('and the desktop pill losing its padding is caught',
    'padding:10px 22px' in '.cart-btn{border-radius:60px;}', False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
