# How Foreverprint pricing works

*Last verified 26 September 2026 (afternoon) against the live database and
against PrintedEasy's own calculator. This is the canonical reference — if you
change how pricing works, change this file in the same commit.*

*A shareable summary for PrintedEasy or a production partner, drawn from this
file, lives at https://claude.ai/code/artifact/3df5ea13-436a-4d15-920b-e423f2c1eef0
— it omits our margin position. It is now out of date; update it when this
file changes.*

**The goal right now is to replicate PrintedEasy's pricing structure as closely
as possible.** Margin comes after, not during. Which stocks we then put in
front of customers may differ from theirs — that is a product decision and does
not matter to the back end, provided the back end can price anything they sell
on the route a product is printed on.

---

## 0. The state of things in one table

| | |
|---|---|
| Cost rows in `sheet_rates` | **7,389** (378 switched off) |
| Finishing rows in `finish_rates` | **0** — table built, scrape in progress |
| Published sell prices | **56,636** |
| Active products | **23** |
| Margins | **0 on every product** — the site sells at cost |
| Payload schema | version 3, published 26 Sept 2026 |

---

## 1. The commercial basis

We buy from **PrintedEasy** (printedeasy.com) at **20% off their published
list price**. Their list is our cost base; we hold no price list of our own.

- **Their increases reach us automatically.** A rise in their list is a rise in
  our cost the same day. Nothing errors — our margin just shrinks. See §8.
- **The 20% is an assumption until an invoice proves it.** No order has been
  invoiced yet. If the discount applies to something other than the web list
  price, every cost figure shifts.

### VAT

Every price we hold **excludes VAT**, because that is how their calculator
quotes. Their own treatment is inconsistent by product: they add VAT on
Postcards and Calendars, and not on Luxury Flat, Luxury Folded, Greeting Cards,
Flyers, Folded Leaflets, Posters or Display Boards. Flyers and folded leaflets
carry an explicit *VAT payable* toggle, reflecting UK zero-rating of leaflets.

**The unresolved point:** they quote Luxury Flat without VAT, and Luxury Flat is
what we sell as a wedding invitation. An invitation is standard-rated. If our
invoices carry 20%, every cost figure here is 20% light — and while Foreverprint
is not VAT registered that is a real cost, not a reclaimable one.

> **To ask PrintedEasy:** *"Your calculator quotes Luxury Flat without VAT. Will
> our invoices carry VAT on invitation and wedding stationery work?"*

On our own side nothing adds VAT to a shop price: `site_config.pricing`
carries `vatRegistered: false`, and the grid and landing pages show the price
paid with no VAT line. Registration day is that one value. The **checkout**
still shows a VAT split and is a separate code change.

---

## 2. How a price is built

```
PrintedEasy list price
        ↓  less 20% (the agreement)
   our COST            ← stored in `sheet_rates`
        ↓  × (1 + margin %)   ← set per product in admin
   our SELL PRICE      ← stored in `pricing_config`, read by the website
```

You only ever enter **cost**. Sell is derived, so the same cost sells at
different prices on different products.

Cost is keyed on **(family, paper, weight, size, quantity, printed_sides)**.
Every part of that key earns its place:

- **family**, because the same paper costs a different amount depending on what
  it is printed as — A4 Silk is one price as a poster and another as a folded
  order of service.
- **printed_sides**, added 25 September. The real uplift for a printed back is
  **8.7% to 34.8%** depending on paper, size and quantity. It was previously
  assumed to be a flat 15%, which was wrong everywhere.

`sheet_rates.active` (added 26 September) lets a rate be kept for evidence but
withheld from customers. Publish and the Monday price watch both skip inactive
rows. It exists because the from-price takes the **cheapest** row, so one bad
cheap rate does not sit quietly in a corner — it becomes the headline.

---

## 3. What we sell, and how it is made

A product names one or more **routes**, each `{family, fold}` and optionally
`papers`. The family decides which PrintedEasy product supplies it. Set in
admin; nothing can be priced without at least one.

| Our family | Bought on | Can it finish? |
|---|---|---|
| **flat-card** | **Postcards** for Silk, Uncoated, Cartonboard · **Luxury Flat** for the Fedrigoni stocks | Postcards: lamination, foiling, spot UV, corners. Luxury Flat: **corners only**, and free |
| **folded-card** | **Greeting Cards** | lamination, foiling, spot UV. **No corners** |
| **folded-leaflet** | **Luxury Folded** | **nothing at all** |
| **large-format** | **Posters** | lamination |
| **display-board** | **Display Boards** | its own lamination field, plus drilled holes |

