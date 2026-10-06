#!/usr/bin/env python3
"""Recompute the spacing figures in docs/BRAND.md from the site.
Run:  python3 tools/refresh-spacing-figures.py

docs/BRAND.md §4 argues for the spacing scale with real counts: how many
declarations use each step, and how many would have to move under each
candidate scale. tools/test-spacing-scale.py recomputes those from the source
and fails when they drift.

Which is correct, and which means ANY change touching padding, margin or gap
makes the document stale — it happened three times on 6 October alone, from
deleting the album pages, adding the mobile header rules, and adding a hint
style to the checkout. Rewriting the table by hand each time invites a wrong
number. This does it.
"""
import io, os, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEPS = [4, 8, 12, 16, 20, 24, 32, 48, 60, 80]
CANDIDATES = {
    'Strict 4px grid':               [4, 8, 12, 16, 24, 32, 48, 64],
    'Strict 8px grid':               [8, 16, 24, 32, 48, 64, 80],
    'These ten steps':               STEPS,
    'These ten plus a 6/10/14 tier': [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 48, 60, 80],
}

vals, files = collections.Counter(), 0
for dp, dn, fns in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'scratch', 'docs',
                                        'tools', 'netlify', 'supabase')]
    for fn in sorted(fns):
        if not fn.endswith(('.html', '.css')): continue
        files += 1
        t = io.open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()
        t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
        for prop in ('padding', 'margin', 'gap', 'row-gap', 'column-gap'):
            for m in re.findall(r'(?<![a-z-])%s\s*:\s*([^;}"]+)' % prop, t):
                for tok in m.split():
                    if re.fullmatch(r'\d+px', tok.strip()):
                        vals[int(tok.strip()[:-2])] += 1
total = sum(vals.values())

p = os.path.join(ROOT, 'docs/BRAND.md')
doc = io.open(p, encoding='utf-8').read()
for i, px in enumerate(STEPS, 1):
    doc = re.sub(r'(\| `--space-%d` \| `%dpx` \| )[\d,]+' % (i, px),
                 lambda m: m.group(1) + format(vals[px], ','), doc)
doc = re.sub(r'\*\*[\d,]+ spacing declarations using \d+ distinct values\*\*',
             '**%s spacing declarations using %d distinct values**' % (format(total, ','), len(vals)), doc)
for name, steps in CANDIDATES.items():
    hit = sum(n for v, n in vals.items() if v in steps)
    doc = re.sub(r'\| %s \| \d+%% \| [\d,]+( declarations)? \|' % re.escape(name),
                 '| %s | %d%% | %s%s |' % (name, round(100 * hit / total), format(total - hit, ','),
                                           ' declarations' if '4px grid' in name else ''), doc)
doc = re.sub(r'across \d+ files', 'across %d files' % files, doc)
io.open(p, 'w', encoding='utf-8').write(doc)
print('docs/BRAND.md refreshed: %s declarations across %d files' % (format(total, ','), files))
