# Where we are — 3 October 2026

*Every figure below was checked against the live site, the live database or a
generated file, not against intention. Where something was measured and came
back different from what was expected, the measurement won and the expectation
is written down beside it.*

**3 October. The day's one serious finding is §18: checkout refuses every
basket**, and has been doing so unnoticed because the site is pre-launch and
nothing posts a test order. It is written up, **not fixed**, and it sits above
margins on the list — margins were never the last thing between us and trading.

Then the design studio, after Nicholas hit the same foiling fault twice on live
work. The cause was not in the page: the Content-Security-Policy set no
`worker-src`, so pdf.js was refused its worker, fell back to a main-thread
"fake worker", and reading a foil layer sometimes never finished. Everything the
site reads with pdf.js has been rasterising on the UI thread. Fixed, along with
three things the fault exposed — the failure latched with no retry, a hang was
not treated as a failure, and a foil layer we draw ourselves was being judged
like a customer's upload and offered a "Fix it" that could not work on it. His
question is what unpicked it: if we generate the file, how can it need fixing?
It also turned up something larger — turning the card after designing it did
not turn the design, and only the foil check noticed. The shape is now settled
once a design is in hand. **Five commits, pushed and deployed the same day:**
`worker-src` is live and `check-live.py` passes 5,277 checks.

Earlier, **two withdrawals**. **Spot UV was withdrawn entirely** rather than
priced — §16. Published 10:07 and verified on the live site, not just locally:
the payload no longer mentions it, Silk now reads Lamination · Foiling ·
Corners · Fold, and the order page offers Lamination · Foiling · Corners. A
latent fault found during that sweep was fixed the same day — the landing pages
were asking for every finish type rather than the live ones. Then **red
envelopes were withdrawn** the same way — §17. Brilliant white is now the only
envelope colour we sell.

Before that, item 9 of this document was rewritten because it still opened by
saying foiling was unpriced and unsellable, three days after it was settled.
Anyone reading it top-down reached the opposite of the truth.

---

**24 commits on 1 October, all pushed** (898 in the repo). The day was almost
entirely **foiling**, taken from "we offer it and cannot deliver it" to a thing
that can be bought on both routes at a price we have actually measured. Two
faults found along the way had nothing to do with foiling and one of my own
conclusions had to be withdrawn.

**Where it stopped.** The studio foiling panel was built, tested and committed
on 1 October. **Still not tried by Nicholas with a real generation** — carried
forward to 3 October as the one open check.

**The foiling thread, in order:**

1. **The template became visible.** He downloaded it and asked whether a blank
   page was correct. It very nearly was — four hairline corner ticks, 0.019% of
   the page. Now a tinted bleed, a solid trim line, a dashed safe area and the
   three words TRIM, BLEED, SAFE AREA. **7.8% non-white, measured.** No library
   of template files: it is a function of two numbers (§9c).
2. **Route B** — "make the foil layer from my artwork" for customers who cannot
   produce one. Point at a colour; we build the mask. Four bugs the build
   itself found, including a photograph being accepted as foilable (§9c).
3. **The red state settled** — "Would you like us to fix it instead?", button
   **Fix it**, no description, Replace dropped from the red only. Fix it is
   withheld from two of the five reds pending testing, which is a decision to
   revisit, not a limitation (§9c).
4. **How PrintedEasy actually charge for foiling.** 269 probes. Their reply
   carries `scodixFoilPostPrice`, which our own scraper had been stripping —
   which is why this was never visible. Sides, three-or-more areas and quantity
   move the price; **coverage, build height, guide and colour do not**, so the
   foiled area is not a cost input. "All Over" is broken on their endpoint and
   was once mistaken for foiling being free (§9c).
5. **The prices went in.** 1,680 measured rates, £67.20–£72.00, list less 20%,
   zero margin. **Published and live** (§9c).
6. **Foiling in the Design Studio.** A studio customer who chose foiling could
   not complete the order at all — asked for a PDF they cannot make, with Route
   B blind on that route. The studio now builds the foil layer itself from the
   text it draws, with **zero pixels of registration offset, measured** (§9h).
7. **And then reworked to per-line, the same day.** Choose a colour, then
   choose which lines are foiled, with their own design on screen showing the
   contrast. The reassurance panel came out entirely. Two bugs found by running
   it — NaN bands and a stuck rebuild race — both written up in §9h.

**Two faults found in passing, neither about foiling:**

- **A folded card was charged nothing for rounded corners** — a £16.80 job,
  free, across 13 products. The wizard reopened a hole that had been closed.
  Fixed (§9e).
- **The place card size was labelled "Business card"** — the only size Place
  Cards sell, and we do not sell business cards. Renamed (commit `a596299`).

**One thing I got wrong and withdrew.** I reported that Cartonboard was sold at
a weight PrintedEasy do not price and that the real stock cost four times more.
He did not believe it, asked for a re-review before anything was changed, and
was right: **255gsm is correct and nothing needed changing** (§9f). The 280gsm
gap turned out to be a ~£90 fixed charge rather than a paper cost (§9f).

**A dead test came back.** `test-route-gating` had been throwing on line 1 for
days, and it was the only test of the function that decides whether a finish is
offered at all. Revived, and it is what found the corners leak. 25 checks.

**Decided and closed today:** the template branch of the design studio
(`design-studio-customise` / `design-studio-templates`) **is not being
developed**. It produces no print artwork and is unreachable from the studio
landing page. Confirmed by Nicholas, 1 October — no foiling work there.

---

**29 commits on 30 September, all pushed** (873 in the repo). 30 September was
one thread and one thread only: the order page, rebuilt to a single structure
and turned on for all twenty-three products. It is written up in §0c, including
the four times it was wrong on the live site before it was right.

**40 commits on 27 September, all pushed.** 27 September ran long and covered five threads:
orientation across the whole site, the flat-or-folded choice, a publish that
stopped working entirely, a sweep of marketing copy that was promising things we
do not sell, and a price comparison against five competitors. Two incidents are
worth reading on their own — §11, where Publish broke, and §12, where the studio
was quietly charging double.

---

## 0. Do this next

**Margins are still the only thing between us and trading — and there is now an
evidence base for setting them (§14).**

> **Where foiling got to, 1 October.** It is now sellable end to end on both
> routes, at measured prices, and published. What is left is listed in §9c and
> §9h and none of it blocks trading:
>
> - **Two questions for PrintedEasy, by email.** Is 7pt really their minimum
>   type size for foil, and what is the maximum foiled area? Both are currently
>   our inference from their Business Cards page, not their answer.
> - **"Fix it" is withheld from two of the five reds** — an unreadable file and
>   a non-PDF — pending a proper test of the fixing. Route B would work on both.
> - **The gold preview in the studio** (the parked Option A). Can be added on
>   top of what shipped without rework; it carries the question of whether a
>   foil choice may hide the five premium papers.
> - **Uncoated 120gsm is unresolved** (§9g). Ask, do not infer — this is the
>   same reasoning that got Cartonboard wrong.
>
> **Waiting on you, not on me:** try the studio foiling panel. It was built
> after the last push and has been tested end to end here, but with a
> **synthetic background** rather than a live Flux generation — that costs an
> API call. Everything downstream of the background is the real path. One real
> generation is the check worth doing before trusting it.
>
> Nothing on this list is a blocker. Foiling is done for trading purposes.

Published 27 September 19:04 and verified: **78,431 sheet prices** (up from
69,887), **14,700 finishing prices**, 22 products, 10 live papers. The publish
itself ran in **1.9 seconds**, a quarter of its budget, with zero dead rows —
the autovacuum fix from §11 holding.

1. **Set the margins.** Confirmed 27 September: our price is
   `PrintedEasy list × 0.80`, which is our cost, sold on at **zero margin** —
   we pass the whole trade discount to the customer, deliberately. Verified:
   22 products at zero margin, and of 64,151 published prices **63,852 are
   exactly cost**. §14 shows what everyone else charges. Matching PrintedEasy
   is a 25% markup; reaching printed.com on Fedrigoni stock is 53%. Both are
   still below the market.

2. ~~**Delivery is free and nobody pays for it.**~~ **ANSWERED 3 October.**
   There is no unknown charge to absorb, because **PrintedEasy's standard
   delivery is free too** — so our free standard delivery costs us nothing.
   This was logged as a fixed subtraction from every margin. It is not one.

   What it is instead is a **floor under the margin**. Their rule, solved from
   a real order of theirs (GBP 236.00 of goods billed GBP 48 Express, GBP 95
   Express Plus): **20% / 40% of the ex-VAT goods value, rounded UP to the
   whole pound**, minimums GBP 20 / GBP 40, Express offered to GBP 3,000 and
   Express Plus to GBP 1,500. Eight candidate rules were tested and only that
   one reproduces both figures.

   **What our site quotes is verified and correct.** Ignoring VAT, our quote
   for print + delivery comes to **exactly 20% below PrintedEasy's quote** for
   the same job and the same delivery option — confirmed at GBP 150, 236, 400,
   800, 1,500 and 2,500 of print, all landing on 0.8000. Below about GBP 150
   the GBP 20 delivery minimum breaks the ratio, because a floor does not
   scale: 14.3% below theirs at GBP 50 of print, 16.7% at GBP 100. That is the
   same cost basis as the rest of the site, applied uniformly.

   **OPEN — and it decides whether delivery breaks even or leaks.** Does
   PrintedEasy's 20% trade discount apply to the **delivery line** on our
   invoice, or only to the print line? Nicholas confirmed the GBP 236 of goods
   he saw was their list price, but that says nothing about how a trade invoice
   treats delivery, and their checkout needs an account, so it cannot be read
   from the public site. It is answerable only from a real PrintedEasy invoice
   or the account terms.

   | Print (their list) | We charge | If the 20% covers the whole invoice | If print only |
   |---|---|---|---|
   | GBP 100 | 100.00 | **+4.00** | 0.00 |
   | GBP 236 | 226.80 | **−0.40** | −10.00 |
   | GBP 500 | 480.00 | **0.00** | −20.00 |
   | GBP 2,000 | 1,920.00 | **0.00** | −80.00 |

   If the discount covers the invoice, the margin is **0.00 at every size** —
   exact break-even, which is right for a site selling at cost, and small
   orders run slightly ahead because the GBP 20 minimum we charge exceeds the
   GBP 16 we would pay. If it covers print only, we collect 80% of what we pay
   for delivery and Express needs a **25% markup on cost** to clear.

   Either way it is bounded: both readings are profitable once any sensible
   margin exists, so this only bites at zero margin, which is today. The
   −0.40 at GBP 236 is a rounding artefact, not a leak — they round the
   surcharge up before the discount and we round up after. Pennies per order;
   leave it.

   **An earlier version of this section stated the loss as fact.** It was an
   inference from "the GBP 236 was list", presented as a finding, and it is not
   established. Modelled end to end in `tools/test-delivery-economics.js`,
   25 checks; note those checks assume the print-only reading and should be
   revisited once the invoice question is settled.

3. **299 published prices sit below cost.** Never above — 80p to £2.40 under, at
   quantities 20, 25, 30, 50, 60, 125, 250 and 450. That is the curve-flattening
   working as designed: PrintedEasy's staircase goes backwards in places and
   Publish walks ours down so we never quote more for fewer. At zero margin
   those specific orders lose money. Harmless once a margin exists.

4. **Monitoring is half built, and the missing half is the money.**
   `tools/check-live.py` and `tools/check-live-browser.js` went in 29
   September and cover the catalogue and the order step
   (`docs/DAILY-CHECK.md`). Neither touches **Stripe checkout** or the **five
   Resend emails**, so nothing would tell us if a card stopped being taken or
   an order confirmation stopped sending. In order: add checkout and email to
   the check; run the jsc suite in the Netlify build so a broken build cannot
   deploy (needs a node shim, Netlify is Linux); then put the daily check on a
   cron that does not depend on a laptop being open.

5. **The order of service does not yet offer flat or folded**, which Nicholas
   asked for on 29 September. Every paper and size it sells has full rate
   coverage in both `flat-card` and `folded-leaflet`, so it is priceable — but
   `routes` is a hand-maintained column and changing it changes which family
   prices the product, so it needs a route edit and a Publish, not a UI change.