**Finishing is a property of the route, not the paper.** The document used to say
the opposite, and it held only by coincidence: the Fedrigoni stocks exist solely
on the Luxury products, and those cannot be finished, so the two correlated.
Luxury Folded proves the real cause — it carries no finishing field whatever
stock you pick.

### Routes replaced a two-slot model

A product used to have `supplier_family` plus a `folded_family` whose slot meant
"folded" rather than "another way of making this". That could not express *a
table plan is flat on 5mm board or on paper*, so 880 `large-format` rates —
Gloss, Silk and Uncoated posters at A1–A4 — sat unreachable.

Two routes **may** share a fold. That is safe because every lookup keys on paper
too: `noBackwardSteps` curves on `paper|gsm|size|fold|sides`, and
`lookupSheetSell` matches the paper. Two routes sharing a fold **and** a paper is
not safe — those lookups take the first hit and would resolve arbitrarily, so a
route may name the `papers` it serves, and **Publish refuses** with an error
naming the clashing stocks if any remain.

Each published rate row carries `rt`, its route index. That matters beyond
price: `printingFamily()` drives **press geometry** — a folded leaflet is imposed
on a double-width sheet — so once two routes share a fold the fold alone cannot
say which family prints the job. The site resolves it from the customer's chosen
paper.

`supplier_family` and `folded_family` remain as a fallback for any payload
published before routes existed.

### Order of service has two routes

An example of why this was needed. It was sold only on Luxury Folded, so it was
Fedrigoni stock or nothing — and Luxury Folded finishes nothing, which is why the
product offered Lamination, Foiling and Spot UV it could never supply.

| Route | Stocks | Weights | Finishing |
|---|---|---|---|
| Luxury Folded (`papers` pinned to the five Fedrigoni) | Tintoretto, Nettuno, Acquerello, Sirio Pearl, Recycled | 280–350 | none |
| Greeting Cards | Silk, Uncoated | 250 / 300 / 350 | yes |

Pinning the luxury route's stocks is what makes the pair legal: both routes carry
Silk and Uncoated, and unrestricted they each claimed them.

### 880 cost rows were unreachable

`large-format` — Gloss, Silk and Uncoated at A1–A4, 20 quantities, 880 rows — has
no product using it. Table plans, signage and welcome signs are all
`display-board`, which is Foamex 5mm at A0–A2. We scraped paper posters and then
sold only board. Routes make this fixable: give those products a second
`large-format` route. **Not yet done.**

## 4. The papers, and what PrintedEasy really offer

**Their dropdown is not authoritative, and the pricing endpoint silently
substitutes.** Measured 26 September on Postcards, A5 ×25, Cartonboard:

| gsm | 250 | 255 | 280 | 300 | 350 | 400 | **999** |
|---|---|---|---|---|---|---|---|
| quoted | 0 | 46 | **139** | 46 | 0 | 0 | **46** |

The form offers 250/300/350/400. The truth is 255 and 280. A nonsense weight of
999 returns 46 — the same as 255 and 300 — so the endpoint falls back to a
default rather than refusing.

**A returned price therefore does not prove the spec is real.** The test that
does:

> Probe the weight, and probe a sentinel weight of 999. The combination is real
> only if the price is **greater than zero** and **different from the
> sentinel**.

This is how the folded 400gsm fault got in: it came back below every thinner
weight and identical to the penny across two papers, because it was a fallback,
not a quote. Those 378 rows are switched off. It is also why
`folded-leaflet` 400gsm **is** genuine — there it rises properly above 350 on
both papers, and their Luxury Folded product really does crease the full range
including the Fedrigoni stocks.

### Stocks we currently hold

| Paper | Weights held | Route | Finishable? |
|---|---|---|---|
| Uncoated | 250 / **300** / 350 / 400 | Postcards | yes |
| Silk | 250 / **300** / 350 / 400 | Postcards | yes |
| Tintoretto Gesso | **300**, 140 | Luxury Flat | **no** |
| Nettuno Bianco | **280** | Luxury Flat | **no** |
| Acquerello Bianco | **280** | Luxury Flat | **no** |
| Sirio Pearl Polar Dawn | **300** | Luxury Flat | **no** |
| Recycled Uncoated | **350** | Luxury Flat | **no** |
| Cartonboard | 255 / **280** | Postcards | yes |
| Ice White | **300** | Greeting Cards | yes |
| Gloss | 250 / **300** / 350 | Posters | lamination only |
| Foamex 5mm | **5mm** | Display Boards | holes, protective finish |

