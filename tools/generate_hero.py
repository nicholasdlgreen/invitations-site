#!/usr/bin/env python3
"""Generate a product hero photograph in the Foreverprint house style.

Flux Pro 1.1 Ultra via fal.ai, the same model the Design Studio uses, but
called directly: netlify/functions/studio-nano.js hardwires "decorative design
only, leave the centre empty, no letters" and offers only 1:1 and 3:4, which is
right for card artwork and wrong for a 4:3 lifestyle hero.

The key is read from a file OUTSIDE the repo, because this repo has no
.gitignore and anything dropped in it gets committed. It is never printed.

    echo 'fal_key_here' > ~/.foreverprint-fal-key && chmod 600 ~/.foreverprint-fal-key
    python3 tools/generate_hero.py greeting-cards --variants 3

Writes scratch/hero-<slug>-1.jpg ... so nothing is overwritten until you pick.
"""
import json, os, sys, urllib.request, pathlib, argparse

KEY_FILE = pathlib.Path.home() / '.foreverprint-fal-key'
ENDPOINT = 'https://fal.run/fal-ai/flux-pro/v1.1-ultra'

# The look, read off thank-you-cards-card.jpg and birthday-invitations-hero.jpg:
# one card as the hero, warm soft window light, cream linen, botanical or
# celebratory props, shallow depth of field, restrained cream/blush/gold.
HOUSE_STYLE = (
    "Editorial product photograph in a refined British luxury stationery style. "
    "Soft warm natural window light from the left, gentle shadows, shallow depth "
    "of field with a softly blurred warm interior behind. Palette of warm cream, "
    "blush, sage and soft antique gold. Calm, understated, expensive. "
    "Straight-on, the card fills the centre of the frame, nothing cropped awkwardly."
)

# Garbled lettering is the classic failure here — the existing birthday hero has
# "PARTY PARTY PARTY SOCK" printed on it. So the card front is artwork only.
NO_TEXT = (
    "The card front carries a decorative design only: absolutely no letters, no "
    "words, no writing, no lettering, no numbers anywhere in the image."
)

SUBJECTS = {
    'place-cards':
        # Two things fought us here. The model writes a name on a place card
        # whatever NO_TEXT says (the first attempts read "iam deula" and
        # "pare ll.."), so the card is described as blank and awaiting
        # calligraphy — something to draw rather than something to suppress.
        # And it defaults to a tent fold, which we do not sell: PrintedEasy's
        # folded route has no 85x55 at all, so ours is a flat card.
        "A single small luxury wedding place card, 85x55mm, FLAT and unfolded — a "
        "single thin sheet of card, not a tent, not standing up — resting on a "
        "folded white linen napkin on a gold-rimmed plate at a beautifully laid "
        "table. Photographed slightly from above. The card is BLANK and unwritten: "
        "the guest's name has not been added yet and the writing area is completely "
        "empty cream paper. Its only decoration is a fine sprig of eucalyptus at the "
        "left edge and a thin gold rule. A lit taper candle and eucalyptus run "
        "softly out of focus behind.",
    'christmas-cards':
        "A single folded luxury Christmas card standing upright on a pale linen "
        "tablecloth. Thick textured cotton paper printed with a winter wreath of "
        "fir, holly and red berries with fine gold detailing. Beside it a sprig of "
        "pine, a cream silk ribbon and one lit candle, warm and softly out of "
        "focus. A matching envelope rests behind it.",
    'greeting-cards':
        "A single luxury greeting card standing upright on a pale cream linen "
        "tablecloth. Thick textured cotton paper with a subtle deckled edge, "
        "printed with a delicate hand-painted botanical design in sage green and "
        "blush with fine gold detailing. Beside it a few loose eucalyptus sprigs, "
        "a cream silk ribbon curled loosely, and one or two dried rose petals. "
        "A matching unsealed envelope rests behind it, slightly out of focus.",
}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--variants', type=int, default=3)
    ap.add_argument('--ratio', default='4:3')
    args = ap.parse_args()

    if args.slug not in SUBJECTS:
        sys.exit("No subject written for '%s'. Add one to SUBJECTS." % args.slug)
    if not KEY_FILE.exists():
        sys.exit("No key at %s — see the docstring." % KEY_FILE)
    key = KEY_FILE.read_text().strip()
    if not key:
        sys.exit("%s is empty." % KEY_FILE)

    prompt = "%s %s %s" % (SUBJECTS[args.slug], HOUSE_STYLE, NO_TEXT)
    body = json.dumps({
        'prompt': prompt,
        'aspect_ratio': args.ratio,
        'num_images': args.variants,
        'output_format': 'jpeg',
        'enable_safety_checker': True,
        'safety_tolerance': '2',
    }).encode()

    req = urllib.request.Request(ENDPOINT, data=body, headers={
        'Authorization': 'Key ' + key,          # never logged
        'Content-Type': 'application/json',
    })
    print('Generating %d variant(s) at %s…' % (args.variants, args.ratio))
    with urllib.request.urlopen(req, timeout=180) as r:
        out = json.load(r)

    images = out.get('images') or []
    if not images:
        sys.exit('No images returned: ' + json.dumps(out)[:400])

    dest = pathlib.Path('scratch'); dest.mkdir(exist_ok=True)
    for i, im in enumerate(images, 1):
        p = dest / ('hero-%s-%d.jpg' % (args.slug, i))
        with urllib.request.urlopen(im['url'], timeout=120) as src:
            p.write_bytes(src.read())
        print('  %s  (%s x %s, %.0f KB)' % (
            p, im.get('width', '?'), im.get('height', '?'), p.stat().st_size / 1024))

if __name__ == '__main__':
    main()
