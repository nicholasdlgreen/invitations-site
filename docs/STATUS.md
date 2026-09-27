# Where we are — 26 September 2026

*Written at the end of the day. Every figure below was checked against the live
site, the live database or a generated file, not against intention.*

**43 commits, all pushed.** Three threads: making our pricing mirror
PrintedEasy's, checking the product mix against competitors, and rebuilding the
artwork journey — plus two incidents worth reading (§6 and §7).

---

## 0. Do this next

**Envelopes are live. Margins are the only thing left in pricing.**

Published 26 September 17:57 and verified the following morning: **4,704
envelope prices**, none null, across the 16 products that offer them. Wedding
invitations quote £7.20 for a hundred white A5 and £18.40 for red, which is the
rate to the penny at zero margin. Nothing leaked where it should not: menu
cards, place cards, table numbers and order of service have none, and there are
no Square-210 envelopes. **Sheet prices held at 56,636** — the check that was
missed last time. The deploy landed first, so the checkout floor moved with the
price.

1. **Set the margins.** The site sells at cost across all 23 products. This is
   the last real blocker in pricing and it is a decision, not a build.

---

## 1. The state of things

| | |
|---|---|
| Cost rows in `sheet_rates` | 7,389 (378 switched off) |
| Finishing rows in `finish_rates` | **2,667** (378 of them envelopes) |
| Published sheet prices | **56,636** |
| Published finishing prices | **15,078** |
| Published envelope prices | **4,704**, live and verified |
| Product page payload | 536KB before envelopes; re-measure |
| Envelope colours offered | **2** (was 6) |
| **Margins** | **0 on all 23 products — the site sells at cost** |

---

## 2. Pricing that mirrors PrintedEasy

### Done

- **Printed sides is a real dimension.** 3,066 rates. The measured uplift for a
  back is **8.7% to 34.8%**, not the flat 15% the code assumed.
- **`sheet_rates.active`** — a rate can be kept for evidence but withheld.
- **Folded 400gsm switched off** (378 rows): it priced below every thinner
  weight and identically on two papers — a fallback, not a quote.
- **Routes.** A product can be priced on more than one PrintedEasy product, with
  per-route stock lists, a publish guard against overlapping stocks, and a route
  index on every rate so press geometry follows the chosen paper.
- **The supplier's vocabulary is in the database** (`pe_stock`,
  `pe_product_overrides`), not hardcoded in two files.
- **Finishing priced the way they price it.** Per option, per side, per size,
  per quantity — replacing one flat figure per type. Verified live: matt
  lamination on A5 is £8.00 at 100 and £12.80 at 500, soft touch £21.60 at 500,
  rounded corners £16.80.
- **Envelopes cut to what they sell** — white and red. Five colours we could not
  buy at any price are gone.
- **Envelope rates loaded** — 378 of them, priced per family, colour, size and
  quantity like every other finishing charge. Loading them also exposed and
  fixed a checkout bug: the price floor still charged 10p an envelope times the
  quantity, which would have demanded £10 for a hundred A5 the site now sells
  at £7.20 — every envelope order rejected at checkout, not let through cheap.

### Two things the measurements changed

**Rounded corners are not free.** They cost **£22** — configuring a real job on
their site, 100 A5 goes from £25 to £50. We had been selling them at £0. My
first measurement said free because my probe copied a checkbox's value whether
or not it was ticked, so corners were already on in the "before" price.

**Finishing is a setup charge, not a per-unit one.** A5 flat card:

| | 10 | 100 | 500 |
|---|---:|---:|---:|
| Rounded corners | £17.60 | £16.80 | £17.60 |
| — per card | 176p | 16.8p | **3.5p** |
| Matt lamination, both sides | £8.80 | £8.00 | £12.80 |
| — per card | 88p | 8p | **2.6p** |

The total barely moves while the quantity rises fiftyfold, so finishing doubles
the price of a hundred cards and is trivial on five hundred. **Worth a minimum
quantity** rather than offering it at every run length. Envelopes are the
exception — they genuinely scale, being a thing per card rather than a setup.

### Outstanding

1. **Margins are 0.** The only thing between us and trading.
2. **Gate finishes and envelopes on the route.** An order of service in
   Fedrigoni stock is still offered Corners that Luxury Folded cannot make, and
   red envelopes on a route that only has white.
3. **Retire `finish_options.cost_modifier`** now the rate table drives pricing.
4. **880 `large-format` rates are still unreachable** — routes make it a one-line
   change, but nobody has decided whether table plans sell on paper as well as
   board.