Tintoretto, Nettuno, Acquerello and Sirio Pearl are **Fedrigoni** stocks — the
premium end, and the thing competitors on plain silk cannot match. Uncoated 120
and Tintoretto 140 exist in `paper_stocks` but have **no rates**, so they never
appear.

### Weights are a property of the route, not the paper

The site derives the thickness picker from **published prices**, never from the
paper's own weight list. No price, not offered. That is why folded Uncoated and
folded Silk show different weights from their flat selves.

### The flexibility we want, and where it now stands

**Anything PrintedEasy sell on the route a product is printed on should be
offerable on that product, from admin, without a code change.**

| Change | Admin only? |
|---|---|
| New **weight** on a paper we already hold | **Yes** |
| A stock PrintedEasy offer that we do not hold | **Yes**, since the vocabulary moved to the database — below |
| A stock on a **different route** for the same product | **Yes**, via a second route — §3 |
| Knowing *which* stocks and weights they sell on a route | **Not yet.** Needs the matrix discovered with the sentinel test |

### The supplier's vocabulary lives in the database

Which stock they call `silk`, and which of their products a stock is bought on,
used to be hardcoded in `tools/printedeasy_refresh.py` **and again** in
`netlify/functions/printedeasy-price-watch.js`, the second carrying a comment
asking whoever added a paper to remember the first.

`paper_stocks` now carries:

- **`pe_stock`** — their own value, as their form spells it (`silk`,
  `tintoretto`, `foamex5mm`). Null means we cannot price it from them.
- **`pe_product_overrides`** — `{"flat-card":"luxury-flat"}`, naming one of
  *their* products when it differs from the family default.

The override replaced a hardcoded `LUXURY` set, which conflated two separate
facts that happened to coincide: *this is premium* and *this is bought off a
different product*. Only the second affects pricing, so a new premium stock on a
normal route would have been mis-routed.

Both are on the Paper Stocks form in admin. In the price watch, loading the
vocabulary is a **hard precondition**: without it every probe looks up an
undefined stock and the run reports that nothing has changed — silence that reads
as good news, the worst failure a watcher can have.

## 5. Finishing — where we do **not** replicate them

Finishing is charged as a flat amount per order, once, whatever the quantity.
That is wrong. Measured 26 September, A6 Silk 300 single sided, their list:

| Quantity | None | Matt front | Matt both sides | Soft touch front |
|---:|---:|---:|---:|---:|
| 25 | £45 | +£4 | +£11 | +£5 |
| 100 | £47 | +£4 | +£11 | +£5 |
| 500 | £59 | +£5 | +£12 | +£7 |

By size at 100: A6 **+£4**, DL **+£4**, A5 **+£6**.

So their lamination charge varies by **option**, **which sides**, **quantity**
and **size** — four dimensions. We hold one number.

| Finish | Our cost held | Reality |
|---|---|---|
| Lamination | £5 | varies on four dimensions; both sides is **+£11, not 2 × £4** |
| Foiling | £70 | list ~£88, near-flat with quantity — sound |
| Spot UV | £52 | verified flat: £63 at 25, £65 at 100, £64 at 500 — sound |
| Corners | £0 | verified free — sound |
| Fold | £0 | verified free — sound |
| Hanging holes | £13.60 | unverified |
| Protective finish | £13.60 | unverified |

**The structural problem.** `finish_options` holds one `cost_modifier` per
finishing **type**, while `finish_types` holds 2–4 **options** each. Lamination
has four options and one price. There is nowhere to put a price that differs by
option, quantity, sides or size.

Our configurator's own copy says lamination is applied to **both sides**, while
£5 is barely their front-only price. Every laminated order gives away roughly
£4–£7 of cost before any margin.

Because foiling is a **setup charge, not a per-unit cost**, it adds about £1.72 a
card at 50 but 34p at 250. Unsellable on short runs, very sellable on long ones —
worth a minimum quantity rather than offering it everywhere.

### `finish_rates` — the replacement

Keyed **(family, finish, option, applies_to, size, quantity)**, holding the
uplift after the 20% discount. Scraped by `tools/printedeasy_finishes.py`.

