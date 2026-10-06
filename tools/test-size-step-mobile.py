#!/usr/bin/env python3
"""The size step is two columns on a phone, with readable dimensions.
Run:  python3 tools/test-size-step-mobile.py

Measured at 375px on 6 October 2026. The size grid is
repeat(auto-fit,minmax(150px,1fr)) with a 14px gap, which needs 314px for two
columns. The container is 311. Three pixels short, so every size sat on its own
row — five rows of a 161px card to choose a paper size, three of them visible.
Asking for two columns outright takes the guesswork out.

The dimensions and the badge under each name were 11.5px, the smallest text on
the site, and they are exactly what someone reads when choosing between A6 and
A5. Now 13px.

Everything is inside max-width:768px. Desktop keeps four columns, 161px cards
and its own type sizes — measured at 1280 before and after.

A note on the wider "text under 14px" finding from the mobile review: most of
those turned out to be 13.1px uppercase labels — buttons, eyebrows, footer
headings — which is a deliberate type treatment, not a defect. Only the 11.5px
items were genuinely too small to read, and they are the ones fixed here.
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

page = io.open(os.path.join(ROOT, 'upload-and-print.html'), encoding='utf-8').read()

def blocks(css, query):
    out, start = [], 0
    while True:
        i = css.find(query, start)
        if i < 0: break
        d, j = 0, i + len(query) - 1
        while j < len(css):
            if css[j] == '{': d += 1
            elif css[j] == '}':
                d -= 1
                if d == 0: break
            j += 1
        out.append(css[i:j + 1]); start = j + 1
    return '\n'.join(out)

mob = blocks(page, '@media(max-width:768px){')
outside = re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '', page)

print('\nTWO COLUMNS ON A PHONE')
is_('the grid is asked for two columns outright',
    '#size-grid{grid-template-columns:repeat(2,1fr)!important' in mob)
is_('with a tighter gap so they fit', 'gap:10px!important' in mob)
is_('the preview box gives up some height', '.art{height:62px' in mob)
is_('and the caption some padding', '.cap{padding:9px 11px 11px;}' in mob)

print('\nTHE TEXT YOU READ TO CHOOSE IS READABLE')
is_('the dimensions are 13px', '.dim{font-size:13px;}' in mob)
is_('the badge is 13px', '.sub{font-size:13px;}' in mob)
is_('the finish note too', '.fs-note{font-size:13px;}' in mob)
is_('and the size name is still clearly the heading', '.nm{font-size:16px;}' in mob)

print('\nDESKTOP KEEPS WHAT IT HAD')
is_('still auto-fit, not a fixed two',
    'minmax(150px,1fr)' in outside)
is_('the preview box is still 74px', '.art{display:flex;align-items:flex-end;justify-content:center;height:74px' in outside)
is_('the dimensions are still 11.5px there', '.dim{display:block;font-size:11.5px' in outside)
is_('and the name 18px', '.nm{display:block;font-family:\'Cormorant Garamond\',Georgia,serif;font-size:18px' in outside)
leaked = [s for s in ('repeat(2,1fr)!important', 'height:62px', 'font-size:13px;}') if s in outside]
is_('none of the mobile rules sits outside a query', leaked, [])

print('\nMUTATION: THE SINGLE COLUMN COMING BACK MUST FAIL')
is_('a grid without the two-column rule is caught',
    'repeat(2,1fr)!important' in '#size-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important;}', False)
is_('and 11.5px dimensions on mobile would be caught',
    '.dim{font-size:13px;}' in '.dim{font-size:11.5px;}', False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