5. **Confirm the 20%** against a real invoice.
6. **The VAT question** — they quote Luxury Flat without VAT, and that is what we
   sell as a wedding invitation.
7. **Their full stock × weight matrix**, discovered with the sentinel test, so
   any weight they sell is an admin tick.

---

## 3. Product mix

### Done

- **The from-price was the price of ONE card.** Papier, Vistaprint and
  printed.com all checked; none quotes a quantity of one. The grid and landing
  pages now quote a pack — "From £18 for 50" — and agree with each other.
- **No VAT added and none claimed**, driven from `site_config`, because we are
  not registered.
- **Quantity ladder** — entry 10, 300 and 500 removed; the free-type box still
  reaches 500.
- **Rounded corners and fold direction** offered. Fold direction verified free;
  corners verified £22.
- **Christmas cards flat as well as folded.**
- **Order of service gained a standard route** alongside the luxury one.

### Outstanding

1. **Lightweight stocks** (Uncoated 120, Tintoretto 140) have no rates.
2. **Boards are single-sided only.**
3. **Range gaps undecided**: details and enclosure cards, evening invitations,
   belly bands, printed envelopes, hen party. Funeral and sympathy open.
4. **Eight product names stored lowercase** and rendering that way.
5. **"Finished by hand" on twelve pages** — nothing is finished by hand.
6. **"Colour mode: CMYK preferred"** on the upload screen, while we send RGB.
7. **Minimum quantity on finishing** — see §2.

---

## 4. The artwork journey

### Done

- **One box per printed face**, every face checked, every face sent to press.
- **A proof per face**, each keeping its own fill/fit, zoom, rotation and pan.
- **The press file uses each face's own position.** It used to impose every face
  with whichever was on screen, so zooming the front silently zoomed the back.
- **The double-sided dead end is gone** — uploading a front used to hide the
  boxes the button then told you to use.
- **Verdicts that explain themselves**: we scale what we can and say the
  resulting DPI, refuse only what is genuinely too small and state the pixels
  needed, and treat a different shape as a choice between crop and border.
- **Recognition when a problem is fixed**, and only then.
- **Print guides legible** on dark artwork; the toggle says which state it is in.
- **Red and orange buttons removed** — neither colour was agreed, and a colour
  cannot say "add the back".
- **Envelopes folded into Finishing** — one step fewer in the wizard.
- **Abandoned faces forgotten**: choosing double sided and changing back left
  the tabs behind, four of them if the fold had been folded.
- **`docs/ARTWORK-SPEC.md` written** for PrintedEasy.

### Outstanding

1. **Six questions for PrintedEasy** (`ARTWORK-SPEC.md` §9). The one that
   matters most: **head to head or head to foot** for a double-sided back. We
   send both faces the same way up. If their press expects otherwise, every
   double-sided job comes back with an upside-down back.
2. **Print one real sample.**
3. **The proof still renders a mismatched file as though it fits.**

---

## 5. How the work is tested now

Mid-afternoon the work was stopped: *"This is now breaking the entire site
because you are not checking and testing before you give it to me to go live."*
That was correct. Changes were being "verified" by injecting patched functions
into the **live** page, which never tests the file about to ship.

There is now a local server running the real `upload-and-print.html` from a copy
of the site. Since then it has caught, before any of it reached Nicholas: the
position race in `checkFile`, the zoom control reading 100% while the canvas
showed otherwise, the on-screen face's adjustment dropped from the press file,
the size row wiped a moment after being added, and "a A5 card" then "an Square".

`node` is not installed here. macOS JXA parses JavaScript but **never settles a
promise** — it has no microtask pump, so async code silently never runs and a
test written against it passes by doing nothing. Use the JavaScriptCore shell
instead, which ships with macOS and has a real event loop:

```
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc test.js
```

It has `readFile()` and `print()`, and it is what the admin session tests run
on.

---

## 6. The admin session expires after an hour, silently

Publish refused this evening: *"no prices were built for any product. No sheet
rates are loaded."* **The guard was right and the live catalogue was never
touched** — 56,636 sheet prices and 10,374 finishing prices still published.

The cause was not the rates. `sheet_rates` holds 7,389 rows and its policy is
correct. Admin kept only the **access token** from sign-in and threw away the
refresh token beside it, and a Supabase access token lasts **one hour**. After
that the page still looked signed in while every admin-only table answered 401,
the loaders' catch blocks set the arrays empty, and Publish reported "no rates"
— which points at the data when the truth is "you are signed out".

