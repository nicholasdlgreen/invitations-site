#!/usr/bin/env python3
"""The CSP actually allows the worker pdf.js tries to start.

Not "worker-src is present". It was present for four days while the worker was
still blocked, because it read `'self' blob:` on the belief that pdf.js starts
its worker from a blob: URL. pdf.js v3 does not: it points
GlobalWorkerOptions.workerSrc at the cdnjs file and calls new Worker() on that
URL. Proven in the live page, 7 October 2026:

    Failed to construct 'Worker': Script at
    'https://cdnjs.cloudflare.com/.../pdf.worker.min.js'
    cannot be accessed from origin 'https://foreverprint.com'

With the worker blocked, pdf.js falls back to its main-thread "fake worker" and
every PDF the site reads is parsed and rendered on the UI thread. That is the
40-second hang on "Checking your foil layer..." from 3 October.

So this test reads the worker URL out of the page and the directive out of
netlify.toml and checks they agree. Two files, one fact, and the fault was that
nothing compared them.

Run:  python3 tools/test-pdf-worker-allowed.py
"""
import io, os, re, sys
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0

def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

PAGE = io.open(os.path.join(ROOT, 'upload-and-print.html'), encoding='utf-8').read()
TOML = io.open(os.path.join(ROOT, 'netlify.toml'), encoding='utf-8').read()

def worker_url(page=None):
    m = re.search(r"const PDFJS_WORKER\s*=\s*'([^']+)'", page or PAGE)
    return m.group(1) if m else None

def policy(toml=None):
    """The CSP value itself. Parsing the file loosely matched the COMMENT above
    the directive, which also contains the words "worker-src", and reported the
    policy as broken when it was fine. Take the quoted value and nothing else."""
    m = re.search(r'Content-Security-Policy\s*=\s*"([^"]+)"', toml or TOML)
    return m.group(1) if m else None

def directive(name, toml=None):
    pol = policy(toml)
    if not pol: return None
    for part in pol.split(';'):
        part = part.strip()
        if part.startswith(name + ' '):
            return part[len(name):].strip()
    return None

def worker_src(toml=None):
    return directive('worker-src', toml)

def allowed(url, directive):
    """Would a browser let new Worker(url) run under this worker-src?"""
    if not url or not directive: return False
    sources = directive.split()
    if url.startswith('blob:'):  return "blob:" in sources
    o = urlparse(url)
    if not o.scheme:             return "'self'" in sources
    origin = '%s://%s' % (o.scheme, o.netloc)
    return origin in sources or "'self'" in sources and origin == ''

print('\nBOTH HALVES OF THE FACT ARE WHERE WE THINK THEY ARE')
is_('the page names a pdf.js worker', bool(worker_url()))
is_('and the CSP has a worker-src', bool(worker_src()))
print('       worker:     %s' % worker_url())
print('       worker-src: %s' % worker_src())

print('\nAND THEY AGREE')
is_('the worker pdf.js starts is permitted by the CSP',
    allowed(worker_url(), worker_src()))

print('\nTHE WORKER COMES FROM AN ORIGIN WE ALREADY EXECUTE CODE FROM')
# Not a new trust: pdf.js itself loads from the same place under script-src.
m = re.search(r"const PDFJS_SRC\s*=\s*'([^']+)'", PAGE)
lib = urlparse(m.group(1)) if m else None
wrk = urlparse(worker_url())
is_('the library and its worker share an origin',
    (lib.scheme, lib.netloc) == (wrk.scheme, wrk.netloc))
is_('and script-src already allows it',
    '%s://%s' % (wrk.scheme, wrk.netloc) in (directive('script-src') or '').split())

print('\nMUTATION: EACH WAY THIS CAN BREAK MUST FAIL')
# 1. The directive as it stood for four days — present, and still wrong.
old = worker_src().replace(' https://cdnjs.cloudflare.com', '')
is_('the mutation changed the directive', old != worker_src())
is_("'self' blob: alone is caught", allowed(worker_url(), old), False)

# 2. The directive dropped altogether, which is the 3 October fault.
is_('no worker-src at all is caught', allowed(worker_url(), None), False)

# 3. pdf.js moved to a different CDN and nobody updated the CSP.
moved = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
is_('a worker moved to another origin is caught',
    allowed(moved, worker_src()), False)

# 4. Self-hosting it would be fine, and must not be reported as broken.
is_('a self-hosted worker would pass', allowed('/vendor/pdf.worker.min.js', worker_src()))

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