6. **The order page is rebuilt and live on all 23 products** — §0c. What is
   still open on it, in the order it matters:

   - **Prices at the quantity step.** The tiles still carry a per-card figure
     (`10 · £1.84 each`). Deliberately left: how price is presented is its own
     piece of work and waits on the margins (§15 item A2).
   - **Rules.** A finish the paper cannot take is greyed and says "Not
     available"; it does not say *why*. The availability data itself is thin —
     the corner and lamination allowlists come from probing one product form at
     one weight (§13), and `finish_rates` has no weight column, so
     availability-by-weight cannot currently be expressed at all.
   - **The artwork step's own appearance** has not been touched. It is where
     the old uploader was left.
   - **`/invitations` is a retired product with a live URL.** `active = false`
     in `product_types`, linked from neither the products page nor the sitemap,
     but the URL answers and falls back to all fifteen sizes in the code's
     defaults because `currentProduct` comes back null. It does the same with
     the flag off, so it is not new. Either take the URL down or set the
     product active.

7. **A tent fold is not producible, and was being offered anyway.** A tent card
   is portrait with the crease at the *top*, and the geometry cannot express
   that: `buildPressFile` decides the crease axis with one line,
   `const acrossTheMiddle = selectedOrientation === 'landscape'`, so a portrait
   card always creases down its side. The uploader's slot layout and the spread
   proportions follow the same rule. Until 30 September the Finishing step
   offered **Tent** on Christmas, greeting, thank you, graduation and
   engagement cards — and *not* on place cards or table numbers, the two
   products where a tent is the natural form. Anyone who had picked it would
   have received a side-creased card. Nobody did: there are no orders yet.
   To sell it, the crease axis has to become independent of orientation in
   `buildPressFile` first, and the uploader and preview follow; the UI is the
   easy half. Worth doing only if we want tent place cards and table numbers,
   which the market does sell.

8. **Artwork from people who never order is not deleted.** Agreed 1 October:
   anything uploaded but never ordered comes out of Supabase storage after
   **one week**. Since 1 October the artwork and the press file are sent when
   the customer leaves the file check, not when they press Add to basket, so
   abandoned baskets now leave files behind. The names are random UUIDs and so
   unguessable, but the bucket is public and nothing deletes them. **No
   cleanup job exists.** It needs a scheduled function that lists the bucket
   and removes anything older than seven days with no order against it.

9. **Foiling — SELLABLE. Read this header before the detail below it.**
   Researched 1 October against PrintedEasy's own configurator, driven end to
   end rather than read off the page source, then built out across that day.

   **Settled on 1 October and live:**

   | | |
   |---|---|
   | The price | **1,680 measured rates** in `finish_rates`, £67.20–£72.00, list less 20%, zero margin. Published (§9c) |
   | Placing a foiled order | Possible on both routes. Upload one, or we make it (§9c, §9h) |
   | The template | Visible and correct, generated per size (§9c) |
   | The design studio | Per-line foiling with the design on screen (§9h) |
   | The papers | Greyed on the five that cannot take it, as below |

   **Still open, and none of it blocks trading:**

   - **The marketing copy still promises foil on papers that cannot take it**
     — the one item below that is unchanged and still needs your wording.
   - **Two questions for PrintedEasy by email** — the 7pt minimum and the
     maximum foiled area. Both remain our inference.
   - **"Fix it" is withheld from two of the five reds**, pending a test (§9c).
   - **The gold preview inside the studio**, the parked Option A (§9h).
   - ~~**Spot UV is still a flat £52.**~~ **Withdrawn entirely on 3 October —
     see §16.** Nicholas chose to remove it rather than price it.

   > **Everything from here to §9b is the 1 October working.** Three paragraphs
   > of it were written in the morning and overtaken by the afternoon; each is
   > struck and points at what replaced it. Kept rather than deleted because the
   > reasoning is worth following, and because two of the day's mistakes are
   > only legible beside what was believed at the time.

   **Done, and already live:** foiling is greyed with "Not available" on the
   five papers PrintedEasy cannot foil — Tintoretto Gesso, Nettuno Bianco,
   Acquerello Bianco, Sirio Pearl Polar Dawn and Recycled Uncoated, all bought
   from their Luxury Flat product, which has no foiling controls at all. It
   stays available on the four that can take it: Uncoated, Silk and Cartonboard
   (their Postcards) and Ice White (their Greeting Cards). This needed no work
   — `paper_stocks.finishes` already excluded it, and the greying built on 30
   September made the refusal visible instead of silently dropping the row.
   Verified by walking all nine papers on the order page.

   **Open — the copy says otherwise.** Every one of the 19 products that offers
   foiling carries it in `features`, and wedding invitations also has it in
   `tagline` and `intro_long`; menu cards has it in `tagline`. The wedding
   invitations line reads "…textured and pearlescent stocks made by Fedrigoni
   in Italy. Add gold, silver or rose gold foil…" — offering the Fedrigoni
   papers and foil in one sentence when those are the papers that cannot have
   it. The configurator refuses correctly; the marketing promises it anyway.
   Nicholas's wording, as always.

   **~~Open — the price is unverified and cannot be right.~~ SETTLED the same
   day — see §9c.** 1,680 measured rates are in `finish_rates` and published.
   The figures below are what was believed before the endpoint was probed
   properly; the £90/£95 they quote turned out to include options we do not
   sell. ~~We charge a flat £70
   from `finish_sells`. There is not one foiling row in `finish_rates`; the
   scraper has never probed it. PrintedEasy quote per job from the size of the
   foiled area, sides, number of areas, build height and colour — measured on
   their site: £90 on Cartonboard and £95 on Ice White for one 50x50mm gold
   area on 100 A5 greeting cards. So the real cost moves and ours does not, and
   on that example we are under by £20–£25 before any margin.~~

   **What was actually wrong with that paragraph**, now that the endpoint has
   been driven properly (§9c): the price does **not** move with the size of the
   foiled area, the build height or the colour. It moves with sides, with three
   or more areas, and with quantity. The £90 and £95 were read off a
   configurator left on options we do not sell. The real figure for what we do
   sell is £80–£95 list, £64–£76 after our 20%.

   ~~**Spot UV is still a flat £52 and is still unprobed.**~~ It was **withdrawn
   on 3 October** rather than priced — see §16.

   **~~Open — we cannot actually place a foiled order.~~ SETTLED the same day —
   see §9c and §9h.** Both routes can place one: an uploader supplies a layer or
   lets us build it from their artwork, and a studio customer never meets a file
   at all. The paragraph below is what was true that morning. ~~They require two PDFs:
   the artwork, and a mask of the foil areas in 100% black at identical size
   and position. We collect one file per face and ask none of their six
   questions. They publish no foiling guide and no template, so a customer
   could not make the mask unaided either. The answer is for us to generate the
   mask and measure the area ourselves — their hardest question, the size of
   the foiled area, is the one we could answer exactly. Staged plan in the
   1 October review.~~ **Footnote worth keeping: the size of the foiled area
   turned out not to be one of their questions at all.** Their price does not
   move with coverage — every value from 1% to 50% quotes identically (§9c). We
   measure it well and it buys us nothing at the till.

   **Two rules to confirm with PrintedEasy by email.** Their site answers one
   of the three questions a foil step has to answer and not the other two:

   - **Does the foil sit over the print, or replace it?** Answered: over. Their
     words are that the foil guide "fits directly over the top of" the main
     print, and they ask for two PDFs, not three. So the customer's artwork is
     unchanged and there is no third file. printed.com by contrast want the
     foiled elements removed from the print file — we follow our printer.
   - **Is there a minimum size of detail?** Not published anywhere on their
     site: no foiling guide, nothing in the artwork checklist, nothing in the
     FAQs. **We are using 7pt, which is the trade norm and my recommendation,
     not their figure.** It needs confirming before it is printed on the page
     as a rule, because refusing a customer's artwork on a number we invented
     is worse than not checking.
   - **What is the maximum foiled area?** Their Business Cards page says "the
     maximum Foiling area is 90mm x 60mm", which is about the size of a
     business card — so it reads as the whole card rather than a universal
     limit. Greeting Cards and Postcards state no maximum at all, and their
     configurator offers an "All Over" option. Unknown for the sizes we sell.

   **Done 1 October:** all eight of their foils are now ours — Gold, Silver,
   Copper, Rose Gold, Red, Blue, Holographic and Green, in `finish_types` with
   a swatch each. We had three.

   **Route A is finished (1 October).** "I have a foil layer" runs end to end:
   the upload slot, the checks, the measurement, the area on the order, the
   job ticket, and which face is foiled. The template is the last piece. There
   is **no library of template files and there does not need to be one** — a
   template is a function of the finished width and height and nothing else.
   The product does not come into it; the fold does not change it, because the
   foil layer is one page at the finished size, which is the front panel, so a
   folded A5 wants the same page as a flat one; the printed sides do not change
   it; and orientation is already in the two numbers, because `sizeSpec` swaps
   them for landscape. So it is drawn on demand by `foilTemplatePlan`, and a
   size added in admin tomorrow has a correct template that afternoon with
   nothing to generate and nothing to go stale.

   It arrived blank the first time and he said so. The old one was four 0.4pt
   corner ticks at 0.80 grey — 207 non-white pixels out of 1,068,552, 0.019% of
   the page. It now carries a tinted bleed, a solid trim line, a dashed safe
   area 4mm in, and the three words **TRIM**, **BLEED** and **SAFE AREA**, each
   above the line it names. Measured on the rendered page: 7.8% non-white, of
   which 6.0% is the bleed tint and 0.74% the lines.

   The guides are mid-grey (140) on purpose — above the 110 the foil test calls
   dark, and perfectly neutral, so the colour test never sees them either. A
   template with the guides still in is not refused for marks we put there
   ourselves. Instead a new **Template guides** check notices them and warns.
   Measured: our template reads 6.7%, a foil layer that never touched it reads
   0.009–0.054% whatever the point size, and the threshold sits at 0.25%
   between them. It is a warning, not a refusal — an unfinished file, not a
   wrong one — and the grey never enters the area measurement, which still
   reports the lettering alone.

   **Route B is built (1 October), as the way out of a red.** "Make it from my
   artwork" asks WHICH PARTS of the design to foil — never what colour the foil
   is, which is one of PrintedEasy's eight and is already chosen upstairs. It
   needs no second file: the artwork is in hand from step 2, two steps earlier.

   The mask is taken from the front face composited **exactly as the press file
   composites it** — same geometry, same position, same zoom, same mirrored
   bleed — so the foil lines up by construction. Measured: nudge the artwork
   26.6mm right and the foil goes with it; zoom 1.4x and it scales by 1.40.

   What it produces is **the same artefact Route A produces**: one PDF page at
   trim plus bleed, black on white, handed to the same `inspectFoilLayer` and
   judged by the same checks. Nothing downstream knows which route made it.

   **What it refuses, and why two measures and not one:**
   - **nothing** — the colour is barely in the design.
   - **speckled** — a photograph or fine line work, on either of two measures.
     The *size of the marks* catches scattered marks under a square millimetre;
     the *share of pixels on an edge* catches grain, which has no middle. Each
     has a case the other misses, proven both ways by mutation.
   - **A large area is NOT refused.** All Over is one of their five tiers.

   Measured end to end in the browser: a flat-colour invitation reads 0.6%
   coverage, 3 marks, 19.2% edge — accepted, green, basket released, areas
   measured at 39 × 21mm and 36.4 × 1mm. A photograph reads 79.3% coverage and
   60.4% edge — refused.

   The traffic light from step 2 now sits on the foil layer too, all three
   lamps. **No acknowledgement tick-box on amber** — that was not agreed.

   **The red state, as Nicholas settled it on 1 October.** The offer reads
   **"Would you like us to fix it instead?"** with a **Fix it** button and no
   description text under the heading. His reasoning on the wording: "Either we
   are fixing or we aren't. If we are then Fix it." **Replace is dropped from
   the red** — "upload a different file" sits directly below it and the offer
   is only needed once — but **kept on green and amber**, where there is nothing
   below and removing it would leave no way to change the file at all.

   **Fix it is withheld from two of the five reds, and this is a decision to
   revisit.** Route B would work on all five: it is built from their artwork
   and never opens the foil layer, so a file we cannot read is not a file we
   cannot work around. It is offered on *Colour*, *What to foil* and *Size*,
   and withheld from *File type* and *Foil layer could not be read*. Nicholas,
   1 October: "we will need to test that you can fix things and we can't do
   that now so it is better to reject and be safe and come back to it in
   testing." **So this is a testing item, not a limitation** — once the fixing
   has been exercised properly, the two withheld cases should be looked at
   again, and the code is one branch away from offering all five.

   **How PrintedEasy charge for foiling — measured 1 October 2026.** 269
   probes, every one reproducible, sentinel-checked. Method: their reply to
   `POST /product/pricing/<slug>` carries **`scodixFoilPostPrice`**, which is 0
   with foiling off and exactly the delta with it on. So the charge can be read
   directly rather than diffed. The repo's own scraper *strips* every scodix
   field, which is why this was never visible before.

   **The three things that change the price:**
   - **Sides.** One side vs both: **+£21 at 25, +£26 at 100, +£35 at 250.** The
     largest single lever by far.
   - **Number of areas.** One and Two cost the SAME. Three costs more: +£3 at
     25, +£5 at 100, +£9 at 250.
   - **Quantity and size together.** Flat at ~£86 up to 250–500, then climbing.
     Card sizes stay flat across our whole ladder; A4 and up climb steeply
     (postcards A4 silk: £88 at 25 → £128 at 500).

   **What does NOT change the price at all — every value tested:**
   coverage percent (1, 2, 3, 4, 5, 7, 10, 25, 50 — all identical); build
   height (flat, low rise, medium, high); common vs different guide; bleed
   (`foil-price` yes/no); number of foil colours (Two/Three). **So the foiled
   AREA does not enter their price.** Our measurement of it is useful to the
   customer and to the press, but it is not a cost input.

   **"All Over" is broken on their endpoint.** It returns
   `{"error": "Undefined array key \"\""}`, a total of 0 and a *negative*
   foil price. This is the £0.00 that defeated the 23 September attempt — it
   was never evidence that foiling is free. It cannot be priced through the API.

   **The charge across everything we sell**, one area, one side, ex VAT:

   | | 25 | 100 | 250 | 500 |
   |---|---|---|---|---|
   | A6, DL, Square, A5 — Silk 300 | £87–88 | £86–88 | £85–89 | £86–93 |
   | same — Uncoated 300 | £89–90 | £87–91 | £87–90 | £88–95 |
   | Business card — Silk 300 | £85 | £86 | £83 | £80 |
   | A4 — Silk 300 | £88 | £94 | £107 | £128 |
   | Cartonboard 280 | | £83 | | |
   | Ice White 300 | £94 | £95 | £95 | £95 |

   **The route barely matters.** A5, Silk 300, 100: £86 on greeting-cards,
   £86 on postcards, £86 on flyers, £87 on folded-leaflets — while the card
   underneath ranges £29 to £56. It is a machine charge, not a product one.
   Foiling remains absent from luxury-flat and luxury-folded (`showScodix=0`).

   **VAT.** `totalSellingPrice` on **postcards is ex VAT** (£115, with
   `sellingPriceWithVAT` £138); on **greeting-cards the two are identical**, so
   no VAT is added there. The foiling charge itself is the same £86 ex VAT on
   both. Confirms the inconsistency recorded in the cost-base notes.

   **For reference against the £70 we currently charge:** £86 less 20% is
   £68.80, and £90 less 20% is £72. The flat £70 is close to right for the
   common case — one area, one side, a card size, up to 500. It is wrong for
   both sides (the charge rises by a third) and for A4 at volume.