Fixed three ways: the refresh token is kept and swapped for a fresh hour, on a
timer and on any 401 (one shared refresh, because Supabase rotates the token and
parallel refreshes cancel each other); a refresh that genuinely fails says the
session has expired and shows the login screen; and Publish now names that as
the reason instead of advising a reload that would only dump you at the login
screen anyway. Six tests, on `jsc`.

**The pattern worth keeping:** an error message that names the wrong cause costs
more than no message. Both of today's incidents were one subsystem failing and a
different one taking the blame.

---

## 7. The incident — an empty catalogue went live

**What happened.** A publish wrote **zero prices for all 23 products**. The grid
showed no "from" prices, the configurator offered no double-sided option, and
every price fell back to a formula.

**Three faults lined up, all mine.**

1. `finish_rates` was given a policy for the Postgres `authenticated` role,
   while every other admin-only table gates on `is_admin()`. Admin satisfies
   `is_admin()` but is not `authenticated`, so the table was invisible to the
   only page that needs it.
2. `sheet_rates` and `finish_rates` were fetched in **one try block** whose catch
   set `sheetRates = []`. The failing new table discarded 7,389 rows that had
   loaded perfectly well.
3. **Publish had no floor.** It built nothing and wrote nothing out, silently.

**Recovery** was a hard-reload and Publish; `sheet_rates` was never touched.
There was nothing to roll back to — `pricing_config` is a single row.

**The lasting fix is the third.** Publish now refuses to write a catalogue with
no prices and says whether the rates failed to load or the filters produced
nothing. Any one of these alone would have been visible; together they were
silent.

**And the reason it got past me:** I verified the finishing prices after that
publish and reported them correct, but I only queried `finish_prices` — never
checked that `sheet_sells` still had rows. Checking the thing you changed and
not the thing beside it is how this happens.

---

## 8. The from-price, and why it was late

**Fixed 27 September.** What follows is what it was, what caused it, and what
was done — the measurements are the point, because the first guess about the
cause was only half right.

### What it was, measured on the live site

| | |
|---|---|
| Page first readable (first contentful paint) | **668ms** |
| `pricing_for` call finishes | **1,614ms** |
| **The price block sits empty for** | **~950ms** |
| What that call downloads | **571KB of JSON** |

The page paints with a `£—` placeholder, then waits for a payload of 3,738
sheet prices and 1,008 finishing prices, parses it, and takes the minimum. Every
landing page does this. On a phone on 4G it is several seconds, not one.

**The whole 571KB is fetched to render one number.** Nothing else on the landing
page reads `sheet_sells` or `finish_prices` — the paper section, the sizes strip
and the finishes section use `available_papers`, `available_sizes` and
`pricing.papers`, and the first two are already on the `product_types` row the
page fetches alongside. The heavy arrays exist for the configurator, not for
this page.

### Fixed, 27 September

`from_prices()` — which the products grid already called — now serves the
landing page too, and the request starts in the `<head>` where
`supabase-config.js` has already set the key, instead of from the bottom of the
body at 601ms. `published_papers()` is a new 7KB endpoint for the one section
that needs the paper catalogue. **9KB in place of 571KB.**

Five runs each, same machine, same page, identical price out:

| | median | spread |
|---|---:|---|
| before | 345ms | 234–918ms |
| after | **213ms** | **196–280ms** |

The spread matters more than the median: the 571KB was the variance, and on a
phone it is the whole story. The price block now reserves its width too, because
the placeholder was narrower than the real figure and the button below it moved.

Sharing one function with the grid is worth as much as the speed. Both pages
computed the same figure by different routes, with a comment in each saying they
must not disagree; checked across all 22 active products before switching, same
price and quantity either way. When we register for VAT the landing page will
follow the grid rather than quietly diverging.

### What was considered and not done

### What I would do, in order

1. **Compute the from-price in the database.** An RPC returning
   `{amount, quantity}` for a slug — about 40 bytes instead of 571KB. The
   cheapest flat, single-sided row at `display_quantity`, which is the rule
   `renderPricing()` already applies in JavaScript. **This is the whole fix for
   the visible symptom** and takes the price from 1,614ms to roughly 700ms.
2. **Give the landing page a light payload.** A second RPC with everything it
   actually uses and neither heavy array, so the page stops downloading the
   configurator's data. Together with (1) that is one small call instead of one
   enormous one.
