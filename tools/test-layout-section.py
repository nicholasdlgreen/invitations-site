#!/usr/bin/env python3
"""The figures in docs/BRAND.md 4a are real, and the studio still obeys them.

4a was written because a studio redesign went asymmetric and there was no
written rule it had broken. A section of invented numbers would be worse than
none, so every count in it is recomputed here from the site itself -- the same
treatment 4's spacing table gets from tools/test-spacing-scale.py.

It also pins the two things that section exists to prevent:
  * the preview card and the order button sharing one centre line;
  * the rail staying narrow, because the rail's width IS the card's width.
"""
import io, re, glob, sys, collections

passed = failed = 0
def check(name, got, want):
    global passed, failed
    if got == want: passed += 1; print('  ok   %s' % name)
    else: failed += 1; print('  FAIL %s   got %r, want %r' % (name, got, want))

DOC = io.open('docs/BRAND.md', encoding='utf-8').read()
SEC = DOC[DOC.index('## 4a. Layout and composition'):DOC.index('## 5. Components')]

def site_files():
    return sorted(set(glob.glob('*.html') + glob.glob('*/*.css')))

def counts():
    ta = collections.Counter(); mw = collections.Counter(); med = collections.Counter()
    for f in site_files():
        try: s = io.open(f, encoding='utf-8').read()
        except Exception: continue
        for m in re.finditer(r'text-align:\s*(\w+)', s): ta[m.group(1)] += 1
        for m in re.finditer(r'@media[^{]*?max-width:\s*(\d+)px', s): med[int(m.group(1))] += 1
        body = re.sub(r'@media[^{]*\{', '{', s)
        for m in re.finditer(r'(?<!@media )max-width:\s*(\d+)px', body): mw[int(m.group(1))] += 1
    return ta, mw, med

def stated(label):
    """The number 4a claims, from its own table rows."""
    m = re.search(r'\|\s*`?' + re.escape(label) + r'`?\s*\|[^|]*\|\s*\*{0,2}(\d[\d,]*)\*{0,2}', SEC)
    if not m:
        m = re.search(r'\|\s*`' + re.escape(label) + r'`\s*\|\s*\*{0,2}(\d[\d,]*)\*{0,2}', SEC)
    return int(m.group(1).replace(',', '')) if m else None

ta, mw, med = counts()

print('THE COMPOSITION FIGURES ARE RECOMPUTED, NOT REMEMBERED')
check('centred alignments', stated('center'), ta['center'])
check('left alignments',    stated('left'),   ta['left'])
check('right alignments',   stated('right'),  ta['right'])
check('centred still outnumbers left by more than 2x', ta['center'] > ta['left'] * 2, True)

print('\nCONTAINERS AND BREAKPOINTS')
check('the 1180px container count', stated('1180px'), mw[1180])
check('1180px is still the dominant container',
      mw[1180] > max(v for k, v in mw.items() if k != 1180) * 2, True)
check('the 768px breakpoint count', stated('768px'), med[768])
check('the 480px breakpoint count', stated('480px'), med[480])
check('the 359px breakpoint count', stated('359px'), med[359])

print('\nTHE STUDIO OBEYS WHAT THE SECTION SAYS')
STUDIO = io.open('design-studio-ai-create.html', encoding='utf-8').read()
rail = re.search(r'grid-template-columns:minmax\(0,1fr\) (\d+)px', STUDIO)
check('the rail has a declared width', bool(rail), True)
check('and it is 140px or less, so the card keeps the width',
      int(rail.group(1)) <= 140 if rail else None, True)
check('the rail is on the card\'s centre line, not its top',
      bool(re.search(r'\.ds-stage\{display:grid;[^}]*align-items:center', STUDIO, re.S)), True)
check('the order button spans the panel it completes',
      '#ds-love{width:100%' in STUDIO, True)
check('only one solid button in the panel', STUDIO.count('class="ds-act-primary"'), 1)

print('\nMUTATION: EACH DRIFT MUST FAIL')
def mutates(name, doc=None, studio=None):
    global passed, failed, SEC, STUDIO
    oldS, oldD = STUDIO, SEC
    if studio: STUDIO = studio
    if doc: SEC = doc
    before = failed
    import contextlib, io as _io
    with contextlib.redirect_stdout(_io.StringIO()):
        # re-run only the assertions that read SEC/STUDIO
        check('x', stated('center'), ta['center'])
        r = re.search(r'grid-template-columns:minmax\(0,1fr\) (\d+)px', STUDIO)
        check('x', int(r.group(1)) <= 140 if r else None, True)
        check('x', bool(re.search(r'\.ds-stage\{display:grid;[^}]*align-items:center', STUDIO, re.S)), True)
    caught = failed > before
    failed = before
    STUDIO, SEC = oldS, oldD
    if caught: passed += 1; print('  ok   %s is caught' % name)
    else: failed += 1; print('  FAIL %s SLIPPED THROUGH' % name)

mutates('a stale centred-alignment figure', doc=SEC.replace('| **673** |', '| **999** |'))
mutates('the rail growing back to 180px',
        studio=STUDIO.replace('minmax(0,1fr) 140px', 'minmax(0,1fr) 180px'))
mutates('the rail going back to the top edge',
        studio=STUDIO.replace('gap:14px;align-items:center;', 'gap:14px;align-items:start;'))

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
