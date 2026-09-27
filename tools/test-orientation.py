#!/usr/bin/env python3
"""Pull the orientation and press-page code out of upload-and-print.html and
check its geometry with jsc.  Run:  python3 tools/test-orientation.py

Portrait and landscape are the same sheet of paper turned ninety degrees — a
fact measured against PrintedEasy, who quote the same price either way.  These
assertions are what stops that turning into a wrong-shaped card: the press page
must be the portrait page's dimensions swapped, and a landscape folded card must
crease across the top rather than down the side.
"""
import io, os, subprocess, sys, tempfile

JSC = ('/System/Library/Frameworks/JavaScriptCore.framework/Versions/A'
       '/Helpers/jsc')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

s = io.open(os.path.join(ROOT, 'upload-and-print.html'), encoding='utf-8').read()

def block(start, end):
    i = s.index(start)
    return s[i:s.index(end, i)]

harness = io.open(os.path.join(ROOT, 'tools', 'orientation-assertions.js'),
                  encoding='utf-8').read()

src = '\n'.join([
    block('let SIZE_SPECS = {', '\n\n'),
    "const PRINT_BLEED_MM = 3, PRINT_MARKS_MM = 5;\n"
    "let selectedSize='A6', selectedOrientation='portrait', FAMILY='flat-card';\n"
    "function printingFamily(){ return FAMILY; }\n"
    "function getAvailableSizes(){ return new Set(); }\n",
    block('function sizeSpec(key, orientation){', '\nfunction proofGeometry'),
    block('function foldedSheetFor(spec){', '\nasync function buildPrintReadyPdfFromVector'),
    harness,
])

with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                 encoding='utf-8') as f:
    f.write(src)
    path = f.name
try:
    out = subprocess.run([JSC, path], capture_output=True, text=True)
    sys.stdout.write(out.stdout)
    sys.stderr.write(out.stderr)
    sys.exit(0 if ' 0 failed' in out.stdout else 1)
finally:
    os.unlink(path)
