#!/usr/bin/env python3
"""
Refresh our cost base from PrintedEasy's published prices.

We buy at 20% off their list, so their published price IS our cost base. They
change prices without notice — their own terms say so — and because the site
sells from a published snapshot, a rise at their end does not show up as an
error. It shows up as margin quietly disappearing. This script is how we find
out and put it right.

It deliberately does TWO things and not a third:

  1. reads what we sell from Supabase (families, papers, weights, sizes)
  2. asks PrintedEasy what each of those costs today, and writes the new cost
     into `sheet_rates`

It does NOT publish. Publishing is what changes the prices customers see, and
that stays a human pressing the button in admin after looking at the diff.
Prices moving on a live shop without anyone deciding is the failure we are
trying to avoid, not automate.

The shape comes from the database rather than being hardcoded, so a paper added
in admin is picked up here automatically — as long as it is mapped in
PE_STOCK below, which is the one place their vocabulary meets ours.

Usage:
    SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py            # report only
    SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py --write    # apply
    ... --only flat-card                                                     # one family
    ... --csv out.csv                                                        # also dump raw

Takes roughly 35 minutes for the full set, paced at ~3 requests a second so we
are not rude to a supplier's website.
"""
import argparse, csv, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from html.parser import HTMLParser

BASE = 'https://www.printedeasy.com'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')
DELAY = 0.30
DISCOUNT = 0.20

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://jvcpzmumkyjdyibmwlsd.supabase.co')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY')

# Our paper names to theirs. The only place the two vocabularies meet: add a
# paper in admin and it must appear here or the refresh cannot price it.
PE_STOCK = {
    'Uncoated': 'uncoated', 'Silk': 'silk', 'Gloss': 'gloss',
    'Cartonboard': 'cartonboard', 'Ice White': 'icewhite',
    'Tintoretto Gesso': 'tintoretto', 'Nettuno Bianco': 'nettuno',
    'Acquerello Bianco': 'acquerello', 'Sirio Pearl Polar Dawn': 'polardawn',
    'Recycled Uncoated': 'recycled',
    # Display boards call the material a substrate, not a stock finish. The
    # form field differs too, which pe_extras() below knows about.
    'Foamex 5mm': 'foamex5mm',
}
# The Fedrigoni range only exists on their Luxury products, which cannot be
# finished at all. Everything else comes off a route that can be foiled.
LUXURY = {'Tintoretto Gesso', 'Nettuno Bianco', 'Acquerello Bianco',
          'Sirio Pearl Polar Dawn', 'Recycled Uncoated'}

def pe_form(family, paper, gsm):
    """The option fields that identify a stock, which differ by product.

    Cards are picked by stock-finish plus a weight in gsm. Display boards are
    picked by substrate alone — the thickness is part of the substrate name —
    and carry their own options, all pinned to the plain, unfinished board.
    Lamination and drilled holes are priced separately as finishes, so they
    must stay off here or every rate would silently include them.
    """
    if family == 'display-board':
        return {'substrate': PE_STOCK[paper], 'printed-sides': 'single',
                'lamination': 'none', 'wrap-mounting': 'no', 'drilled-holes': 'none'}
    return {'stock-finish': PE_STOCK[paper], 'stock-weight': gsm,
            'printed-sides': 'single'}


def pe_product(family, paper):
    if family == 'flat-card':      return 'luxury-flat' if paper in LUXURY else 'postcards'
    if family == 'folded-card':    return 'greeting-cards'
    if family == 'folded-leaflet': return 'luxury-folded'
    if family == 'large-format':   return 'posters'
    if family == 'display-board':  return 'display-boards'
    return None

# Sizes they list as their own options. Anything else we buy as a custom size,
# which prices identically — our 148mm square is not on their menu but costs
# the same as asking for 148x148.
LISTED = {
    'luxury-flat':    {'A6': 'A6', 'A5': 'A5', 'DL': 'DL', 'A4': 'A4', 'Square-210': '210x210'},
    'postcards':      {'A6': 'A6', 'A5': 'A5', 'DL': 'DL'},
    'greeting-cards': {'A6': 'A6', 'A5': 'A5', 'DL': 'DL', 'Square': '148x148'},
    # Their luxury-folded page asks for a FLAT size ("Unfolded document
    # size"); their greeting-cards page asks for a FINISHED one. A size on our
    # site always means the finished piece, so this maps ours to theirs: a
    # finished A5 order of service is a flat A4 folded in half.
    'luxury-folded':  {'A6': 'A5', 'A5': 'A4', 'A4': 'A3'},
    'posters':        {'A1': 'A1', 'A2': 'A2', 'A3': 'A3', 'A4': 'A4'},
    'display-boards': {'A0': 'A0', 'A1': 'A1', 'A2': 'A2', 'A3': 'A3', 'A4': 'A4'},
}
CUSTOM_DIMS = {'Square': ('148', '148'), 'Square-210': ('210', '210'),
               'A6': ('105', '148'), 'A5': ('148', '210'), 'DL': ('99', '210'),
               'A4': ('210', '297'), 'A3': ('297', '420')}