3. **Stop the hero waiting on anything below the fold.** The two calls are in a
   `Promise.all` and the price waits for both, including the 571KB one. Render
   the hero the moment its own data lands.
4. **Reserve the space.** `£—` is narrower than `£18 for 50`, so the block
   changes width when the real figure arrives and the button below it moves.
   Even at 200ms that reads as a jolt.
5. **Cache it at the edge.** The from-price changes only on Publish. A thin
   Netlify function in front of the RPC with a short `Cache-Control` makes
   repeat visits and crawlers instant.

**Fastest possible**, if it is ever worth the machinery: render the number into
the HTML at request time with a Netlify Edge Function, so it is there in the
first paint with no round trip at all. Still read from the database per request,
so still dynamic.

**None of this hardcodes a price or bakes one in at build time** — the standing
rule from 17 September. Every option above reads the published figure at request
time; the change is how much else travels with it.

---

## 9. The design studio wording

**Fixed 27 September.** Nicholas spotted that the Christmas card wording "looked
odd". It was worse than odd.

`studio_fields` had no rows at all for **christmas-cards, greeting-cards and
place-cards**, and `loadStudioFields()` keeps a hardcoded fallback when the
table returns nothing — the wedding invitation. So all three asked for a host
line, a venue reading Cotswold Manor, a dress code of black tie and an RSVP.
Confirmed on the live site before touching anything.

Two more were asking nothing about their own content: an **order of service**
with no service in it, and an **RSVP card** with nothing to reply on. And every
box on every product was optional, so any product could be generated from an
empty form — `optional` had been a column since the table was created and
nothing ever read it.

### What the competitors do

Neither Papier nor Vistaprint uses labelled wording boxes at all. Both give you
a finished template and let you click the text on the card to change it —
Papier's editor has tabs per face, a layout picker and *add text / add image /
add QR code*; Vistaprint has 522 wedding invitation templates filtered by
corners, foil, theme, photos, size, season, colour, fold and orientation.

**So there is almost no overlap, because we are not doing the same thing.** They
sell a template you edit. We sell a brief you describe, and the wording feeds an
AI that draws something new. That is worth keeping — nobody else lets you say
"art deco, sage green, gold foil" and get a design back — but it only works if
the questions match the product.

The one thing both of them do that we do not is **sell the set** (item 33).

---

## 10. Orientation — done 27 September

Every size we sold was portrait. Vistaprint sell both, and treat it exactly as
its own axis: `Size · Fold · Product Orientation · Corner · Foil · Backside ·
Stock`. It was the largest structural gap in the range.

**It needed no new rates**, which was not obvious and was worth measuring.
PrintedEasy were asked directly, through the pricing endpoint, with the
sentinel check in place so a substituted default could not pass as a quote:

| | portrait | landscape |
|---|---|---|
| A6 flat, Silk 300, x100 | £25 | £25 |
| A5 flat | £29 | £29 |
| DL flat | £26 | £26 |
| A6 folded | £50 | £50 |

The same sheet of paper, turned. So orientation is a property of the artwork,
not a different product, and it touches no price anywhere.

**One accessor, every reader.** `sizeSpec()` in the uploader and `sizeInfo()`
in the studio return the size with its millimetres swapped when the card is
landscape. The size cards, the artwork check, the proof, the press file, the
basket line and the job ticket all read it, so they cannot disagree about which
way round the card is. Verified in the browser: a landscape A6 press page comes
out 164x121mm with a 148x105mm trim box — the portrait page's numbers swapped,
not a size invented from scratch.

**Where it is not offered.** A square has nothing to turn. Nor does a size whose
landscape twin is already sold separately — the boards are `A3` and `A3-L` and
the customer picks between them, so a toggle as well would have meant two ways
to order one thing and two names for it on the job sheet.

**A landscape folded card creases across the top.** The unfolded sheet turns
with the card: 210x148 becomes 148x210, the front panel moves from the right
half to the bottom half, and the fold ticks move from the top and bottom edges
to the left and right. Checked on a real order of service: 312x226mm portrait,
226x312mm landscape.

### Two bugs this turned up

- **The studio never sent the size to the image generator.** The function
  defaulted to `3:4`, so *every* design ever generated came back portrait — a
  square invitation was generated tall and then cropped square, and a landscape
  table plan was generated portrait and cropped hard on both sides. The design
  the customer approved was not the shape of the thing they were buying. The
  card's real millimetres now travel with the brief and the nearest Flux preset
  is chosen from them (A5 -> 2:3, landscape A5 -> 3:2, DL -> 9:21, square ->
  1:1), and the prompt states the shape in words as well.
