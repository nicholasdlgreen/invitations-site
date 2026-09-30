# The ordering wizard — brief

One agreed structure for the ordering wizard, before and after the upload step,
built once and rolled out across all 22 products. Agreed 30 September.

**Scope: Upload & Print only.** The design studio serves a different audience —
people who do not have artwork — and is not touched by this work. Upload &
Print serves the more experienced customer who arrives with a file.

## The process

1. Research current best practice for multi-step configurators and ordering
   flows. **Ecommerce sources only** — the first pass leaned on GOV.UK, which
   optimises completion of a form people must finish, the opposite incentive to
   a purchase someone can abandon.
2. Review printed.com, Vistaprint, Papier and Moo — what they ask, in what
   order, before and after upload.
3. Compare ours against both, using `tools/audit-wizard.py`.
4. Bring back design options for the wizard, before and after upload.

Then review, agree one, build it once, roll it out.

## Requirements

- **One structure, every product.** Variation only where a product genuinely
  differs (a foam board has no envelopes), never as a side effect of which
  price rows happen to exist.
- **Admin has to drive it.** Adding or removing a paper stock or a finishing
  option in admin must change the wizard, on every product, without a code
  change. The structure is fixed; the contents are data. This is part of the
  brief, not an afterthought — a wizard that only a developer can change will
  drift again.

## What this replaces

22 products, 7 distinct wizards (measured, `tools/audit-wizard.py`). The
landing pages are already one structure across all 22 and are not in scope.

## Where it got to, 30 September

Research done (`scratch/wizard-research.html`). Recommendation: **A, spec first
and artwork last** — the trade-printer model that printed.com and MOO both use
— **with D, presets, on top**. Awaiting review before anything is built.

Two findings that stand whichever option is chosen, both now backed by
ecommerce research rather than opinion:

- **We hide unavailable options instead of showing them unavailable.** Baymard
  record users discovering this only after opening a menu. Ours is worse: the
  option vanishes, so nobody knows it existed.
- **We show no price per unit**, on a product sold exclusively in packs. 81% of
  sites miss this; it is the largest single gap in Baymard's product-page
  benchmark.
