#!/usr/bin/env python3
"""Scrape PrintedEasy's FINISHING prices into `finish_rates`.

Why this exists
---------------
`finish_options` held one cost per finishing TYPE — lamination was £5 whatever
you chose, however many you ordered, whatever size. Measured against their
calculator on 2026-09-26 that is wrong on four counts: the charge varies by
option (matt vs soft touch), by which sides it goes on (front +£4, BOTH +£11 —
not twice £4), by quantity (+£4 at 100, +£17 at 500) and by size (A6 +£4,
A5 +£6). Every laminated order gave away £4-£7 of cost before margin.

What it stores
--------------
The UPLIFT, after the 20% discount, keyed
(family, finish, option, applies_to, size, quantity).

Paper and weight are deliberately absent. Both-sides lamination measured
£11/£11/£12/£11 across 250-400gsm at quantity 100, and £17/£16/£17/£16 at 500 —
flat within the ±£1 you get from differencing two whole-pound prices. The job's
own printed_sides is out for the same reason (single 6, double 5 at one spec).

±£1 IS THE RESOLUTION OF THEIR PRICE LIST. They quote whole pounds, so an
uplift is the difference of two rounded staircases. Do not chase it.

Validation, and why the sentinel does NOT apply to options
----------------------------------------------------------
The sentinel probe — ask for a value nothing can match, and distrust any price
that equals it — is the right test for WEIGHTS, where their dropdown lies and
the endpoint substitutes a default. It is the wrong test here.

Tried on lamination it rejected Matt and Gloss on half the grid, because an
unknown lamination value falls back to a REAL lamination rather than to none, so
the sentinel collides with the cheapest genuine option. Worse, Matt and Gloss
price identically anyway — a true finding, not a fault — so equality proves
nothing.

For finishes the form's own option list IS authoritative: lamination-front
offers none/matt/gloss/soft/antiscuff and the endpoint honours every one. So we
validate on arithmetic instead:

  * the base price must be > 0, or the base spec itself is not sold
  * the finished price must be > 0
  * the finished price must be >= the base — a finish cannot make a job cheaper

The sentinel is still probed, once per (finish, applies_to, size, quantity), and
reported when it differs from the base. That tells us the field substitutes,
which is worth knowing, but it no longer discards rows.

Usage
-----
    SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_finishes.py                  # report
    SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_finishes.py --write          # apply
    ... --only flat-card            # one family
    ... --finish lamination         # one finish
    ... --quick                     # 4 quantities instead of 21, for a smoke test

It never publishes. That stays a person pressing the button after reading the
diff.
"""
import argparse, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request

BASE = 'https://www.printedeasy.com'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36')
DELAY = 0.30
SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co'
SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# A value no real option can be. Used to prove the endpoint is answering our
# request rather than falling back to its default.
SENTINEL = '__fp_sentinel__'

# Which of their products prices each of our families, and the form field that
# carries the finish. Display boards name their options differently and are
# handled by their own entry rather than a special case in the loop.
ROUTES = {
    'flat-card':      'postcards',
    'folded-card':    'greeting-cards',
    'folded-leaflet': 'luxury-folded',
    'large-format':   'posters',
    'display-board':  'display-boards',
}

# Our size name -> the dimensions their form wants. Mirrors printedeasy_refresh.
CUSTOM_DIMS = {'Square': ('148', '148'), 'Square-210': ('210', '210'),
               'A6': ('105', '148'), 'A5': ('148', '210'), 'DL': ('99', '210'),
               'A4': ('210', '297'), 'A3': ('297', '420'),
               'business-card': ('85', '55')}
LISTED = {
    'postcards':      {'A6': 'A6', 'A5': 'A5', 'DL': 'DL'},
    'greeting-cards': {'A6': 'A6', 'A5': 'A5', 'DL': 'DL', 'Square': '148x148'},
    'luxury-folded':  {'A6': 'A5', 'A5': 'A4', 'A4': 'A3'},
    'posters':        {'A1': 'A1', 'A2': 'A2', 'A3': 'A3', 'A4': 'A4'},
    'display-boards': {'A0': 'A0', 'A1': 'A1', 'A2': 'A2'},
}

