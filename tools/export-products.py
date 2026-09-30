#!/usr/bin/env python3
"""Export the product catalogue for review.

One section per product: the sizes, paper stocks and finishing options it
offers — and, for each, whether it can actually be sold. An option that has no
rate behind it does not fail loudly; the page invents a price. So a review of
"has this product got the right options" is only half a review unless it also
says which of them are priceable.

    python3 tools/export-products.py            # writes both files
    python3 tools/export-products.py --stdout   # summary to the terminal

Writes scratch/product-export.html (to read) and scratch/product-export.csv
(to open in a spreadsheet).
"""
import csv, json, os, re, sys, urllib.request
from collections import defaultdict

SB = 'https://jvcpzmumkyjdyibmwlsd.supabase.co'
KEY = re.search(r"SUPABASE_ANON_KEY *= *'([^']+)'",
                open('upload-and-print.html').read()).group(1)
HDRS = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
TIER = {'luxury': 'Luxury', 'kinder': 'Eco'}


def get(url):
    return json.loads(urllib.request.urlopen(
        urllib.request.Request(url, headers=HDRS), timeout=40).read())


def main():
    products = get(SB + '/rest/v1/product_types?select=*&active=eq.true&order=slug')
    sizes    = {r['id']: r for r in get(SB + '/rest/v1/print_sizes?select=*')}
    stocks   = {r['name']: r for r in get(SB + '/rest/v1/paper_stocks?select=*&active=eq.true')}
    finishes = {r['name']: r for r in get(SB + '/rest/v1/finish_types?select=*&active=eq.true')}

    rows, blocks, problems = [], [], []
    for p in products:
        slug = p['slug']
        try:
            pl = get(SB + '/rest/v1/rpc/pricing_for?p_slug=' + slug)[0]['payload']
            pub = next((x for x in pl['products'] if x['slug'] == slug), None)
        except Exception:
            pub = None
        sells = (pub or {}).get('sheet_sells') or []
        priced_paper = {r.get('paper') for r in sells}
        priced_size  = {r.get('size') for r in sells}
        # paper x size, so a paper priced in one size but not another shows up
        priced_pair  = {(r.get('paper'), r.get('size')) for r in sells}

        block = {'slug': slug, 'name': p.get('name') or slug,
                 'family': p.get('supplier_family'), 'folded': p.get('folded_family'),
                 'envelopes': p.get('envelopes_offered') is not False,
                 'sizes': [], 'papers': [], 'finishes': []}

        for s in (p.get('available_sizes') or []):
            known = s in sizes
            ok = s in priced_size
            dim = ('%s × %smm' % (round(float(sizes[s]['width_mm'])), round(float(sizes[s]['height_mm'])))
                   if known else 'NOT IN print_sizes')
            block['sizes'].append((s, dim, ok))
            rows.append([slug, 'size', s, dim, 'sellable' if ok else 'NO PRICE'])
            if not ok: problems.append((slug, 'size', s, 'no rate for this size'))
            if not known: problems.append((slug, 'size', s, 'not in print_sizes'))

        for n in (p.get('available_papers') or []):
            known = n in stocks
            ok = n in priced_paper
            tier = TIER.get((stocks.get(n) or {}).get('tier'), 'Signature') if known else '—'
            missing = [s for s in (p.get('available_sizes') or []) if (n, s) not in priced_pair]
            block['papers'].append((n, tier, ok, missing))
            rows.append([slug, 'paper', n, tier,
                         'sellable' if ok and not missing else
                         ('NO PRICE' if not ok else 'not in ' + ','.join(missing))])
            if not known: problems.append((slug, 'paper', n, 'not in paper_stocks'))
            elif not ok:  problems.append((slug, 'paper', n, 'no rate at all'))
            elif missing: problems.append((slug, 'paper', n, 'no rate in ' + ', '.join(missing)))

        for n in (p.get('available_finishes') or []):
            known = n in finishes
            opts = [o['name'] for o in (finishes.get(n) or {}).get('options', [])
                    if str(o.get('name', '')).lower() != 'none']
            block['finishes'].append((n, opts, known))
            rows.append([slug, 'finish', n, ', '.join(opts), 'listed' if known else 'NOT IN finish_types'])
            if not known: problems.append((slug, 'finish', n, 'not in finish_types'))
        blocks.append(block)

    os.makedirs('scratch', exist_ok=True)
    with open('scratch/product-export.csv', 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['product', 'kind', 'option', 'detail', 'status'])
        w.writerows(rows)

    open('scratch/product-export.html', 'w').write(html(blocks, problems, stocks, finishes))

    print('%d products, %d option rows.' % (len(blocks), len(rows)))
    print('%d need attention.\n' % len(problems))
    for slug, kind, opt, why in problems:
        print('  %-30s %-7s %-24s %s' % (slug, kind, opt, why))
    print('\nscratch/product-export.html   scratch/product-export.csv')
    return 0


