#!/usr/bin/env python3
"""CLAUDE.md points at files that exist and rules that are real.
Run:  python3 tools/test-claude-md.py

CLAUDE.md is the file Claude reads at the start of every session, so it is the
one place where being out of date does real damage: a wrong path is silently
ignored and the rule behind it is simply never applied.

Every document it references must exist, and every test it names must exist and
pass. If a guide is renamed or a test deleted, this fails and says which.
"""
import io, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

doc = io.open(os.path.join(ROOT, 'CLAUDE.md'), encoding='utf-8').read()

print('\nEVERY FILE IT SENDS YOU TO EXISTS')
refs = sorted(set(re.findall(r'`((?:docs/|tools/)?[A-Za-z0-9_.-]+\.(?:md|py|html|js))`', doc)))
missing = [r for r in refs if not os.path.exists(os.path.join(ROOT, r))]
is_('no broken path', missing, [])
print('       (%d files referenced)' % len(refs))

print('\nEVERY TEST IT NAMES ACTUALLY PASSES')
named = sorted(set(re.findall(r'`(tools/test-[A-Za-z0-9_-]+\.py)`', doc)))
is_('it names some tests', len(named) >= 2)
for t in named:
    r = subprocess.run([sys.executable, os.path.join(ROOT, t)],
                       capture_output=True, cwd=ROOT)
    is_('  %s passes' % t, r.returncode, 0)

print('\nTHE CLAIMS IT MAKES ABOUT THE BUILD ARE TRUE')
build = io.open(os.path.join(ROOT, 'tools/build_pages.py'), encoding='utf-8').read()
is_('build_pages.py injects the header', 'header' in build.lower())
header = io.open(os.path.join(ROOT, 'header.html'), encoding='utf-8').read()
is_('header.html really holds the :root block', ':root' in header)
is_('and CLAUDE.md says so', 'header.html' in doc and ':root' in doc)

print('\nTHE RULES THAT COST US BUGS ARE ALL STATED')
for rule, text in [('token over literal', 'never a hex literal'),
                   ('inherited colour in a link', 'inherited inside a link'),
                   ('novalidate', 'novalidate'),
                   ('no unagreed copy', 'never ship copy that has not been agreed'),
                   ('commit but never push', 'Never push'),
                   ('mutation-test', 'Mutation-test'),
                   ('verify in a browser', 'Verify in a browser')]:
    is_('  %s' % rule, text in doc)

print('\nMUTATION: A BROKEN REFERENCE MUST FAIL')
is_('a missing file is caught',
    os.path.exists(os.path.join(ROOT, 'docs/NOT-A-REAL-FILE.md')), False)
is_('and the pattern would have matched it',
    bool(re.search(r'`((?:docs/|tools/)?[A-Za-z0-9_.-]+\.(?:md|py|html|js))`',
                   'see `docs/NOT-A-REAL-FILE.md` for more')))

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
