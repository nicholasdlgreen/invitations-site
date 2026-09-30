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

## A second question, asked 30 September

Whether the wizard should exist in this form at all, given what is now
possible. Written up in `scratch/wizard-ai-options.html`. **The recommendation
above is held, not withdrawn.**

The conclusion: the *questions* are not outdated — a press needs the size, the
stock, the sides and the quantity, and no technology changes that. What has
dated is the assumption behind the form, that the only way to learn them is to
ask a human. For an Upload & Print customer the file already answers half.

Ranked:

1. **The file answers the questions.** Deterministic, no model. We already
   extract page count and dimensions from any PDF, and `mapPagesToSlots()`
   already matches file geometry against a specification. Inverting it — search
   every size × fold × sides for the one the file fits — is a loop around
   tested code. Turns the file report from a list of mistakes into "here is
   what you have". Cannot derive paper, finishing or quantity.
2. **Say what you want in a sentence.** Constrained extraction into the
   existing form; the rate table still prices it. `help-chat.js` already calls
   Claude, so the pattern exists.
3. **Recommend the paper from the artwork.** Ink coverage and type weight from
   the render we already do, mapped onto real print craft. The only one a
   competitor cannot buy off the shelf. Must stay advice, never a silent
   change.
4. **Chat to a price.** Weakest. Slower than clicking for an audience that
   knows what it wants, and it hides the options.

Never AI: the price, the final specification without explicit confirmation, and
anything without the manual path still behind it.

## The two tracks, side by side

`scratch/wizard-two-tracks.html` — the same order reaching the same price two
ways, screen by screen.

- **A, traditional:** 6 screens, 10 decisions, presets needed to make it
  bearable. Works for everyone, including someone with no file.
- **B, file-led:** 5 screens, 6 decisions, two of them confirmations. Needs no
  presets — the file is the shortcut. Does not work without a file.

**Neither reaches a price faster.** Paper and quantity have to be asked either
way, and they are two of the four screens before a total. B's win is not speed:
it is that the customer is never asked something the file already knows, and
never told at the end that they answered it wrongly.

So the decision is not A or B. It is whether to build A alone, or build A and
let a file skip the front of it.

## Decided, 30 September

**The start point is size and shape, as it is today.** Size and range turn out
to be completely independent — every range is buyable in every size on every
product, place cards included — so there was no technical reason for the order
and it was a positioning choice.

**The range stays its own step**, where it is now, and **there are no presets**.
The range does that job. This also removes a collision I had introduced: my
mockup had "Eco" as both a preset and a paper range, which cannot both be on
one page under one word. Option D is therefore dropped.

### Still open

- **Where the artwork goes** — before the specification as today, or after it
  as option A proposed.
- **Whether the file derives the specification** (idea 1): 73% of correct
  exports identify themselves, 95% after one question.
- **The visual design.** The first attempt was rejected for looking like a
  wireframe, which it did: I drew a new design language beside an existing one
  instead of using the existing one. Redone as `scratch/wizard-design.html`,
  which loads the real `step3.css` and the real paper photographs, so the range
  pods, rail and price bar on it are the shipped components rather than
  drawings of them. Only the size stage is new, and it borrows the range pod's
  shape — picture, caption, meta row with a from-price.

  Worth recording: the persistent summary and sticky price bar I listed in the
  recommendation as something to add **already exist**, as `.bar` / `.sum` /
  `.tot` / `.go-btn` in step3.html. The design system is further along than my
  research assumed.
