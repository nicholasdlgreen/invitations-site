#!/usr/bin/env python3
"""Refresh tools/fixtures/published-prices.json from the live published prices.

The checkout floor test drives the real floor with real published rows. It
needs that data IN THE REPO, not in a temp directory: tools/test-slug-from-url.js
reads its fixture from a scratchpad that no longer exists and has silently run
zero assertions ever since, which is the quietest way for a test to die.

The fixture is trimmed to the fields the floor reads and stored columnar, which
takes it from 1.9MB to about 630KB.

It does NOT need to be current. The test is about whether the floor behaves
against a realistic ladder, not about whether today's prices are right — that is
the price-watch's job. Refresh it when the shape of the data changes, not when
the numbers do.

    python3 tools/refresh-price-fixture.py
"""
import json, os, re, sys, urllib.request

SLUGS = ['wedding-invitations', 'rsvp-cards', 'greeting-cards']
COLS  = ['paper', 'gsm', 'size', 'qty', 'fold', 'sides', 'sell']
ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT   = os.path.join(ROOT, 'tools', 'fixtures', 'published-prices.json')

cfg = open(os.path.join(ROOT, 'supabase-config.js')).read()
url = re.search(r"url:\s*'([^']+)'", cfg).group(1)
key = re.search(r"anonKey:\s*'([^']+)'", cfg).group(1)

out = {'_cols': COLS,
       '_note': 'published sheet prices, trimmed to the fields the checkout floor reads',
       'products': {}}
for slug in SLUGS:
    req = urllib.request.Request(
        url + '/rest/v1/rpc/pricing_for?p_slug=' + urllib.parse.quote(slug),
        headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    data = json.load(urllib.request.urlopen(req))
    payload = data[0]['payload'] if isinstance(data, list) else data.get('payload', data)
    products = payload.get('products') or []
    if not products:
        print('no published product for', slug); sys.exit(1)
    rows = products[0].get('sheet_sells') or []
    out['products'][slug] = [[r.get(c) for c in COLS] for r in rows]
    print('%-22s %d rows' % (slug, len(rows)))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('wrote %s (%.0f KB)' % (OUT, os.path.getsize(OUT) / 1024))
