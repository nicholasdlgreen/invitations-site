#!/usr/bin/env python3
"""Every page that has a footer must carry the company disclosure.
Run:  python3 tools/test-footer-disclosure.py

The Companies (Trading Disclosures) Regulations 2008 require a UK limited
company to show its registered name, company number, place of registration and
registered office address ON ITS WEBSITE — not only in its terms. Until
5 October 2026 the footer read "(c) 2026 Foreverprint. All rights reserved."
and nothing else, on all 57 pages.

This is a file-sweeping check rather than a jsc one because it has to walk the
tree: the footer is hardcoded into every page AND injected from footer.html
over the top, so there is no single file to read. That duplication is exactly
why this test exists — 57 copies of a legal sentence drift, and a page added
later will simply not have it unless something fails.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISCLOSURE = ('Foreverprint is a trading name of Natch Limited, registered in '
              'England and Wales, company number 09493377. Registered office: '
              'Regina House, 124 Finchley Road, London NW3 5JS.')
NUMBER = '09493377'

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
            pages.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))

footered = [(n, t) for n, t in pages if 'class="footer-bottom"' in t]

print('\nTHE DISCLOSURE IS ON EVERY PAGE THAT HAS A FOOTER')
is_('there are pages with footers at all', len(footered) > 0)
missing = [n for n, t in footered if 'class="footer-legal"' not in t]
is_('no footered page is missing the disclosure block', missing, [])
wrong = [n for n, t in footered if DISCLOSURE not in t]
is_('every one carries the exact wording', wrong, [])
unstyled = [n for n, t in footered if '.footer-legal{' not in t]
is_('every one also carries the style rule', unstyled, [])
print('       (%d pages checked)' % len(footered))

print('\nIT SAYS THE FOUR THINGS THE REGULATIONS REQUIRE')
is_('the registered name', 'Natch Limited' in DISCLOSURE)
is_('the company number', NUMBER in DISCLOSURE)
is_('the place of registration', 'England and Wales' in DISCLOSURE)
is_('the registered office', 'Regina House, 124 Finchley Road, London NW3 5JS' in DISCLOSURE)
is_('and it is spelt Finchley, not Finchely', 'Finchely' not in DISCLOSURE)

print('\nIT SITS BELOW THE COPYRIGHT ROW, NOT INSIDE IT')
# Inside the flex row it would be squeezed against "Made with love in the UK".
inside = [n for n, t in footered
          if re.search(r'<div class="footer-bottom">(?:(?!</div>).)*footer-legal', t, re.S)]
is_('no page nests it inside the copyright row', inside, [])

print('\nNOTHING ELSE CLAIMS TO BE THE COMPANY')
# A stray old entity name would contradict the disclosure.
stray = [n for n, t in footered if re.search(r'Foreverprint (Ltd|Limited)\b', t)]
is_('no page calls Foreverprint itself a limited company', stray, [])

print('\nMUTATION: A PAGE WITHOUT IT MUST FAIL')
fake = [('fake.html', '<div class="footer-bottom"><span>(c) 2026</span></div>')]
fake_missing = [n for n, t in fake if 'class="footer-legal"' not in t]
is_('a footered page with no disclosure is caught', fake_missing, ['fake.html'])
typo = DISCLOSURE.replace('Finchley', 'Finchely')
is_('a misspelt address no longer matches', typo == DISCLOSURE, False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
