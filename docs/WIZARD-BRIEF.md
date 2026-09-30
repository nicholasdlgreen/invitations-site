# The ordering wizard — brief

One agreed structure for the ordering wizard, before and after the upload step,
built once and rolled out across all 22 products. Agreed 30 September.

## The process

1. Research current best practice for multi-step configurators and ordering flows.
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
