#!/usr/bin/env python3
"""Every page that shows Amy also loads the code that makes her work.
Run:  python3 tools/test-widget-script-present.py

delivery.html and 404.html carried the widget markup but never loaded
help-widget.js. Clicking the "?" threw "hwToggle is not defined" and nothing
happened — on the live site, for weeks. The 404 page is the sharpest case: a
visitor already lost, clicking for help, getting nothing.

Both were my doing. Commit bac39ae (16 Sept) moved the widget's JavaScript out
of footer.html into help-widget.js and wired it up by hand-editing a list of
pages assembled by eye; delivery.html was missed. Commit 51f6bfe (21 Sept)
created 404.html with the markup copied in and no script, so that page shipped
broken from its first commit.

The root cause was not the typo. It was changing a shared component and writing
no test that every page still loads it. Nothing failed, so nothing said so.
This is that test. It asserts a thing is PRESENT, which is the only kind of
check that catches an omission — looking at what is there never will.
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

SCRIPT = re.compile(r'<script[^>]+src="[^"]*help-widget\.js')
# footer.html supplies the markup to pages that have none of their own; it is a
# fragment, not a page, so it does not load scripts itself.
shows = [(f, t) for f, t in pages if 'id="hw-btn"' in t and f != 'footer.html']
inlines_own = [f for f, t in pages if 'function hwToggle' in t]

print('\nTHE WIDGET IS ON THE SITE AT ALL')
is_('pages show Amy', len(shows) > 20)
print('       (%d pages carry the launcher)' % len(shows))

print('\nEVERY ONE OF THEM CAN ACTUALLY RUN HER')
missing = [f for f, t in shows if not SCRIPT.search(t) and f not in inlines_own]
is_('no page shows a button that cannot work', missing, [])

print('\nTHE TWO THAT WERE BROKEN')
for f in ('delivery.html', '404.html'):
    t = dict(pages).get(f, '')
    is_('  %-16s loads help-widget.js' % f, bool(SCRIPT.search(t)))
    is_('  %-16s still shows the button' % f, 'id="hw-btn"' in t)

print('\nAND THE SCRIPT IT ASKS FOR EXISTS')
is_('help-widget.js is in the repo',
    os.path.exists(os.path.join(ROOT, 'help-widget.js')))
widget = io.open(os.path.join(ROOT, 'help-widget.js'), encoding='utf-8').read()
is_('and defines the function the button calls', 'function hwToggle' in widget)
onclicks = set(re.findall(r'id="hw-btn"[^>]*onclick="(\w+)\(', ''.join(t for _, t in pages)))
is_('which is the one the markup names', onclicks, {'hwToggle'})

print('\nMUTATION: A PAGE MISSING THE SCRIPT MUST FAIL')
fake = '<button id="hw-btn" onclick="hwToggle()">?</button></body>'
is_('a page with the button and no script is caught',
    bool(SCRIPT.search(fake)), False)
is_('and one with both passes',
    bool(SCRIPT.search(fake + '<script src="/help-widget.js" defer></script>')))

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