9e. **A folded card is charged NOTHING for rounded corners. 13 products.**
   Found 1 October while reviving `test-route-gating`, and confirmed on the
   real published payload in the live page, not in a fixture:

   | wedding invitation, Silk, A5, x100 | Corners shown? | charged | our cost |
   |---|---|---|---|
   | flat | yes | **£16.80** | £16.80 |
   | folded | **yes, ungreyed** | **£0.00** | £16.80 |

   The printer does not offer rounded corners on a creased card, so there is no
   `folded-card` rate. `lookupFinishSell` correctly returns **null** — that part
   was fixed earlier and still works — but `totalFinishSell` **skips a null**,
   so the charge silently becomes zero.

   The thing that used to prevent it was `step3Finishes` filtering on
   `finishPricedOn`, which refused to offer a finish the route cannot be
   charged for. **That filter exists only in the pre-wizard branch.** The
   wizard branch marks a finish unavailable from the PAPER's capabilities alone
   and never asks about the route — and the wizard is now on for everything. So
   turning the wizard on reopened a hole that had been closed, and the one test
   that guarded it was among the three that had stopped running.

   Not fixed here; this job was foiling. **13 active products can fold and
   offer Corners.**

9f. **Cartonboard: CORRECTED — there was never anything wrong with it.**
   An earlier version of this entry said we sell Scancote at a weight
   PrintedEasy do not price. **That was wrong.** Nicholas asked for it to be
   re-reviewed before anything was changed, and the re-review overturned it.
   Nothing was changed, which is the only reason this is a note and not an
   incident.

   **What is actually true.** Their stock called `cartonboard` is shown to
   customers as **SCANCOTE**, and it is offered in **two** weights, both real:
   **255gsm (400 micron)** and **280gsm (450 micron)**. 255 is their default.
   **We sell 255gsm. That is correct.** They carry it on postcards and
   greeting-cards, which are exactly the two routes we buy those families
   through, so the mapping was never in question either.

   | postcards, A5 | x25 | x100 | x250 | x500 | |
   |---|---|---|---|---|---|
   | cartonboard 255 | £24 | £29 | £35 | £48 | real — their default, and ours |
   | cartonboard 280 | £117 | £119 | £124 | £132 | real — the heavier board |
   | cartonboard 250 / 350 / 400 | nil | nil | nil | nil | not Scancote weights |
   | silk 280 | nil | nil | nil | nil | not a Silk weight |

   **The test that settles it:** an invalid stock-and-weight pair returns
   **nil**, not a substitute. Silk at 280 is nil; Scancote at 250, 350 and 400
   are nil. Both Scancote weights return a price, with a sensible curve. So
   both are real.

   **How the wrong conclusion was reached, because it will happen again.** The
   999 sentinel returned the same figure as 255 — and the sentinel rule says
   distrust anything that matches it. But 999 falls back to the stock's
   **default weight**, and for Scancote the default IS 255. So the sentinel was
   returning 255's genuine price and the rule condemned a real product.

   **This is the exact blind spot written up in 9c an hour earlier, after Ice
   White tripped the same wire.** The warning was recorded and then walked into
   anyway. The rule is now: **a sentinel match is never a verdict.** Confirm
   with the supplier's own page, and with the nil-versus-price test above,
   before touching a catalogue entry.

   **What the 280 actually costs, measured properly on 1 October.** The first
   pass said "roughly four times the price for a 12% thickness increase".
   Nicholas did not believe it — "it will be more, but not 4 times" — and asked
   for it to be re-run across several products with the spec held identical.
   He was right. The number was real; the explanation was wrong.

   **It is a fixed charge of about £90, not a paper cost.** Postcards, A5,
   single sided:

   | qty | 255 | 280 | gap | gap per card |
   |---|---|---|---|---|
   | 1 | £23 | £117 | **+£94** | £94.00 |
   | 25 | £24 | £117 | +£93 | £3.72 |
   | 100 | £29 | £119 | +£90 | £0.90 |
   | 500 | £48 | £132 | +£84 | £0.17 |
   | 2500 | £143 | £201 | **+£58** | £0.02 |

   **The gap SHRINKS as the run grows.** A heavier paper would do the opposite —
   more sheets, more cost. Shrinking is the signature of a setup fee. The same
   shape holds on greeting-cards, where the premium falls from 194% at one card
   to **10% at 2500** — and 10% is almost exactly the weight difference, so that
   is the real paper cost and everything above it is the fee. Double sided is
   the same shape with a larger fee (+£143 at 25, +£78 at 2500).

   **The board itself is only ~10% heavier**, from their own reply, not
   inferred: `thicknessPerItem` 400 → 450 micron, and `totalWeight` for the job
   0.793kg → 0.870kg, which is +9.8% and matches 255 → 280 exactly.

   **Two things that look wrong on their side, worth knowing before anyone
   buys 280.** The marginal cost runs backwards — pricing the last 1,500 cards
   of a 2,500 run, 255 costs £0.048 a card and 280 costs £0.036, so the heavier
   board is cheaper at the margin, which cannot be right for paper. And several
   add-ons return NEGATIVE prices on 280: HD printing, Pantone and RGB all come
   back as −119, which is minus the order total. That is the same fault
   signature as their broken All Over foiling option (9c).

   **Our stored costs were checked against their live list and are exact.**
   All 24 sampled combinations — both families, A5/A6/DL, 25/100/250/500 — match
   list × 0.80 to the penny. Nothing was changed.

   | | flat-card A5 | folded-card A5 |
   |---|---|---|
   | x25 | £19.20 | £40.80 |
   | x100 | £23.20 | £46.40 |
   | x250 | £28.00 | £58.40 |
   | x500 | £38.40 | £76.80 |

   **If 280 is ever wanted:** about £90 on the order whatever the size, then
   roughly 10% more paper. Unsellable below a few hundred, reasonable at
   volume. Every figure above reproduced on a second independent session.

9g. **Uncoated 120gsm — unresolved, deliberately.** It was listed above as a
   fallback on the same reasoning that got Cartonboard wrong, so it does not
   get asserted here. The facts: their postcards page offers Uncoated at
   250/300/350/400 and not 120, yet 120 returns a price (£22/£24/£29/£34 at
   25/100/250/500) — cheaper than 250 at every rung, which is what a lighter
   stock should be. The 999 sentinel returns exactly 120's figures, but here it
   is falling back to the LOWEST weight rather than the default, so the match
   proves nothing either way. **Ask PrintedEasy whether 120gsm Uncoated is
   buyable on the postcards route.** It is one minor line — "Featherweight",
   for inserts.

9d. **SUPERSEDED — see 9f and 9g.** Both "faults" below were read off a
   sentinel match and both were wrong or unproven. Kept only so the reasoning
   can be followed; **neither was acted on**.

   ~~Two catalogue faults found while probing, neither about foiling.~~
   - **Cartonboard: we sell 255gsm and PrintedEasy only price 280gsm.** On both
     postcards and greeting-cards, 255 returns exactly the 999-sentinel price
     while 280 returns a distinct, much higher one (£119 and £151 against £29
     and £58 at A5/100). Every Cartonboard rate we hold is therefore a
     fallback, not a quote.
   - **Uncoated 120gsm is a fallback on postcards** — identical to the
     sentinel. We list it as "Featherweight".

   **And a blind spot in the sentinel test itself, worth recording.** Where a
   stock has exactly ONE real weight, the 999 sentinel falls back to that very
   weight and the test wrongly condemns it. Ice White 300 looked like a
   fallback for this reason; it is real, proven instead by showing the price
   moves properly with quantity (£66 / £106 / £185 / £308 at 25/100/250/500).
   A sentinel match is a reason to look harder, not a verdict.

