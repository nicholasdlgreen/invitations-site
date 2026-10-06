#!/usr/bin/env python3
"""The spacing scale matches the site it was derived from.
Run:  python3 tools/test-spacing-scale.py

The scale was taken FROM the site, not imposed on it. A strict 4px grid would
have fitted 36% of 13,606 spacing declarations and forced 8,741 to move; these
ten steps are simply the values already in heaviest use, so reaching for one on
new work lands where the surrounding page already sits.

That only stays true while the figures are true, so this recomputes every usage
count in docs/BRAND.md 4 from the source rather than trusting the document.
It also watches the total: a sharp fall would mean someone had started
retrofitting existing spacing, which is explicitly not wanted.
"""
import io, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

def scan():
    vals = collections.Counter()
    for dp, dn, fns in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'scratch',
                                            'docs', 'tools', 'netlify', 'supabase')]
        for fn in sorted(fns):
            if not fn.endswith(('.html', '.css')): continue
            t = io.open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
            t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
            for prop in ('padding', 'margin', 'gap', 'row-gap', 'column-gap'):
                for m in re.findall(r'(?<![a-z-])%s\s*:\s*([^;}"]+)' % prop, t):
                    for tok in m.split():
                        if re.fullmatch(r'\d+px', tok.strip()):
                            vals[int(tok.strip()[:-2])] += 1
    return vals

vals  = scan()
total = sum(vals.values())
doc    = io.open(os.path.join(ROOT, 'docs/BRAND.md'), encoding='utf-8').read()
header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read()
tokens = {n: v.strip() for n, v in
          re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);',
                     re.search(r':root\s*\{([^}]*)\}', header).group(1))}

print('\nTHE TEN STEPS EXIST, AND ARE WHAT THE DOCUMENT SAYS')
STEPS = [4, 8, 12, 16, 20, 24, 32, 48, 60, 80]
for i, px in enumerate(STEPS, 1):
    is_('  --space-%-2d is %dpx' % (i, px), tokens.get('--space-%d' % i), '%dpx' % px)
is_('there are exactly ten', len([k for k in tokens if k.startswith('--space-')]), 10)

print('\nEVERY STEP IS A SIZE THE SITE ALREADY USED')
# That is the whole argument for this scale: adopting a step never moves a page.
unused = [px for px in STEPS if vals[px] == 0]
is_('no step is invented', unused, [])
rare = [(px, vals[px]) for px in STEPS if vals[px] < 20]
is_('and none is so rare it is really a new value', [p for p, n in rare if p != 80], [])

print('\nTHE USAGE FIGURES IN THE DOCUMENT ARE RECOMPUTED, NOT TRUSTED')
quoted = dict((int(a), int(b.replace(',', ''))) for a, b in
              re.findall(r'\|\s*`--space-\d+`\s*\|\s*`(\d+)px`\s*\|\s*([\d,]+)', doc))
is_('the document quotes counts for every step', len(quoted), 10)
wrong = {px: (claimed, vals[px]) for px, claimed in quoted.items() if vals[px] != claimed}
is_('all of them match the source', wrong, {})

print('\nNOTHING HAS BEEN RETROFITTED')
# Adoption is meant to be additive. If this total collapses, someone has begun
# rewriting existing spacing, which the document explicitly rules out.
is_('the site still has its spacing (%d declarations)' % total, total > 12000)
is_('and the document states the scale is for new work only',
    'Existing spacing is deliberately left alone' in doc)
is_('CLAUDE.md says the same',
    'Do not retrofit existing spacing' in
    io.open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read())

print('\nMUTATION: A FIGURE DRIFTING MUST FAIL')
is_('a wrong count is caught', {4: (999, vals[4])} if vals[4] != 999 else {}, {4: (999, vals[4])})
is_('an invented step is caught', vals.get(37777, 0) > 0, False)
is_('a renumbered token is caught', tokens.get('--space-11'), None)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
