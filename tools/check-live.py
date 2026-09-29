#!/usr/bin/env python3
"""Walk the live site the way a customer's browser does, and complain only when
something is actually wrong.

Everything goes through the publishable key and the same RPC the shop uses, so
a pass means a customer can reach it — not that a row exists somewhere an admin
can see.

    python3 tools/check-live.py
    python3 tools/check-live.py --product christmas-cards
    python3 tools/check-live.py --skip-pages     # data only, no page fetches
    python3 tools/check-live.py --self-test      # prove the checks can fail

Exit code is 0 when everything passed and 1 when anything failed, so it can sit
in a cron or a build without anyone reading the output.
"""
import argparse, copy, json, re, sys, urllib.request, urllib.error
from collections import defaultdict

SB   = 'https://jvcpzmumkyjdyibmwlsd.supabase.co'
SITE = 'https://foreverprint.com'
# The publishable key, the one already in the shipped pages. Never the service key.
KEY  = re.search(r"SUPABASE_ANON_KEY *= *'([^']+)'",
                 open('upload-and-print.html').read()).group(1)
HDRS = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

CORE_CATEGORIES = ['pair', 'colour', 'medium', 'era', 'layout', 'motif', 'mood']
FORBIDDEN_PHRASE = [
    (re.compile(r'foil', re.I),               'does not sell a finish as a picture'),
    (re.compile(r'photograph|photo ', re.I),  'does not promise a photograph'),
    (re.compile(r'typograph|type-led', re.I), 'does not ask for lettering'),
]
PLACEHOLDERS       = ['{lead}', '{audience}', '{medium}', '{layout}', '{motif}', '{colour}']
STALE_PLACEHOLDERS = ['{style}', '{touch}', '{finish}', '{season}', '{setting}', '{mood}']

fails, checks = [], 0


def check(ok, what, detail=''):
    global checks
    checks += 1
    if not ok:
        fails.append((what, detail))
    return ok


def get(url, headers=None, want_json=True):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode('utf-8', 'replace')
        return (json.loads(body) if want_json else body), r.status


def rest(path):
    """A table read, in pages.

    PostgREST stops at 1,000 rows and says nothing about it. The first run of
    this script reported that half the wedding products had lost their motif
    and mood boxes; they had not, the read had been cut off at row 1,000. A
    checker that quietly sees part of the data is worse than no checker, so
    every page is fetched and the total is asserted by the caller.
    """
    rows, start, page = [], 0, 1000
    while True:
        h = dict(HDRS, **{'Range-Unit': 'items', 'Range': '%d-%d' % (start, start + page - 1)})
        batch = get(SB + '/rest/v1/' + path, h)[0]
        if not isinstance(batch, list):
            return batch
        rows += batch
        if len(batch) < page:
            return rows
        start += page


def check_vocabulary(slug, cats, prompt):
    """Everything the design studio needs before it can draw step 3."""
    for cat in CORE_CATEGORIES:
        check(len(cats.get(cat, [])) > 0, slug + ': has a ' + cat + ' box',
              'the studio would draw the step without it')

    # A bundle naming a colour the palette lacks draws a grey dot.
    palette = {c['phrase'] for c in cats.get('colour', [])}
    for p in cats.get('pair', []):
        for name in p['phrase'].split('|'):
            check(name.strip() in palette,
                  slug + ': bundle "' + p['label'] + '" uses a palette colour',
                  '"' + name.strip() + '" is not in this palette')

    for c in [x for v in cats.values() for x in v]:
        for rx, why in FORBIDDEN_PHRASE:
            check(not rx.search(c['phrase']),
                  slug + ': chip "' + c['label'] + '" ' + why, c['phrase'])

    # A swatch with no colour renders as a grey circle.
    for c in cats.get('colour', []):
        check(bool(c.get('swatch_hex')), slug + ': swatch "' + c['label'] + '" has a colour', '')

    tpl = (prompt or {}).get('base_prompt') or ''
    for ph in PLACEHOLDERS:
        check(ph in tpl, slug + ': template has ' + ph, tpl[:90])
    for ph in STALE_PLACEHOLDERS:
        check(ph not in tpl, slug + ': template has no stale ' + ph, tpl[:90])
    check('no lettering or words in the image' in tpl,
          slug + ': template still forbids lettering', tpl[:90])