# The sizes we sell per family, and a paper/weight to price the base on. The
# base spec does not affect the uplift (proven flat across weights) — it only
# has to be a combination they really sell, or the base comes back 0.
FAMILY_SPEC = {
    'flat-card':      {'sizes': ['A6', 'A5', 'DL', 'Square', 'Square-210'],
                       'stock': ('silk', '300')},
    'folded-card':    {'sizes': ['A6', 'A5', 'DL', 'Square'],
                       'stock': ('cartonboard', '255')},
    'folded-leaflet': {'sizes': ['A6', 'A5', 'A4'], 'stock': ('silk', '300')},
    'large-format':   {'sizes': ['A4', 'A3', 'A2', 'A1'], 'stock': ('silk', '300')},
    'display-board':  {'sizes': ['A2', 'A1', 'A0'], 'stock': ('foamex5mm', None)},
}

# The finishes, the form fields that carry them, and the option values. Names on
# the left are ours (they must match finish_types.name); values on the right are
# theirs.
#
# Lamination is the reason this file exists, so it is modelled fully: 'front'
# sets only lamination-front, 'both' sets front and reverse together.
FINISHES = {
    'lamination': {
        'our_name': 'Lamination',
        'options': {'Matt': 'matt', 'Gloss': 'gloss',
                    'Soft touch': 'soft', 'Anti-scuff': 'antiscuff'},
        'fields': {'front': lambda v: {'lamination-front': v},
                   'both':  lambda v: {'lamination-front': v, 'lamination-reverse': v}},
        # Display boards call the field 'lamination' and offer different values,
        # so they are excluded rather than silently probed with a field their
        # form does not have — which would return the base price and record a
        # free finish that does not exist.
        # Luxury Folded carries NO lamination field: every value, sentinel
        # included, returns the plain price. It was allowlisted here without
        # checking and the first full run duly recorded a pile of zero-cost
        # lamination rows — free finishes that do not exist. The guard below now
        # catches this generally; the allowlist is the first line of defence.
        'families': {'flat-card', 'folded-card', 'large-format'},
    },
    # Envelopes are the one charge here that is genuinely PER UNIT rather than a
    # setup fee, so the ladder matters more, not less. Option names match the
    # envelopes table, not finish_types, because that is where they live.
    #
    # Red exists on Postcards and Greeting Cards but NOT on the Luxury products,
    # so folded-leaflet is expected to yield white only — the per-option check in
    # main() drops an option that does not move the price while its siblings do.
    'envelopes': {
        'our_name': 'Envelopes',
        'options': {'Brilliant White': 'white', 'Red': 'red'},
        'fields': {'front': lambda v: {'envelopes': v}},
        'families': {'flat-card', 'folded-card', 'folded-leaflet'},
    },
    'corners': {
        'our_name': 'Corners',
        'options': {'Rounded': '6'},
        'fields': {'front': lambda v: {'rounded-corners': v,
                                       'rounded-corners-tl': 'yes', 'rounded-corners-tr': 'yes',
                                       'rounded-corners-bl': 'yes', 'rounded-corners-br': 'yes'}},
        # Only the Postcards route carries rounded corners; Greeting Cards has
        # no such field.
        'families': {'flat-card'},
    },
}

FULL_LADDER = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150,
               200, 250, 300, 375, 450, 475, 500]
QUICK_LADDER = [25, 100, 250, 500]


