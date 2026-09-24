# How Foreverprint pricing works

*Last verified 24 September 2026, when every claim below was re-checked
against the live database. This is the canonical reference — if you change how
pricing works, change this file in the same commit.*

*A shareable summary for PrintedEasy or a production partner, drawn from this
file, lives at https://claude.ai/code/artifact/3df5ea13-436a-4d15-920b-e423f2c1eef0
— it omits our margin position. Update it when this file changes.*

Everything below was checked against PrintedEasy's live calculator on the date
above: ten sample configurations across all four product families, both supply
routes, custom sizes and every weight. All ten agreed.

---

## 1. The commercial basis

We buy from **PrintedEasy** (printedeasy.com) at **20% off their published
list price**. Their list price is therefore our cost base, and we hold no
separate price list of our own.

Two consequences that matter:

- **Their increases reach us automatically.** A rise in their list is a rise in
  our cost the same day. Nothing breaks, nothing errors — our margin simply
  shrinks. See §7 for how we find out.
- **The 20% is an assumption until an invoice proves it.** No order has yet been
  invoiced. If the discount turns out to apply to something other than the web
  list price, every cost figure in the system shifts.

### VAT — open question

Every price we hold is **excluding VAT**, because that is how their calculator
quotes. Their treatment is inconsistent by product:

| They add VAT | They do not |
|---|---|
| Postcards, Desktop Calendars, Wall Calendars | Luxury Flat, Luxury Folded, Greeting Cards, Flyers, Folded Leaflets, Posters, Display Boards |

Flyers and folded leaflets carry an explicit *VAT payable: yes/no* toggle —
switching it on takes a £30 job to £36. That reflects the UK zero-rating of
leaflets.

**The unresolved point:** they quote Luxury Flat with no VAT, and Luxury Flat
is what we sell as a wedding invitation. An invitation is standard-rated. If
our invoices carry 20%, every cost figure here is 20% light — and while
Foreverprint is not VAT registered that is a real cost, not a reclaimable one.

> **To ask PrintedEasy:** *"Your calculator quotes Luxury Flat without VAT.
> Will our invoices carry VAT on invitation and wedding stationery work?"*

---

## 2. What we sell, and what it is printed as

Each product belongs to a **family**, which decides which PrintedEasy product
it is bought on. The family is set per product in admin and nothing can be
priced without it.

| Our family | Products | Sizes | Bought on |
|---|---|---|---|
| **flat-card** (13) | wedding, party, birthday, engagement party, baby shower and christening invitations; invitations; save the dates; RSVP cards; menu cards; table numbers; new arrival cards; moving cards | A6, A5, DL, Square (148mm), Square 210mm | **Postcards** for Silk, Uncoated, Cartonboard · **Luxury Flat** for the Fedrigoni stocks |
| **folded-card** (4) | greeting cards, thank you cards, engagement cards, graduation cards | A6, A5, DL, Square | **Greeting Cards** |
| **folded-leaflet** (1) | order of service | A5, A4 | **Luxury Folded** |
| **large-format** (3) | table plans, welcome signs, signage | A4, A3, A2, A1 | **Posters** |

### Why flat cards use two routes

Luxury Flat and Postcards price Silk and Uncoated **identically** — £25 is £25,
£29 is £29, all the way down. But only Postcards supports foiling. So those
papers are bought on the Postcards route at no extra cost and gain foiling,
while the Fedrigoni stocks, which exist only on Luxury Flat, are bought there.

---

## 3. The papers

Ten stocks. Weights shown are those we sell; **bold is the default**.

| Paper | Weights | Route | Can be finished? |
|---|---|---|---|
| Uncoated | 250 / **300** / 350 / 400 | Postcards | yes |
| Silk | 250 / **300** / 350 / 400 | Postcards | yes |
| Tintoretto Gesso | **300** | Luxury Flat | **no** |
| Nettuno Bianco | **280** | Luxury Flat | **no** |
| Acquerello Bianco | **280** | Luxury Flat | **no** |
| Sirio Pearl Polar Dawn | **300** | Luxury Flat | **no** |
| Recycled Uncoated | **350** | Luxury Flat | **no** |
| Cartonboard | 255 / **280** | Postcards | yes |
| Ice White | **300** | Greeting Cards | yes |
| Gloss | 250 / **300** / 350 | Posters | lamination only |

Tintoretto Gesso, Nettuno Bianco, Acquerello Bianco and Sirio Pearl are all
**Fedrigoni** stocks — that is the premium end of the range and the thing
competitors on plain silk cannot match.

### Weights are not available everywhere

Which weights a paper comes in is a property of the paper. Which we can **buy**
depends on what it is being printed as:

| | flat-card | folded-card |
|---|---|---|
| Uncoated | 250 / 300 / 350 / 400 | **300 only** |
| Silk | 250 / 300 / 350 / 400 | **250 / 300 / 350** |

The site therefore derives the thickness picker from the **published prices**,
never from the paper's own weight list. If it has no price, it is not offered.

---

## 4. How a price is built

```
PrintedEasy list price
        ↓  less 20% (the agreement)
   our COST            ← stored in `sheet_rates`
        ↓  × (1 + margin %)   ← set per product in admin
   our SELL PRICE      ← stored in `pricing_config`, read by the website
```

You only ever enter **cost**. The sell price is derived, so the same cost sells
at different prices on different products.

Cost is keyed on **(family, paper, weight, size, quantity)**. The family is part
of the key because the same paper costs different amounts depending on what it
is printed as — A4 Silk is one price as a poster and another as a folded order
of service.

