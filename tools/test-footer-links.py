#!/usr/bin/env python3
"""The footer's links land somewhere sensible.
Run:  python3 tools/test-footer-links.py

The FAQs link pointed at /help-support.html#faq, which scrolled 381px in — 18%
down the page — and pushed the "How can we help?" heading off screen along with
the invitation to ask Amy. You arrived in a list of questions with no context,
having skipped the page's main offer. Measured in the browser before changing
it.

The FAQ is the bulk of that page, so the top of the page is the right place to
arrive; nothing is lost by dropping the anchor.
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
    dirnames[:] = [d for d in dirnames if d not in ('.git','node_modules','scratch','docs','tools')]
    for fn in sorted(filenames):
        if fn.endswith('.html'):
            p = os.path.join(dirpath, fn)
            pages.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))

print('\nTHE FAQ LINK LANDS AT THE TOP OF THE PAGE')
anchored = [f for f, t in pages if 'help-support.html#faq' in t]
is_('no page links into the middle of help-support', anchored, [])
linked = [f for f, t in pages if '>FAQs</a>' in t]
is_('the link is still there, on every page with a footer', len(linked) > 40)
wrong = [f for f, t in pages
         if re.search(r'<a href="/help-support\.html[^"]*">FAQs</a>', t)
         and not re.search(r'<a href="/help-support\.html">FAQs</a>', t)]
is_('and it points at the page, not a fragment', wrong, [])
print('       (%d pages carry the link)' % len(linked))

print('\nTHE PAGE STILL HAS THE SECTION, FOR ANYONE WHO LINKS TO IT')
hs = dict(pages).get('help-support.html', '')
is_('the #faq section still exists', 'id="faq"' in hs)
# It keeps its scroll-margin so a direct link to the fragment still clears the
# sticky header — the anchor was never broken, it was the wrong destination.
is_('and still clears the sticky header if used', 'scroll-margin-top:90px' in hs)

print('\nWHAT A VISITOR SEES ON ARRIVAL IS STILL THERE')
is_('the page heading', 'How can we help?' in hs)
is_('and the invitation to ask Amy', 'Ask Amy' in hs)

print('\nMUTATION: THE ANCHOR COMING BACK MUST FAIL')
is_('an anchored link is caught', 'help-support.html#faq' in '<a href="/help-support.html#faq">FAQs</a>')

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