class FormReader:
    """Lifts every input/select default out of a product page."""
    def __init__(self):
        from html.parser import HTMLParser

        class P(HTMLParser):
            def __init__(self):
                super().__init__()
                self.fields, self._sel, self._first, self._seen = {}, None, None, False

            def handle_starttag(self, tag, attrs):
                a = dict(attrs)
                if tag == 'input':
                    n, t = a.get('name'), (a.get('type') or 'text').lower()
                    if not n:
                        return
                    if t in ('radio', 'checkbox'):
                        if 'checked' in a:
                            self.fields[n] = a.get('value', 'on')
                        else:
                            self.fields.setdefault(n, self.fields.get(n, ''))
                    else:
                        self.fields[n] = a.get('value', '')
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

        self.p = P()

    def read(self, html):
        self.p.feed(html)
        return self.p.fields


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
            f = FormReader().read(html)
            m = re.search(r'name="_token"\s+value="([^"]+)"', html)
            if m:
                f['_token'] = m.group(1)
            # The Scodix upsells carry their own confirmation dance and would
            # add foiling to every probe, so they are stripped here and set
            # back explicitly by scrape_foiling() when foiling is the thing
            # being measured. Stripping them was also why foiling could not be
            # priced at all until 1 October: every probe silently removed the
            # fields that carry it.
            for k in list(f):
                if k.startswith('scodix') or k in ('spot-uv-price', 'foil-price', 'spot-uv-remove',
                                                   'foiling-remove', 'spot-uv-remove-foiling'):
                    f.pop(k, None)
            self._forms[slug] = f
        return self._forms[slug]

    def price(self, slug, **over):
        body = {k: ('' if v is None else str(v)) for k, v in {**self.form(slug), **over}.items()}
        req = urllib.request.Request(
            f'{BASE}/product/pricing/{slug}', data=urllib.parse.urlencode(body).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded',
                     'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA,
                     'Referer': f'{BASE}/products/{slug}'})
        time.sleep(DELAY)
        try:
            j = json.loads(self.op.open(req, timeout=40).read().decode())
        except Exception as e:
            return None
        v = j.get('totalSellingPrice')
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def reply(self, slug, **over):
        """The whole reply. Foiling needs `scodixFoilPostPrice` out of it, and
        needs to see `error` — their All Over option returns a server error
        with a NEGATIVE price, which differencing would have recorded as a
        discount."""
        body = {k: ('' if v is None else str(v)) for k, v in {**self.form(slug), **over}.items()}
        req = urllib.request.Request(
            f'{BASE}/product/pricing/{slug}', data=urllib.parse.urlencode(body).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded',
                     'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA,
                     'Referer': f'{BASE}/products/{slug}'})
        time.sleep(DELAY)
        try:
            return json.loads(self.op.open(req, timeout=40).read().decode())
        except Exception:
            return {}


# ── FOILING ───────────────────────────────────────────────────────────────
#
# Measured 1 October 2026, 269 probes, every figure reproduced on a second run.
# Foiling is not scraped by the generic loop above for three reasons:
#
# 1. **It is read, not differenced.** Their reply carries `scodixFoilPostPrice`,
#    which is 0 with foiling off and exactly the delta with it on. The generic
#    loop differences two whole-pound prices and carries the +/-1 pound noise
#    the module docstring warns about; this does not.
#
# 2. **One probe answers for eight colours.** Their price does not vary by foil
#    colour — nor by coverage percent (1, 2, 3, 4, 5, 7, 10, 25, 50 all
#    identical), build height, common-or-different guide, or bleed. Every one of
#    those was walked. So the foiled AREA is not a cost input to them, and one
#    measurement is written out across the colours we sell.
#
# 3. **It is sold on the front only.** Our foil layer is a single page at the
#    finished size, which can only be the front panel, so `applies_to` is
#    'front' and the probe asks for one side. Both sides is dearer (+21 pounds
#    at 25, +26 at 100, +35 at 250) and we do not sell it. If we ever do, it is
#    a second applies_to, not a change to this one.
#
# What DOES move their price, for whenever this is revisited: sides, three
# areas rather than one or two (one and two cost the same), and quantity once
# past 250-500 on the larger sheets.
#
# "All Over" is not probed. It returns `{"error": "Undefined array key \"\""}`,
# a zero total and a NEGATIVE foil price. That is a fault on their endpoint, not
# a price, and it is the 0.00 pounds that was once mistaken for foiling being
# free.

FOIL_COLOURS = ['Gold', 'Silver', 'Copper', 'Rose Gold', 'Red', 'Blue',
                'Holographic', 'Green']

# The one spec the charge is measured at: foiling on, one side, one area, the
# cheapest coverage. Every other field was proven not to move the price.
FOIL_FIELDS = {'scodix_foil': 'true', 'scodix_foil_sides': '1',
               'scodix_foil_different_guide': 'false',
               'scodix_foil_number_of_areas': '1',
               'scodix_foil_build_height': 'flat',
               'scodix_foil_coverage_percent': '1',
               'foil-price': 'no', 'showScodix': '1',
               'scodix_spotUV': ''}