- **The checkout's print-prep block still named a variable `sizeSpec`**, which
  had become a function. Left alone it would have sent `undefined` trim sizes to
  the press-prep step on every order.

**Tested** by `tools/test-orientation.py` — 29 assertions pulled out of the live
file and run under `jsc`, covering the swapped press page, the folded sheet on
both axes, and which sizes may be offered the choice at all.

---

## 11. Publish stopped working — 27 September

Three publishes failed at 16:43, 16:44 and 16:45 with HTTP 500 and
`57014 — canceling statement due to statement timeout`. The one before, at
15:55, had worked. **Nothing about the data had changed**: the same 8,481 sheet
rates and 2,667 finishing rates were read before the publish that worked and
before all three that failed.

### What was actually wrong

The catalogue publishes as **one jsonb value** — 10MB of JSON, 69,887 sheet
prices and 14,700 finishing prices across 22 products. It does not fit in a
page, so Postgres stores it out of line in a TOAST table as about **717
chunks**. Every publish writes 717 new chunks and leaves the previous 717 as
dead rows. Publish a few times in an afternoon and the TOAST table is mostly
dead weight — it reached **2,151 dead against 717 live** — and every read and
write of the payload walks past all of it.

The `authenticated` role has `statement_timeout = 8s`. Measured on the live
instance:

| the publish write | time | against the 8s limit |
|---|---|---|
| bloated, as found | **9,971 ms** | over — could never succeed |
| after a plain VACUUM | **1,165 ms** | 15% |

So once the write crossed eight seconds, Publish could not succeed again, and
would not have recovered on its own until autovacuum happened to catch up. It
was not a bug that appeared; it was a coin toss that had been landing the right
way. Even the publish that *worked*, at 15:55, took 5.2 seconds — 64% of the
budget — and nobody had ever checked that number.

### What was done

1. **A plain `VACUUM`** cleared 2,151 dead chunks to 0 and unblocked publishing
   the same evening. (`VACUUM FULL` would also shrink the file from 7.4MB to
   ~1.4MB but takes an exclusive lock — left for a quiet moment.)
2. **`supabase/migrations/20260927_pricing_config_autovacuum.sql`** — autovacuum
   tuned for this one table. Its defaults are written for tables that are
   appended to, not for a single row whose entire ten megabytes are replaced
   each time: it waits for 20% dead and then throttles itself. Now it cleans
   after essentially every publish and does not throttle. **The `toast.*` half
   matters most** — without it autovacuum tidies a 40kB heap and ignores the
   7MB TOAST table where all the bloat actually is.
3. **`Prefer: return=minimal`** on the publish POST. It had been
   `return=representation`, which made the database re-serialise all 10MB
   inside the same statement and send it to a caller that discards it — a tenth
   of the budget and a 10MB download, for nothing.

Verified after: three publishes back to back ran **1,240ms, 1,156ms, 1,020ms**
and did not degrade. The same three-in-a-row test before the fix gave 16s, 32s,
34s.

### Two things to remember

- **A false trail cost time.** The first theory was that the from-price cache
  trigger added that morning was to blame. Measured, it is **303ms** — 5% of the
  budget, not the cause. But it was 5% added to an operation already running at
  64% of its limit, and nobody had measured the headroom before putting it
  there. *Before adding work to publish, measure what publish has left.*
- **Supabase Pro does not change this.** The plan was upgraded the same evening;
  `statement_timeout` is still 8s for `authenticated`. Pro brings daily backups
  (which clears a launch blocker), not a bigger budget for this statement.

### The part that is not fixed

**The payload is 10MB and grows every time rates are added** — 2.5x what it was
when this design was chosen. Autovacuum tuning keeps it publishable; it does not
make it small. The options, none chosen yet:

- Publish sheet prices to their own table, a row per price, instead of one JSON
  blob. Biggest change, and the only one that actually solves it.
- Publish only what the site reads at page load and fetch the rest on demand.
- Drop quantities from the published ladder and interpolate more in the browser.

---

## 12. The studio was selling every invitation folded — 27 September

Found by Nicholas asking a plain question: *"if I am in a thank you card or an
invitation, how am I choosing folded — where is that option?"* The answer was
that there wasn't one.

**In the design studio there was no flat/folded control at all**, for any
product. The hand-off to the order step read:

    fold: (CONFIG_FOLDED && PRODUCT_HAS_FOLDED_ROUTE) ? 'folded' : 'flat'