9h. **Foiling in the Design Studio — built 1 October (Option B simplified).**

   **The bug.** A studio customer who chose foiling could not complete the
   order at all. They were offered all eight colours, ungreyed, then asked for
   "a second PDF, 154 × 216mm, the parts to be foiled in 100% black", and the
   basket refused to release. Route B could not rescue them either: it reads
   the uploaded artwork, and in studio mode `sideFiles` is empty. A hard stop,
   confirmed on the running page before anything was changed.

   **The fact that solved it.** The studio does not hand over a flat picture by
   accident — it DRAWS the names itself. `flattenToPrintFile` composites the
   Flux background and then writes the text on top with `ctx.fillText`, at
   coordinates it has computed. Only the exported JPEG is flat. So the foil
   layer does not have to be extracted from anything: the same loop writes the
   same lines a second time, same font, same x, same baseline, in solid black
   on white.

   **Registration is therefore exact by construction, and was measured rather
   than asserted.** Rendering the print file over a plain white background so
   its text could be isolated, and comparing its bounding box with the foil
   layer's: **0 pixels on all four edges**, 1818 × 2550 both.

   **It is built unconditionally and nobody is asked.** The studio makes it,
   uploads it beside the artwork, and puts `foilLayerUrl` on the design. On the
   order page it comes in through the SAME door an uploaded file does — fetched
   on first sight of a foil choice, turned into a File, handed to
   `takeFoilLayer` — so `inspectFoilLayer` measures it and the same checks judge
   it. Measured end to end: 154 × 216mm, black on white, 0.000% off-colour,
   1.19% of the card, two areas at 84.2 × 34.9mm and 50.8 × 33.9mm, green,
   accepted, **basket releases**.

   Where an uploader sees a spec list and a drop zone, a studio customer sees
   **"Your foil layer is ready — made from the names in your design. Nothing to
   upload."** No filename and no Replace, because they never supplied a file.
   **Nothing changes for an uploader.**

   **Nicholas's decisions, for the record.** Text only — the Flux background is
   photographic and no press could plate it. **All or nothing**, not per
   element. **Nothing asked in the studio**: he was shown the colour-chosen-in-
   the-studio version and rejected it, because only four of our nine papers can
   be foiled and the five that cannot are the premium Italian ones, so a foil
   chosen before the paper always risks being withdrawn. The range pods and the
   finishing order are untouched; the new behaviour sits inside the existing
   **Foiling** row, second of four after Lamination.

   **Deliberately NOT built: the template route.** `design-studio-customise.html`
   produces no print artwork at all, and `design-studio-templates.html` is
   linked only from itself and from customise — the studio landing page goes
   straight to the AI route. The whole branch is unreachable without typing a
   URL. Foiling it would be work on a dead path. **If that branch is ever
   revived it will need its own foil layer**, and it is the easier of the two:
   its text is already real SVG elements with ids.

   **Revised the same day to per-line, with the design on screen.** Nicholas
   looked at the panel and made three calls: the customer cannot tell what can
   be foiled, the reassurance is answering questions they never asked, and
   **they cannot see it**. So:

   - **Choose a colour, then choose the lines.** Each line is listed in the
     customer's own words — "Charlotte & James", not a field called `names` —
     with **All** and **None**. Foiling opens at None and only becomes
     something when a colour is chosen, at which point every line is ticked to
     pare back from.
   - **Their design is on screen**, with the ticked lines in the chosen foil.
     Worth knowing: step 3 was already being handed the artwork and storing it
     in a variable it never read. The design was invisible through paper,
     finishing and quantity, and now is not.
   - **Gone:** "Your foil layer is ready", the traffic light, and the size,
     colour and content rows. All of it reports on work the customer did not
     do. The checks still RUN and still reach the job ticket; they only appear
     if one fails.

   **How a line is foiled on its own.** The studio records where each line sits
   as a **fraction of the page height**, widened to meet its neighbours so the
   bands tile the page exactly — measured: 0–0.364, 0.364–0.523, 0.523–0.589,
   0.589–0.646, 0.646–1. The order page keeps only the marks inside ticked
   bands and rebuilds the layer. **Nothing is redrawn and no text is
   re-measured**, which is what stops the foil drifting off the card. Measured
   per line: unticking two takes them to **0** dark pixels while the other
   three are unchanged to the pixel.

   **Two bugs the build found, both only visible by running it:**
   - **Every band after the first came out NaN.** The widening read each
     neighbour's edges after having already overwritten and deleted them.
     Fixed by reading all the original edges first.
   - **Two quick ticks stuck the panel on "Checking your foil layer" for
     good.** Each tick starts a rebuild that rasterises, builds a PDF and runs
     the checks, so they overlap. Last-wins token; the overtaken runs stand
     down.

   **Still open:** showing the gold in the studio itself as a selling layer,
   which is the Option A he parked. It can be added on top of this without
   rework, and it carries the decision about whether a foil choice may hide the
   five premium papers.

   **Still open on foiling** (the pricing came off this list on 1 October):
   how Route B is offered on the FIRST foiling screen rather than only after a
   failure, parked by Nicholas until the studio panel is live and tested; and
   the two questions for PrintedEasy by email — the 7pt minimum and the maximum
   foiled area.

9b. **"We can fix that for you" — parked deliberately, not forgotten.** Some of
   the ways a foil layer fails are ones we could repair without the customer
   touching anything. The clearest is **the wrong page size**: a layer exported
   at trim size with no bleed is refused today, but we know the right page
   size, and centring their page on a correct one is exact — no scaling,
   nothing moves, nothing is lost. It is also likely to be the most common
   mistake they make.

   **Nicholas's two reasons for holding it back (1 October), both of which
   outrank the convenience:**

   1. **It is a chargeable moment.** Repairing a customer's file is work, and
      offering it free inside the flow gives that away before anyone has
      decided what it is worth.
   2. **It moves responsibility for the output onto us.** The moment we touch
      the file, "we print exactly what you supply" stops being true for that
      order, and a reprint argument becomes ours to lose. So any fix we offer
      has to be one we are **100% sure of** — not merely usually right.

   Nothing is to be built here until both are settled. The size fix is the only
   candidate that is arithmetically exact; anything involving redrawing,
   rescaling or guessing intent is not in this category at all.

10. ~~**`delivery.html` publishes delivery prices we do not charge.**~~
   **FIXED 3 October (c015352).** Express showed a flat **£12.00** and Next Day
   a flat **£18.00** while the basket charged 20% and 40% with £20/£40
   minimums — on the £236 order measured at PrintedEasy the real figures are
   £48 and £95, so the page understated Express by £36 and Next Day by £77, in
   writing, on a page a customer could hold us to. The day counts and the 1pm
   cut-off were corrected on 1 October; the two prices were left alone because
   replacing them meant deciding how a percentage-with-a-minimum is presented.

   Nicholas chose that presentation from three mock-ups: the cards now read
   **From £20** and **From £40**, with the rule stated beneath them. A
   percentage in the price slot reads like a trade price list; a from-price
   keeps a pound figure where every other card has one and cannot be
   contradicted at the till.

   Two things came out of the build worth keeping. The grid's columns were set
   in an **inline style**, which beats a media query — so the stacked phone
   layout would have been written, looked right in the source and silently
   never applied; the rule moved to a `.ship-grid` class and a test asserts it
   is not inline. And the basket now **rounds up** to match them, quoting £48
   where it quoted £47.20. `tools/test-delivery-page-copy.js` (24 checks)
   replays the basket arithmetic across every order value from £0 to £4,000 and
   fails if anything is ever cheaper than the from-price we advertise.

   **Still open:** the page calls the third service **Next Day** while the
   database and the configurator call it **Express Plus**, so a customer meets
   two names for one thing. Renaming touches live pricing data; left alone.

11. **`cart.js` asks the wrong question about where it is.** It decides whether
   you are on the order page with `pathname.includes('upload-and-print')`,
   which is **false on the clean `/<slug>/order` URL every customer uses**. The
   page's own override masks it today, so nothing is broken; if that override
   ever failed to install, the basket drawer's button would navigate the
   customer away to a fresh `/upload-and-print.html?action=checkout` and lose
   the product they were configuring. Same family as the flag that was read
   off the query string on 30 September. Found 1 October, not fixed.

12. **Three tests do not run at all** — `test-route-gating`, `test-slug-from-url`
   and `test-section-race`. They read fixtures from a scratchpad that no longer
   exists. Small job, but a real failure can hide behind noise that is always
   there.

13. **The migration backups are still in the database.**
   `studio_prompt_options_pre_20260929` and `studio_config_pre_20260929` hold
   the old chip vocabulary so `tools/sql/studio_vocab_20260929_rollback.sql`
   can put it back. Drop both once the six-box step 3 has bedded in.

---

## 0c. 30 September — the order page, in one place

One structure for the whole range, live on all twenty-three products at
`/<slug>/order`. The signed-off design is **`docs/ORDER-PAGE.html`**, written as
a standalone page and checked against the shipped page point by point. Build
against that file, not against a description of it. `docs/WIZARD-BRIEF.md` was
deleted on 1 October — it described seven steps and the artwork going last, both
overtaken, and a stale brief beside a built page is how the wrong artefact gets
built from. The four standing points worth keeping (scope, admin drives the
contents, one structure for every product, no copy or price before the
specification is finished) are carried in that file's own header.

**Six steps, one line.** `SIZE — ARTWORK — PAPER — FINISHING — QUANTITY —
DELIVERY`. Words only: no rings, no figures, the word you are on in full colour
with a gold hairline under it, the ones behind in the mid tone, the ones ahead
pale. The rule is not decoration — a warm grey and a warm brown are too close
to carry the state alone.

**The page's bar and step 3's rail are now one list.** They were two: the bar
said Size · Artwork · Paper & Quantity · Basket · Checkout and three steps later
the rail said something else entirely. Both are drawn from `Step3.journey()`, so
they cannot drift, and the list bends to the product in one place — a range with
one paper in it drops out of both in the same breath. Signage, table plans and
welcome signs say **Board**, not Paper, because their stock is measured in
millimetres.

**The range is still chosen and is not a numbered step.** Same three pods, same
filtering of the papers behind it. It carries no number, and standing on it
lights Paper — the step it leads into — rather than falling back to lighting
Size.

**Size first, then the shape of the card.** Five size cards drawn as cards, the
uploader straight after, and Flat or folded · Which way up · Printed sides in a
labelled row *below* the grid. A size the chosen shape cannot be made in is
greyed rather than removed: taking Square 210 out when Folded is picked shrank
the grid by 175px and everything below it jumped, under the cursor that had just
pressed the control.

**His wording, on 30 September.** Quantity, not "How many" — in the line and on
the section heading, so every product's step 3 now says Quantity. "Any number
from 1 to 500" came off from under the typed box; the box and its Use button
stay, and so does the element, because a number the printer will not quote still
has to say why. Corners is the title, so the signed-off page was changed, not the
catalogue. The bar names the size and shape before the paper —
`A5 flat, portrait · Uncoated · 300gsm · no finishing · 100 cards · Standard`.

**What it was checked against.** All twenty-three order pages walked at the URL
customers use, reading what each rendered: five size cards for the invitation
range, four for the card range, three for signage, two for order of service, one
for place cards — matching `available_sizes` in every case but `/invitations`,
which is retired (§0 item 6). `tools/test-wizard-rail.js` holds 60 assertions,
every one mutation-tested. `tools/serve.py` now resolves `/<slug>/order` the way
Netlify does. `/docs/*` is 404'd in `_redirects`, so the signed-off page sitting
in `docs/` is not reachable from the shop.

### Four times it was wrong on the live site first

Worth writing down, because three of the four are the same mistake.

1. **The whole thing was behind `?wizard=new` and nobody said so.** Every check
   was run on `upload-and-print.html?product=...`. Customers arrive at
   `/wedding-invitations/order`, which Netlify serves as a **200 rewrite** — the
   browser never sees the query string, `location.search` is empty. So the flag
   read false on the only route anyone takes, and the old step 1 was live all
   day. The page had already solved this forty lines higher up in `PRODUCT`,
   which resolves the slug from the path.
2. **The dev server did not serve that route either**, so it could not have been
   caught locally. Fixed.
3. **Basket and Checkout were added to an agreed seven-step structure**, making
   nine, which wrapped to four rows of furniture above the first question. Not a
   small fix and should not have been made without asking.
4. **Told to "get rid of range as a step so it is only 6", the range section was
   removed from the page** — the pods and the filtering with it — instead of
   being left off the numbered line. A terse correction during a run of mistakes
   is a correction, and should be read narrowly.

The standing rule from all four: **verify on the URL a customer uses, reached
the way a customer reaches it.** See [[no-unagreed-structure]] and
[[site-health-checks]].

---

## 0b. 29 September, in one place

Four pieces of work, all pushed and live.

**Step 3 rebuilt across every theme.** 22 products carried 1,082 chips in seven
boxes, of which ten products were 82–90% copies of the wedding list that had
drifted. Now eight theme vocabularies — 452 distinct chips — in six boxes that
each answer one question, generated by `tools/gen-studio-vocab.py` rather than
hand-written SQL. Medium, era and layout are pick-one because those are the
three where two picks contradict. Birthday gained a "who it's for" box, which
is the market's first axis and we had nothing. Gone: the wedding crest and bows
sitting on moving cards, type-led chips arguing with "no lettering" in the same
sentence, photographic chips for a studio with no photo upload, and foil we
sell at the order step. See §15 and [[studio-prompt-vocabulary]].

**The Luxury and Eco ranges were unbuyable from the design studio for five
days.** Commit `6fc146b` on 25 September replaced two hardcoded paper-tier
lists with a lookup into data that arrives over the network; step 3 mounted
before it landed, everything fell back to Signature, the range chooser saw one
range and removed itself, and `_step3Ready` latched. Fixed by keeping the
load's promise and awaiting it. The shape to watch for: moving a hardcoded
value into the database turns a synchronous certainty into an asynchronous
maybe.

**A daily check was built.** `tools/check-live.py` (5,187 checks, ~40s, exit 1
on failure, `--self-test` proves each rule can fail) and
`tools/check-live-browser.js` for what only a browser can see. Runbook in
`docs/DAILY-CHECK.md`. It does not cover checkout or email — item 4 above.

