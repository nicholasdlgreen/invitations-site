#!/usr/bin/env python3
"""The pod icons are gold, on every page that has them.
Run:  python3 tools/test-path-icon-colour.py

The two large pods on the home page had blue stars. Nobody chose blue:
#0000EE is the browser's default link colour. Each pod is an <a>, and the home
page's .path-icon rule set a size and a margin but no colour, so the glyph
inherited the anchor's default. Every other element in the pod escaped it by
declaring its own colour; the icon was the only thing left inheriting.

The fault was a missing declaration, not a wrong one, so the test is written
that way: every .path-icon rule on the site must state a colour, and it must be
the gold token rather than a literal. A rule that simply forgets again is
caught, which grepping for "blue" never would be.
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
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', 'scratch', 'tools')]
    for fn in sorted(filenames):
        if fn.endswith('.html'):
            p = os.path.join(dirpath, fn)
            pages.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))

RULE = re.compile(r'^\.path-icon\s*\{([^}]*)\}', re.M)

print('\nEVERY COPY OF THE RULE STATES A COLOUR')
# Only pages that actually put the class in their markup. delivery.html kept a
# .path-icon rule long after the component left it; a rule nothing uses cannot
# render blue, and failing on it would be a false alarm that teaches us to
# ignore this test. The orphan was deleted rather than exempted.
carriers = [(f, RULE.search(t).group(1)) for f, t in pages
            if RULE.search(t) and 'class="path-icon"' in t]
is_('the component is found on the site', len(carriers) > 1)
print('       (%d pages carry it)' % len(carriers))
missing = [f for f, body in carriers if 'color:' not in body.replace('background-color:', '')]
is_('none of them leaves the colour to be inherited', missing, [])

print('\nAND THE COLOUR IS THE GOLD TOKEN, NOT A LITERAL')
not_token = [f for f, body in carriers if 'var(--gold)' not in body]
is_('every one uses var(--gold)', not_token, [])
literals = [f for f, body in carriers if re.search(r'color:\s*#(?!\s)', body)]
is_('no hard-coded hex', literals, [])

print('\nTHE HOME PAGE, WHICH WAS THE ONE AT FAULT')
home = dict(pages)['index.html']
is_('its rule now sets gold', 'color:var(--gold)' in RULE.search(home).group(1))
is_('and the glyphs are untouched', '>✦<' in home and '>✧<' in home)

print('\nNO RULE LEFT BEHIND BY A COMPONENT THAT MOVED ON')
orphans = [f for f, t in pages if RULE.search(t) and 'class="path-icon"' not in t]
is_('no page styles an icon it does not have', orphans, [])

print('\nMUTATION: A RULE THAT FORGETS AGAIN MUST FAIL')
is_('a colourless rule is caught',
    'color:' in '.path-icon{font-size:var(--text-h2);margin-bottom:24px;display:block;}', False)
is_('a hard-coded colour is caught',
    'var(--gold)' in '.path-icon{color:#B8976A;}', False)
is_('and background-color alone does not count as a colour',
    'color:' in '.path-icon{background-color:#fff;}'.replace('background-color:', ''), False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
