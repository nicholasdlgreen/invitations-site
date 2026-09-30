#!/usr/bin/env python3
"""What shape is the ordering wizard, for each product?

Not what the code could do — what a customer is actually asked, derived from
the published catalogue the page reads. Every question below appears or
disappears on its own rule, and most of those rules are emergent: they follow
from which rate rows happen to exist rather than from a decision anyone made.

    python3 tools/audit-wizard.py
    python3 tools/audit-wizard.py --why      # explain each difference
"""
import json, re, sys, urllib.request
from collections import OrderedDict, defaultdict

SB = 'https://jvcpzmumkyjdyibmwlsd.supabase.co'
KEY = re.search(r"SUPABASE_ANON_KEY *= *'([^']+)'",
                open('upload-and-print.html').read()).group(1)
HDRS = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

SQUARE = {'Square', 'Square-210'}


def _get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=HDRS), timeout=30).read())


def payload(slug):
    return _get(SB + '/rest/v1/rpc/pricing_for?p_slug=' + slug)[0]['payload']


def live(slug):
    """The product_types row, which the page fetches separately and merges over
    the published payload.

    The payload carries no envelopes_offered, quantity_ladder or sides_offered
    at all. Reading only the payload made this tool report that every product
    offers envelopes, including an A0 foam board — which the site does not do.
    The page was right and the audit was wrong, which is worth a comment: any
    check that reads one of these two sources and not the other will describe a
    site that does not exist.
    """
    rows = _get(SB + '/rest/v1/product_types?slug=eq.' + slug + '&select=*')
    return rows[0] if rows else {}


def shape(slug):
    pl = payload(slug)
    prod = next((x for x in pl['products'] if x['slug'] == slug), None)
    if not prod:
        return None
    pt = live(slug)
    merged = dict(prod)
    for k in ('available_sizes', 'available_papers', 'available_finishes',
              'quantity_ladder', 'routes', 'folded_family'):
        if pt.get(k):
            merged[k] = pt[k]
    merged['envelopes_offered'] = pt.get('envelopes_offered') is not False
    merged['sides_offered'] = pt.get('sides_offered')
    prod = merged
    papers = {p['name']: p for p in (pl.get('papers') or [])}
    sells = prod.get('sheet_sells') or []
    sizes = prod.get('available_sizes') or []
    offered = prod.get('available_papers') or []
    priced = {r.get('paper') for r in sells}

    folds = [f for f in ('flat', 'folded')
             if f in {r.get('fold') or 'flat' for r in sells}]

    def sides_for(fold):
        seen = {r.get('sides') or 'single' for r in sells if (r.get('fold') or 'flat') == fold}
        return [v for v in ('single', 'double') if v in seen]

    tiers = defaultdict(list)
    for n in offered:
        if n in priced:
            t = (papers.get(n) or {}).get('tier') or 'signature'
            tiers[t if t in ('luxury', 'kinder') else 'signature'].append(n)

    weights = {n: len((papers.get(n) or {}).get('weights') or []) for n in offered if n in priced}
    fin = set()
    for n in offered:
        fin |= set((papers.get(n) or {}).get('finishes') or [])
    allowed = set(prod.get('available_finishes') or [])
    fin = sorted(fin & allowed) if allowed else sorted(fin)

    turnable = [s for s in sizes if s not in SQUARE]

    return OrderedDict([
        ('sizes', len(sizes)),
        ('asks size', len(sizes) > 1),
        ('asks flat/folded', len(folds) > 1),
        ('asks which way up', 'all' if len(turnable) == len(sizes) and sizes
                              else ('none' if not turnable else '%d of %d' % (len(turnable), len(sizes)))),
        ('asks sides, flat', ','.join(sides_for('flat')) or '—'),
        ('asks sides, folded', ','.join(sides_for('folded')) or '—'),
        ('asks range', len(tiers)),
        ('papers', len(tiers and [n for v in tiers.values() for n in v])),
        ('asks thickness', '%d-%d' % (min(weights.values()), max(weights.values())) if weights else '—'),
        ('asks finishing', len(fin)),
        ('asks envelopes', bool(prod.get('envelopes_offered'))),
        ('qty steps', len(prod.get('quantity_ladder') or [])),
    ])


SLUGS = ['wedding-invitations', 'save-the-dates', 'rsvp-cards', 'menu-cards', 'place-cards',
         'table-numbers', 'engagement-party-invitations', 'engagement-cards',
         'christmas-cards', 'birthday-invitations', 'party-invitations',
         'new-arrival-cards', 'baby-shower-invitations', 'christening-invitations',
         'moving-cards', 'graduation-cards', 'thank-you-cards', 'greeting-cards',
         'order-of-service', 'signage', 'table-plans', 'welcome-signs']


def main():
    shapes = OrderedDict()
    for s in SLUGS:
        sh = shape(s)
        if sh:
            shapes[s] = sh

    keys = list(next(iter(shapes.values())).keys())
    w = max(len(s) for s in shapes) + 1
    print('\n' + 'product'.ljust(w) + ''.join(k.replace('asks ', '').center(14) for k in keys))
    print('-' * (w + 14 * len(keys)))
    for s, sh in shapes.items():
        print(s.ljust(w) + ''.join(str(sh[k]).center(14) for k in keys))

    # Which questions are answered differently across products, and how often.
    print('\nHow consistent is each question?')
    for k in keys:
        vals = defaultdict(list)
        for s, sh in shapes.items():
            vals[str(sh[k])].append(s)
        if len(vals) == 1:
            print('  %-22s one answer everywhere (%s)' % (k, list(vals)[0]))
        else:
            parts = sorted(vals.items(), key=lambda x: -len(x[1]))
            print('  %-22s %d different answers: %s' % (k, len(vals),
                  ', '.join('%s x%d' % (v, len(ss)) for v, ss in parts)))
            if '--why' in sys.argv:
                for v, ss in parts[1:]:
                    print('      %-14s %s' % (v, ', '.join(ss)))

    sig = defaultdict(list)
    for s, sh in shapes.items():
        sig[tuple(str(sh[k]) for k in keys)].append(s)
    print('\n%d products, %d distinct wizards.' % (len(shapes), len(sig)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