def pe_size(prod, size):
    """(size, width, height) for their form, or None if we cannot buy it there."""
    listed = LISTED.get(prod, {})
    if size in listed:
        return (listed[size], '', '')
    if size in CUSTOM_DIMS:
        w, h = CUSTOM_DIMS[size]
        return ('custom', w, h)
    return None

# Where we sample their price curve.
#
# PrintedEasy quote any quantity — their field says "Type any amount" — so the
# site should too, and anything between two points we hold is interpolated.
# That makes the choice of points the thing that decides how accurate our cost
# is, and round numbers were a guess.
#
# A dense sweep on 24 September (about 250 live quotes across three
# representative configurations) showed their curve is not a formula: it steps
# in whole pounds, and the steps land in different places for every paper,
# weight and size. It also showed the three families behave quite differently —
# flat cards step every 20-30, folded cards every 10, posters every 2-3 below
# 40 — so one ladder never suited all of them.
#
# Measured against those real curves, these points hold the average error to
# about 0.2-0.7% of their price, against 0.4-0.9% on the eight points used
# before, and — the actual point — they let us quote 10 or 87 or 340 at all.
#
# 475 is not a round number and is deliberate. Their price DIPS there: a folded
# card costs £97 at 450 and £94 at 475, on both curves swept, at exactly the
# same place. No amount of sampling either side predicts a dip, because a
# straight line from 450 to 500 runs above it. Worth asking them whether it is
# intended; until it changes, we sample it.
LADDER = {'flat-card':      [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125,
                             150, 200, 250, 300, 375, 450, 475, 500],
          'folded-card':    [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125,
                             150, 200, 250, 300, 375, 450, 475, 500],
          'folded-leaflet': [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125,
                             150, 200, 250, 300, 375, 450, 475, 500],
          'large-format':   [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35,
                             40, 50, 60, 70, 85, 100],
          # A wedding buys one table plan and one welcome sign. Dense at the
          # bottom, thinning out where nobody orders.
          'display-board':  [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50]}

# Folded leaflets will not price without these; they are injected by their own
# JavaScript, so they are not in the page's HTML to be read.
EXTRA_FORM = {'luxury-folded': {'foldType': 'half', 'foldCount': '1',
                                'foldDirection': 'vertical', 'print-direction': 'outwards',
                                'colour-type': 'full', 'drilling': '0', 'hd-printing': 'std',
                                'low-coverage': 'no', 'pantone-printing': 'no',
                                'rgbPrinting': 'no', 'silver_ink': 'no'}}
# No 'printed-sides' here on purpose. It used to say 'double', which read as a
# decision but never took effect: price() layers pe_form() on top, and that
# sets 'single'. Every folded rate we hold is a single-sided price. Changing it
# is a real decision — double-sided is about 15% dearer — so it belongs in
# pe_form() where it would actually apply, not here where it looked settled.