def html(blocks, problems, stocks, finishes):
    def esc(t): return (str(t).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    o = ["""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Product catalogue</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Jost:wght@200;300;400;500&display=swap">
<style>
:root{--cream:#FAF7F2;--white:#fff;--line:#EFE7E0;--text:#3D2E24;--soft:#7A6558;--pale:#B0A098;--gold:#B8976A;--err:#C94A3A;--ok:#5A9E6F}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--text);font-family:'Jost',system-ui,sans-serif;font-size:15px;line-height:1.6}
.page{max-width:1080px;margin:0 auto;padding:34px 22px 110px}
h1{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:2rem;margin:0 0 6px}
h2{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.3rem;margin:0 0 3px}
.sub{color:var(--soft);font-size:14px;max-width:84ch;margin:0 0 18px}
.p{background:var(--white);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px}
.meta{font-size:12px;color:var(--pale);margin-bottom:12px}
.lab{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--pale);margin:12px 0 6px}
.row{display:flex;flex-wrap:wrap;gap:6px}
.i{font-size:12.5px;border:1px solid var(--line);border-radius:999px;padding:4px 11px;background:var(--cream)}
.i.bad{border-color:var(--err);background:#FCEAEA;color:var(--err)}
.i small{color:var(--pale)}
.bad-box{background:#FCEAEA;border-left:2px solid var(--err);padding:13px 17px;border-radius:0 10px 10px 0;margin:16px 0;font-size:14px;color:var(--soft)}
.ok-box{background:#F3F8F2;border-left:2px solid var(--ok);padding:13px 17px;border-radius:0 10px 10px 0;margin:16px 0;font-size:14px;color:var(--soft)}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:8px}
th,td{text-align:left;padding:6px 9px;border-bottom:1px solid var(--line)}
th{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--pale);font-weight:400}
</style></head><body><div class="page">
<h1>Product catalogue</h1>
<p class="sub">Every active product, with the sizes, paper stocks and finishing options it offers. Anything marked in red has no price behind it &mdash; the option would be shown to a customer and then costed from a rate that does not exist.</p>"""]
    if problems:
        o.append('<div class="bad-box"><b>%d things need a decision.</b><table><tr><th>Product</th><th>Kind</th><th>Option</th><th>Problem</th></tr>' % len(problems))
        for s, k, opt, why in problems:
            o.append('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (esc(s), esc(k), esc(opt), esc(why)))
        o.append('</table></div>')
    else:
        o.append('<div class="ok-box">Every option on every product has a price behind it.</div>')

    for b in blocks:
        o.append('<div class="p"><h2>%s</h2><div class="meta">%s &middot; %s%s &middot; %s</div>'
                 % (esc(b['name']), esc(b['slug']), esc(b['family'] or '—'),
                    (' + ' + esc(b['folded'])) if b['folded'] else '',
                    'envelopes offered' if b['envelopes'] else 'no envelopes'))
        o.append('<div class="lab">Sizes</div><div class="row">')
        for s, dim, ok in b['sizes']:
            o.append('<span class="i%s">%s <small>%s</small></span>' % ('' if ok else ' bad', esc(s), esc(dim)))
        o.append('</div><div class="lab">Paper stocks</div><div class="row">')
        for n, tier, ok, missing in b['papers']:
            bad = (not ok) or missing
            note = tier if not missing else 'no rate in ' + ', '.join(missing)
            o.append('<span class="i%s">%s <small>%s</small></span>' % (' bad' if bad else '', esc(n), esc(note)))
        o.append('</div><div class="lab">Finishing</div><div class="row">')
        if not b['finishes']:
            o.append('<span class="i"><small>none</small></span>')
        for n, opts, known in b['finishes']:
            o.append('<span class="i%s">%s <small>%s</small></span>' % ('' if known else ' bad', esc(n), esc(', '.join(opts))))
        o.append('</div></div>')
    o.append('</div></body></html>')
    return '\n'.join(o)


if __name__ == '__main__':
    raise SystemExit(main())
