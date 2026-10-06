#!/usr/bin/env python3
"""The mobile menu shows the whole range, and desktop's mega-menu is untouched.
Run:  python3 tools/test-mobile-menu.py

Nicholas said he could only see wedding products on his phone. He was right.
Opened at 375px the menu ran to 1,880px on an 812px screen: 12 of its 28 items
were reachable without scrolling, and those 12 were "All Products" and all
eleven wedding products. Celebrations sat at the very bottom edge and
Announcements two screens below it, so the range looked like weddings and
nothing else. Measured 6 October 2026.

The three categories now collapse. The menu is 416px, all six top-level items
fit on one screen, and a tap opens a category.

DESKTOP AND MOBILE SHARE ONE #mainNav. That is why this test exists in this
shape. The collapse CSS is entirely inside @media(max-width:768px) and the
script only adds a class, so nothing outside that query refers to
.mega-col.open and desktop cannot change. Measured at 1280, 1024 and 900
before and after: the panel is 638px, the columns 564px, 25 links — identical.

The headings stay <div>s because desktop's layout relies on them. role,
tabindex and aria-expanded are set by the script at runtime, on mobile only,
so the markup a desktop visitor gets is the markup that was always there.
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

header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read()

def block(css, query):
    i = css.index(query); d, j = 0, i + len(query) - 1
    while j < len(css):
        if css[j] == '{': d += 1
        elif css[j] == '}':
            d -= 1
            if d == 0: return css[i:j + 1]
        j += 1
    return ''

mobile = block(header, '@media(max-width:768px){')
outside = re.sub(r'@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}', '', header)
script = header[header.index('<script>'):]

print('\nTHE CATEGORIES COLLAPSE ON A PHONE')
is_('the links are hidden until a category is opened', '.mega-col > a{display:none;}' in mobile)
is_('and shown when it is', '.mega-col.open > a{display:block;}' in mobile)
is_('the heading is a 48px target', 'min-height:48px' in mobile)
is_('it shows a + / − affordance', '.mega-cat::after{content:"+"' in mobile)
is_('which flips when open', '.mega-col.open > .mega-cat::after' in mobile)

print('\nNONE OF IT CAN REACH DESKTOP')
# If any of these appear outside the query, desktop's mega-menu changes.
for rule in ('.mega-col > a{display:none', '.mega-col.open', 'min-height:48px'):
    is_('  %-28s is not outside the query' % rule, rule not in outside)
is_('nothing outside the query mentions the open class at all',
    '.mega-col.open' not in outside)

print('\nTHE SCRIPT IS GUARDED BY THE SAME BREAKPOINT')
is_('it checks the width before binding',
    "matchMedia('(max-width:768px)').matches" in script)
is_('and returns early when it does not match',
    re.search(r"matchMedia\('\(max-width:768px\)'\)\.matches\) return;", script) is not None)
is_('it toggles a class rather than styling anything itself',
    "classList.toggle('open')" in script)
is_('no inline style is set on the columns',
    not re.search(r'\.mega-col[^;]*\.style\.', script))

print('\nTHE MARKUP IS UNCHANGED, WHICH IS WHAT KEEPS DESKTOP SAFE')
is_('the headings are still plain divs', '<div class="mega-cat">' in header)
is_('no role in the markup', 'role="button"' not in re.sub(r'<script>.*', '', header, flags=re.S))
is_('no tabindex in the markup', 'tabindex=' not in re.sub(r'<script>.*', '', header, flags=re.S))
is_('they are set at runtime instead',
    "setAttribute('role','button')" in script and "setAttribute('tabindex','0')" in script)

print('\nIT IS REACHABLE BY KEYBOARD')
is_('aria-expanded is maintained', "setAttribute('aria-expanded'" in script)
is_('Enter and Space work', "e.key === 'Enter'" in script and "e.key === ' '" in script)
is_('and they do not also scroll the page', 'preventDefault()' in script)

print('\nTHE THREE CATEGORIES STILL EXIST')
for cat in ('Weddings', 'Celebrations', 'Announcements'):
    is_('  %s' % cat, '<div class="mega-cat">%s</div>' % cat in header)
is_('each still has a View all', len(re.findall(r'class="mega-viewall"', header)), 3)

print('\nMUTATION: A RULE ESCAPING TO DESKTOP MUST FAIL')
leaked = outside + '.mega-col > a{display:none;}'
is_('a collapse rule left outside is caught', '.mega-col > a{display:none' not in leaked, False)
is_('an unguarded script is caught',
    "matchMedia('(max-width:768px)').matches" in "(function(){ var cols=...; })();", False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
