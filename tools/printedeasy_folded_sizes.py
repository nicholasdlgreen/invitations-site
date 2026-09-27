#!/usr/bin/env python3
"""Scrape PrintedEasy's Luxury Folded at the two sizes we had no rates for.

Why this exists
---------------
Everything we sell FOLDED could only ever be offered on Signature paper,
because the Luxury and recycled stocks have no rates on the folded-card
family. They do exist on `folded-leaflet` — PrintedEasy's Luxury Folded —
which is how an order of service offers all three ranges. But we only ever
scraped folded-leaflet at A6 and A5, so a folded card at DL or Square still
had nowhere to get a Luxury price from.

The awkward part
----------------
Their Luxury Folded form asks for the UNFOLDED sheet, not the finished card.
A6 and A5 finished map onto their listed A5 and A4. DL and Square have no
listed equivalent, so they have to be bought as a custom unfolded sheet:

    finished DL     99 x 210  ->  unfolded 198 x 210
    finished Square 148 x 148 ->  unfolded 296 x 148

Both quote. Checked before writing this, with the sentinel test that the rest
of this toolchain relies on: a nonsense 999x999 returns 0 rather than a
substituted default, so a number coming back is a real number. Orientation
makes no difference — 296x148 and 148x296 both return the same.

Two things worth knowing about what comes back:

  * Custom is NOT the same as listed on this product. A custom 105x148 quotes
    85 where their listed A6 quotes 79. So a custom size cannot be assumed to
    equal its listed twin here, unlike on luxury-flat.
  * Their custom price does not track area. A Square (438cm2) costs more than
    an A4 (624cm2), because an awkward sheet imposes badly. That is a real
    cost and it will show up as a Square costing slightly more than an A5.

Writes a CSV. Nothing touches the database from here.
"""
import csv, importlib.util, sys, time

spec = importlib.util.spec_from_file_location('pe', 'tools/printedeasy_refresh.py')
pe = importlib.util.module_from_spec(spec)
sys.argv = ['scrape']
spec.loader.exec_module(pe)

DISCOUNT = pe.DISCOUNT          # we buy at 20% off their list

# finished size -> the unfolded sheet it is folded from
UNFOLDED = {'DL': ('198', '210'), 'Square': ('296', '148')}

PAPERS = [  # (our name, gsm, their stock code)
    ('Recycled Uncoated', 350, 'recycled'),
    ('Acquerello Bianco', 280, 'acquerello'),
    ('Nettuno Bianco', 280, 'nettuno'),
    ('Sirio Pearl Polar Dawn', 300, 'polardawn'),
    ('Tintoretto Gesso', 300, 'tintoretto'),
    ('Silk', 250, 'silk'), ('Silk', 300, 'silk'),
    ('Silk', 350, 'silk'), ('Silk', 400, 'silk'),
    ('Uncoated', 250, 'uncoated'), ('Uncoated', 300, 'uncoated'),
    ('Uncoated', 350, 'uncoated'), ('Uncoated', 400, 'uncoated'),
]
LADDER = pe.LADDER['folded-leaflet']
SIDES = ('single', 'double')

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'folded_sizes.csv'
    cli = pe.PrintedEasy()

    # The sentinel first. If an absurd sheet ever starts returning a price,
    # every number below becomes untrustworthy and the run should stop.
    s = cli.price('luxury-folded', size='custom', width='999', height='999',
                  quantity='100', **{'stock-finish': 'tintoretto',
                                     'stock-weight': '300', 'printed-sides': 'single'})
    if (s.get('totalSellingPrice') or 0) > 0:
        sys.exit('SENTINEL FAILED: 999x999 returned a price, so custom sizes are '
                 'being substituted. Nothing scraped.')
    print('sentinel ok (999x999 -> 0)\n')

    rows, done, total = [], 0, len(PAPERS) * len(UNFOLDED) * len(SIDES) * len(LADDER)
    for size, (w, h) in UNFOLDED.items():
        for paper, gsm, stock in PAPERS:
            for sides in SIDES:
                got = 0
                for qty in LADDER:
                    try:
                        r = cli.price('luxury-folded', size='custom', width=w, height=h,
                                      quantity=str(qty),
                                      **{'stock-finish': stock, 'stock-weight': str(gsm),
                                         'printed-sides': sides})
                        lst = float(r.get('totalSellingPrice') or 0)
                    except Exception as e:
                        lst = 0.0
                    done += 1
                    if lst > 0:
                        rows.append({'supplier_family': 'folded-leaflet', 'size': size,
                                     'paper_name': paper, 'weight_gsm': gsm,
                                     'printed_sides': sides, 'quantity': qty,
                                     'list_price': round(lst, 2),
                                     'cost': round(lst * (1 - DISCOUNT), 2)})
                        got += 1
                    time.sleep(0.25)
                print(f'  {size:<7} {paper:<24} {gsm:>4}gsm {sides:<7} '
                      f'{got}/{len(LADDER)}   [{done}/{total}]', flush=True)

    with open(out, 'w', newline='') as f:
        wr = csv.DictWriter(f, fieldnames=['supplier_family','size','paper_name','weight_gsm',
                                           'printed_sides','quantity','list_price','cost'])
        wr.writeheader(); wr.writerows(rows)
    print(f'\n{len(rows)} rates -> {out}')

if __name__ == '__main__':
    main()