which asks *"could this product be folded?"* and answers *"then it is folded"*.
So all fourteen products sold both ways — every invitation, save the date, RSVP,
menu, place card, table number — were handed to checkout as folded cards, at
roughly **twice the price**, with no way to ask for a flat one:

| Wedding invitation, 100, A5 Silk | flat | folded |
|---|---|---|
| | £24.00 | **£47.20** |

Answering "No, leave it blank" to the inside question did not make it flat
either. It came in the same day, in `d8556a3` "Give a folded card its inside" —
fixing the absence of a folded option created the absence of a flat one.

**And on Upload & Print, the five folded-only products said nothing at all.**
Thank you, greeting, engagement and graduation cards and the order of service
are sold *only* folded, and the word "fold" appeared nowhere on the page —
verified on the live site. Correct that there is no choice to make; wrong that
nobody is told. Someone would lay out artwork for a flat card and meet the
crease at the proof.

### What it does now

- **The studio asks** "Flat card or folded card?" at the size step, for the
  fourteen products sold both ways, **defaulting to flat** — the cheaper and
  commoner card. A studio that quietly defaults to folded is charging double
  without asking.
- **Choosing flat takes the inside question away with it**, so a flat card can
  never be sold carrying a message nobody can read.
- **Folded-only products say so**, in both places, instead of offering a choice
  of one. The line names the product rather than calling everything a card,
  because an order of service is a booklet.
- **Boards say nothing**, as before.

The decision is now `isFoldedNow()` — *is the thing being designed, right now, a
folded card* — rather than `CONFIG_FOLDED`, which only ever meant *could it be*.
A folded-only product still hands off `fold: 'flat'`, because that is how its
own rates are tagged; that trap is documented where the function is defined.

**Tested.** `tools/test-studio-fold.js` — 17 assertions over all four product
shapes. End to end in a browser: the same invitation prices at **£23.20 flat and
£44.80 folded**, and the choice reaches the lookup.

---

## 13. Paper coverage — 27 September

Asked what we have no paper stocks for. Nothing is broken: all 22 live products
offer papers, and every combination the configurator can actually reach has a
price. But three things came out of looking.

### Gloss — switched off

Active, offered by **no** product, **0** published prices, and **240 live cost
rows**. It is a `large-format` paper (A1–A4) while the three board products are
`display-board` (Foamex, A2/A1/A0) — a different family, and no A0 cost — so it
could not simply be added to signage. `paper_stocks.active = false`; the cost
rows are kept as evidence.

### The bigger finding underneath it

**`large-format` holds 880 live cost rows** across Gloss, Silk and Uncoated at
A1–A4, and **no live product uses that family at all**. We hold a costed
paper-poster range we do not sell. That is a product decision, not a bug, and
nobody has made it.

### Cartonboard and Ice White on the thirteen invitation products

They are on greeting cards, thank you, engagement, graduation and place cards,
but not on the thirteen invitation-type products. Checking product × paper ×
size makes this look like a config change. **It is not** — that check ignores
fold and printed sides, and the gaps are exactly there:

| Paper | Family | Sides | Sizes missing |
|---|---|---|---|
| Cartonboard | flat-card | double | A5, A6, DL, Square, Square-210 |
| Ice White | flat-card | single | A5, A6, DL, Square, Square-210 |
| Ice White | flat-card | double | A5, A6, DL, Square, Square-210 |

Ice White has **no flat-card single rates at all** at card sizes — it exists
only as a folded card plus a double-sided business card. It cannot be sold flat
today. Scraping those 15 combinations across the 21-point ladder is 315 prices.

### Weights that exist but cannot be bought

Uncoated 120gsm and Tintoretto Gesso 140gsm have no rates. Correctly hidden —
`availableWeightsFor()` filters by published price — so no customer sees them.
They were meant for insert and detail cards, which we still do not sell.

### A correction worth keeping

I first called adding those two papers a free win, then called it dangerous
because `getAvailablePapers()` does not filter by price. Both were wrong.
`step3Papers()` filters afterwards via `availableWeightsFor()`, and a test that
added both papers and swept all four formats showed neither ever appears. The
guard has since been moved into `getAvailablePapers()` itself so it does not
depend on a caller remembering — but it closed a latent weakness, not a live
bug, and the commit says so.

---

## 14. The full to-do list

