#!/usr/bin/env python3
"""The checkout fields do not trigger the iOS zoom, and their hints cannot truncate.
Run:  python3 tools/test-checkout-fields.py

Two faults, found reviewing the site on a phone on 6 October 2026.

THE ZOOM. iOS Safari zooms the page in when a field with a font-size under 16px
takes focus, and does not zoom back out. --text-sm is fluid and bottoms out at
15px, so every checkout field sat one pixel under the line on a phone — name,
email, phone, all four address lines, postcode, notes. Measured: 17px at 1024
and above, 16.6px at 768, 15px from 430 down.

The fix is max(16px, var(--text-sm)) rather than a media query, because max()
can only raise. Desktop stays at 17px and 768 stays at 16.6px, unchanged, while
phones come up to 16. Nicholas asked to approve anything that changes desktop;
this changes nothing there, and the choice of max() is what guarantees it.

THE HINTS. The placeholders truncated on a phone — "For your order confirma",
"House number and stre", "Flat, building or compa" — and an empty field with
grey text in it reads as already filled, which is the complaint about this very
form on 5 October.

Of the nine placeholders only three repeated their label; four carried
information the label did not, and one IS its field's only label. So the four
informative ones moved under the label where they have the full width and
cannot cut, the three redundant ones went, and the discount code keeps its
placeholder because nothing else names that field.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ck   ' if ok else '  FAIL ').replace('ck','ok') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

page = io.open(os.path.join(ROOT, 'upload-and-print.html'), encoding='utf-8').read()

print('\nNO FIELD CAN TRIGGER THE iOS ZOOM')
m = re.search(r'\.co-input\{([^}]*)\}', page)
is_('the .co-input rule is there', bool(m))
is_('its size is floored at 16px', 'font-size:max(16px, var(--text-sm))' in m.group(1))
is_('using max(), which cannot lower anything',
    'max(16px' in m.group(1) and 'min(' not in m.group(1))
# A media query would have LOWERED 768px from 16.6 to 16. max() does not.
is_('and not a media query, which would have changed 768px',
    not re.search(r'@media[^{]*\{[^}]*\.co-input\{[^}]*font-size', page))

print('\nTHE INFORMATIVE HINTS MOVED OUT OF THE BOX')
HINTS = {'coEmail': 'For your order confirmation',
         'coPhone': 'For delivery updates',
         'coAddr1': 'House number and street',
         'coAddr2': 'Flat, building or company'}
for fid, text in HINTS.items():
    is_('  %-9s has its hint under the label' % fid,
        bool(re.search(r'<span class="co-hint">%s</span><(?:input|textarea) class="co-input" id="%s"'
                       % (re.escape(text), fid), page)))
    is_('  %-9s no longer carries it as a placeholder' % fid,
        not re.search(r'id="%s"[^>]*placeholder' % fid, page))
is_('there are exactly four hints', len(re.findall(r'class="co-hint"', page)), 4)
is_('and a style for them', '.co-hint{' in page)

print('\nTHE REDUNDANT PLACEHOLDERS ARE GONE')
for fid in ('coName', 'coPostcode', 'coNotes'):
    is_('  %-11s has no placeholder' % fid,
        not re.search(r'id="%s"[^>]*placeholder' % fid, page))
    is_('  %-11s still has its label' % fid,
        bool(re.search(r'<label class="co-label" for="%s">' % fid, page)))

print('\nTHE ONE PLACEHOLDER THAT IS A LABEL STAYS')
# coDiscountInput has no <label> at all, so its placeholder is the only thing
# naming it. Removing it would leave an unnamed box.
is_('the discount field keeps its placeholder',
    bool(re.search(r'id="coDiscountInput"[^>]*placeholder="Discount code"', page)))
is_('because it has no label element',
    not re.search(r'<label[^>]*for="coDiscountInput"', page))

print('\nNO CHECKOUT FIELD KEPT A PLACEHOLDER IT SHOULD NOT')
left = re.findall(r'id="(co[A-Za-z]+)"[^>]*placeholder="([^"]*)"', page)
is_('only the discount field has one', left, [('coDiscountInput', 'Discount code')])

print('\nMUTATION: EITHER FAULT COMING BACK MUST FAIL')
is_('a bare var(--text-sm) is caught',
    'max(16px' in 'font-size:var(--text-sm);', False)
is_('a returning placeholder is caught',
    bool(re.search(r'id="coName"[^>]*placeholder',
                   '<input class="co-input" id="coName" placeholder="First and last name">')))
is_('and a hint left inside the box is caught',
    bool(re.search(r'<span class="co-hint">x</span><input class="co-input" id="coEmail"',
                   '<input class="co-input" id="coEmail" placeholder="x">')), False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