# Where foiling can be bought at all.
#
# Only two routes. It is absent from luxury-flat and luxury-folded entirely
# (`showScodix=0`, no scodix fields in the form), which is why the Italian
# papers take no foiling on our side either — and ROUTES sends our
# **folded-leaflet** family to luxury-folded, so that family cannot be foiled
# either. Listing it here would have scraped a product with no foiling field
# and recorded whatever came back, which is exactly how a pile of free
# lamination rows got in once before.
FOIL_FAMILIES = {'flat-card', 'folded-card'}

# The generic FAMILY_SPEC prices folded-card on Cartonboard 255gsm, which the
# 1 October probes showed is a weight PrintedEasy do not sell: it returns the
# same price as a nonsense 999, while 280gsm returns a distinct and much higher
# one. Foiling is measured on a stock proven real instead, so the figure cannot
# rest on a substitution. The generic loop's own use of 255 is a separate
# question and is written up in STATUS.
FOIL_BASE_STOCK = {'flat-card': ('silk', '300'), 'folded-card': ('silk', '300')}

# The sizes foiling is SOLD on, which is not the list the generic loop uses.
# flat-card sells foiling on the business card size (place cards) and
# FAMILY_SPEC does not list it.
#
# This matters more than it looks. Once ANY Foiling row exists,
# lookupFinishSell treats the ladder as the only answer: a size the ladder does
# not cover returns null and the finish is WITHDRAWN rather than falling back
# to the flat figure. So a size missing from here does not quote a little
# wrong — it stops being offered at all. Taken from
# product_types.available_sizes on 1 October, for every active product whose
# available_finishes include Foiling.
FOIL_SIZES = {'flat-card':   ['A6', 'A5', 'DL', 'Square', 'Square-210', 'business-card'],
              'folded-card': ['A6', 'A5', 'DL', 'Square']}


def scrape_foiling(pe, families, ladder):
    """The foiling charge, after the 20% discount, per family/size/quantity."""
    rows, skipped, notes = [], [], []
    for family in families:
        if family not in FOIL_FAMILIES:
            notes.append(f'{family}: PrintedEasy do not foil on this route')
            continue
        slug = ROUTES[family]
        stock, gsm = FOIL_BASE_STOCK[family]
        for our_size in FOIL_SIZES[family]:
            for qty in ladder:
                f = {'quantity': str(qty), 'stock-finish': stock,
                     'stock-weight': gsm, 'printed-sides': 'single'}
                f.update(size_fields(slug, our_size))
                # The plain job first, so a spec they do not sell is not
                # recorded as a foiling price.
                plain = pe.reply(slug, **f, **{'scodix_foil': '', 'scodix_spotUV': ''})
                base = plain.get('totalSellingPrice')
                try:
                    base = float(base)
                except (TypeError, ValueError):
                    base = 0.0
                if base <= 0:
                    skipped.append(f'{family} {our_size} x{qty}: the plain job is not sold')
                    continue
                d = pe.reply(slug, **f, **FOIL_FIELDS)
                if d.get('error'):
                    skipped.append(f'{family} {our_size} x{qty}: {d["error"]}')
                    continue
                try:
                    charge = float(d.get('scodixFoilPostPrice'))
                except (TypeError, ValueError):
                    skipped.append(f'{family} {our_size} x{qty}: no foiling figure in the reply')
                    continue
                # A finish cannot make a job cheaper, and cannot be free.
                if charge <= 0:
                    skipped.append(f'{family} {our_size} x{qty}: foiling came back at {charge}')
                    continue
                total = float(d.get('totalSellingPrice') or 0)
                if abs(total - base - charge) > 0.011:
                    skipped.append(f'{family} {our_size} x{qty}: {charge} does not reconcile '
                                   f'against {base} -> {total}')
                    continue
                cost = round(charge * 0.80, 2)
                for colour in FOIL_COLOURS:
                    rows.append({'supplier_family': family, 'finish_name': 'Foiling',
                                 'option_name': colour, 'applies_to': 'front',
                                 'size': our_size, 'quantity': qty, 'cost': cost})
            print(f'foiling {family} {our_size}: {len(rows)} rows so far, '
                  f'{len(skipped)} skipped', flush=True)
    return rows, skipped, notes