Everything outstanding, in one place and in the order I would do it. The
sections above give the reasoning; this is the list.

**Cleared 26–27 September:** the envelope rates loaded, deployed, published and
verified — 4,704 prices, sheet prices held at 56,636. **Orientation** built
across the uploader, the studio, the press file and the job ticket (§10).
**Publish was broken and is fixed** (§11) — the payload is still 10MB and that
remains the underlying problem.

### Next up

| # | What | Why it is first |
|---|---|---|
| 1 | **Set the margins** | The site sells at cost across all 23 products. The last real blocker in pricing, and a decision rather than a build. |
| 2 | **Publish** | Seven product names and the `/invitations` switch-off are database changes; the grid reads `product_types` live, but a publish keeps the payload honest. |
| 3 | **Decide on place cards and table numbers** | We tell customers each card in a set will differ. Nothing makes that true. §10, item 31. |

### Blocking launch

3. **VAT at checkout.** The grid is clean and driven by
   `site_config.pricing.vatRegistered`, but checkout still shows "VAT (20%)"
   and stores a VAT figure while we are not registered. Move checkout onto the
   same flag so the two cannot disagree.
4. **Stripe live keys, and a live-mode webhook with its own
   `STRIPE_WEBHOOK_SECRET`.** Without the webhook, payments succeed and orders
   stay pending.
5. **Print one real sample** through PrintedEasy. The file maths is verified;
   the handover to their press is not.
6. **Send `ARTWORK-SPEC.md`** and get the six questions answered. The one that
   matters: **head to head or head to foot** for a double-sided back. We send
   both faces the same way up — if their press expects otherwise, every
   double-sided job comes back upside down.
7. **Supabase Pro** (~$25/mo). The free plan has no automatic backups, and
   orders, customers and consent records live there.
8. **`ALERT_EMAIL` in Netlify** for the Monday supplier price watch.
9. **Remove the homepage holding overlay** when the decision is made to open.

### Live mis-sells — cleared 27 September

All three done, and two closed as not-bugs.

- ~~**Gate finishes and envelopes on the route.**~~ The example in this list was
  wrong: order of service does not offer Corners at all. The real exposure was
  **thirteen products selling both flat and folded**, where rounded corners are
  priced on flat-card only. A folded order was offered them, found no rate, fell
  through to the flat figure — **which is zero** — so we did a £22 job for
  nothing. Envelope colours had no live exposure yet; they are gated now too.
- ~~**The proof renders a mismatched file as though it fits.**~~ Fill now ghosts
  what will be cut off, fit hatches the paper left blank. The press file is
  unchanged.
- ~~**Product names stored lowercase.**~~ Seven fixed, not eight, in the database
  and in every place the HTML used the name as a name. "signage" was the page
  title Google shows.
- ~~"Finished by hand" on twelve pages.~~ **Not a bug — we do finish by hand.**
  Nicholas confirmed 27 September.
- ~~"Colour mode: CMYK preferred" on the upload screen.~~ **Left as is**, by
  decision, 27 September.

Two things still open from that work:

10. **"Save the Date" and "Table Plan" are singular** while their slugs and the
    rest of the range are plural. A naming decision, not a casing one, so left
    alone.
11. **The checkout floor still adds nothing for a finish it cannot price.** The
    interface can no longer offer one, so this needs deliberate tampering to
    reach — but it is the last place the zero survives.

### Found and fixed the same day

- ~~**`/invitations` returned 404**~~ while active and on the grid. A half-built
  duplicate of wedding invitations: no page, no category, no hero image, no
  FAQs, copy lifted word for word, nothing linking to it, no order using it.
  **Switched off, not deleted** — the row is there if it should become a real
  category page.
- ~~**Every landing page had a broken `.html` twin.**~~ All 23 served 200 and
  rendered "Product not found". Fixed by dropping a trailing `.html` before the
  dot test. No redirect rule: the canonical tags already name one address, and a
  blanket `/*.html` rule would sit in front of `header.html`, `footer.html` and
  the `/:slug/order` rewrite.
- ~~**The from-price took about a second to appear.**~~ See §8 — now about 210ms
  and, more to the point, steady.

12. **`renderSizesStrip()` has never had an element to write into** on any of
    the 23 pages. Dead code, and it was before this work. Either add the markup
    or delete the function.

### Site testing — scoped 27 September, not started

