# Where we are — 26 September 2026

*Written at the end of the day. Every figure below was checked against the live
site, the live database or a generated file, not against intention.*

**40 commits, all pushed and live.** Three threads: making our pricing mirror
PrintedEasy's, checking the product mix against competitors, and rebuilding the
artwork journey — plus one incident worth reading (§5).

---

## 0. The state of things

| | |
|---|---|
| Cost rows in `sheet_rates` | 7,389 (378 switched off) |
| Finishing rows in `finish_rates` | **2,667**, loaded and live (378 of them envelopes) |
| Published sheet prices | **56,636** |
| Published finishing prices | **10,374** |
| Product page payload | 536KB |
| Envelope colours offered | **2** (was 6) |
| **Margins** | **0 on all 23 products — the site sells at cost** |

---

## 1. Pricing that mirrors PrintedEasy

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

## 2. Product mix

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
7. **Minimum quantity on finishing** — see §1.

---

## 3. The artwork journey

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

## 4. How the work is tested now

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

## 4a. The admin session expires after an hour, silently

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

## 5. The incident — an empty catalogue went live

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

## 6. What I would do next, in order

1. **Set margins.** Everything else in pricing is finished.
2. **Gate finishes and envelopes on the route** — closes two live mis-sells.
3. **Send `ARTWORK-SPEC.md` to PrintedEasy and print one real sample.** Both
   cheap, both de-risk everything else.
4. The stock × weight matrix, then the range gaps.
