#!/usr/bin/env python3
"""The wording is fitted to a clear area on the card, on BOTH studio pages.

What this guards, and why each one is here:

  * The two pages agree on the three numbers. The whole promise is that a
    design looks the same after you click "Make some tweaks" as it did before.
  * Both text blocks are 78% of the card wide. The tweak page was 84%, so the
    identical wording wrapped onto more lines there and a block that had been
    fitted to 62% arrived taller.
  * The fit note sits OUTSIDE .ds-preview. --ds-chrome is measured as the
    preview's height minus the card's, and the card is capped by whatever the
    window has left after the chrome -- so a note inside the box took 76px off
    the card, which made the wording need a smaller scale, which kept the note
    up. Measured 6 October 2026: it shrank the card from 324x457 to 270x381.
  * The only floor is the 7pt print rule. There was a flat 0.5 as well, and on
    A5 that was what stopped the fit while the smallest line was still 7.9pt.
  * rescale() shares that floor. With a flat 0.5 of its own, wording that
    auto-fitted to 0.44 got BIGGER when you pressed the minus button.
"""
import io, re, sys

CREATE = 'design-studio-ai-create.html'
TWEAK  = 'design-studio-tweak.html'
passed = failed = 0

def check(name, got, want):
    global passed, failed
    ok = got == want
    if ok:
        passed += 1; print('  ok   %s' % name)
    else:
        failed += 1; print('  FAIL %s   got %r, want %r' % (name, got, want))
    return ok

def read(p):
    return io.open(p, encoding='utf-8').read()

def const(src, name):
    m = re.search(r'var\s+%s\s*=\s*([0-9.]+)\s*;' % name, src)
    return m.group(1) if m else None

def stack_width(src, selector):
    """The declared width of the text block, from its own rule."""
    m = re.search(re.escape(selector) + r'\{([^}]*)\}', src)
    if not m: return None
    w = re.search(r'(?<!max-)width:\s*([0-9]+)%', m.group(1))
    return w.group(1) + '%' if w else None

def note_is_outside_preview(src):
    """True when #ds-fit-note is not inside the .ds-preview box."""
    note = src.find('id="ds-fit-note"')
    if note < 0: return None
    open_pv = src.find('class="ds-preview"')
    if open_pv < 0 or open_pv > note: return None
    # walk the divs between the preview opening and the note; if depth returns
    # to zero before we reach it, the note is outside the box.
    seg = src[open_pv:note]
    depth = len(re.findall(r'<div\b', seg)) - len(re.findall(r'</div>', seg))
    return depth <= 0

def run(create, tweak):
    global passed, failed
    print('THE TWO PAGES AGREE ON THE TEXT AREA')
    for n, want in (('TEXT_AREA_W', '0.78'), ('TEXT_AREA_H', '0.62'), ('MIN_PRINT_PT', '7')):
        c, t = const(create, n), const(tweak, n)
        check('%s is %s on the create page' % (n, want), c, want)
        check('%s matches on the tweak page' % n, t, c)

    print('\nBOTH TEXT BLOCKS ARE THE SAME WIDTH, OR THE WORDING WRAPS DIFFERENTLY')
    check('create: generated stack is 78%',
          stack_width(create, '.ds-canvas.is-generated .ds-stack'), '78%')
    check('tweak: stack is 78%', stack_width(tweak, '.tw-stack'), '78%')

    print('\nTHE NOTE MUST NOT STEAL CARD HEIGHT')
    check('the fit note sits outside .ds-preview', note_is_outside_preview(create), True)

    print('\n7PT IS THE ONLY FLOOR')
    for label, src in (('create', create), ('tweak', tweak)):
        m = re.search(r'function minLegibleScale\(\)\{(.*?)\n  \}', src, re.S)
        body = m.group(1) if m else ''
        check('%s: the floor is computed from MIN_PRINT_PT' % label,
              'MIN_PRINT_PT / 2.835' in body, True)
        check('%s: no flat 0.5 clamp on the result' % label,
              re.search(r'Math\.max\(0\.5,\s*floorMm', body) is None, True)

    print('\nTHE MINUS BUTTON CANNOT MAKE THE TEXT BIGGER')
    m = re.search(r'function rescale\(delta\)\{(.*?)\n  \}', create, re.S)
    body = m.group(1) if m else ''
    check('rescale shares minLegibleScale()', 'minLegibleScale()' in body, True)
    check('rescale has no floor of its own',
          re.search(r'Math\.max\(0\.5,\s*Math\.min', body) is None, True)

    print('\nTHE CARD SHAPE TRAVELS WITH THE DESIGN')
    check('create sends the card ratio', 'cardRatio:' in create, True)
    check('create sends the height in mm', 'heightMm:' in create, True)
    check('tweak applies the ratio', 'state.cardRatio' in tweak, True)
    check('tweak uses the mm for its floor', 'state.heightMm' in tweak, True)

create, tweak = read(CREATE), read(TWEAK)
run(create, tweak)

print('\nMUTATION: EACH FAULT COMING BACK MUST FAIL')
def mutates(name, src_c, src_t):
    global passed, failed
    before = failed
    import contextlib, io as _io
    with contextlib.redirect_stdout(_io.StringIO()):
        run(src_c, src_t)
    caught = failed > before
    failed = before
    if caught:
        passed += 1; print('  ok   %s is caught' % name)
    else:
        failed += 1; print('  FAIL %s SLIPPED THROUGH' % name)

mutates('a tweak page back at 84%', create,
        tweak.replace('.tw-stack{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:78%',
                      '.tw-stack{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:84%'))
mutates('the two pages disagreeing on the text area', create,
        tweak.replace('var TEXT_AREA_H = 0.62;', 'var TEXT_AREA_H = 0.70;'))
mutates('the note moved back inside the preview box',
        create.replace('      </div>\n      <!-- Outside .ds-preview on purpose.',
                       '      <!-- Outside .ds-preview on purpose.')
              .replace('<div class="ds-fit-note" id="ds-fit-note" role="status" style="display:none;"></div>',
                       '<div class="ds-fit-note" id="ds-fit-note" role="status" style="display:none;"></div>\n      </div>'),
        tweak)
mutates('the flat 0.5 clamp returning',
        create.replace('Math.max(0.2, floorMm / mmAtScale1)', 'Math.max(0.5, floorMm / mmAtScale1)'), tweak)
mutates('rescale growing its own floor back',
        create.replace('Math.max(minLegibleScale(), Math.min(1.8, textScale + delta))',
                       'Math.max(0.5, Math.min(1.8, textScale + delta))'), tweak)
mutates('the card shape not travelling', create.replace('cardRatio:', 'cardRatioX:'), tweak)

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
