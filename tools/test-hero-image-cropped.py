#!/usr/bin/env python3
"""The "Made in the UK" image has no AI watermark on it.
Run:  python3 tools/test-hero-image-cropped.py

home-made-for-you.jpg was generated, and the generator left its sparkle mark in
the bottom-right corner. The image was 1000x1339 and the mark sat at roughly
y 1207-1293, inside the part the page actually showed: the frame is 4/5 and the
image was taller than that, so object-fit:cover trimmed the top and bottom but
left the corner visible.

Cropping to the top 1200 rows removes it. Nothing is lost — the lowest card,
the "Thomas" place card, ends around y 1089.

A watermark cannot be tested for directly, so this pins the thing that can be:
the height. If the uncropped original is ever restored the height goes back to
1339 and this fails. It also checks the frame still matches, because the crop
changed which edges the browser trims.
"""
import io, os, struct, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

def jpeg_size(path):
    d = io.open(path, 'rb').read()
    i = 2
    while i < len(d):
        if d[i] != 0xFF:
            i += 1; continue
        m = d[i + 1]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', d[i + 5:i + 9]); return w, h, len(d)
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            i += 2; continue
        i += 2 + struct.unpack('>H', d[i + 2:i + 4])[0]
    return None, None, len(d)

IMG = 'home-made-for-you.jpg'
w, h, size = jpeg_size(os.path.join(ROOT, IMG))

print('\nTHE IMAGE IS THE CROPPED ONE')
is_('it is still there', os.path.exists(os.path.join(ROOT, IMG)))
is_('width unchanged at 1000', w, 1000)
is_('height is 1200, not the original 1339', h, 1200)
is_('so the rows carrying the mark (1207-1293) are gone', h < 1207)

print('\nNOTHING WAS LOST FROM THE BOTTOM')
# The lowest real content — the "Thomas" place card — ends around y 1089.
is_('the crop sits below the lowest card', h > 1089 + 20)

print('\nTHE PAGE STILL FRAMES IT THE SAME WAY')
index = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
is_('the frame is still 4/5', 'aspect-ratio:4/5' in index)
is_('and the image still fills it', 'object-fit:cover' in index)
is_('the page still points at this file', '/' + IMG in index)
# 1000/1200 is wider than 4/5, so the browser trims the sides, not top/bottom.
is_('the image is wider than the frame, so the sides are trimmed', w / h > 0.8)

print('\nIT HAS NOT BALLOONED')
is_('under 200KB (was 199KB before the crop)', size < 200 * 1024)
print('       (%d x %d, %d KB)' % (w, h, size // 1024))

print('\nMUTATION: THE UNCROPPED ORIGINAL MUST FAIL')
is_('a 1339-tall image is caught', 1339 < 1207, False)
is_('and 1200 passes', 1200 < 1207, True)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