**Paper and weight are deliberately not in the key**, which is what keeps this a
~900-probe job per family rather than 40,000. Both-sides lamination measured
£11/£11/£12/£11 across 250–400gsm at quantity 100 and £17/£16/£17/£16 at 500 —
flat within the ±£1 you get from differencing two whole-pound prices. The job's
own `printed_sides` drops out for the same reason.

**±£1 is the resolution of their price list**, not our error. They quote whole
pounds, so an uplift is the difference of two rounded staircases. Do not chase it.

Three things the first runs taught, all of them traps:

- **The sentinel probe does not transfer from weights to options.** Asked for an
  invented lamination value their endpoint falls back to a **real** lamination
  rather than to none, so the sentinel collided with Matt and rejected 11 good
  rows. Matt and Gloss also price identically — a true finding — so equality
  proves nothing. For finishes their own option list **is** authoritative;
  validation is arithmetic instead, and a finish may cost nothing but can never
  make a job cheaper.
- **An allowlist is no defence against your own judgement.** `folded-leaflet` was
  allowlisted for lamination without checking, and Luxury Folded has no such
  field, so a full run recorded zero-cost lamination rows for finishes that do not
  exist. There is now a general guard: if the sentinel **and** every real option
  price identically to the plain job, the form has no such field and nothing is
  written.
- **A report that cannot be read twice is not a report.** The first full run
  computed 2,793 rates over an hour and discarded them. It now always writes a
  CSV.

**Matt and Gloss lamination cost the same**; soft touch is £1–2 more. Worth
knowing when pricing the options to customers.

### Still to wire: gate finishes on the route

Finishes are gated on the **paper's** capability list and the product's allowlist.
Neither knows about the route, which is now wrong in a way that is live: an order
of service on Tintoretto is offered **Corners**, and Luxury Folded cannot make
them. It is free, so no money is taken, but it is a promise we cannot keep.

The fix is self-maintaining and needs no new config: require `finish_rates` rows
for the **printing family**. The scrape becomes the capability list, and because
the guard above writes nothing for a family whose form lacks the field, a route
that cannot finish automatically offers nothing.

### Envelopes bypass the margin engine

PrintedEasy charge **6p** for white and **11p** for red, per unit, measured at
100. Our `envelopes` table charges **35p to 60p** as a flat retail figure read
straight into the basket. That is a reasonable retail price, but it is a margin
already set while every other margin is 0 — so "the site sells at cost" is not
strictly true, and envelopes sit outside the system that will set margin.

---

## 6. Where everything lives

| What | Where | Changed by |
|---|---|---|
| Our cost, 7,389 rows | `sheet_rates` | admin → Pricing → Sheet Rates, or `tools/printedeasy_refresh.py` |
| Our sell price, 56,804 prices | `pricing_config` (one row) | admin → Pricing → **Publish** |
| Papers, weights, finishes | `paper_stocks` | admin → Pricing → Paper Stocks |
| Papers/sizes/family/quantities per product | `product_types` | admin → Pricing → Product Types |
| What a finish **costs** today | `finish_options` (one price per type) | admin |
| What a finish **will cost** | `finish_rates` (per option, sides, size, quantity) | `tools/printedeasy_finishes.py` |
| How a product can be made | `product_types.routes` | admin → product form |
| The supplier's name for a stock | `paper_stocks.pe_stock`, `pe_product_overrides` | admin → Paper Stocks |
| What a finish is **called** and its options | `finish_types` | admin |
| Envelope retail prices | `envelopes` | admin |
| Which pack the grid quotes | `product_types.display_quantity` | admin → product form |
| VAT rate and registration | `site_config.pricing` | SQL |

**Two tables, nearly the same name, different jobs.** `finish_options` holds
what a finish costs; `finish_types` holds what the customer reads. Changing a
price in one changes no words, and rewriting the other changes no price.

**No price is anywhere in the code.** Pages read the published snapshot live, so
a price change needs a Publish, never a deploy.

That was true in principle and false in practice until 24 September: twenty of
twenty-one landing pages tested `schema_version === 2` while Publish writes 3,
so each silently discarded the payload and showed "Pricing to be confirmed" —
no error, on every product page, for a day. **A version bump in the payload is a
breaking change to every page that reads it**; widen the test rather than
raising the number.

---

## 7. The three agreed changes, and where they stand

Agreed 26 September.

1. **Finishing as a rate table** — `finish_rates` exists and the scraper works.
   **Outstanding:** populate it, then gate finishes on the route and retire
   `finish_options.cost_modifier`.
