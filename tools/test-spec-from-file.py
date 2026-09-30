#!/usr/bin/env python3
"""Can a finished PDF tell us what it is?

Idea 1 rests on one claim: that (page count, page width, page height) is enough
to identify which product specification a file was made for. This tests the
claim before anyone builds on it, by enumerating every specification Upload &
Print sells and asking which of them a given file shape could belong to.

A collision is two different specifications accepting the same file shape. Some
are harmless (the two readings are the same card). Some are not.

The model of "a correct export" below is not invented here: it is the same set
of shapes mapPagesToSlots() accepts, which tools/test-uploader-faces.js already
pins — four panels or two spreads for a folded card printed throughout, one
spread or two panels for outside only, and a spread that is twice as tall
rather than twice as wide when the card is landscape.
"""
import itertools
from collections import defaultdict

# The card sizes Upload & Print actually sells, from SIZE_SPECS.
SIZES = {
    'A5':     (148, 210),
    'A6':     (105, 148),
    '5x7':    (127, 178),
    'DL':     (99, 210),
    'Square': (148, 148),
}
BLEED = 6          # 3mm each edge
TOL = 4            # the tolerance mapPagesToSlots already uses


def page_shapes(w, h):
    """A page may arrive trimmed or with bleed."""
    return [(w, h), (w + BLEED, h + BLEED)]


def signatures(size, orient, fold, sides):
    """Every file shape that is a correct export of this specification.

    Returns a list of (n_pages, w, h) for the pages, which are all the same
    shape in every case we accept.
    """
    w, h = SIZES[size]
    if orient == 'landscape':
        w, h = h, w
    out = []
    if fold == 'flat':
        n = 1 if sides == 'single' else 2
        out += [(n, pw, ph) for pw, ph in page_shapes(w, h)]
    else:
        # A folded card's spread doubles on the axis the crease runs across:
        # a portrait card creases down its side, a landscape one across it.
        sw, sh = (w, h * 2) if orient == 'landscape' else (w * 2, h)
        if sides == 'single':
            # outside only: two panels, or one spread
            out += [(2, pw, ph) for pw, ph in page_shapes(w, h)]
            out += [(1, pw, ph) for pw, ph in page_shapes(sw, sh)]
        else:
            # all four faces: four panels, or two spreads
            out += [(4, pw, ph) for pw, ph in page_shapes(w, h)]
            out += [(2, pw, ph) for pw, ph in page_shapes(sw, sh)]
    return out


def near(a, b):
    return abs(a - b) <= TOL


SPECS = []
for size in SIZES:
    for orient in ('portrait', 'landscape'):
        # A square has no other way up; do not double-count it.
        if orient == 'landscape' and SIZES[size][0] == SIZES[size][1]:
            continue
        for fold in ('flat', 'folded'):
            for sides in ('single', 'double'):
                SPECS.append((size, orient, fold, sides))


def matches(sig):
    n, w, h = sig
    hits = []
    for spec in SPECS:
        for (sn, sw, sh) in signatures(*spec):
            if sn == n and near(sw, w) and near(sh, h):
                hits.append(spec)
                break
    return hits


def name(spec):
    size, orient, fold, sides = spec
    return '%s %s %s %s-sided' % (size, orient, fold, sides)


def main():
    # Every file shape any correct export could produce.
    all_sigs = set()
    for spec in SPECS:
        all_sigs |= set(signatures(*spec))

    unique, ambiguous = [], []
    for sig in sorted(all_sigs):
        hits = matches(sig)
        (unique if len(hits) == 1 else ambiguous).append((sig, hits))

    print('%d specifications, %d distinct file shapes they can produce.\n'
          % (len(SPECS), len(all_sigs)))
    print('%d shapes identify exactly one specification.' % len(unique))
    print('%d shapes are ambiguous.\n' % len(ambiguous))

    # Which ambiguities actually matter? Two readings that differ only in a
    # square's orientation are the same card; two that differ in the fold are not.
    real = []
    for sig, hits in ambiguous:
        folds = {h[2] for h in hits}
        sizes = {h[0] for h in hits}
        sides = {h[3] for h in hits}
        if len(folds) > 1 or len(sizes) > 1 or len(sides) > 1:
            real.append((sig, hits))

    print('Of those, %d are differences that change the price or the press file:\n' % len(real))
    for sig, hits in real:
        n, w, h = sig
        print('  %d page%s at %g × %gmm could be:' % (n, '' if n == 1 else 's', w, h))
        for hspec in hits:
            print('      %s' % name(hspec))
        print()

    harmless = len(ambiguous) - len(real)
    if harmless:
        print('%d further shapes are ambiguous only in ways that do not matter\n'
              '(the same card described two ways).\n' % harmless)

    pct = 100.0 * len(unique) / len(all_sigs)
    print('%.0f%% of correct exports identify themselves exactly.\n' % pct)

    print('Asking ONE question as well as reading the file:')
    for i, label in ((2, '"Is it folded?"'), (3, '"Printed both sides?"'),
                     (0, '"What size?"'), (1, '"Which way up?"')):
        total, still = resolve_with(i)
        print('  %-22s leaves %d of %d ambiguous  (%.0f%% resolved)'
              % (label, still, total, 100.0 * (total - still) / total))
    print()
    return 0


def resolve_with(extra):
    """If we ask the customer ONE more thing, how much does it resolve?

    extra is the index into a spec tuple (0 size, 1 orientation, 2 fold,
    3 sides) that we imagine asking about directly.
    """
    all_sigs = set()
    for s in SPECS:
        all_sigs |= set(signatures(*s))
    still = 0
    for sig in all_sigs:
        hits = matches(sig)
        # group the candidates by the answer to the extra question; if every
        # group has one member, asking it resolves this shape completely
        by = defaultdict(list)
        for h in hits:
            by[h[extra]].append(h)
        if any(len(v) > 1 for v in by.values()):
            still += 1
    return len(all_sigs), still


if __name__ == '__main__':
    raise SystemExit(main())
