#!/usr/bin/env python3
"""Design templates were withdrawn — nothing should still offer them.
Run:  python3 tools/test-no-design-templates.py

Until 5 October 2026 how-it-works.html opened the Design Studio route with
"Choose one of our considered templates and make it yours", and two whole pages
were still live and answering HTTP 200: the gallery
(design-studio-templates.html) and the template editor
(design-studio-customise.html). Neither was in the sitemap, but the editor was
reachable from the gallery's breadcrumbs, so anyone with a link could browse
designs for a service we do not sell.

Both pages are deleted and 301 to /design-studio.html.

What this does NOT forbid: the word "template" in code (HTML <template>
elements, CSS grid-template-columns, JS template literals), and
guides/wedding-invitation-wording.html, which is about example WORDING for an
invitation — a different thing, genuinely useful, deliberately kept.
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

KEEP = ('guides/wedding-invitation-wording.html',)

pages = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ('.git','node_modules','tools','docs','scratch')]
    for fn in sorted(filenames):
        if not fn.endswith('.html'): continue
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, ROOT)
        raw = io.open(p, encoding='utf-8', errors='ignore').read()
        # Prose only: strip code and comments, so grid-template-columns and
        # template literals are not mistaken for an offer to the customer.
        t = re.sub(r'<script\b.*?</script>', '', raw, flags=re.S | re.I)
        t = re.sub(r'<style\b.*?</style>',  '', t,   flags=re.S | re.I)
        t = re.sub(r'<!--.*?-->',           '', t,   flags=re.S)
        prose = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t))
        pages.append((rel, raw, prose))

print('\nTHE TWO TEMPLATE PAGES ARE GONE')
for f in ('design-studio-templates.html', 'design-studio-customise.html'):
    is_(f + ' no longer exists', os.path.exists(os.path.join(ROOT, f)), False)

print('\nAND BOTH ADDRESSES REDIRECT RATHER THAN 404')
red = io.open(os.path.join(ROOT, '_redirects'), encoding='utf-8').read()
for path in ('/design-studio-templates', '/design-studio-templates.html',
             '/design-studio-customise', '/design-studio-customise.html'):
    is_(path + ' -> /design-studio.html 301',
        bool(re.search(re.escape(path) + r'\s+/design-studio\.html\s+301', red)))
# A rule after the catch-all never runs.
is_('the rules sit above the 404 catch-all',
    red.index('/design-studio-templates ') < red.index('/*  /404.html  404'))

print('\nNO PAGE LINKS TO EITHER OF THEM')
linking = [rel for rel, raw, _ in pages
           if re.search(r'href="[^"]*design-studio-(templates|customise)', raw)]
is_('nothing links to the deleted pages', linking, [])

print('\nNO PAGE OFFERS TEMPLATES IN ITS COPY')
offenders = [rel for rel, _, prose in pages
             if re.search(r'\btemplates?\b', prose, re.I) and rel not in KEEP]
is_('no live page mentions templates to a customer', offenders, [])
print('       (%d pages checked, %d kept by exception)' % (len(pages), len(KEEP)))

print('\nTHE WORDING GUIDE IS KEPT ON PURPOSE')
wording = dict((r, p) for r, _, p in pages).get(KEEP[0])
is_('the wording guide is still here', wording is not None)
if wording:
    is_('and it is about wording, not design', 'Wording' in wording)

print('\nTHE DEAD TEMPLATE CODE WENT WITH THE PAGES')
studio = dict((r, raw) for r, raw, _ in pages).get('design-studio.html', '')
is_('no .tpl- styles left in the studio', '.tpl-' in studio, False)
upload = dict((r, raw) for r, raw, _ in pages).get('upload-and-print.html', '')
is_('the buttons no longer point at the template editor',
    'design-studio-customise.html?template=' in upload, False)
# 'ai-studio' is the only source any design carries, so the template branch was
# unreachable as well as pointing at a deleted page.
is_('and the unreachable template branch is gone',
    "backBtn.textContent = 'Back to design'" in upload, False)

print('\nMUTATION: PUTTING AN OFFER BACK MUST FAIL')
fake = 'Choose one of our considered templates and make it yours.'
is_('a page offering templates is caught', bool(re.search(r'\btemplates?\b', fake, re.I)))
is_('a link to the gallery is caught',
    bool(re.search(r'href="[^"]*design-studio-(templates|customise)',
                   '<a href="/design-studio-templates.html">x</a>')))

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