2. **More than one route per product** — **done.** Routes, per-route stock lists,
   the overlap guard, `rt` on every published row, and press geometry resolving
   from the chosen paper. Order of service is the first product using it.
3. **The supplier's vocabulary out of code** — **done** for `pe_stock` and
   `pe_product_overrides`. **Outstanding:** discover their full stock × weight
   matrix per route with the sentinel test, so admin can tick any weight they
   genuinely sell.

Only after all three would the back end be a genuine replica, and margin comes
after that.

## 8. Watching for supplier changes

`netlify/functions/printedeasy-price-watch.js` runs **Mondays at 08:00**. It
samples about twenty prices and reads one product page — roughly 25 requests a
week — and emails only when something moves: a price, or a stock or weight
appearing or disappearing. It changes nothing; it tells you to run the refresh.

It skips `active = false` rows, so it cannot report drift on a price nobody can
buy. Needs `ALERT_EMAIL` in Netlify if alerts should go anywhere other than
`FROM_EMAIL`.

---

## 9. Routine jobs

**Change one price.** Admin → Pricing → Sheet Rates. Choose family, paper,
weight, edit the grid, Save. Then **Publish**.

**Add a weight.** Add it to the paper in Paper Stocks, scrape or enter its cost
rows, Publish.

**Refresh everything from the supplier.**

```bash
SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py          # report
SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py --write  # apply
```

Reports what moved before changing anything; `--write` updates cost only and
**never publishes**. Roughly 35 minutes for the full set, paced at about three
requests a second.

A refresh upserts `cost` only, so it will **not** silently re-enable a rate
switched off in §4 — flip `active` by hand if a re-scrape proves it real.

**Publish.** Admin → Pricing → Publish. **Hard-reload admin after a deploy
first**, or the old publish code writes a stale payload — that has caught us
three times. Read the warnings: a product with no family cannot be priced.

### Where a customer sees a price

- **The grid** (`/products`): `From £18 for 50`, from the `from_prices()`
  function — cheapest flat single-sided spec at the product's
  `display_quantity`.
- **A landing page** (`/slug`): the same figure and pack in the hero block, from
  `renderPricing()`, which reads `display_quantity` too. Both surfaces must
  agree; they pinned different sizes until 26 September and quoted £19 against
  £18 for the same product.
- **Everywhere else**: the order step.

---

## 10. Constraints worth knowing

**Luxury paper or foiling, never both.** The Fedrigoni range cannot be finished
at all. A foiled invitation must be on Silk, Uncoated or Cartonboard.

**Cartonboard 280gsm is expensive** — £139 against £46 for the 255 on the same
job. A specialist board with a steep minimum.

**A1 is a cliff** — £216–£296 against £49 at A2 and £18 at A3. A1 is a common
table plan size.

**Their price curve is a staircase in whole pounds and some treads go
backwards** — 475 folded A5 cards cost less than 450. Publish walks each curve
down so we never quote more for fewer, per (fold × sides). The backward steps
stay in `sheet_rates`, because that table's job is to mirror the supplier.

**PostgREST returns at most 1,000 rows and does not say it truncated.** Admin's
rate load had no paging and once published 888 of 3,795 rates with large format
missing entirely. Fixed with `sbFetchAll`. **Always check the published payload,
not just the input data.**

**Standard production is free**; Express is +20% (min £20) and Express Plus
+40% (min £40), charged on top and not held in the rate tables.

---

## 11. Outstanding

1. **Margins.** All 0. The cost base is trade, the market is consumer: Uncoated
   300gsm A5 ×100 costs £24, while Papier charge £210 for the same box. Margin
   should be set by where we want to sit against Papier, not by marking up cost.
2. **Populate `finish_rates`**, then gate finishes on the route and retire
   `finish_options.cost_modifier`. Until then lamination under-recovers £4–£7 an
   order and the copy promises both sides.
3. **Corners is promised on an order of service in Fedrigoni stock** and cannot
   be made. Free, so no money is taken — closed by the route gate.
4. **Discover their stock × weight matrix per route** with the sentinel test, the
   last piece of item 3.
5. **The 880 `large-format` rates** are still unreachable. Routes make it a
   one-line change; nobody has decided whether table plans should be sold on
   paper.
6. **The VAT question** in §1 — the single most valuable thing to resolve.
7. **Confirm the 20%** against a real invoice.
8. **Envelopes** sit outside the margin engine: they cost 6p and we charge 35p.
9. **The checkout VAT line** still shows a split while the business is not
   registered. The grid and landing pages are already clean.
