#!/usr/bin/env python3
"""The focus ring is visible, and page titles are one size.
Run:  python3 tools/test-focus-and-headings.py

Two changes made on 6 October 2026.

THE FOCUS RING. It was --gold-lt (1.89:1 on white) on most pages and --gold
(2.74:1) on the five sign-in pages. An interface element needs 3:1, so neither
passed, and the sign-in pages are exactly where someone using a keyboard most
needs to see where they are. All of them now use a --focus role token set to
#7A6558 — 5.48:1, and a colour already in the palette. The brand gold was
deliberately left alone.

Every usage is written var(--focus, var(--soft)) rather than var(--focus).
--focus is defined in header.html, which pages fetch at RUNTIME, so it can be
cached stale or fail. Without a fallback, border-color:var(--focus) resolves to
currentColor and the ring renders as body text — observed while testing this.
--soft is declared in every page's own :root, so it is a safe local fallback.

PAGE TITLES. Eight different sizes across eight pages. They now all use
var(--text-h1). The token was repointed from clamp(40px, 3.8vw + 21px, 58px),
which nothing used, to clamp(2rem, 3.6vw, 3rem), which 24 product pages already
used via .lp-h1 — otherwise standardising would have enlarged those 24 pages.

Hero headings are deliberately excluded. A hero is a different role from a page
title and keeps its own larger scale — the homepage, wedding-albums, the album
builder and saved-designs all have one.
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

def lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def contrast(a, b):
    la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

pages = []
for dp, dn, fns in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'scratch', 'docs',
                                        'tools', 'netlify', 'supabase')]
    for fn in sorted(fns):
        if fn.endswith(('.html', '.css')):
            p = os.path.join(dp, fn)
            pages.append((os.path.relpath(p, ROOT),
                          io.open(p, encoding='utf-8', errors='ignore').read()))
header = dict(pages)['header.html']
tokens = {n: v.strip() for n, v in
          re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);',
                     re.search(r':root\s*\{([^}]*)\}', header).group(1))}

print('\nTHE FOCUS RING CLEARS THE INTERFACE THRESHOLD')
is_('a --focus token exists', '--focus' in tokens)
ratio = round(contrast(tokens['--focus'], '#FFFFFF'), 2)
is_('it beats 3:1 on white (got %.2f)' % ratio, ratio >= 3.0)
is_('comfortably, not marginally', ratio >= 4.5)
is_('and it reuses --soft rather than inventing a colour',
    tokens['--focus'].lower(), tokens['--soft'].lower())

print('\nNO FOCUS RULE IS LEFT ON A COLOUR THAT FAILS')
FOCUS_RULE = re.compile(r'[^{}]*:focus(?:-within)?[^{}]*\{[^}]*\}')
bad = []
for f, t in pages:
    for rule in FOCUS_RULE.findall(t):
        m = re.search(r'border-color:\s*(var\([^;]*\)|#[0-9A-Fa-f]{3,6})', rule)
        if m and '--focus' not in m.group(1):
            bad.append((f, m.group(1)))
is_('every focus border uses the token', bad, [])

print('\nAND EVERY USAGE SURVIVES THE HEADER NOT LOADING')
# header.html is fetched at runtime; a bare var(--focus) falls back to
# currentColor, which paints the ring in the body text colour.
unqualified = []
for f, t in pages:
    if f == 'header.html': continue
    for m in re.findall(r'var\(--focus[^)]*\)+', t):
        if 'var(--soft)' not in m: unqualified.append((f, m))
is_('no bare var(--focus) in page CSS', unqualified, [])

print('\nPAGE TITLES ARE ONE SIZE')
is_('the token is the size the site already used',
    re.sub(r'\s+', '', tokens['--text-h1']), 'clamp(2rem,3.6vw,3rem)')
RULE = re.compile(r'([^{}]{0,200})\{([^{}]{0,400})\}')
h1_rules = []
for f, t in pages:
    for sel, body in RULE.findall(t):
        if 'h1' not in sel.lower() or 'font-size:' not in body: continue
        # A hero is a different role from a page title and keeps its own,
        # larger scale: .hero-h1, .hero h1, .builder-hero h1, .page-hero h1.
        if 'hero' in sel.lower(): continue
        h1_rules.append((f, sel + '{' + body + '}'))
    # headings written as an inline style attribute, not a rule
    for m in re.findall(r'<h1[^>]*style="([^"]*font-size:[^"]*)"', t, re.I):
        if 'hero' not in m.lower():
            h1_rules.append((f, 'inline{' + m + '}'))
off = [(f, re.search(r'font-size:\s*([^;]+);', m).group(1))
       for f, m in h1_rules if 'var(--text-h1)' not in m]
is_('no page-title rule sets its own size', off, [])
weights = set(re.search(r'font-weight:\s*(\d+)', m).group(1)
              for f, m in h1_rules if re.search(r'font-weight:\s*\d+', m))
is_('and they share one weight', sorted(weights), ['400'])
print('       (%d heading rules on the token)' % len(h1_rules))

print('\nTHE BRAND GOLD WAS NOT TOUCHED')
is_('--gold is unchanged', tokens['--gold'].upper(), '#B8976A')
is_('--gold-lt is unchanged', tokens['--gold-lt'].upper(), '#D4B896')

print('\nMUTATION: EACH FAULT COMING BACK MUST FAIL')
is_('the old pale-gold ring is caught', contrast('#D4B896', '#FFFFFF') >= 3.0, False)
is_('the old gold ring is caught too', contrast('#B8976A', '#FFFFFF') >= 3.0, False)
is_('a bare var(--focus) is caught',
    'var(--soft)' in 'border-color:var(--focus);', False)
is_('an h1 with its own size is caught',
    'var(--text-h1)' in '.x h1{font-size:clamp(2rem,4vw,3rem);}', False)
is_('and the old token value would be caught',
    re.sub(r'\s+', '', 'clamp(40px, 3.8vw + 21px, 58px)') == 'clamp(2rem,3.6vw,3rem)', False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
