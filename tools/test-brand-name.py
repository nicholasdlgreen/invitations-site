#!/usr/bin/env python3
"""The brand is written one way: foreverprint.
Run:  python3 tools/test-brand-name.py

Until 5 October 2026 the site used four spellings at once. The logo in
header.html has always been lowercase — forever<span>print</span>, Cormorant
Garamond, forever in #3D2E24 and print in gold #B8976A — but the words around
it did not match:

  Foreverprint    516  page titles, social tags, structured data, body copy
  forever·print    11  the five account pages, with a middle dot
  FOREVERPRINT      1  the holding-page splash
  foreverprint    374  of which 352 were domains and email addresses

Nicholas asked for lowercase everywhere, with body text left in the ordinary
colour rather than given the logo's two-tone treatment.

What this does NOT police: foreverprint.com and hello@foreverprint.com, which
were always lowercase; and two FOREVERPRINT left in code — a banner comment in
analytics.js and a heading inside a test — neither of which a customer reads.
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

SHIPPED = ('.html', '.js', '.py', '.toml', '.xml', '.json')
files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    # scratch/ is gitignored and 404s on the live site: working notes, not pages.
    dirnames[:] = [d for d in dirnames if d not in ('.git','node_modules','scratch','docs')]
    # tools/ is 404'd by _redirects, so its HTML is scaffolding, not pages.
    for fn in sorted(filenames):
        if fn.endswith(SHIPPED):
            p = os.path.join(dirpath, fn)
            files.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))

print('\nONE SPELLING, AND IT IS THE LOWERCASE ONE')
# tools/ is excluded throughout: it is 404'd by _redirects, and a test must
# be able to quote the spellings it forbids — this one named all four in its
# own documentation and so failed itself on the first run.
shipped = [(f, x) for f, x in files if not f.startswith('tools/')]
cap   = [f for f, x in shipped if 'Foreverprint' in x]
dot   = [f for f, x in shipped if 'forever·print' in x]
is_('no file writes it with a capital F', cap, [])
is_('no file uses the middle-dot form',   dot, [])
# The all-caps form survives only in code the customer never sees.
caps  = [f for f, x in shipped if 'FOREVERPRINT' in x]
is_('all-caps survives only in a code banner nobody reads',
    sorted(caps), ['analytics.js'])
print('       (%d shipped files scanned)' % len(shipped))

print('\nTHE LOGO IS UNCHANGED, AND IS STILL THE TWO-TONE MARK')
hdr = dict(files)['header.html']
is_('the wordmark is lowercase and split for colour',
    '<a class="logo" href="/">forever<span>print</span></a>' in hdr)
is_('forever takes the text colour', 'color:var(--text)' in hdr)
is_('print takes the gold',          '.logo span{color:var(--gold);}' in hdr)

print('\nEVERY PAGE TITLE ENDS WITH THE BRAND')
# Three exceptions, each deliberate: the admin tool, the guide template whose
# {{TITLE}} is filled at build time, and a developer preview page.
EXEMPT = {'admin.html', 'guide.html', 'step3/preview.html'}
bad = []
for f, t in files:
    if not f.endswith('.html') or f in EXEMPT or f.startswith('tools/'): continue
    m = re.search(r'<title>(.*?)</title>', t, re.S)
    if not m: continue                      # fragments have no title, correctly
    title = re.sub(r'\s+', ' ', m.group(1)).strip()
    if not title.endswith('| foreverprint'): bad.append((f, title))
is_('no page ends with anything else', bad, [])
# The pattern that was there before.
is_('no title still says "| Invitations"',
    [f for f, t in files if f.endswith('.html') and not f.startswith('tools/')
       and re.search(r'<title>[^<]*\| Invitations</title>', t)], [])

print('\nDOMAINS AND EMAIL ADDRESSES ARE UNTOUCHED')
is_('the domain still appears', any('foreverprint.com' in t for _, t in files))
is_('the mailbox still appears', any('hello@foreverprint.com' in t for _, t in files))

print('\nMUTATION: ANY OF THE OLD SPELLINGS MUST FAIL')
is_('a capital F is caught',   'Foreverprint' in 'Welcome to Foreverprint')
is_('a middle dot is caught',  'forever·print' in 'Sign in — forever·print')
is_('a stray title is caught',
    bool(re.search(r'<title>[^<]*\| Invitations</title>', '<title>Saved | Invitations</title>')))

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
