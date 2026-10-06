#!/usr/bin/env python3
"""Mobile controls are at least 48px, and desktop keeps its own sizes.
Run:  python3 tools/test-tap-targets.py

Google's minimum is 48x48 with 8px between, "about the size of a person's
finger pad area". Measured at 375px on 6 October 2026, these were under it:

  Amy's close            16 x 20   the smallest control on the site
  Amy's send             21 x 21
  the basket drawer close 24 x 29
  the carousel arrows    38 x 38
  the burger             38 x 42   the primary control on every mobile page
  Amy's prompts         192 x 28   the first thing most people tap in that panel
  Amy's chat input      230 x 30
  footer links           47 x 24   with 8px between, so the gap between two of
                                   them was smaller than a fingertip

All of it is inside max-width:768px queries. Desktop, where a mouse is doing
the pointing and 48px would make the furniture look clumsy, keeps every one of
its own sizes — measured at 1280 before and after.

A note for anyone re-measuring: Amy's panel carries scale(0.97) while closed,
so getBoundingClientRect returns 43 for a 44px control until it is opened. The
numbers only mean anything with the panel open.
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

def read(f): return io.open(os.path.join(ROOT, f), encoding='utf-8').read()
def block(css, query):
    """All blocks of this query joined, not just the first.

    index.html has seven @media(max-width:768px) blocks. Reading only the
    first one reported the carousel arrow rule as missing when it was simply
    in the fourth — the test was wrong, not the stylesheet.
    """
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
def outside_queries(css):
    return re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '', css)

header, footer, index = read('header.html'), read('footer.html'), read('index.html')
h_mob = block(header, '@media(max-width:768px){')
f_mob = block(footer, '@media(max-width:768px){')
i_mob = block(index,  '@media(max-width:768px){')

print('\nEVERY CONTROL THAT WAS UNDER 48px IS NOW AT LEAST 48')
for where, css, sel in [('header', h_mob, '.nav-toggle{min-width:48px;min-height:48px'),
                        ('header', h_mob, '.modal-close{min-width:48px;min-height:48px'),
                        ('footer', f_mob, '.hw-close-btn{min-width:48px;min-height:48px'),
                        ('footer', f_mob, '#hw-send{min-width:48px;min-height:48px'),
                        ('footer', f_mob, '#hw-input{min-height:48px;}'),
                        ('footer', f_mob, '.hw-prompt{min-height:48px'),
                        ('footer', f_mob, '.footer-col a{min-height:48px'),
                        ('index',  i_mob, '.hero-arrow{width:48px;height:48px')]:
    is_('  %-7s %s' % (where, sel.split('{')[0]), sel in css)

print('\nNONE OF IT REACHES DESKTOP')
for name, css in (('header.html', header), ('footer.html', footer), ('index.html', index)):
    out = outside_queries(css)
    leaked = [s for s in ('min-height:48px', 'min-width:48px') if s in out]
    is_('  %-12s has no 48px rule outside a query' % name, leaked, [])

print('\nAND DESKTOP KEEPS ITS OWN SIZES')
out_h, out_i = outside_queries(header), outside_queries(index)
is_('the drawer close is still its original size',
    bool(re.search(r'\.modal-close\{', out_h)) and 'min-height:48px' not in
        re.search(r'\.modal-close\{[^}]*\}', out_h).group(0))
is_('the carousel arrows are still 46px on desktop',
    '.hero-arrow{position:absolute' in out_i and 'width:46px;height:46px' in out_i)
is_('the footer links keep their 8px rhythm on desktop',
    'margin-bottom:8px' in outside_queries(footer))

print('\nTHE MOBILE RULES ARE IN A QUERY THAT ALREADY EXISTED, OR A NEW ONE')
is_('header has its mobile query', bool(h_mob))
is_('footer now has one', bool(f_mob))
is_('index has one', bool(i_mob))
is_('footer has exactly one, so nothing was duplicated',
    footer.count('@media(max-width:768px){'), 1)
print('       (index.html has %d such blocks; all are read)' % index.count('@media(max-width:768px){'))

print('\nMUTATION: A CONTROL SHRINKING BACK MUST FAIL')
is_('a 38px burger is caught',
    '.nav-toggle{min-width:48px;min-height:48px' in '.nav-toggle{width:38px;height:42px;}', False)
is_('a 48px rule escaping to desktop is caught',
    'min-height:48px' in outside_queries('.x{min-height:48px;}'), True)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
