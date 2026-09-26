# Where we are — 26 September 2026

*Written at the end of the day's work. Every claim below was checked against the
live site, the live database or a generated file, not against intention.*

Thirty-one commits, all pushed and live. Three threads: making our pricing
mirror PrintedEasy's, checking our product mix against competitors, and
rebuilding the artwork journey.

---

## 1. Pricing that marries with PrintedEasy

### Done

- **Printed sides is a real dimension of the cost base.** 3,066 rates scraped.
  The measured uplift for a printed back is **8.7% to 34.8%** depending on
  paper, size and quantity — the code had assumed a flat 15%, which was wrong
  everywhere.
- **`sheet_rates.active`** — a rate can be kept for evidence but withheld from
  customers. Publish and the Monday price watch both honour it.
- **Folded 400gsm switched off** (378 rows). It priced below every thinner
  weight at every size and quantity, and identically to the penny on two
  different papers — the signature of a fallback, not a quote.
- **The sentinel test**, written down in `PRICING.md` §4: their form is not
  authoritative and the endpoint substitutes a default rather than refusing.
  Cartonboard on Postcards quotes 0 at 250gsm, 46 at 255 — and **46 for a
  nonsense 999**.
- **Routes.** A product can now be priced on more than one PrintedEasy product,
  with per-route stock lists, a publish guard that refuses overlapping stocks,
  and a route index on every published rate so press geometry follows the
  customer's chosen paper.
- **The supplier's vocabulary moved into the database** — `pe_stock` and
  `pe_product_overrides` on `paper_stocks`, editable in admin. It was hardcoded
  in the Python refresh tool **and again** in the Netlify price watch.
- **`finish_rates` table built and 2,289 rates scraped**, keyed
  (family, finish, option, sides, size, quantity).

### The finishing numbers, and what they cost us

We charge **one flat £5** for lamination whatever is chosen. Measured, A5,
flat-card, our cost after the 20%:

| Option | Sides | 25 | 500 |
|---|---|---:|---:|
| Matt | front | £4.80 | £7.20 |
| Matt | both | £8.80 | £12.80 |
| Gloss | front | £4.80 | £8.00 |
| Soft touch | front | £5.60 | £12.00 |
| **Soft touch** | **both** | **£9.60** | **£21.60** |
| Anti-scuff | both | £9.60 | £20.80 |

The configurator's own copy says lamination is applied to **both sides**. So a
soft-touch laminated run of 500 costs us £21.60 and recovers £5 — **£16.60 lost
before any margin**, on a single line.

### Outstanding

1. **Load the 2,289 finishing rates.** They are in a CSV, not in the database.
   `finish_rates` is still empty and the site still charges the flat £5.
2. **Gate finishes on the route.** Finishes are gated on the paper and the
   product, neither of which knows which press the job goes to. This is live
   now: an order of service in Fedrigoni stock is offered **Corners**, and
   Luxury Folded cannot make them. Free, so no money is taken, but it is a
   promise we cannot keep.
3. **Retire `finish_options.cost_modifier`** once the rate table drives pricing.
4. **Discover their full stock × weight matrix per route**, with the sentinel
   test, so offering any weight they genuinely sell is an admin tick. This is
   the last piece of the three agreed changes.
5. **880 `large-format` rates are still unreachable** — Gloss, Silk and Uncoated
   posters at A1–A4. Routes make it a one-line change; nobody has decided
   whether table plans should be sold on paper as well as board.
6. **Margins are 0 on all 23 products.** Still the only real launch blocker.
7. **Envelopes sit outside the margin engine** — they cost 6p and we charge 35p.
8. **The 20% discount is unconfirmed** against a real invoice.
9. **The VAT question** with PrintedEasy — they quote Luxury Flat without VAT,
   and that is what we sell as a wedding invitation.

---

## 2. Product mix, against the competition

### Done

- **The from-price was the price of ONE card.** Papier, Vistaprint and
  printed.com were all checked; none of them quotes a quantity of one, and every
  one that shows an "each" price names the quantity beside it. The grid and the
  landing pages now quote a pack — "From £18 for 50" — from a per-product
  `display_quantity`, and both surfaces agree.
- **No VAT is added and none is claimed**, because we are not registered. Driven
  from `site_config`, so registration day is one value.
- **Quantity ladder** — entry lowered to 10, and 300 and 500 removed. The
  free-type box still reaches 500 with a real price behind every step.
- **Rounded corners and fold direction**, both free from the printer. Verified
  that Luxury Flat really does carry rounded corners, so the ones live on
  Tintoretto are deliverable.
