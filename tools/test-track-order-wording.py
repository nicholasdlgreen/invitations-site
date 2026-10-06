#!/usr/bin/env python3
"""The tracking page does not assume the order was invitations.
Run:  python3 tools/test-track-order-wording.py

We sell place cards, menus, order of service, thank you cards and Christmas
cards as well as invitations. The tracking page told everyone, whatever they
had bought, that "your invitations are being printed", and summarised the
order as "50 invitations". Nothing on this page knows what was ordered — the
record it reads carries a design name and a quantity, not a product type — so
nothing on it should guess.

The navigation links to Wedding Invitations, Party Invitations and the rest are
left alone: those are real products, correctly named.
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

page = io.open(os.path.join(ROOT, 'track-order.html'), encoding='utf-8').read()

print('\nTHE THREE PLACES A CUSTOMER READS')
is_('the line above the form says order', 'the current status of your order.' in page)
is_('the printing step says order', "desc:'Your order is being printed.'" in page)
is_('the summary counts items, not invitations',
    '${order.qty} items' in page)

print('\nNOTHING LEFT THAT GUESSES THE PRODUCT')
# Strip the navigation, where the product names are correct, and the comments.
body = re.sub(r'<!--.*?-->', '', page, flags=re.S)
body = re.sub(r'<a href="/[a-z-]*invitations"[^>]*>[^<]*</a>', '', body)
guesses = [m for m in re.findall(r'[^<>\n]*\binvitations?\b[^<>\n]*', body, re.I)
           if 'meta ' not in m and 'href' not in m]
is_('no customer-facing line names invitations', guesses, [])

print('\nMUTATION: THE OLD WORDING COMING BACK MUST FAIL')
is_('the printing step is caught',
    "desc:'Your order is being printed.'" in "desc:'Your invitations are being printed.'", False)
is_('the summary line is caught',
    '${order.qty} items' in '${order.suite} · ${order.qty} invitations · ${order.total}', False)
is_('and a product name in the nav is still allowed',
    re.sub(r'<a href="/[a-z-]*invitations"[^>]*>[^<]*</a>', '',
           '<a href="/party-invitations">Party Invitations</a>').strip(), '')

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