def size_fields(slug, our_size):
    listed = LISTED.get(slug, {})
    if our_size in listed:
        return {'size': listed[our_size]}
    w, h = CUSTOM_DIMS[our_size]
    return {'size': 'custom', 'width': w, 'height': h}


def base_fields(family, slug, our_size, qty):
    spec = FAMILY_SPEC[family]
    stock, gsm = spec['stock']
    f = {'quantity': str(qty)}
    f.update(size_fields(slug, our_size))
    if family == 'display-board':
        f.update({'substrate': stock, 'printed-sides': 'single',
                  'lamination': 'none', 'wrap-mounting': 'no', 'drilled-holes': 'none'})
    else:
        f.update({'stock-finish': stock, 'stock-weight': gsm, 'printed-sides': 'single'})
    return f


def sb(path, method='GET', body=None, prefer=None):
    if not SERVICE_KEY:
        sys.exit('SUPABASE_SERVICE_KEY is not set')
    h = {'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY,
         'Content-Type': 'application/json'}
    if prefer:
        h['Prefer'] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'{SUPABASE_URL}/rest/v1/{path}', data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read().decode()
        return json.loads(t) if t.strip() else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true', help='apply to finish_rates (default reports only)')
    ap.add_argument('--only', metavar='FAMILY', help='limit to one supplier family')
    ap.add_argument('--finish', metavar='NAME', help='limit to one finish key, e.g. lamination')
    ap.add_argument('--quick', action='store_true', help='4 quantities instead of 21')
    ap.add_argument('--csv', metavar='PATH', help='where to write the raw scrape')
    a = ap.parse_args()

    ladder = QUICK_LADDER if a.quick else FULL_LADDER
    families = [a.only] if a.only else list(FAMILY_SPEC)
    # Foiling is not in FINISHES: it is measured by scrape_foiling() below, on
    # its own terms. --finish foiling therefore runs that and nothing else —
    # and `generic` turns the loop below off entirely rather than letting it
    # walk every family, size and quantity fetching base prices for a list of
    # finishes that is now empty. The first run did exactly that and spent
    # several minutes printing "0 rates" before it reached the foiling.
    finishes = [a.finish] if a.finish else list(FINISHES)
    finishes = [f for f in finishes if f in FINISHES]
    generic = bool(finishes)

    pe = PrintedEasy()
    rows, skipped, errors, substitutes, notoffered = [], [], [], set(), set()
    everMoved = set()

    for family in (families if generic else []):
        slug = ROUTES.get(family)
        if not slug:
            errors.append(f'{family}: no route')
            continue
        for our_size in FAMILY_SPEC[family]['sizes']:
            for qty in ladder:
                bf = base_fields(family, slug, our_size, qty)
                base = pe.price(slug, **bf)
                if not base:
                    skipped.append(f'{family} {our_size} x{qty}: base came back {base}')
                    continue
                for fkey in finishes:
                    spec = FINISHES[fkey]
                    if family not in spec.get('families', set(FAMILY_SPEC)):
                        continue
                    for applies_to, build in spec['fields'].items():
                        # Diagnostic only: if an invented value prices the same
                        # as the base the field is strict; if it differs, the
                        # endpoint substitutes a default for this field. Either
                        # way the option list came from their own form, so this
                        # does not discard anything.
                        sent = pe.price(slug, **bf, **build(SENTINEL))
                        if sent is not None and abs(sent - base) > 0.005:
                            substitutes.add(f'{family}/{fkey}/{applies_to}')
                        # If the sentinel AND every real option price exactly
                        # the same as the plain job, the form has no such field
                        # and we are recording a finish the printer does not
                        # offer. Cheaper to detect than to trust an allowlist.
                        probes = {o: pe.price(slug, **bf, **build(v))
                                  for o, v in spec['options'].items()}
                        if (sent is not None and abs(sent - base) < 0.005 and
                                all(g is not None and abs(g - base) < 0.005 for g in probes.values())):
                            notoffered.add(f'{family}/{fkey}/{applies_to} on {our_size} (no such field)')
                            continue
                        # Whether an option is OFFERED cannot be judged from one
                        # rung. Their prices are whole pounds, so a real charge
                        # rounds to £0 at small quantities — white envelopes on a
                        # greeting card are 4p each, which is £0 on a run of 25.
                        # Judging per cell dropped them as "not offered" while
                        # red, at 8p, survived.
                        #
                        # So record whether this option EVER moved the price for
                        # this family and finish, and decide at the end.
                        for our_opt, their_opt in spec['options'].items():
                            got = probes.get(our_opt)
                            if not got:
                                skipped.append(f'{family} {fkey} {our_opt} {applies_to} {our_size} x{qty}: 0')
                                continue
                            key = (family, fkey, our_opt)
                            if abs(got - base) > 0.005:
                                everMoved.add(key)
                            if got < base - 0.005:
                                skipped.append(f'{family} {fkey} {our_opt} {applies_to} {our_size} x{qty}: '
                                               f'{got} is cheaper than the plain job at {base}')
                                continue
                            uplift = round((got - base) * 0.80, 2)
                            rows.append({'supplier_family': family, 'finish_name': spec['our_name'],
                                         'option_name': our_opt, 'applies_to': applies_to,
                                         'size': our_size, 'quantity': qty, 'cost': uplift,
                                         '_key': (family, fkey, our_opt)})
                print(f'{family} {our_size} x{qty}: {len(rows)} rates, '
                      f'{len(skipped)} skipped, {len(errors)} errors', flush=True)

    # An option that never moved the price anywhere, for any size or quantity,
    # is one the form does not have. One that moved it somewhere is real, and a
    # £0 rung is simply a £0 rung.
    dropped = sorted({r['_key'] for r in rows if r['_key'] not in everMoved})
    for k in dropped:
        notoffered.add(f'{k[0]}/{k[1]}/{k[2]} (never changed the price)')
    rows = [r for r in rows if r['_key'] in everMoved]
    for r in rows:
        r.pop('_key', None)

    # Foiling is measured on its own terms — read from the reply rather than
    # differenced, one probe answering for eight colours, front only. See
    # scrape_foiling().
    if not a.finish or a.finish == 'foiling':
        frows, fskip, fnotes = scrape_foiling(pe, families, ladder)
        rows.extend(frows)
        skipped.extend(fskip)
        for n in fnotes:
            notoffered.add(n)
        print(f'\nfoiling: {len(frows)} rates, {len(fskip)} skipped')

    print(f'\nFINISHED {len(rows)} rates, {len(skipped)} not offered, {len(errors)} errors')
    if notoffered:
        print('\nNOT OFFERED — the form has no such field, nothing written:')
        for x in sorted(notoffered):
            print('  ' + x)
    if substitutes:
        print('\nfields where an unknown value still returned a price '
              '(the endpoint substitutes a default here):')
        for x in sorted(substitutes):
            print('  ' + x)
    if skipped[:12]:
        print('\nnot offered (first 12):')
        for s in skipped[:12]:
            print('  ' + s)

    # Always keep the rows. The first full run was report-only and threw away
    # 2,793 rates after an hour of scraping, which meant re-running to see a
    # single number. A report that cannot be read twice is not a report.
    import csv as _csv
    out = a.csv or 'finish_rates_scrape.csv'
    with open(out, 'w', newline='') as fh:
        w = _csv.DictWriter(fh, fieldnames=['supplier_family', 'finish_name', 'option_name',
                                           'applies_to', 'size', 'quantity', 'cost'])
        w.writeheader()
        w.writerows(rows)
    print(f'\nwrote {len(rows)} rows to {out}')

    if not a.write:
        print('Report only. Re-run with --write to apply these costs to finish_rates,'
              ' or load the CSV.')
        return

    # Must match finish_rates_natural_key exactly.
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        sb('finish_rates?on_conflict=supplier_family,finish_name,option_name,applies_to,size,quantity',
           'POST', chunk, prefer='resolution=merge-duplicates,return=minimal')
        print(f'wrote {i + len(chunk)}/{len(rows)}', flush=True)
    print('done — now Publish in admin')


if __name__ == '__main__':
    main()