def check_prices(slug, payload):
    """Everything the shop needs before a customer can be charged.

    Returns (slug, papers, ranges, prices) for the caller to print, or None.
    """
    prods = payload.get('products') or []
    prod = next((p for p in prods if p.get('slug') == slug), None)
    if not check(prod is not None, slug + ': is in the published payload',
                 'the publish may be stale'):
        return None

    papers  = {p['name']: p for p in (payload.get('papers') or [])}
    sells   = prod.get('sheet_sells') or []
    priced  = {r.get('paper') for r in sells}
    sizes   = set(prod.get('available_sizes') or [])
    offered = prod.get('available_papers') or []

    check(bool(sells),   slug + ': has any prices at all', 'nothing is buyable')
    check(bool(offered), slug + ': offers at least one paper', '')

    for name in offered:
        # A paper with no rate does not fail loudly: the page invents a price.
        check(name in priced, slug + ': "' + name + '" has a price',
              'offered but has no rate — the page would invent one')
        check(name in papers, slug + ': "' + name + '" is in the paper catalogue', '')

    # Every range the customer is shown needs a paper behind it that is both
    # offered and priced. This is the fault that hid Luxury and Eco.
    tiers = defaultdict(list)
    for name in offered:
        if name in priced:
            t = (papers.get(name) or {}).get('tier') or 'signature'
            tiers[t if t in ('luxury', 'kinder') else 'signature'].append(name)
    check(len(tiers) > 0, slug + ': at least one range is reachable', '')

    bad = [r for r in sells
           if not isinstance(r.get('sell'), (int, float))
           or r.get('sell') != r.get('sell') or (r.get('sell') or 0) <= 0]
    check(not bad, slug + ': every price is a real number',
          ('%d bad rows, e.g. %s' % (len(bad), json.dumps(bad[0]))) if bad else '')

    off_size = sorted({r.get('size') for r in sells} - sizes) if sizes else []
    check(not off_size, slug + ': prices only for sizes it sells', str(off_size))

    return (slug, len(offered), len(tiers), len(sells))


# ── proving the checks can fail ──────────────────────────────────────────────
# A checker that has never failed is a checker nobody should trust. Each of
# these breaks one real thing in a copy of the live data; the run asserts the
# matching check notices. Nothing is written back.
def _break_chip_cat(cats, prompt):  cats['motif'] = []
def _break_pair(cats, prompt):      cats['pair'][0]['phrase'] = 'chartreuse|cream'
def _break_foil(cats, prompt):      cats['motif'][0]['phrase'] = 'fine gold foil detailing'
def _break_type(cats, prompt):      cats['era'][0]['phrase'] = 'bold typographic'
def _break_swatch(cats, prompt):    cats['colour'][0]['swatch_hex'] = None
def _break_tpl_new(cats, prompt):   prompt['base_prompt'] = prompt['base_prompt'].replace('{medium}', '')
def _break_tpl_old(cats, prompt):   prompt['base_prompt'] += ' {style}'
def _break_lettering(cats, prompt): prompt['base_prompt'] = prompt['base_prompt'].replace(
                                        'no lettering or words in the image', 'lovely lettering')

def _break_unpriced(pl, slug):
    p = next(x for x in pl['products'] if x['slug'] == slug)
    p['sheet_sells'] = [r for r in p['sheet_sells'] if r.get('paper') != p['available_papers'][0]]
def _break_all_signature(pl, slug):
    for p in pl['papers']:
        p['tier'] = 'signature'
    # still one range, so this only bites via the per-paper checks below
    p2 = next(x for x in pl['products'] if x['slug'] == slug)
    p2['available_papers'] = [n for n in p2['available_papers']
                              if (next((q for q in pl['papers'] if q['name'] == n), {}) or {}).get('tier')]
def _break_no_prices(pl, slug):
    next(x for x in pl['products'] if x['slug'] == slug)['sheet_sells'] = []
def _break_nan_price(pl, slug):
    next(x for x in pl['products'] if x['slug'] == slug)['sheet_sells'][0]['sell'] = None
def _break_missing_product(pl, slug):
    pl['products'] = []

VOCAB_BREAKS = [
    ('a box is empty',                      _break_chip_cat),
    ('a bundle names a colour we lack',     _break_pair),
    ('a foil chip creeps back',             _break_foil),
    ('a typographic chip creeps back',      _break_type),
    ('a swatch loses its colour',           _break_swatch),
    ('the template loses a placeholder',    _break_tpl_new),
    ('a stale placeholder returns',         _break_tpl_old),
    ('the no-lettering rule is dropped',    _break_lettering),
]
PRICE_BREAKS = [
    ('a paper is offered with no rate',     _break_unpriced),
    ('the product vanishes from a publish', _break_missing_product),
    ('a product has no prices at all',      _break_no_prices),
    ('a price is not a number',             _break_nan_price),
]