# ── PrintedEasy ───────────────────────────────────────────────────────────
class FormReader(HTMLParser):
    """Their product page carries the whole form server-side. Reading its
    defaults beats guessing at options we do not care about (Scodix foiling,
    lamination, fold direction) but which the endpoint still demands."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fields, self._sel, self._first, self._seen = {}, None, None, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'input':
            n, t, v = a.get('name'), (a.get('type') or 'text').lower(), a.get('value', '')
            if not n:
                return
            if t in ('hidden', 'text', 'number'):
                self.fields[n] = v
            elif t in ('radio', 'checkbox') and 'checked' in a:
                self.fields[n] = v
        elif tag == 'select':
            self._sel, self._first, self._seen = a.get('name'), None, False
        elif tag == 'option' and self._sel:
            v = a.get('value', '')
            if self._first is None:
                self._first = v
            if 'selected' in a:
                self.fields[self._sel], self._seen = v, True

    def handle_endtag(self, tag):
        if tag == 'select' and self._sel:
            if not self._seen:
                self.fields[self._sel] = self._first or ''
            self._sel = None


class PrintedEasy:
    def __init__(self):
        import http.cookiejar
        cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        self.op.addheaders = [('User-Agent', UA)]
        self._forms = {}

    def form(self, slug):
        if slug not in self._forms:
            html = self.op.open(f'{BASE}/products/{slug}', timeout=40).read().decode('utf8', 'replace')
            fr = FormReader()
            fr.feed(html)
            f = fr.fields
            m = re.search(r'name="_token"\s+value="([^"]+)"', html)
            if m:
                f['_token'] = m.group(1)
            # Drop the upsells; we price the plain card and add finishing
            # separately, because foiling is a flat setup charge not a per-unit one.
            for k in list(f):
                if k.startswith('scodix') or k in ('spot-uv-price', 'foil-price', 'spot-uv-remove',
                                                   'foiling-remove', 'spot-uv-remove-foiling'):
                    f.pop(k, None)
            f.update(EXTRA_FORM.get(slug, {}))
            self._forms[slug] = f
        return self._forms[slug]

    def price(self, slug, **over):
        body = {k: ('' if v is None else str(v)) for k, v in {**self.form(slug), **over}.items()}
        req = urllib.request.Request(
            f'{BASE}/product/pricing/{slug}', data=urllib.parse.urlencode(body).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded',
                     'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA,
                     'Referer': f'{BASE}/products/{slug}'})
        return json.loads(self.op.open(req, timeout=40).read().decode())


# ── Supabase ──────────────────────────────────────────────────────────────
def sb(path, method='GET', body=None, prefer=None):
    if not SERVICE_KEY:
        sys.exit('SUPABASE_SERVICE_KEY is not set. Copy it from Netlify → '
                 'Site configuration → Environment variables, then re-run.')
    h = {'apikey': SERVICE_KEY, 'Authorization': f'Bearer {SERVICE_KEY}',
         'Content-Type': 'application/json'}
    if prefer:
        h['Prefer'] = prefer
    req = urllib.request.Request(f'{SUPABASE_URL}/rest/v1/{path}', method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read().decode()
    return json.loads(raw) if raw.strip() else []


def what_we_sell():
    """Every (family, paper, gsm, size) the site currently offers, read from the
    database so admin stays the single source of truth for the range."""
    stocks = {p['name']: p for p in sb('paper_stocks?select=name,weights,active&active=eq.true')}
    prods = sb('product_types?select=slug,supplier_family,available_papers,available_sizes,active'
               '&active=eq.true')
    combos, no_family, unmapped = set(), set(), set()
    for p in prods:
        fam = p.get('supplier_family')
        if not fam:
            no_family.add(p['slug'])
            continue
        for paper in (p.get('available_papers') or []):
            if paper not in stocks:
                continue
            if paper not in PE_STOCK:
                unmapped.add(paper)
                continue
            gsms = [int(w['gsm']) for w in (stocks[paper].get('weights') or []) if w.get('gsm')]
            for gsm in gsms:
                for size in (p.get('available_sizes') or []):
                    combos.add((fam, paper, gsm, size))
    return sorted(combos), sorted(no_family), sorted(unmapped)


def current_costs():
    out, offset = {}, 0
    while True:
        page = sb(f'sheet_rates?select=supplier_family,paper_name,weight_gsm,size,quantity,cost'
                  f'&limit=1000&offset={offset}')
        for r in page:
            out[(r['supplier_family'], r['paper_name'], r['weight_gsm'], r['size'], r['quantity'])] = float(r['cost'])
        if len(page) < 1000:
            return out
        offset += 1000


# ── main ──────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--write', action='store_true',
                    help='apply the new costs to sheet_rates (default is report only)')
    ap.add_argument('--only', metavar='FAMILY', help='limit to one supplier family')
    ap.add_argument('--csv', metavar='PATH', help='also write the raw scrape here')
    args = ap.parse_args()

    combos, no_family, unmapped = what_we_sell()
    if args.only:
        combos = [c for c in combos if c[0] == args.only]
    for slug in no_family:
        print(f'  ! {slug} has no product family set — cannot be priced', file=sys.stderr)
    for paper in unmapped:
        print(f'  ! paper "{paper}" is not in PE_STOCK — add it to this script', file=sys.stderr)
    if not combos:
        sys.exit('Nothing to price.')

    total = sum(len(LADDER.get(f, [])) for f, _, _, _ in combos)
    print(f'{len(combos)} paper/size combinations, {total} prices to fetch '
          f'(~{total * DELAY / 60:.0f} min)\n', flush=True)

    pe = PrintedEasy()
    scraped, skipped, failed = {}, [], []
    done = 0
    for fam, paper, gsm, size in combos:
        prod = pe_product(fam, paper)
        dims = pe_size(prod, size) if prod else None
        if not dims:
            skipped.append((fam, paper, gsm, size))
            continue
        s, w, h = dims
        for qty in LADDER.get(fam, []):
            try:
                d = pe.price(prod, size=s, width=w, height=h, quantity=qty,
                             **pe_form(fam, paper, gsm))
                lst = d.get('totalSellingPrice')
                # A zero means they do not offer that combination at all, which
                # is different from it being free.
                if lst:
                    scraped[(fam, paper, gsm, size, qty)] = round(float(lst) * (1 - DISCOUNT), 2)
            except Exception as e:
                failed.append((fam, paper, gsm, size, qty, str(e)[:80]))
            time.sleep(DELAY)
            done += 1
            if done % 200 == 0:
                print(f'  {done}/{total}…', flush=True)

    # The rule of the trade: the more you order, the less each one costs. It
    # held at every ladder point on all three curves swept, so a rise is a
    # signal — a scrape that caught their site mid-change, a stock we have
    # mapped wrongly, or a genuine oddity of theirs like the dip at 475. It is
    # reported, never corrected, because we do not know which of those it is.
    climbs = []
    for (fam, paper, gsm, size) in {(k[0], k[1], k[2], k[3]) for k in scraped}:
        pts = sorted((q, scraped[(fam, paper, gsm, size, q)])
                     for q in LADDER.get(fam, [])
                     if (fam, paper, gsm, size, q) in scraped)
        for i in range(1, len(pts)):
            (q0, c0), (q1, c1) = pts[i - 1], pts[i]
            if c1 / q1 > c0 / q0 + 1e-9:
                climbs.append((fam, paper, gsm, size, q0, c0 / q0, q1, c1 / q1))
    if climbs:
        print(f'\nUNIT PRICE RISES WITH QUANTITY ({len(climbs)}) '
              '— each of these costs more per item the more you buy')
        for fam, paper, gsm, size, q0, u0, q1, u1 in climbs[:25]:
            print(f'  {fam} {paper} {gsm}gsm {size}: '
                  f'{q0}\u2192{q1} costs \u00a3{u0:.4f}\u2192\u00a3{u1:.4f} each')
        if len(climbs) > 25:
            print(f'  \u2026and {len(climbs) - 25} more')

    before = current_costs()
    rose = [(k, before[k], v) for k, v in scraped.items() if k in before and v > before[k] + 0.005]
    fell = [(k, before[k], v) for k, v in scraped.items() if k in before and v < before[k] - 0.005]
    new  = [k for k in scraped if k not in before]
    gone = [k for k in before if k not in scraped and (not args.only or k[0] == args.only)]

    def show(title, rows, withold=True):
        if not rows:
            return
        print(f'\n{title} ({len(rows)})')
        for row in rows[:25]:
            if withold:
                k, o, n = row
                pct = (n - o) / o * 100 if o else 0
                print(f'   {k[0]:15} {k[1]:24} {k[2]}gsm {k[3]:11} x{k[4]:<4} '
                      f'£{o:>7.2f} → £{n:>7.2f}  ({pct:+.1f}%)')
            else:
                print(f'   {row[0]:15} {row[1]:24} {row[2]}gsm {row[3]:11} x{row[4]}')
        if len(rows) > 25:
            print(f'   … and {len(rows) - 25} more')

    print(f'\n{"="*72}\n{len(scraped)} prices fetched, {len(failed)} failed, '
          f'{len(skipped)} combinations they do not sell')
    show('COST WENT UP', rose)
    show('COST CAME DOWN', fell)
    show('NEW — not previously priced', new, withold=False)
    show('GONE — we list it, they no longer price it', gone, withold=False)
    if not (rose or fell or new or gone):
        print('\nNothing has moved. Costs are unchanged.')

    if args.csv:
        with open(args.csv, 'w', newline='') as fh:
            w = csv.writer(fh)
            w.writerow(['supplier_family', 'paper_name', 'weight_gsm', 'size', 'quantity', 'cost'])
            w.writerows([list(k) + [v] for k, v in sorted(scraped.items())])
        print(f'\nraw scrape → {args.csv}')

    if failed:
        print(f'\n{len(failed)} failed, first few:')
        for f in failed[:5]:
            print('   ', f)

    if not args.write:
        print('\nReport only. Re-run with --write to apply these costs to sheet_rates.')
        return

    rows = [{'supplier_family': k[0], 'paper_name': k[1], 'weight_gsm': k[2],
             'size': k[3], 'quantity': k[4], 'cost': v} for k, v in scraped.items()]
    for i in range(0, len(rows), 500):
        sb('sheet_rates?on_conflict=supplier_family,paper_name,weight_gsm,size,quantity',
           method='POST', body=rows[i:i + 500],
           prefer='resolution=merge-duplicates,return=minimal')
        print(f'  wrote {min(i + 500, len(rows))}/{len(rows)}', flush=True)

    print('\nCosts updated.')
    print('NOT published — nothing customers see has changed yet.')
    print('Open admin → Pricing → Publish, check the warnings, then publish.')


if __name__ == '__main__':
    main()
