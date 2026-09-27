#!/usr/bin/env python3
"""Fill the three gaps that stop Cartonboard and Ice White being sold on the
thirteen invitation products.

Reuses printedeasy_refresh.py's own form handling, size mapping, ladder and
discount, so these rows come out identical in shape to the ones already in
sheet_rates. It does NOT write to Supabase — it prints SQL, which goes in
through the admin connection after the numbers have been looked at.

    Cartonboard 255gsm  flat-card  double   A5 A6 DL Square Square-210
    Ice White   300gsm  flat-card  single   A5 A6 DL Square Square-210
    Ice White   300gsm  flat-card  double   A5 A6 DL Square Square-210
"""
import importlib.util, json, sys, time
spec = importlib.util.spec_from_file_location('pe', 'tools/printedeasy_refresh.py')
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)

FAMILY = 'flat-card'
PROD   = 'postcards'
SIZES  = ['A5', 'A6', 'DL', 'Square', 'Square-210']
JOBS   = [('Cartonboard', 'cartonboard', 255, 'double'),
          ('Ice White',   'icewhite',    300, 'single'),
          ('Ice White',   'icewhite',    300, 'double')]
LADDER = M.LADDER[FAMILY]

pe = M.PrintedEasy()

# The form accepts a stock it does not honour, so a price alone proves nothing.
# A nonsense stock must come back 0 or every number below is worthless.
probe = pe.price(PROD, size='custom', width='148', height='210', quantity=100,
                 **{'stock-finish': 'NOT-A-REAL-STOCK', 'stock-weight': 300,
                    'printed-sides': 'single'})
if probe.get('totalSellingPrice'):
    sys.exit('SENTINEL FAILED: a nonsense stock priced at %s — the endpoint is '
             'substituting a default and nothing here can be trusted'
             % probe.get('totalSellingPrice'))
print('-- sentinel ok: a nonsense stock returns 0, so prices below are real', flush=True)

rows, failed, zero = [], [], []
total = len(JOBS) * len(SIZES) * len(LADDER)
done = 0
for paper, stock, gsm, sides in JOBS:
    for size in SIZES:
        dims = M.pe_size(PROD, size)
        if not dims:
            failed.append((paper, size, sides, 'no size mapping')); continue
        s, w, h = dims
        for qty in LADDER:
            try:
                d = pe.price(PROD, size=s, width=w, height=h, quantity=qty,
                             **{'stock-finish': stock, 'stock-weight': gsm,
                                'printed-sides': sides})
                lst = d.get('totalSellingPrice')
                if lst:
                    rows.append((paper, size, qty, gsm, sides,
                                 round(float(lst) * (1 - M.DISCOUNT), 2)))
                else:
                    zero.append((paper, size, sides, qty))
            except Exception as e:
                failed.append((paper, size, sides, '%s @%s' % (str(e)[:40], qty)))
            time.sleep(M.DELAY)
            done += 1
            if done % 50 == 0:
                print('-- %d/%d…' % (done, total), file=sys.stderr, flush=True)

print('-- %d prices fetched, %d came back zero, %d failed'
      % (len(rows), len(zero), len(failed)))
for f in failed[:10]: print('--   FAILED:', f)
for z in zero[:10]:   print('--   ZERO  :', z)

# the trade rule: more copies must never cost more each
climbs = []
for paper, stock, gsm, sides in JOBS:
    for size in SIZES:
        pts = sorted((q, c) for (p, sz, q, g, sd, c) in rows
                     if p == paper and sz == size and sd == sides)
        for i in range(1, len(pts)):
            (q0, c0), (q1, c1) = pts[i-1], pts[i]
            if c1/q1 > c0/q0 + 1e-9:
                climbs.append((paper, size, sides, q0, c0/q0, q1, c1/q1))
if climbs:
    print('-- UNIT PRICE RISES WITH QUANTITY (%d) — reported, never corrected' % len(climbs))
    for p_, sz_, sd_, q0, u0, q1, u1 in climbs[:15]:
        print('--   %s %s %s-sided: %d->%d  \u00a3%.4f->\u00a3%.4f each'
              % (p_, sz_, sd_, q0, q1, u0, u1))

with open('/dev/stdout', 'w') as out:
    out.write('\n-- %d rows\ninsert into sheet_rates\n'
              '  (paper_name, size, quantity, cost, weight_gsm, supplier_family, printed_sides, active)\nvalues\n' % len(rows))
    out.write(',\n'.join(
        "  (%s, %s, %d, %.2f, %d, '%s', %s, true)"
        % (json.dumps(p).replace('"', "'"), json.dumps(sz).replace('"', "'"),
           q, c, g, FAMILY, json.dumps(sd).replace('"', "'"))
        for (p, sz, q, g, sd, c) in rows))
    out.write(';\n')