def self_test(cats, prompt, payload, slug):
    global fails, checks
    ok = True
    for name, fn in VOCAB_BREAKS:
        fails, checks = [], 0
        c, p = copy.deepcopy(cats), copy.deepcopy(prompt)
        fn(c, p)
        check_vocabulary(slug, c, p)
        caught = len(fails) > 0
        ok = ok and caught
        print('  %-42s %s' % (name, 'caught' if caught else 'NOT CAUGHT'))
    for name, fn in PRICE_BREAKS:
        fails, checks = [], 0
        pl = copy.deepcopy(payload)
        fn(pl, slug)
        check_prices(slug, pl)
        caught = len(fails) > 0
        ok = ok and caught
        print('  %-42s %s' % (name, 'caught' if caught else 'NOT CAUGHT'))
    fails, checks = [], 0
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--product', help='check one slug only')
    ap.add_argument('--quiet', action='store_true', help='print failures only')
    ap.add_argument('--skip-pages', action='store_true', help='no live page fetches')
    ap.add_argument('--self-test', action='store_true', help='prove the checks can fail')
    args = ap.parse_args()

    def say(*a):
        if not args.quiet:
            print(*a)

    chips = rest('studio_prompt_options?select=product_slug,category,label,phrase,swatch_hex&active=eq.true')
    cfg   = rest('studio_config?select=product_slug,product_noun,base_prompt')
    # If a read were ever truncated again, every check below would pass for the
    # products that survived and fail for the rest, which reads like a site
    # fault. Assert the size here so the cause gets named instead.
    total = int(get(SB + '/rest/v1/studio_prompt_options?select=count&active=eq.true', HDRS)[0][0]['count'])
    check(len(chips) == total, 'read every chip row',
          'got %d of %d — the read was truncated' % (len(chips), total))

    by_product = defaultdict(lambda: defaultdict(list))
    for c in chips:
        by_product[c['product_slug']][c['category']].append(c)
    prompts = {r['product_slug']: r for r in cfg}

    slugs = sorted(prompts)
    if args.product:
        slugs = [s for s in slugs if s == args.product]
        if not slugs:
            sys.exit('no such product: ' + args.product)

    if args.self_test:
        slug = slugs[0]
        payload = rest('rpc/pricing_for?p_slug=' + slug)[0]['payload']
        print('\nProving each check can fail, against a copy of %s\n' % slug)
        good = self_test(by_product[slug], prompts[slug], payload, slug)
        print('\n' + ('every check bites' if good else 'SOME CHECKS NEVER FAIL — fix them') + '\n')
        return 0 if good else 1

    say('Design studio vocabulary')
    for slug in slugs:
        check_vocabulary(slug, by_product.get(slug, {}), prompts[slug])

    say('Paper and price coverage')
    for slug in slugs:
        try:
            payload = rest('rpc/pricing_for?p_slug=' + slug)[0]['payload']
        except Exception as e:
            check(False, slug + ': has a published price payload', str(e))
            continue
        line = check_prices(slug, payload)
        if line:
            say('  %-30s %d papers, %d ranges, %d prices' % line)

    if not args.skip_pages:
        say('Live pages')
        for slug in slugs:
            for url in (SITE + '/' + slug, SITE + '/upload-and-print.html?product=' + slug):
                try:
                    body, status = get(url, want_json=False)
                    check(status == 200, url + ' loads', 'HTTP ' + str(status))
                    check('{lead}' not in body and '{medium}' not in body,
                          url + ' shows no raw placeholder', '')
                except urllib.error.HTTPError as e:
                    check(False, url + ' loads', 'HTTP ' + str(e.code))
                except Exception as e:
                    check(False, url + ' loads', str(e))

    print()
    if fails:
        print('%d of %d checks FAILED\n' % (len(fails), checks))
        for what, detail in fails:
            print('  ' + what + ('\n      ' + detail if detail else ''))
        print()
        return 1
    print('%d checks passed, nothing to report\n' % checks)
    return 0


if __name__ == '__main__':
    sys.exit(main())