**The fold question was asked twice and never.** Flat-or-folded in the studio's
step 1 on fourteen products, which-way-it-opens in Finishing on five, both on
Christmas cards, and neither on the thirteen that sell a folded card without
asking. Both now live at the size step on both pages. See
[[fold-choice-model]].

---

## 1. The state of things

Measured against the live database, 27 September 19:04.

| | |
|---|---|
| Cost rows in `sheet_rates` | **8,796** (8,418 active) |
| Finishing rows in `finish_rates` | 2,667 (378 of them envelopes) |
| Published sheet prices | **78,431** |
| Published finishing prices | **14,700** |
| Live products | **22** |
| Live papers | **10** (Gloss switched off — nothing sold it) |
| Published payload | **11 MB** — was 10MB this morning, and growing |
| Publish duration | **1.9s** of an 8s hard limit |
| Orders in the database | **0** (the 54 test orders were cleared) |
| **Margins** | **0 on all 22 products — the site sells at cost** |

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

One rule worth keeping: a test that holds its own copy of the code under test
is a test of the copy. `tools/test-quality-report.js` instead cuts the seven
functions it checks straight out of `upload-and-print.html` at run time, by
matching braces. Break the page and the test fails; that was proved by breaking
it three different ways and watching 6, then 4, then 1 assertion go red.

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

## 14. What competitors charge — 27 September

Read from each site's own live calculator. Full workbook: `docs/PRICE-COMPARISON.md`.

The cleanest row: printed.com's default wedding invitation uses **300gsm
Tintoretto Gesso, the same Fedrigoni paper we stock.** A5, one side, with
envelopes:

| Quantity | Us (cost) | printed.com inc VAT | Their premium |
|---|---|---|---|
| 50 | £36.00 | £38.95 | +8% |
| 100 | £48.00 | £62.39 | **+30%** |
| 150 | £64.00 | £90.29 | **+41%** |

The field at 100 × A5: **us £23.20** on Silk · PrintedEasy list £29.00 ·
instantprint £29.29 (envelopes forced in) · **us £40.80** on Gesso ·
printed.com £62.39 on Gesso · Vistaprint ~£70 · Papier ~£210. A **ninefold
spread** on a physically similar card.

**Three things it says.** Low quantities are where margin has to come from —
our A5 Silk moves only 80p between 25 and 50 cards, because trade print is
mostly a setup charge, so a percentage margin earns almost nothing on the small
orders a wedding shop actually sells. Luxury stock carries margin more honestly
than plain — printed.com are 53% above us on Gesso but 26% on silk. And
envelopes are table stakes: free at printed.com, **forced in** at instantprint,
included at Papier, an extra £7.20 per 100 for us.

**A correction worth keeping.** The first version of this said our own supplier
undercut us. It was backwards, and Nicholas caught it. Both numbers were in
front of me. We are 20% *below* PrintedEasy because the trade discount is passed
on, not kept.

### What search says, same day

Google Trends, UK, twelve months. **Foil is the only finish with real demand** —
the sole finish in the top 25 searches, and rising, especially "gold foil".
**Vellum scores 96 against foil's 100, and we do not sell it** — worth noting
given vellum was removed from the copy the same afternoon for being a claim we
could not honour. Letterpress, embossed and laser cut do not register.
"Folded wedding invitations" is rising, which validates §12. **No quantity term
appears anywhere** in either list, which suggests pack size is decided on the
page rather than in the search box.

Semrush still has **no API units**. Google Ads Keyword Planner is now connected
through Supermetrics but the Google account used **has no accessible Ads
account** — the re-link is in the conversation, and account 972-711-7378 is the
one it needs to see.

---

## 15. The full to-do list

**Regenerated 3 October 2026, end of day.** Everything outstanding, in one
place, grouped by what it is rather than when it turned up.

**The numbers are stable labels, not an order of work** — item 31 has been item
31 since 27 September and is referred to by that number elsewhere in this
document. The order to do things in is the table immediately below. Gaps in the
sequence are items that have been cleared; they are not missing.

**Everything from 3 October is pushed, deployed and verified on the live site.**
Twenty commits: the CSP fix, the studio foiling work, the shape lock, checkout
reading prices again, the fold routes, the order and welcome emails, the Send
Email Hook, and the finishing section. `check-live.py` passes 5,277 checks.

**One thing is deployed but deliberately inert:** the Send Email Hook, item 54.
It is live as a locked endpoint — no hook configured, no secret set, Supabase
still sending its own account emails — and must be tested live before it is
switched on.

### Next up — the order I would do them

| | What | Item | Why it is here |
|---|---|---|---|
| 1 | **Write the three welcome-email passages** | 52 | Square-bracket placeholders would reach a customer as written. Nothing should send a welcome until they are done, and only Nicholas can write them |
| 2 | **Agree the customer-facing strings Claude wrote** | 44 | Live now, in Claude's words rather than Nicholas's, and marked unagreed in the source |
| 3 | **Set the margins** | A2 | 22 products at cost. A decision, not a build. §14 is the evidence. May carry a floor — **if PrintedEasy's 20% discount excludes the delivery line, Express needs a 25% markup to clear** (§2, unresolved) |
| 4 | **Decide on place cards and table numbers** | 31 | We tell customers each card in a set will differ. Nothing makes that true, and the claim is live |
| 5 | **Switch on the Send Email Hook** | 54 | Built and deployed, deliberately not enabled. Needs a live test first |
| 7 | **Shrink the published payload** | 38 | 13MB, and the reason Publish breaks. Proven at 1.1MB but not built |

### A. Blocking launch

Nothing can be sold until A1 and A2 are done. The rest must be true before a
real customer arrives.

- **A1. Checkout refuses every basket** — item 36 below, §18.
- **A2. Margins are 0 on 22 products.** The decision, not the build.
- **A3. VAT at checkout.** The grid is clean and driven by
  `site_config.pricing.vatRegistered`, but checkout still shows "VAT (20%)" and
  stores a VAT figure while we are not registered. Move checkout onto the same
  flag so the two cannot disagree.
- **A4. Stripe live keys, and a live-mode webhook with its own
  `STRIPE_WEBHOOK_SECRET`.** Without the webhook, payments succeed and orders
  stay pending.
- **A5. Print one real sample** through PrintedEasy. The file maths is verified;
  the handover to their press is not.
- **A6. Send `ARTWORK-SPEC.md`** and get the six questions answered. The one
  that matters: **head to head or head to foot** for a double-sided back. We
  send both faces the same way up — if their press expects otherwise, every
  double-sided job comes back upside down.
- **A7. `ALERT_EMAIL` in Netlify** for the Monday supplier price watch.
- **A8. Remove the homepage holding overlay** when the decision is made to open.

### B. Checkout and orders

36. ~~**Checkout refuses every basket.**~~ **DONE 3 October**, `aa1ba6d`.
    It accepted the payload only at `schema_version === 2` while the live one
    says 3, so it loaded no prices and floored every item on the
    `(qty/50) x GBP150` fallback — 741 of 741 configurations refused at 100
    cards. It now asks `pricing_for` per basket slug, the same function the
    order page prices from, which also stops it pulling 13MB on every checkout.
    Proved over 12,722 real published rows: the floor never exceeds what the
    site would charge. §18 has the full account.
37. ~~**The checkout price floor is weight-blind.**~~ **DONE 3 October**, same
    commit. The basket records no paper weight, so several rows matched and
    `.find()` took whichever came first — sometimes the dearest, which floored
    7,129 configurations ABOVE the cheapest legitimate order. It now takes the
    lowest matching row, because the floor is the LEAST an order could cost.

51a. **Nothing posts a basket end to end.** The floor is now covered by 12,722
    row-level checks, but no test actually submits a cart to the function. That
    gap is exactly why 36 survived unnoticed. Belongs with item 15's
    price-correctness stage.

### C. Pricing

16. **Confirm the 20% supplier discount** against a real invoice.
17. **The VAT question on their side** — they quote Luxury Flat without VAT, and
    that is what we sell as a wedding invitation.
18. **Their full stock × weight matrix**, found with the sentinel test, so any
    weight they sell becomes an admin tick rather than a scrape.
19. **Lightweight stocks have no rates, so they never appear** — confirmed
    3 October: **Uncoated 120 and Tintoretto Gesso 140** are the two.
20. **Folded 400gsm** is switched off in the data but still listed as a weight.
    Either re-scrape it or drop it from the folded products, so the decision is
    visible in admin rather than implicit.
21. **880 `large-format` rates unreachable.** Routes make it a one-line change,
    but nobody has decided whether table plans sell on paper as well as board.
22. **A minimum quantity on finishing.** It is a setup charge: rounded corners
    are 176p a card at 10 and 3.5p at 500, so finishing doubles the price of a
    small order and is trivial on a large one.
23. **Retire `finish_options.cost_modifier`** now the rate table drives pricing.
    Still carrying Lamination=5, Foiling=70, Protective finish=13.60, Hanging
    holes=13.60. Lamination and Foiling now have real ladders and no longer read
    it; the protective finish and hanging holes still do, so it cannot simply be
    deleted.
24. **The 42 `folded-leaflet` envelope rates are unreachable** — order of
    service is the only product on that family and has envelopes switched off.
    Decide whether it should offer them.
24a. ~~**Delivery is free and unfunded.**~~ **CLOSED 3 October.** Standard
    delivery is free at PrintedEasy too, so our free standard delivery costs us
    nothing and there was never a subtraction to find. Their upgrade rule is
    now known exactly and ours already matched it; the page that advertised
    flat GBP 12.00 and GBP 18.00 is fixed (see item 10). Our quote for print +
    delivery comes to exactly 20% below theirs, verified at six order sizes.
    **One question survives, for A2 rather than as a task:** whether their 20%
    trade discount covers the delivery line or only the print. If it covers the
    invoice we break even exactly; if not, Express needs a 25% markup to clear.
    Answerable only from a real invoice. Full working in §2 above.
24b. **299 published prices sit below cost**, by 80p to GBP 2.40, at eight
    quantities. Curve-flattening doing its job against a supplier staircase that
    goes backwards. Harmless once a margin exists; a real loss at zero.
24c. **Cartonboard's single-sided ladder is thinner than the others** — 16
    sampled points at A5 where every other paper has 21. Prices interpolate
    correctly; the curve is just sampled more coarsely. Re-scrape when
    convenient.
24d. ~~**Flat thank you, engagement and graduation cards.**~~ **DONE
    3 October**, `1215cd0` — and greeting cards with them. All four were sold
    folded-only and priced as folded, so a thank you card cost the same as a
    folded wedding invitation. They now carry a flat-card route as well; the
    rates already existed, so it was configuration rather than a scrape. The
    from-price for all four fell from GBP 34.40 to GBP 17.60. A card now opens
    the way it is actually sold, taken from its first route, because the
    opening fold was hardcoded flat and would have opened these four flat the
    moment they gained the option.
24e. **Vellum.** Scores 96 against foil's 100 in UK search and we do not stock
    it. printed.com do. Removed from our copy as a false claim; worth pricing as
    a real product.
38. **The published payload is 13MB** and carries every price for every product.
    The dedup is **designed, proven and NOT built**: costs stored once, margin
    applied on read, measured at **1,136 kB against 14 MB** and verified
    identical across 78,431 sheet rows and 37,380 finish rows with zero price
    differences. The working was dropped from the database afterwards, so it has
    to be rebuilt from `docs/PRICING-STRUCTURE.md`, the only surviving artefact.
    Must come after item 36, because checkout would have to read the new shape.
45. **Two questions for PrintedEasy by email**: the 7pt minimum type size, and
    the maximum foiled area. Both affect what we are allowed to accept.
46. **Order of service reads "From GBP 37 for 50"** while every other card
    product reads GBP 18. It is `folded-leaflet`, not `folded-card`, so it is
    not the same cause as the folded cards. Never investigated.
47. **Christmas cards are folded only.** Offering them flat as well would give a
    true GBP 18 entry beside the GBP 34 folded one, and a flat Christmas card is
    a real product. **Not agreed** — suggested and left.

### D. The design studio

31. **Place cards and table numbers cannot do what we tell customers they do.**
    There is no variable-data support anywhere: the uploader builds ONE artwork
    and prints N copies. So fifty place cards are fifty copies of one guest's
    name, and the table-number box says *"each card in your set will differ"*,
    which nothing makes true. Either build it — paste a guest list, get N
    artworks — or change what we sell and what we say. **The false line is live
    now.**
32. **Table plans have no tables.** Heading, names and date, and nowhere to type
    who sits where, which is the whole content of the product.
