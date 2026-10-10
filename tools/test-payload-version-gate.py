#!/usr/bin/env python3
"""Nothing decides the payload's SHAPE by reading its version number.
Run:  python3 tools/test-payload-version-gate.py

On 24 September twenty of twenty-one landing pages tested
`schema_version === 2` while Publish was writing 3. Every one of them silently
discarded the payload and showed "Pricing to be confirmed" -- no error, on
every product page, for a day. docs/PRICING.md section 6 carries the rule that came
out of it: WIDEN THE TEST RATHER THAN RAISE THE NUMBER.

The same trap was reintroduced on 9 October and caught before it was applied.
The first draft of the dedup migration branched on `schema_version >= 3` to
decide whether the catalogue carried a shared rate set -- and the LIVE payload
has said 3 since the hierarchical publish, so it would have gone looking for a
rate set that was not there and blanked every price on the site.

So this test guards two things:

  1. The migration asks the DATA (`payload ? 'rate_sets'`), never the label.
  2. Every reader still in the code accepts the number Publish actually writes.

A version number has drifted once here. The presence of a key cannot.
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

def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()

def strip_comments(src):
    """Comments explain the trap; they must not be mistaken for the trap."""
    src = re.sub(r'/\*.*?\*/', ' ', src, flags=re.S)
    src = re.sub(r'(?m)^\s*//[^\n]*', ' ', src)
    src = re.sub(r'(?m)//[^\n"\']*$', ' ', src)
    src = re.sub(r'(?s)<!--.*?-->', ' ', src)
    return src

def sql_strip_comments(src):
    return re.sub(r'(?m)^\s*--[^\n]*', ' ', src)

# --- 1. the migration decides by the data ----------------------------------
print('THE MIGRATION ASKS THE DATA, NOT THE LABEL')
MIG = 'supabase/migrations/20261009_pricing_payload_v3.sql'
mig = sql_strip_comments(read(MIG))

is_('it gates on the rate set being present', len(re.findall(r"payload \? 'rate_sets'", mig)), 2)
is_('and nowhere branches on the version number',
    re.search(r"schema_version'\s*\)\s*::int|schema_version'\s*\)\s*[<>=]", mig) is None)
is_('the version is still passed through to callers untouched',
    "'schema_version', c.payload -> 'schema_version'" in mig)

# --- 2. what Publish writes, and what every reader accepts ------------------
print('\nEVERY READER ACCEPTS THE NUMBER PUBLISH ACTUALLY WRITES')
admin = strip_comments(read('admin.html'))
m = re.search(r'schema_version:\s*(\d+)', admin)
is_('admin states the version it publishes', m is not None)
published = int(m.group(1)) if m else None
print('         Publish writes schema_version: %r' % published)

# Every file that could be served to a visitor.
targets = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames
                   if d not in ('.git', 'node_modules', 'docs', 'tools', 'supabase')]
    for fn in filenames:
        if fn.endswith('.html') or fn.endswith('.js'):
            targets.append(os.path.relpath(os.path.join(dirpath, fn), ROOT))

GATE = re.compile(r'schema_version\s*(===|==|>=|<=|!==|!=|>|<)\s*(\d+)')
gates, refused = [], []
for rel in sorted(targets):
    for op, num in GATE.findall(strip_comments(read(rel))):
        gates.append((rel, op, int(num)))
        ok = {'===': lambda a, b: a == b, '==': lambda a, b: a == b,
              '>=':  lambda a, b: a >= b, '<=': lambda a, b: a <= b,
              '>':   lambda a, b: a >  b, '<':  lambda a, b: a <  b,
              '!==': lambda a, b: a != b, '!=': lambda a, b: a != b,
              }[op](published, int(num))
        if not ok:
            refused.append('%s  (schema_version %s %s)' % (rel, op, num))

print('         %d version gate(s) in pages served to visitors' % len(gates))
for rel, op, num in gates:
    print('           %s  %s %s' % (rel, op, num))
is_('no page refuses the payload Publish writes', refused, [])

# Exact equality is the shape of the September bug even when it happens to pass
# today, because the next bump breaks it silently rather than loudly.
exact = ['%s (%s %s)' % (r, o, n) for r, o, n in gates if o in ('===', '==')]
is_('no page pins an EXACT version', exact, [])

print('\nMUTATION: EACH GUARD MUST FAIL WHEN THE TRAP IS PUT BACK')
mut = mig.replace("payload ? 'rate_sets'", "coalesce((c.payload ->> 'schema_version')::int, 2) >= 3")
is_('a version branch in the migration is caught',
    len(re.findall(r"payload \? 'rate_sets'", mut)) == 2, False)
is_('and the ::int form is caught',
    re.search(r"schema_version'\s*\)\s*::int", mut) is not None)
is_('a reader pinned to the wrong number is caught',
    GATE.search('if (payload.schema_version === 2)').group(1) == '===')

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