- **Christmas cards are flat as well as folded** — they were folded-only, which
  is why they priced at twice an invitation.
- **Order of service gained a standard route** alongside the luxury one. It was
  Fedrigoni stock or nothing.
- **Place cards and Christmas cards** added and priced.

### Outstanding

1. **Lightweight stocks** — Uncoated 120 and Tintoretto 140 exist in
   `paper_stocks` with no rates, so they never appear.
2. **Boards are single-sided only** — signage, table plans, welcome signs.
   Deliberately deferred.
3. **Range gaps not yet decided**: details and enclosure cards, evening
   invitations, belly bands, printed envelopes, hen party. Funeral and sympathy
   undecided.
4. **Eight product names are stored lowercase** and render that way on the grid
   — `invitations`, `signage`, `Menu cards`, `Save the Date` and others.
5. **"Finished by hand" appears on twelve product pages.** Nothing is finished
   by hand; the printer machine-finishes everything. Predates this work; flagged,
   not changed, because it is Nicholas's copy.
6. **"Colour mode: CMYK preferred"** on the upload screen contradicts what we
   actually send, which is RGB. We ask customers for something we then ignore.

---

## 3. The artwork journey

### Done

- **One box per printed face**, every face checked, every face sent to press.
- **A proof per face** — tabs with a status dot, and each face keeps its own
  fill/fit, zoom, rotation and position.
- **The press file uses each face's own position.** It used to build every face
  with whichever was on screen, so zooming the front silently zoomed the back.
  Verified on a generated PDF: two pages, both 164×226mm, each with its own
  position.
- **The double-sided dead end is gone.** Uploading a front hid the very boxes
  the button then told you to use.
- **Verdicts that explain themselves** rather than "wrong size": we scale what
  we can and say the resulting DPI, refuse only what is genuinely too small and
  state the pixels needed, and treat a different shape as a choice between crop
  and border.
- **Three places the customer can read it** — under the boxes, under the face
  tabs, and an "Artwork size" row in the quality report, which previously
  covered format, file size, DPI and pages and never mentioned size.
- **Recognition when they fix it.** A corrected file used to say nothing at all.
- **Print guides are legible** on dark artwork, and the toggle says which state
  it is in.
- **Red and orange buttons removed.** Neither colour was agreed and a colour
  cannot say "add the back".
- **`docs/ARTWORK-SPEC.md` written** to be shared with PrintedEasy.

### Outstanding

1. **Six questions for PrintedEasy**, in `ARTWORK-SPEC.md` §9. The one that
   matters most: **head to head or head to foot** for a double-sided back. We
   send both faces the same way up. If their press expects otherwise, every
   double-sided job comes back with an upside-down back.
2. **Print one real sample.** The file maths is verified; the handover to their
   press is not.
3. **The proof still renders a mismatched file as though it fits**, scaled to
   the card. The messaging now explains it, but the picture does not show it.

---

## 4. How the work is tested now — and why that changed

Mid-afternoon Nicholas stopped the work: *"This is now breaking the entire site
because you are not checking and testing before you give it to me to go live."*

He was right. Changes were being "verified" by injecting patched functions into
the **live** page, which tests the patch against the live DOM and never tests
the file about to ship.

There is now a local server running the real `upload-and-print.html` from a copy
of the site. Since then it has caught, before Nicholas saw any of them:

- positions lost on return, through an await race in `checkFile`
- the zoom control reading 100% while the canvas showed the customer's zoom
- the on-screen face's adjustment dropped from the press file
- the "Artwork size" row wiped a moment after being added
- "a A5 card", then "an Square"

Two corrections were also made to claims already given to Nicholas: a "both
slots filled from one file" bug that was an artefact of a synthetic drop event,
and a description of bleed as a 4% scale-up when the code in fact **mirrors**
the outer 3mm, cropping nothing. The second had already reached
`ARTWORK-SPEC.md` and would have gone to PrintedEasy as a question asking
permission for something we do not do.

**Keep the harness.** `node` is not installed on this machine; macOS JXA is used
as the local JavaScript parser for syntax checks.

---

## 5. What I would do next, in order

1. **Load the finishing rates and gate finishes on the route.** It closes a live
   mis-selling (Corners on an order of service) and stops the lamination
   under-recovery.
2. **Set margins.** Everything else in pricing is finished and the site is
   selling at cost.
3. **Send `ARTWORK-SPEC.md` to PrintedEasy** and print one real sample. Both are
   cheap and both de-risk everything else.
4. The stock × weight matrix, then the range gaps.