33. **Sell the set.** Papier offer "Complete the set" inside the editor;
    Vistaprint sell invitation suites as a category. Closest thing we have is
    the design-suite idea.
34. **Saving a design loses almost everyone.** 44 sessions generated, 24 pressed
    "Love it", 5 tried to save, **2 designs exist**. Saving is gated behind
    creating an account and that is where people stop.
35. **`studio-nano.js` is misnamed** — it calls Flux Pro 1.1 Ultra, not Nano.
    The filename says the opposite of the decision on record.
39. **"Love it" still waits about 7.7 seconds.** Halved on 3 October by not
    uploading the same pixels twice. The rest is the press PDF going up a 1Mbps
    connection and cannot be made smaller without touching print quality, which
    is refused. The only remaining lever is to hand the files to the order page
    and upload in the background while the customer picks paper. **Not built**:
    it puts the artwork-fallback rule in two places, and getting it wrong means
    an order with no print file.
43. **Re-test changing the size after designing.** Before the shape lock, going
    back to the size step and choosing another size reverted the page to "upload
    your artwork" and the design vanished from the journey — the data survived
    and a reload brought it back, but a customer would not know. The lock should
    make it unreachable; not re-tested since.
48. **The gold preview inside the studio** — the parked Option A from the
    foiling design conversation.
49. **Marketing copy promises foil on papers that cannot take it**, on 19
    products. Needs Nicholas's wording, not Claude's.

### E. Artwork, print and the press

40. **Nothing can delete from the `artwork` bucket.** It has INSERT and SELECT
    policies for `anon` and **no DELETE policy at all**, so abandoned artwork
    accumulates for ever and only the service role can clear it. This is the
    real shape of "abandoned artwork is never deleted"; the agreed retention was
    one week and nothing enforces it.
41. **37 files, about 22MB, were added to the bucket on 3 October** between
    Claude's testing and Nicholas's. Seven named `_speedprobe-...` are certainly
    test files; the rest are `print-ai`, `ref-ai` and `foil-ai` sets from studio
    runs. They need deleting from the Supabase dashboard.
50. **"Fix it" is still withheld from two of the five red states** — a foil
    layer we cannot open, and a file that was never a PDF. Held back on purpose
    until the fixing has been tested properly.

### F. Site testing

15. **Build the test suite.** Five stages, agreed in outline and paused, in the
    order worth doing them:
    - **Broken images** — inventory from four DB columns, 81 `<img>` tags across
      56 pages, CSS backgrounds and runtime-built URLs; then fetch every one and
      check status, type and size.
    - **Price correctness** — compute every price twice, once with the site's
      own functions and once from the rules in `PRICING.md`, and compare. Also
      proves the checkout floor never exceeds the price shown, that more cards
      never cost less, and that grid, landing page and configurator agree.
    - **Eight ordering journeys**, each exercising a different code path rather
      than a different product name. Stops at Add to Basket.
    - **The artwork uploader** — diagnostic images per rule and per DPI band,
      then press-file forensics: page count, page size, crop marks, bleed proved
      mirrored rather than cropped, each face keeping its own position.
    - **Make it repeatable** — scripts in `tools/`, and a report separating
      failed from passed from could-not-be-tested.

    **What it cannot prove:** whether an image is the *right* image, whether the
    press file suits *their* press, the payment flow, or colour on paper.
42. **Two test suites do not run at all.** `test-section-race.js` wants a
    browser `window`; `test-slug-from-url.js` reads a fixture from a scratchpad
    that no longer exists. Both were already broken. A suite that reports
    nothing reports success, which is how `test-foil-route-b.js` silently
    stopped running for part of 3 October.
51. **Nothing tests checkout.** `check-live.py` reads pages and prices and never
    posts a basket, which is exactly why item 36 survived. The price-correctness
    stage of item 15 is where this belongs.

### G. Housekeeping

25. **~112 junk bot signups** remain. The orders table is empty.
26. **`from_price_text` is empty on all 23 products and nothing reads it** —
    confirmed 3 October. Either delete the column and its admin field or wire it
    up as an override; a writable field that renders nowhere is a trap.
27. **`display_quantity` has no admin screen** — changing which pack the grid
    quotes means SQL.
28. **A JavaScript error fires on load of `upload-and-print.html`.** Harmless so
    far, never chased, and proven not to come from this week's changes.
29. **Boards are single-sided only** (signage, table plans, welcome signs),
    deliberately deferred when double-sided went in.
29a. **Hide a section heading until it has content.** "Our paper stocks" printed
    with nothing under it for months. The race is fixed, but the failure mode
    remains: any future fault shows as a heading over a gap, which reads as
    "they have no papers". Cheap insurance on 23 pages.
29c. **`description` is empty on six products** — confirmed 3 October. It is
    only the fallback for meta_description and every product has one of those,
    so nothing is broken; the column is half-filled.
44. **Three customer-facing strings are Claude's words, not Nicholas's**, and
    are live: the heading and body of the "could not prepare your foil layer"
    panel, and the shape note on the size step. Marked in the source as not
    agreed.

### H. Email and customer communication

Reviewed end to end on 3 October. What a customer receives when they sign up
and when they order now works; what it looks like, and the two providers behind
it, are what is left.

52. **The welcome email has three unfilled placeholders in it**, in square
    brackets, and they would be sent to a customer as written: how Foreverprint
    started, where it prints and what it is proud of, and who is on the team.
    Only Nicholas can write them. **Nothing should send a welcome until they are
    done.**
53. **Email design — imagery and personality.** Agreed 3 October: the emails are
    plain, and want pictures and some character. Deliberately deferred; the
    sequence and the code were done first. Applies to the welcome, the order
    confirmation and the dispatch email.
54. **The account emails through Resend — DEPLOYED, NOT SWITCHED ON.**
    `netlify/functions/auth-email.js` is Supabase's Send Email Hook. Pushed and
    live on 3 October (`f1275eb`), but **inert**: no hook is configured in
    Supabase and `SEND_EMAIL_HOOK_SECRET` is not set, so it answers 401 to
    everything and Supabase is still sending its own account emails. Verified
    by creating a test account against the live auth API — signup returned 200
    with `confirmation_sent_at` set, so nothing is broken in the meantime.

    **Do not enable it before testing it live.** With the hook on, Supabase does
    NOT fall back — a non-2xx reply fails the auth operation itself, so a
    mistake means nobody can register, confirm an address or reset a password.
    Rollback is turning the hook off in Supabase; no deploy needed.

    The order to switch it on:

    1. Supabase → Authentication → Hooks → Send Email Hook → HTTPS
       `https://foreverprint.com/.netlify/functions/auth-email`. Copy the
       `v1,whsec_…` secret. **Leave it disabled.**
    2. Netlify: add `SEND_EMAIL_HOOK_SECRET` (production, secret).
    3. Claude signs a real request with openssl and posts it, so a genuine
       email arrives and the link can be clicked — proving the signature, the
       link and Resend while Supabase is still sending its own.
    4. Only then enable the hook.

    **The signature check is the one part no test covers** — it needs node's
    crypto and there is no node on this machine. Step 3 is how it gets proved.
    Two mistakes would break every account email silently and both are pinned by
    `tools/test-auth-email.js` (36 checks, five mutants): the verify endpoint is
    on the SUPABASE API domain rather than foreverprint.com, and an email change
    carries two token hashes where `token_hash_new` belongs to the new address.

    Worth checking while in the dashboard: Authentication → Emails → SMTP
    Settings. Until the hook is on, confirmations go through Supabase's shared
    sender, which is rate limited.

55. **No record of what was emailed.** There is no log table; the only evidence
    an email was sent is Resend's dashboard. If a customer says they never got
    it, there is nothing on our side to check.
56. **`TRUSTPILOT_BCC` is not set**, so no review invitation is sent at all —
    neither ours (deliberately unscheduled) nor Trustpilot's (needs the BCC).
57. ~~**`ANTHROPIC_API_KEY` is not in the Netlify environment**~~ — **SET AND
    VERIFIED 5 October.** Nicholas added the key and deployed; Amy answers.
    Verified live, not assumed: "how does delivery work?" now returns free
    standard, Express at 20% with the GBP 20 minimum and next day at 40% with
    the GBP 40 minimum, in 1.8 seconds. Three more questions confirmed the
    knowledge rewrite landed — largest size answered as **A0** (it used to say
    A1), wax seals answered as a plain no with foiling offered instead, and all
    ten papers named correctly. A deliberately malformed request confirmed the
    **failure** path logs too, recording the parse error. Measured cost:
    1,559 input and 110 output tokens, about **0.17p** per question, below the
    1p estimate. Test rows deleted afterwards so the first real conversation is
    the first row. What follows is the record of what was wrong.

    It was not a loose end, it was **the help assistant being dead**. Reclassified
    5 October after Nicholas reported Amy answering "sorry I could not get
    through" to a plain question. Reproduced against the live site: a POST to
    `/.netlify/functions/help-chat` asking "how does delivery work?" returns
    **HTTP 500** with no text, so the widget falls back to that apology. Ten
    environment variables are set; this is not one of them, so every call to
    Anthropic is rejected. **Every free-text question has failed since the
    widget was built.** The scripted flows — order tracking, the artwork
    wizard, the contact form — were never affected and work.

    **Only Nicholas can clear this**: Claude does not handle API keys. Netlify
    → Site configuration → Environment variables → add `ANTHROPIC_API_KEY`.
    Nothing else in item 61 works until it is set.

58. **Stripe may send its own payment receipt** as well as ours, which would be
    two emails about one payment. A setting in the Stripe dashboard.

59. **DMARC is `p=none`** and its reports go to a personal Gmail address. Worth
    moving to `p=quarantine` once sending volume justifies it. SPF and DKIM are
    both correct and verified — checked 3 October.

60. ~~**The website does not carry the company disclosure.**~~ **DONE 5
    October**, same day it was raised. The footer on all **57** pages now reads
    "Foreverprint is a trading name of Natch Limited, registered in England and
    Wales, company number 09493377. Registered office: Regina House, 124
    Finchley Road, London NW3 5JS." — the four things the Companies (Trading
    Disclosures) Regulations require, on the website rather than only in the
    terms. It sits on its own line below the copyright row rather than inside
    it, because that row is a flex pair and a third item would have been
    squeezed against "Made with love in the UK".

    57, not the 55 first counted: a `grep --include` miss. All 57 blocks were
    byte-identical before the change, which is what made a mechanical edit safe.
    Contrast measured at **5.73:1** against the footer background, passing AA
    for small text, by inheriting the footer's own colour rather than inventing
    a dimmer grey. Four lines on a phone, no overflow.

    `tools/test-footer-disclosure.py`, 13 checks. It walks the tree rather than
    reading one file, because the footer is hardcoded into every page AND
    injected from `footer.html` over the top — so a page added later would
    simply not have it. Verified by breaking a real page and confirming the test
    names it.

61. **Amy's knowledge was four months stale, and nothing was recorded.** Fixed
    5 October (option B of the review). Two separate failures sat behind one
    symptom, and the second would have survived the key being set:

    Her facts were a snapshot written into the function. She knew **four of the
    fifteen** sizes we sell, said "larger formats up to A1" when we sell A0,
    named **none** of the ten paper stocks, and said **nothing at all about
    what delivery costs** — which is precisely the question that prompted the
    complaint. She now carries the live catalogue as of 5 October: 22 products,
    all 15 sizes with dimensions, all 10 papers with weights and what each is
    for, all 8 foils, free standard delivery and the 20%/40% upgrades, and an
    explicit list of what we do **not** sell (wax seals, ribbon, vellum,
    envelope printing, spot UV) so she stops being asked to improvise. She is
    also told that if a customer quotes the product page against her, the page
    wins and she is out of date.

    And nothing was logged, which is the reason a total outage could last from
    the day it was built until a customer-facing complaint. `help_chat_log` now
    records every turn — question, answer, model, tokens, how long the customer
    waited — **including the failures**. That last word is the point: a logger
    wired only into the success path would have stayed silent through the exact
    outage it exists to catch, and a test asserts the log call sits inside the
    catch block.

    Message content is personal data, so the Privacy Policy now says we keep
    these messages, why, and asks people not to type sensitive details into it.
    Those words were Claude's; **Nicholas approved them unchanged on 5 October**.

    `tools/test-help-chat.js`, 62 checks. Still a snapshot, so it will drift
    again: item 62 is the fix for that.

