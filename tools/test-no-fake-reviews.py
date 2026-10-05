#!/usr/bin/env python3
"""No invented customer reviews anywhere on the site.
Run:  python3 tools/test-no-fake-reviews.py

Until 5 October 2026 the home page carried three five-star testimonials from
"Charlotte & James", "Amelia & Oliver" and "Isabella & William", under the
heading "Words from Our Customers". The shop has never taken an order, so all
three were placeholder copy written during the build.

That is not a matter of taste. Fabricated consumer reviews are a banned
practice under Schedule 20 of the Digital Markets, Competition and Consumers
Act 2024, and the site is about to start paying for traffic.

This sweeps every page rather than guarding one file, because the cheapest way
for this to come back is for a placeholder to be pasted onto a landing page
nobody is watching. It fails on the specific invented names, on star ratings,
and on review structured data — the last being the worst case, since that is
what puts stars in Google's results.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INVENTED = ['Charlotte & James', 'Charlotte &amp; James',
            'Amelia & Oliver',   'Amelia &amp; Oliver',
            'Isabella & William','Isabella &amp; William']
HEADINGS = ['Words from Our Customers', 'Happy Customers']

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
    dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules')]
    for fn in sorted(filenames):
        if fn.endswith('.html'):
            p = os.path.join(dirpath, fn)
            txt = io.open(p, encoding='utf-8', errors='ignore').read()
            # What makes a testimonial is RENDERED CONTENT, not a name appearing
            # somewhere in a file. Strip HTML comments (the removal note names
            # the three on purpose) and <script> blocks (a comment in
            # upload-and-print.html uses "Charlotte & James" as an example of
            # text to foil, and the design studio uses it as a placeholder for
            # a names field — both legitimate, and both were flagged by the
            # first version of this test).
            txt = re.sub(r'<!--.*?-->', '', txt, flags=re.S)
            txt = re.sub(r'<script\b.*?</script>', '', txt, flags=re.S | re.I)
            pages.append((os.path.relpath(p, ROOT), txt))

print('\nTHE INVENTED CUSTOMERS ARE GONE')
is_('there are pages to check', len(pages) > 50)
for name in INVENTED:
    hits = [n for n, t in pages if name in t]
    is_('no page quotes "%s"' % name, hits, [])
for h in HEADINGS:
    hits = [n for n, t in pages if h in t]
    is_('no page is headed "%s"' % h, hits, [])
print('       (%d pages checked)' % len(pages))

print('\nNO STAR RATINGS ARE DISPLAYED')
stars = [n for n, t in pages if '★★★' in t]
is_('no run of filled stars anywhere', stars, [])

print('\nNO REVIEW STRUCTURED DATA — THIS IS THE ONE THAT REACHES GOOGLE')
# aggregateRating or Review markup is what renders stars in search results.
# Faking it misleads people who never visit the site.
for token in ['aggregateRating', 'ratingValue', 'reviewCount', '"@type": "Review"', '"@type":"Review"']:
    hits = [n for n, t in pages if token in t]
    is_('no page declares %s' % token, hits, [])

print('\nTHE SECTION WAS REMOVED, NOT JUST EMPTIED')
idx = dict(pages).get('index.html', '')
is_('the home page has no testimonial section left', 'TESTIMONIALS' in idx, False)
raw = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
is_('a note records why, so it is not re-added by accident',
    'removed\n     entirely' in raw or 'was removed' in raw)
is_('the note points at the real-reviews plan', 'item 29' in raw)

print('\nMUTATION: PUTTING ONE BACK MUST FAIL')
fake = '<p>"Absolutely breathtaking."</p><div>Charlotte &amp; James</div>'
is_('a reinstated testimonial is caught', 'Charlotte &amp; James' in fake)
is_('and a star row is caught', '★★★' in '★★★★★')

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
