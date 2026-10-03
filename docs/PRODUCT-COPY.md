# What the product text says, and where it lives

Written 27 September 2026, after the site was found promising wax seals.

## Where each field actually goes

`product_types` has eight text fields. **Only four reach a customer**, and the
landing page HTML is only a fallback — JavaScript overwrites it at runtime from
the database, so **editing the .html file changes nothing on screen**.

| Field | Reaches a customer? | Where |
|---|---|---|
| `tagline` | **yes** | the hero paragraph, `#lp-sub` |
| `description` | **yes** | meta description fallback |
| `meta_title` | **yes** | the browser tab and Google |
| `meta_description` | **yes** | Google's snippet |
| `features` | no | nothing renders it |
| `intro_long` | no | nothing renders it |
| `buyer_guide` | no | nothing renders it |
| `faqs` | only in `/guides/*` | not on product pages |

**Always load the page and read it after a copy change.** The diff is not the
evidence. This was found the hard way: the file was edited, the page reloaded,
and the old wax-seal sentence was still on screen.

## What we can honestly claim

Read these before writing a sentence about papers or finishes.

**Finishes** (`finish_types`) — foil in eight colours;
rounded corners; matt, gloss or soft-touch lamination; long-edge, short-edge or
tent folds; a matt or gloss protective finish and drilled hanging holes on
boards; envelopes in brilliant white or red.

**Papers** (`paper_stocks`) — Uncoated, Silk, Ice White, Cartonboard, Gloss,
Recycled Uncoated, Foamex 5mm board, and four Fedrigoni stocks: Tintoretto
Gesso, Nettuno Bianco, Acquerello Bianco, Sirio Pearl Polar Dawn. 250–400gsm.

**There is no minimum order.** Rates go down to a single card. Anything saying
otherwise is wrong.

**We do not sell** wax seals, deckle edges, vellum, cotton rag, letterpress,
embossing, debossing or acrylic. All of these had been promised somewhere.

**Never promise a proof.** Say "check" or "preview". Two products claimed
"Digital proof included".

## How `features` was rebuilt

All 22 active products had `features` regenerated from the catalogue itself on
27 September — sizes from `available_sizes`, weights from the published prices,
fold behaviour from `supplier_family` and `folded_family`, finishes from
`available_finishes`, envelopes from the published finish prices. Every line is
derived from something true rather than written from memory.

Before that it held, among other things, an RSVP card reading "choose from
smooth white ad ad ad", signage offering acrylic we have never stocked, greeting
cards described as "folded or flat" when they are folded only, and "Digital
proof included". Fifteen of the twenty-two were empty.

The generator was a throwaway SQL function, `build_features(slug)`, dropped
immediately after use. It was **not** kept: a generator left in place looks
authoritative and silently goes stale, and this column is meant to be editable
by hand in admin. If the range changes enough to matter, rewrite the affected
rows — do not resurrect it and re-run it over hand-edited text.