62. ~~**Amy should read the catalogue rather than remember it.**~~ **DONE
    5 October.** She now assembles her knowledge from the five tables that ARE
    the shop — `print_sizes`, `paper_stocks`, `finish_types`,
    `delivery_options`, `product_types` — the same rows the order page and the
    landing pages read, on every reply. There is no snapshot to drift, which
    was the point: rewriting the snapshot earlier the same day fixed the
    symptom and left the cause.

    Read with the **anon** key, not the service key. All five tables are
    already public to the browser, so there is nothing to elevate for and a
    prompt injection in a customer message can never reach past the shop
    window. Cached five minutes in the warm container, so a conversation costs
    one read at most, and all five are fetched in parallel.

    **A Supabase outage makes her stale, never silent.** A failed or empty read
    falls back to the last good copy, and failing that to the snapshot kept in
    the file for exactly this. `knowledge()` cannot throw. That matters because
    the complaint that started all of this was a customer getting an apology
    instead of an answer, and a catalogue reader that could fail closed would
    reintroduce it.

    **No prices, deliberately.** The landing pages carry a from-price, but
    margins are not set, so every published figure is at or near cost and what
    Amy quotes is a pricing decision rather than a catalogue fact. She is still
    told never to invent one. One more table read whenever that is wanted.

    One real bug found by rendering the output rather than trusting it:
    Uncoated's weights came out `250/300/350/400/120gsm`, because the rows are
    in display order and 120gsm was added last. Sorted ascending.

    `tools/test-help-catalogue.js`, 76 checks, run against
    `tools/fixtures/catalogue.json` — a real capture of the five tables — and
    cutting the generators out of the shipped file so it tests the code that
    deploys. Refresh the fixture when the catalogue moves.

    **Closed the same day:** Amy calling the third service **Express Plus**
    exposed that `delivery.html` alone called it **Next Day** — a customer met
    two names for one service. Nicholas chose Express Plus everywhere, so the
    page now matches `delivery_options`, the configurator and Amy. The line
    "Order before 1pm for next day delivery" stays, because that describes when
    it ARRIVES, which the name does not tell you; the meta descriptions keep
    "next day delivery" too, because that is what people type into Google and
    nobody searches for Express Plus.

    57, not the 55 first counted: a `grep --include` miss. All 57 blocks were
    byte-identical before the change, which is what made a mechanical edit safe.
    Contrast measured at **5.73:1** against the footer background, passing AA
    for small text, by inheriting the footer's own colour rather than inventing
    a dimmer grey. Four lines on a phone, no overflow.

    `tools/test-footer-disclosure.py`, 13 checks. It walks the tree rather than
    reading one file, because the footer is hardcoded into every page AND
    injected from `footer.html` over the top — so a page added later would
    simply not have it. Verified by breaking a real page and confirming the test
    names it.

63. **The cookie banner says no, and Google still hears from us.** Found
    5 October by Nicholas's own testing, reproduced and measured, **parked at
    his direction — no work done.**

    The Privacy Policy promises: *"If you say no, none of that happens. No
    analytics or advertising cookies are set, no click identifier is stored,
    and nothing about your visit is sent to Google."*

    **Half of that is true.** Declining sets no Google cookies — the only one
    written is our own `fp_consent=denied`, with no `_ga`, no `_gcl`, nothing
    in localStorage. The consent signal reaches Google correctly as `gcs=G100`,
    both denied.

    **The last clause is not.** A returning visitor who already declined, with
    no banner shown, still sends on **every page view**: two `gtag/js` loads,
    a `page_view` to `region1.google-analytics.com/g/collect`, and a
    `page_view` to `pagead2.googlesyndication.com/ccm/collect`. The page URL
    goes with them.

    This is **deliberate**: `analytics.js` line 327 calls `loadTag()`
    unconditionally, and the comment above it explains why — Advanced Consent
    Mode, so Google can model the conversions of the ~20% who decline. The code
    does what it was built to do; **the policy was written describing a
    different design.** The live file is byte-identical to the one tested
    (same SHA1), so this is what customers get.

    **A second leak the tag fix would not close:** Google Fonts loads on **60
    pages** regardless of consent, sending the visitor's IP to Google before
    they click anything. Every third-party host our pages contact is
    Google-owned — five of them. Fixing the tag alone still leaves that
    sentence false.

    Three ways out: make the code match the policy (Basic Consent Mode — costs
    the conversion modelling); make the policy match the code (accurate, reads
    worse); or both plus self-hosting the fonts, the only option that makes the
    published sentence literally true. Whether cookieless pings require consent
    under UK PECR is contested and not Claude's call; what is not in doubt is
    that the published promise and the shipped behaviour differ.

### I. Needs a decision, not a developer

30. **Range gaps**: details and enclosure cards, evening invitations, belly
    bands, printed envelopes, hen party. Funeral and sympathy still open.
    Samples were declined.

### Cleared or resolved since this list was written

**5 October — three invented customer reviews removed from the home page:**

- **The home page carried three five-star testimonials for a shop that has
  never taken an order.** "Charlotte & James", "Amelia & Oliver" and
  "Isabella & William", under the heading *"Words from Our Customers"* —
  placeholder copy written during the build and never removed. Fabricated
  consumer reviews are a banned practice under Schedule 20 of the Digital
  Markets, Competition and Consumers Act 2024, and the site is about to start
  paying for traffic. Removed entirely at Nicholas's direction — the whole
  section, heading included, not just the quotes. Nothing replaces it; real
  ones go there when there are real ones (item 29).

  **No review structured data existed**, which is the good news: `aggregateRating`
  and `Review` markup are what put stars in Google's results, and faking those
  misleads people who never reach the site. Checked across all 91 pages.

  `tools/test-no-fake-reviews.py`, 20 checks, sweeps every page for the
  invented names, star rows and review schema. Its first run failed correctly
  and for the wrong reason — it flagged "Charlotte & James" in a code comment
  about foil area and in a design-studio placeholder, both legitimate. What
  makes a testimonial is rendered content, so it now strips comments and
  `<script>` blocks before looking.

**5 October — the trading conditions did not say who we are. Not on this list
because nobody had read the Terms since they were drafted:**

- **The Terms of Service carried five unfilled template blanks, live.** Section
  1 read "This website (foreverprint.com) is operated by [LEGAL ENTITY NAME], a
  [SOLE TRADER / LIMITED COMPANY] [registered in England and Wales under company
  number [COMPANY NUMBER]] with its [registered office / principal place of
  business] at [BUSINESS ADDRESS]" — on the page a customer is bound by, with a
  "Last updated: April 2026" date above it. Now states that Foreverprint is a
  trading name of **Natch Limited**, company number **09493377**, registered
  office **Regina House, 124 Finchley Road, London NW3 5JS**.

- **The Privacy Policy named no data controller.** It said "We are the data
  controller" where "we" resolved to the brand, not a legal person. UK GDPR
  requires the controller to be identified; a trading name is not one. Natch
  Limited is now named, with a postal route alongside the email.

- **Returns gave an email and no geographical address**, which the Consumer
  Contracts Regulations expect for a cancellation notice. Added, with a line
  asking customers to make contact before sending anything back.

  Checked against Companies House rather than taken on trust, which caught a
  misspelling: the address was given to us as "Finchely Road". The correct
  spelling is pinned by `tools/test-company-details.js`, 29 checks, along with
  a guard that fails if any bracketed template token ever returns to these
  three pages.

- **The footer carried no company disclosure either**, on all 57 pages. Raised
  as item 60 and done the same day at Nicholas's direction: the registered name,
  number, place of registration and registered office now sit below the
  copyright line sitewide. See item 60 for the detail.

**3 October, afternoon — found and fixed the same day, none of it was on this
list because none of it was known:**

- **Five of the eight foil colours drew as GOLD on every product landing page.**
  `finishing/section.js` knew rose, silver and gold; Copper, Red, Blue, Green
  and Holographic all fell through to the gold ramp, on 19 products. The correct
  eight had been in `step3/step3.js` since 1 October and the landing pages were
  never brought with them. Fixed, and `tools/test-foil-swatches.js` now compares
  the two sets so they cannot drift apart again — that check is what was
  missing. Verified across all 22 landing pages: 8 of 8 correct everywhere.
- **The foil swatches were 220px, three across** — a wall of colour once there
  were eight of them. Now 120px, four across, stepping down to three and two on
  narrow screens rather than shrinking.
- **Lamination and Corners were a heading, a description and a grid each.**
  Three stacked mini-sections for one line of specification, and the grid left a
  hole whenever a finish had two options rather than three. Each is now one row.
  It holds its shape at two finishes or five, which matters for the boards:
  signage, table plans and welcome signs show Protective finish and Hanging
  holes instead, and no foil section at all.
- **"Showing Celebrations products only"** — the word "only" removed. One banner
  serves all three categories, so weddings and announcements said it too.
- **Corners read "Square or Rounded. Square, or softened at the corners."** The
  description repeated the option names, which the old layout hid and the inline
  one exposed. Nicholas's wording: "Softened at the corners, or left as cut."

- **Lamination's flat GBP 5** — resolved. It has 2,184 rates across 4 options.
- **Product names stored inconsistently in lowercase** — resolved; none are.
- **54 test orders** — cleared; the orders table is empty.
- **Supabase Pro** — done 27 September. It did not change
  `statement_timeout = 8s`, which is what §11 is about.
- **Spot UV** — withdrawn entirely, §16.
- **Red envelopes** — withdrawn, §17.
- **The foiling hang in the design studio** — the CSP had no `worker-src`, so
  pdf.js silently ran on the main thread. Fixed and live, §16 of the memory
  notes; the three faults it exposed are fixed too.

### Notes worth keeping, not tasks

- **Anything hand-written between `<!--CHROME:header-->` and its closing marker
  is deleted by `build_pages.py`.** That region is regenerated from header.html
  on every run. It caused a scare on 27 September — 27 lines of CSS vanished
  from upload-and-print.html — which turned out to be a duplicate that also
  existed safely at line 287, so the build was right and the panic was not.
- **`getAvailablePapers()` now filters by published price.** It always was safe,
  because `step3Papers()` filtered afterwards. The guard was moved so it no
  longer depends on a caller remembering. Noted because the commit message says
  it closed a latent weakness, not a live bug.

### Cleared 30 September

- **The order page rebuilt to one structure and turned on for all 23
  products** — six steps, one line, size first, the range off the numbering
  (§0c). Walked at `/<slug>/order` on every product.
- **The page bar and step 3's rail stopped being two different maps.** Both are
  drawn from `Step3.journey()` now, so a product's own shape — a single range,
  a board rather than paper — changes both together or neither.
- **Clicking a completed step in the rail went nowhere.** It scrolled to a
  panel the page had hidden, which looked exactly like the click had failed.
- **A section that had not opened yet kept whatever number `step3.html` was
  written with**, so "2 Your paper" sat under a line calling paper step 3.
  Every section is numbered now, open or not.
- **Choosing Folded moved the page under the cursor** — the grid lost a row and
  everything below it jumped 175px. Sizes are greyed, not removed.
- **The crease sentence and the from-price came off the site** (both asked for
  on 29 September, shipped 30th).
- **"Any number from 1 to 500" came off** from under the typed quantity box.
- **The step is called Quantity**, everywhere, on every product.
- **`tools/serve.py` resolves `/<slug>/order`**, so the URL customers use can
  be opened locally at all. Its absence is why four wrong versions reached the
  live site before this was right — see the end of §0c.
- **`tools/test-wizard-rail.js`** — 60 assertions, each mutation-tested.

### Cleared 27 September

A long day. In the order it happened:

- **Orientation** — portrait or landscape across the uploader, the studio, the
  press file, the basket and the job ticket. Measured as free at the printer, so
  no rates and no scrape (§10).
- **Publish stopped working entirely** and was fixed — TOAST bloat, not the
  trigger I first blamed (§11).
- **The studio was selling every invitation folded**, at roughly double, with no
  control to choose flat. Found by Nicholas asking where the option was (§12).
- **Card icons** — a folded card now looks folded, from one shared drawing.
- **Eight pages promised finishes and papers we do not sell** — wax seals,
  deckle edges, vellum, cotton rag — including a direct answer in the help
  centre and a minimum-order claim in Amy's knowledge base. All removed, and
  `product_types.features` rebuilt from the catalogue for all 22 products.
- **The paper and finishing sections vanished at random** on all 23 landing
  pages — a race with two deferred scripts. Fixed, with a regression test.
- **Gloss switched off**; **Cartonboard and Ice White added** to the thirteen
  invitation products, which needed 315 new scraped rates first (§13).