15. **Build the test suite.** Five stages, agreed in outline and paused. In the
    order worth doing them:
    - **Broken images** — inventory from four DB columns, 81 `<img>` tags across
      56 pages, CSS backgrounds and the runtime-built URLs; then fetch every one
      and check status, type and size. Not a bug: storage URLs missing
      `/public/`.
    - **Price correctness** — compute every price twice, once with the site's
      own functions and once from the rules in `PRICING.md`, and compare. Also
      proves the checkout floor never exceeds the price shown, that more cards
      never cost less, and that the grid, landing page and configurator agree.
      No browser, tens of thousands of combinations.
    - **Eight ordering journeys**, chosen so each exercises a different code
      path rather than a different product name — flat, folded, double-sided,
      folded-card-only, folded leaflet, large format, business-card size, and
      envelopes with finishing. Stops at Add to Basket; never touches payment.
    - **The artwork uploader** — diagnostic test images per rule and per DPI
      band, then press-file forensics: page count, page size, crop marks, bleed
      proved to be mirrored rather than cropped, and each face keeping its own
      position.
    - **Make it repeatable** — scripts in `tools/`, and a report that separates
      failed from passed from could-not-be-tested.

    **What it cannot prove:** whether an image is the *right* image, whether the
    press file suits *their* press, the payment flow, or colour on paper.

### Pricing accuracy, once trading

16. **Confirm the 20% supplier discount** against a real invoice.
17. **The VAT question on their side** — they quote Luxury Flat without VAT, and
    that is what we sell as a wedding invitation.
18. **Their full stock × weight matrix**, found with the sentinel test, so any
    weight they sell becomes an admin tick rather than a scrape.
19. **Lightweight stocks** (Uncoated 120, Tintoretto 140) exist but have no
    rates, so they never appear.
20. **Folded 400gsm** is switched off in the data but still listed as a weight.
    Either re-scrape it or drop it from the folded products, so the decision is
    visible in admin rather than implicit.
21. **880 `large-format` rates unreachable.** Routes make it a one-line change,
    but nobody has decided whether table plans sell on paper as well as board.
22. **A minimum quantity on finishing.** It is a setup charge: rounded corners
    are 176p a card at 10 and 3.5p at 500, so finishing doubles the price of a
    small order and is trivial on a large one.
23. **Retire `finish_options.cost_modifier`** now the rate table drives pricing.
24. **The 42 `folded-leaflet` envelope rates are unreachable** — order of
    service is the only product on that family and has envelopes switched off.
    Decide whether it should offer them.

### Housekeeping

25. **54 test orders** to clear, and ~112 junk bot signups.
26. **`from_price_text` is empty on all 23 products and nothing reads it.**
    Either delete the column and its admin field or wire it up as an override;
    a writable field that renders nowhere is a trap.
27. **`display_quantity` has no admin screen** — changing which pack the grid
    quotes means SQL.
28. **A JavaScript error fires on load of `upload-and-print.html`.** Harmless so
    far, never chased, and proven not to come from any of this week's changes.
29. **Boards are single-sided only** (signage, table plans, welcome signs),
    deliberately deferred when double-sided went in.

### The design studio — opened 27 September

Done that day: the wording boxes fixed on five products, and an admin screen so
they can be changed without SQL (§9).

31. **Place cards and table numbers cannot do what we tell customers they do.**
    There is no variable-data support anywhere: the uploader builds ONE artwork
    and prints N copies. So fifty place cards are fifty copies of one guest's
    name, and the table-number box says *"each card in your set will differ"*,
    which nothing in the system makes true. Either build it — paste a guest
    list, get N artworks — or change what we sell and what we say. **The false
    line in that label is live now.**
32. **Table plans have no tables.** Heading, names and date, and nowhere to type
    who sits where, which is the whole content of the product. Parked with 31
    because it is the same kind of gap.
33. **Sell the set.** Papier offer "Complete the set — info card, RSVP card,
    RSVP envelope" inside the editor; Vistaprint sell invitation suites as a
    category. Both competitors do it and we do not. Closest thing we have is
    the design-suite idea.
34. **Saving a design loses almost everyone.** 44 sessions generated, 24 pressed
    "Love it", 5 tried to save, **2 designs exist**. Saving is gated behind
    creating an account and that is where people stop.
35. **`studio-nano.js` is misnamed** — it calls Flux Pro 1.1 Ultra, not Nano.
    The filename says the opposite of the decision on record.

### Needs a decision, not a developer

30. **Range gaps**: details and enclosure cards, evening invitations, belly
    bands, printed envelopes, hen party. Funeral and sympathy still open.
    Samples were declined.
