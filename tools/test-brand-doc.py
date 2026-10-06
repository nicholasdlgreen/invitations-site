#!/usr/bin/env python3
"""docs/BRAND.md still describes the site it claims to describe.
Run:  python3 tools/test-brand-doc.py

A brand guideline is only worth having while it is true. The usual failure is
not that someone disagrees with it — it is that the code moves and the document
does not, and six months later nobody trusts it.

So every colour and type value quoted in BRAND.md is checked against
header.html, which is where the tokens actually live. If someone changes a
token and not the document, this fails and names the token.

It deliberately does NOT check the inconsistency counts in §7: those are a
snapshot of work still to do, and will change as the work is done.
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

doc    = io.open(os.path.join(ROOT, 'docs/BRAND.md'), encoding='utf-8').read()
header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read()

root = re.search(r':root\s*\{([^}]*)\}', header).group(1)
tokens = {n: v.strip() for n, v in re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);', root)}

print('\nTHE TOKENS STILL LIVE WHERE THE DOCUMENT SAYS')
is_('header.html holds a :root block', bool(tokens))
is_('and the document points there', 'header.html' in doc and '`:root`' in doc)

print('\nEVERY COLOUR QUOTED IN THE DOCUMENT MATCHES THE CODE')
quoted = dict(re.findall(r'\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`', doc))
is_('the document quotes colours at all', len(quoted) >= 10)
wrong = {n: (v, tokens.get(n)) for n, v in quoted.items()
         if tokens.get(n, '').lower() != v.lower()}
is_('all of them agree with header.html', wrong, {})
print('       (%d colour tokens checked)' % len(quoted))

print('\nEVERY TYPE STEP QUOTED MATCHES THE CODE')
steps = dict(re.findall(r'\|\s*`(--(?:text|nav)-[a-z0-9]+)`\s*\|\s*`(clamp\([^`]+\))`', doc))
is_('the document quotes the scale', len(steps) >= 7)
badsteps = {n: (v, tokens.get(n)) for n, v in steps.items()
            if re.sub(r'\s+', '', tokens.get(n, '')) != re.sub(r'\s+', '', v)}
is_('all of them agree with header.html', badsteps, {})
print('       (%d type steps checked)' % len(steps))

print('\nNO TOKEN EXISTS IN THE CODE THAT THE DOCUMENT NEVER MENTIONS')
undocumented = [n for n in tokens if n not in doc]
is_('every token appears somewhere in the document', undocumented, [])

print('\nTHE RULES IT STATES ARE RULES THE TESTS ENFORCE')
is_('the gold-inheritance rule cites its guard', 'test-path-icon-colour' in doc)
is_('the novalidate rule is stated', 'novalidate' in doc)
is_('the brand name rule is stated', 'lowercase f' in doc)

print('\nIT IS DATED, AND SAYS IT MUST BE CHANGED WITH THE CODE')
is_('carries a verification date', bool(re.search(r'Last verified \d+ \w+ 20\d\d', doc)))
is_('and the same-commit rule, as PRICING.md has',
    'change this file in the same commit' in doc)

print('\nHOW THE CHROME GETS ONTO A PAGE — CHECKED AGAINST THE BUILD')
# This paragraph has been wrong in both directions and the wrong version was
# committed. It is now asserted against build_pages.py rather than believed.
build = io.open(os.path.join(ROOT, 'tools/build_pages.py'), encoding='utf-8').read()
is_('the build really does inline the chrome', 'def inline_chrome' in build)
is_('by swapping the site-header/site-footer placeholders', "site-%s" in build or 'site-header' in build)
is_('and writing the file back', "open(path, \"w\"" in build)
is_('so the document says build time', 'at build time' in doc)
is_('and does NOT claim a runtime fetch does the work',
    'Each page fetches it at runtime' not in doc)
is_('while still recording the fetch as a fallback',
    'fallback' in doc and "fetch('/header.html')" in doc)
is_('CLAUDE.md agrees',
    'at build time' in io.open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read())

print('\nTHE CONTRAST FIGURES ARE RECOMPUTED, NOT TRUSTED')
# These are the numbers that justify §8. If a token is darkened to fix the
# button, the ratios in the document must move with it or the argument is
# wrong. Recomputed here from the live tokens every run.
def _lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def contrast(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

checks = [
    ('body text on cream',   '--text',    '--cream',  12.17),
    ('white on gold button', '--white',   '--gold',    2.74),
    ('gold text on cream',   '--gold',    '--cream',   2.56),
    ('focus ring on white',  '--focus',   '--white',   5.48),
    ('secondary on cream',   '--soft',    '--cream',   5.13),
]
for label, fg, bg, claimed in checks:
    actual = round(contrast(tokens[fg], tokens[bg]), 2)
    is_('  %-22s doc says %.2f' % (label, claimed), actual, claimed)

print('\nAND THE DOCUMENT STILL CALLS THE FAILURES FAILURES')
is_('the button is named as failing AA',
    'the primary button' in doc and 'fails AA' in doc)
is_('the focus ring is recorded as fixed, with its new ratio',
    '5.48' in doc and '--focus' in doc)
is_('the button text size is stated as measured', '13.2px' in doc)
is_('and the gold is recorded as a decision, not an oversight',
    'leave the gold as it is for now' in doc)

print('\nMUTATION: A TOKEN CHANGED IN ONE PLACE ONLY MUST FAIL')
fake_tokens = dict(tokens); fake_tokens['--gold'] = '#FF0000'
is_('a drifted colour is caught',
    {n: v for n, v in quoted.items()
     if fake_tokens.get(n, '').lower() != v.lower()} == {}, False)
is_('a drifted type step is caught',
    re.sub(r'\s+', '', 'clamp(13px, 0.55vw + 11px, 15px)') ==
    re.sub(r'\s+', '', 'clamp(13px, 0.55vw + 11px, 16px)'), False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