### Finishing

Charged as a flat amount per order, not per card, because that is how the
printer charges. Figures are our cost after the 20%.

| Finish | Our cost | Notes |
|---|---|---|
| Lamination | £5 | |
| Foiling | £70 | list ~£88, near-flat whatever the quantity |
| Spot UV | £52 | list ~£65, likewise |

Because foiling is a **setup charge and not a per-unit cost**, it adds about
£1.72 a card at 50 but only 34p a card at 250. It is unsellable on short runs
and very sellable on long ones — worth a minimum quantity rather than offering
it everywhere.

**Finishing is a property of the paper, not the product.** Choose a Fedrigoni
stock and the finishing options disappear, because the printer cannot foil,
laminate or spot-UV that range at all. Choose Silk, Uncoated or Cartonboard and
they appear.

---

## 5. Where everything lives

| What | Where | Changed by |
|---|---|---|
| Our cost, 1,340 rows | `sheet_rates` (Supabase) | admin → Pricing → Sheet Rates, or `tools/printedeasy_refresh.py` |
| Our sell price, 8,788 prices | `pricing_config` (one row) | admin → Pricing → **Publish** |
| Papers, weights, finishes | `paper_stocks` | admin → Pricing → Paper Stocks |
| Which papers/sizes/family each product has | `product_types` | admin → Pricing → Product Types |
| Finish charges | `finish_options` | admin → Pricing → Finish Options |
| Finish names, descriptions, colours | `finish_types` | admin |

**Two tables, nearly the same name, different jobs.** `finish_options` holds what
a finish *costs*. `finish_types` holds what the customer *reads* — the name, the
description and the colour options, which is what the product pages render.
Changing a price in `finish_options` does not change a word on the site, and
rewriting `finish_types` does not change a price.

**No price is anywhere in the code.** Pages read the published snapshot live, so
a price change never needs a deploy — only a Publish.

That was true in principle and false in practice until 24 September: twenty of
the twenty-one landing pages tested `schema_version === 2` while Publish writes
3, so each one silently discarded the entire payload and showed "Pricing to be
confirmed". No error, no warning — just no prices, on every product page, for a
day. Fixed in `66fc506`. **A version bump in the payload is a breaking change to
every page that reads it**; widen the test rather than raising the number next
time.

Current state: schema version 3, published 23 Sept 2026, **all margins 0** (the
site sells at cost while we test).

---

## 6. Routine jobs

**Change one price.** Admin → Pricing → Sheet Rates. Choose family, paper and
weight, edit the grid, Save. Then **Publish**.

**Add a paper.** Add it in Paper Stocks with its weights, tick it on the
products that should offer it, add its cost rows in Sheet Rates, then Publish.
It must also be added to `PE_STOCK` in `tools/printedeasy_refresh.py` and
`netlify/functions/printedeasy-price-watch.js` or the refresh cannot price it.

**Refresh everything from the supplier.**

```bash
SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py          # report
SUPABASE_SERVICE_KEY=... python3 tools/printedeasy_refresh.py --write  # apply
```

Reports what moved before changing anything; `--write` updates cost only. It
**never publishes** — that stays a person pressing the button after reading the
diff. About 35 minutes for all 1,388 prices.

**Publish.** Admin → Pricing → Publish. Read the warnings first: it lists every
product with a gap, and a product with no family cannot be priced at all.

### Where a customer now sees a price

The "Simple, honest pricing" section and its quantity-by-paper table were taken
off all 21 landing pages on 24 September and replaced by "Our paper stocks".
**The only price on a landing page is now the hero "from" figure**, which
renderPricing() derives from the cheapest paper at the lowest quantity. Every
other price is quoted in the order step. If pricing needs to be visible earlier
in the journey again, it is a new section, not a restored one.

---

## 7. Watching for supplier changes

`netlify/functions/printedeasy-price-watch.js` runs every **Monday at 08:00**.
It samples about twenty prices and reads one of their product pages — roughly
25 requests a week — and emails only when something has moved: a price, or a
stock or weight appearing or disappearing.

It changes nothing. It tells you to run the refresh.

Needs `ALERT_EMAIL` set in Netlify if alerts should go anywhere other than
`FROM_EMAIL`.

---

## 8. Constraints worth knowing

**Luxury paper or foiling, never both.** The Fedrigoni range cannot be finished
at all. A foiled invitation must be on Silk, Uncoated or Cartonboard.

**Cartonboard 280gsm is expensive** — £94–£127 a box against Silk's £18–£56 for
the same job. It is a specialist board with a steep minimum. Loaded, but not
one to put in front of customers without thinking.

**A1 is a cliff.** £216–£296 against £49 at A2 and £18 at A3. A1 is a common
table plan size, so it matters for how signage is priced.

**Standard production is free**; Express is +20% (min £20) and Express Plus +40%
(min £40), charged on top and not held in the rate tables.

---

## 9. Outstanding

1. **Margins.** All currently 0 — the site sells at cost. The cost base is trade
   but the market position is consumer: Uncoated 300gsm A5 ×100 costs £24, while
   Papier charge £2.10 a card (£210 for the same box). Margin should be set by
   where we want to sit against Papier, not by marking up cost.
2. **The VAT question** in §1 — the single most valuable thing to resolve.
3. **Confirm the 20%** against a real invoice.
4. **Seven products carry placeholder `from_price_text`** ("From £X.XX per card
   inc. VAT"). Nothing renders it today, but it should be cleared before launch.
5. The checkout VAT line still shows a VAT split while the business is not
   registered — tracked separately on the go-live list.
