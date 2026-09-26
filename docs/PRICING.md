# How Foreverprint pricing works

*Last verified 26 September 2026 against the live database and against
PrintedEasy's own calculator. This is the canonical reference — if you change
how pricing works, change this file in the same commit.*

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
| Published sell prices | **56,804** |
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

## 3. What we sell, and what it is printed as

A product's **family** decides which PrintedEasy product it is bought on. It is
set per product in admin and nothing can be priced without it.

| Our family | Products | Bought on |
|---|---|---|
| **flat-card** (15) | wedding, party, birthday, engagement party, baby shower, christening invitations; invitations; save the dates; RSVP; menu cards; table numbers; place cards; new arrival; moving cards; **Christmas cards** | **Postcards** for Silk, Uncoated, Cartonboard · **Luxury Flat** for the Fedrigoni stocks |
| **folded-card** (4) | greeting, thank you, engagement, graduation cards | **Greeting Cards** |
| **folded-leaflet** (1) | order of service | **Luxury Folded** |
| **display-board** (3) | table plans, welcome signs, signage | **Display Boards** |

A product may also name a **`folded_family`**, giving it a second route for the
folded version. Wedding invitations and Christmas cards both do: flat on
`flat-card`, folded on `folded-card`.

### One family can span two of their products

`flat-card` resolves Silk, Uncoated and Cartonboard to *Postcards* and the
Fedrigoni stocks to *Luxury Flat*, decided per paper in `pe_product()`. Luxury
Flat and Postcards price Silk and Uncoated identically, but only Postcards
supports foiling — so those papers are bought there at no extra cost and gain
foiling, while the Fedrigoni stocks, which exist only on Luxury Flat, are
bought there.

### 880 cost rows are currently unreachable

`sheet_rates` holds a **`large-format`** family — Gloss, Silk and Uncoated at
A1–A4, 20 quantities each, 880 rows — and **no product uses it**. Table plans,
signage and welcome signs are all `display-board`, which is Foamex 5mm only at
A0–A2. We scraped paper posters and then sold only board.

They are unreachable because a product has exactly one `supplier_family` plus
one `folded_family`, and the second slot means "folded", not "another route".
**This is the limit that has to go** — see §7.

---

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

### The flexibility we want and do not yet have

**Anything PrintedEasy sell on the route a product is printed on should be
offerable on that product, from admin, without a code change.** Today:

| Change | Admin only? |
|---|---|
| New **weight** on a paper we already hold | **Yes** — `paper_stocks`, scrape, Publish |
| A stock PrintedEasy offer that we do not hold | **No** — needs `PE_STOCK`, sometimes `LUXURY`, and the price-watch list edited in Python |
| A stock on a **different route** for the same product | **No** — impossible in the model |

---

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
has four options and one price. Foiling has four colours and one price. There
is nowhere to put a price that differs by option, quantity, sides or size.

Our configurator's own copy says lamination is applied to **both sides**, while
£5 is barely their front-only price. Every laminated order gives away roughly
£4–£7 of cost before any margin.

Because foiling is a **setup charge, not a per-unit cost**, it adds about £1.72
a card at 50 but 34p at 250. Unsellable on short runs, very sellable on long
ones — worth a minimum quantity rather than offering it everywhere.

**Finishing is a property of the paper, not the product.** Choose a Fedrigoni
stock and the options disappear, because the printer cannot foil, laminate or
spot-UV that range at all.

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
| What a finish **costs** | `finish_options` | admin |
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

## 7. Agreed changes, not yet built

Agreed 26 September, in this order:

1. **Rebuild finishing as a rate table**, keyed like sheet rates —
   (family, finish, option, size, quantity, sides). This is the one change that
   makes us structurally match them; everything after it is data.
2. **Generalise `folded_family` into a list of routes**, so a product can be
   priced on more than one PrintedEasy product. This frees the 880 orphaned
   `large-format` rows and lets table plans be sold on paper as well as board.
3. **Move the supplier's vocabulary out of Python into the database** —
   `PE_STOCK` and `LUXURY` become columns on `paper_stocks`, and the full stock
   × weight matrix PrintedEasy offer per route is discovered and stored as data,
   validated with the sentinel test in §4. Then offering any stock they sell, at
   any weight they sell it, is an admin tick rather than a code edit.

---

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
2. **The three agreed changes in §7**, before margin.
3. **The VAT question** in §1 — the single most valuable thing to resolve.
4. **Confirm the 20%** against a real invoice.
5. **Lamination under-recovers** by £4–£7 an order, and the copy promises both
   sides — fixed by §7.1.
6. **Envelopes** sit outside the margin engine.
7. **The checkout VAT line** still shows a split while the business is not
   registered.