- **Price comparison** against five competitors, and a search-demand read (§14).
- Supabase upgraded to **Pro** — daily backups, which closes a launch blocker.
- **Footer FAQs and Contact Us were both broken** — FAQs pointed at an anchor
  that does not exist on how-it-works, Contact Us was a mailto. Both now reach
  the help centre, which 55 pages had never linked to.
- **The order tracker's form sat 482px down** a 900px screen on a page whose
  only job is that form. Now 394px, with everything above the fold at three
  screen sizes.
- **Greeting cards had a 49-character box** on /products where every other
  product has 274 to 363. Rewritten to 287.
- **Two products had no search snippet at all** — Christmas cards and place
  cards served `content=""`. Both written.
- **meta_title was empty on all 22 products.** Eight wedding products were
  named in a way that never says "wedding" — "Signage | Foreverprint" competes
  for a word nobody types when they want a sign for their wedding. All 22
  rewritten, 45 to 59 characters, and built into the served HTML.

**Still true after all of it:** margins are 0 and the payload is 11MB and
growing. Delivery is no longer unfunded — standard costs us nothing, and our
quote sits 20% below PrintedEasy's on print and delivery alike. One question
is open: whether their trade discount covers the delivery line (§2).

### Cleared 29 September

- **The file quality report now shows a traffic light**, and a customer who is
  walking past a warning has to say so. Three lamps at the top of the report,
  one lit — green, amber or red, with the count in words beside it. When
  anything is flagged, an amber panel appears above the Continue button and the
  button greys until it is ticked. It stays clickable, so pressing it takes
  them to the box rather than doing nothing.

  The tick is tied to the exact set of problems it was given for. Change the
  file, change the size, add a side, and it clears itself — nobody accepts a
  soft image and then walks a wrong-sized file through on the same tick. What
  was flagged, the words they read and the moment they accepted it are stored
  on the order as `artworkAck`.

  Worth being straight about: a tick box does **not** move the legal
  responsibility. You cannot sign away "as described" with a checkbox. What it
  buys is a record — a complaint can be answered with what the customer was
  actually shown, rather than with "the system would have told them". That is
  why the record matters more than the gate.

  Covered by `tools/test-quality-report.js`, 50 assertions.

- **The database's structure is now in the repo.** 61 migrations have been
  applied to Supabase; six migration files exist, and even those were applied
  through the connector rather than the CLI, so 55 schema changes lived nowhere
  but the live database. `supabase/schema.sql` is a readable snapshot of all of
  it — 40 tables, 63 policies, 14 functions, 3 triggers — with notes where the
  DDL alone would mislead. `tools/dump-schema.md` holds the queries to remake it
  after the next change. It is a record, not a migration, and no substitute for
  the daily backups.

  Two things it turned up: `studio_events` carries two identical INSERT
  policies, so tightening one would do nothing; and `discount_redemptions` has
  no INSERT policy at all, which means the whole discount audit trail depends on
  the `redeem_discount()` function staying exactly as it is.

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

---

## 16. Spot UV withdrawn — 3 October 2026

Nicholas chose to remove it entirely rather than price it. It sat exactly where
foiling had on the morning of 1 October — a flat **£52** in `finish_options`,
**zero rows** in `finish_rates`, never probed — except that nobody wanted to
sell it. Removing it was a shorter job than measuring it.

**Found in three places, as he asked it be looked at:**

| | Where |
|---|---|
| **Content** | 19 products' `features`; wedding invitations' `tagline` and `intro_long`; `help-support.html`; the hardcoded hero fallbacks in `product.html` and `wedding-invitations.html`; two bullets in `wedding-albums.html` |
| **The wizard** | **Nothing to remove.** `step3/step3.js` has zero mentions and `finishing/section.js` fetches `finish_types` from the database, so both render whatever the catalogue holds. The four mentions in `upload-and-print.html` were all comments |
| **Pricing and data** | `finish_types` (1 row), `finish_options` (1 row, £52), `paper_stocks.finishes` (4 papers), `product_types.available_finishes` (19 products + the retired `Invitations`) |

**What was deliberately NOT removed.** `printedeasy_finishes.py`,
`printedeasy_refresh.py`, `printedeasy_foil_probe.py` and
`printedeasy-price-watch.js` all name `scodix_spotUV` and `spot-uv-price`.
Those are **PrintedEasy's own form fields, which we strip from every probe** so
that spot UV is never accidentally added to a foiling or lamination quote.
Deleting them would corrupt the scrapes. They stay.

**Two things the sweep turned up:**

- ~~**`finishing/section.js` does not filter `finish_types` by `active`.**~~
  **Fixed the same day.** The order page had `active=eq.true` and the landing
  pages did not, so marking a finish inactive would have withdrawn it from the
  order step and left it advertised on all 23 landing pages — the shop refusing
  to sell a thing the page beside it still offers. Deleting the Spot UV row
  outright meant this was never exposed; the next finish retired the ordinary
  way would have hit it.

  `step3/preview.html` had the same gap and is fixed too, so the preview cannot
  show a finish the shop will not sell. **`admin.html` deliberately still asks
  for all of them**, because it has to edit inactive rows, and that exception is
  now named in a test rather than left as a silent omission.

  Four readers of `finish_types` are pinned in `test-route-gating`, three that
  must filter and one that must not. Checked both ways: removing the filter from
  the landing pages fails, and adding it to admin fails.
- **A false positive worth knowing about.** Welcome Signs appeared to mention
  Spot UV in its FAQs. It says *"a sheltered **spot**"*. The first sweep used
  `ilike '%spot%'` and counted 20 products; the real number was 19.

**Tested.** All 16 suites identical to the baseline taken before the first
edit. `tools/check-live.py` **5,275 checks passed, exit 0**. Verified in the
browser on the order page (finishes now Lamination · Foiling · Corners), a
landing page, help and support, and the albums page — no "spot uv" anywhere.

`test-route-gating` guarded a real rule — *a finish with no ladder anywhere
must still be offered and still be charged* — and used Spot UV as its subject.
The rule outlived the finish, so the subject is now **Protective finish**,
which genuinely has no card-side ladder. Re-checked that the test still fails
when the rule is broken.

**Published 3 October 10:07 and verified on the live site.** The payload no
longer mentions Spot UV anywhere; Silk's capabilities now read Lamination ·
Foiling · Corners · Fold. Checked on foreverprint.com rather than locally: the
order page offers Lamination · Foiling · Corners, the landing page renders
Foiling and Lamination only, help and support is clean, and the landing page's
request carries `active=eq.true`. `check-live.py` 5,275 checks, exit 0.

## 17. Red envelopes withdrawn — 3 October 2026

Nicholas asked for them off the site, handled the way Spot UV had been that
morning: find every mention, review it, remove it, then prove the site still
works. Brilliant white is now the only envelope colour we sell.

**Found in four places:**

| | Where |
|---|---|
| **The data** | `envelopes.red` (active, £0.23 each) — the real source, because all three customer fetches filter `active=eq.true`. And **168 rates** in `finish_rates` for Envelopes/Red across 2 supplier families at A6, A5, DL and Square, £0.80–£87.20, which published as **2,184 Red price rows across 15 products** |
| **A code fallback** | the hardcoded `ENVELOPES` array in `upload-and-print.html`, used only when Supabase is unreachable. Its own comment says a fallback offering stock we cannot buy is worse than none, so leaving red in it would have contradicted the comment directly above it |
| **Tests** | three checks in `tools/test-route-gating.js` built Red into the fixture and asserted it was priced |
| **Copy** | one line of `docs/PRODUCT-COPY.md` |

**Nothing to remove in the pages.** No landing page lists envelope colours —
the greeting-cards FAQ only says envelope options appear with the sizes. Nothing
in `product_types`, `site_config` or `finish_types` mentions a red envelope, and
no order references one.

**Withdrawn with `active = false`, not deleted.** Unlike Spot UV, which had no
rates at all, these are 168 real scraped costs and the Monday price watch diffs
against them. Switching them off keeps the evidence and makes the decision
reversible with two updates; the customer-facing result is identical, because
every customer-facing fetch already filters on `active`.

**A wrong conclusion, corrected before it did harm.** Reading the publish
builder, Claude reported that `finish_rates` was never filtered on `active` and
that 2,184 withdrawn prices would therefore stay in the payload. **That was
wrong.** The two rate tables guard it in different places: `finish_rates` is
filtered at the FETCH (`active=is.true`), while `sheet_rates` is fetched whole
and filtered in the loop. Reading only the builder shows one and not the other.
A redundant check was left in the builder with a comment explaining the split,
so the next reader is not caught the same way.

**What was deliberately NOT touched:** **red FOIL** is a different product and
is still sold — `tools/test-foil.js` names it among eight foil colours and that
is correct. The two historical mentions in this document (§918, §952) are a
dated record and stay as written.

**Verified, on the live site rather than locally.** The envelopes endpoint now
returns Brilliant White alone. On foreverprint.com the order page holds exactly
one colour, `envelopePricedOn('Red', ...)` is false, and white's 210 price rows
are untouched. `check-live.py` 5,275 checks, nothing to report. All test suites
pass, 0 failures, including a new check that **fails if red is ever published
again** without the withdrawal being revisited.

**Two things left open, neither blocking:**

- The 168 Red rows are still in the published payload until the next Publish.
  They are unreachable — the colour cannot be selected — but they should go.
- A basket saved in `localStorage` before today could still hold a red envelope
  line. At checkout the floor would find no red row and contribute £0 rather
  than reject it, so the stored price would stand and we would owe someone red
  envelopes. Pre-launch the only such baskets are ours. Not fixed; it needs a
  decision on whether to drop withdrawn options out of saved carts.
- Unrelated, found while running the suites: **`test-section-race.js` and
  `test-slug-from-url.js` do not run at all** — one needs a browser `window`,
  the other reads a fixture from a scratchpad that no longer exists. Both were
  already broken; neither touches envelopes. Same rot that had killed
  `test-route-gating.js` until it was revived on 1 October.

## 18. Checkout refuses every basket — found 3 October, NOT FIXED

**Nothing can be sold.** Found while reading the pricing chain for something
else, confirmed against the live database, and **not fixed** — it wants a
decision about how checkout should read prices once the payload is restructured.

`netlify/functions/create-checkout.js` rebuilds the price of every basket line
and refuses anything materially cheaper than that floor. It loads the catalogue
like this:

```js
if (payload?.schema_version === 2 && Array.isArray(payload.products)) {
```

The live payload carries **`schema_version: 3`**, and has done since the
hierarchical publish went in. So `ctx.products` stays empty, there is no legacy
`prices` key to fall back on, and every item floors on the crude fallback
`Math.round((qty / 50) * basePerFifty)` with `basePerFifty = 150`.

Measured against the live payload, flat single-sided rows:

| Quantity | Real price | Floor applied | Configurations refused |
|---|---|---|---|
| 25  | GBP 17.60 – 1,119 | GBP 75  | 741 of 750 |
| 50  | GBP 18.40 – 2,228 | GBP 150 | 741 of 750 |
| 100 | GBP 19.20 – 91.20 | GBP 300 | **741 of 741** |
| 200 | GBP 20.80 – 137.60| GBP 600 | **741 of 741** |

The customer gets HTTP 400 and *"Prices have changed since this basket was
created. Please refresh the page and try again."* Refreshing cannot help.

**Why it was never noticed:** the site is pre-launch, there are no real orders,
and monitoring does not cover Stripe checkout. `check-live.py` reads pages and
prices; it never posts a basket.

**It is not a one-character fix.** Changing `=== 2` to `>= 2` works only while
products carry their prices inline. If the payload is deduplicated — which is
the other outstanding pricing job — products no longer carry `sheet_sells`, and
checkout would be back to the fallback formula without saying so. The fix is to
call the `pricing_for` RPC per basket slug instead of downloading the whole
payload, which also stops this function pulling 13MB on every checkout.

**A second fault in the same floor**, independent of the first: the basket never
records which paper WEIGHT was ordered, so `product.sheet_sells.find(...)` keys
only on paper, size, quantity, fold and sides and takes whichever row comes
first. On the live payload that is sometimes a dearer weight — **7,129
configurations across 19 products floor above the cheapest legitimate order**,
worst case demanding GBP 124.80 for a GBP 92.80 one. It should take the lowest
matching row explicitly rather than relying on the order rows happen to be in.

**The lesson is one this document already carries, from envelopes:** a price
floor that is too HIGH is a bug, not a safe default. It rejects honest orders at
the last click and protects nothing.
