# Customer relationships and marketing

Working plan, 7 October 2026. **Nothing here is built yet.** Organised by what
a customer *does*, because that is what we can detect and therefore what we can
act on.

Where this says what a message is *for*, that is a proposal. The words are
Nicholas's to write, as everything customer-facing on this site is.

---

## 1. Decisions taken

Recorded so they are not re-opened by accident.

| | Decision | Date |
|---|---|---|
| Saving a design requires an account | **Yes** — that is how we get an address | 7 Oct |
| What we offer for an address | **The saved design itself.** Nothing further | 7 Oct |
| Store the wedding date | **No** | 7 Oct |
| Chasing people who never identify themselves | Convert them to savers **and** Google retargeting — see §4a | 7 Oct |
| Open and click tracking | **Turn on**, to learn how it behaves | 7 Oct |
| Consent basis | **Soft opt-in**, with the caveat below | 7 Oct |
| Open and click tracking | **ON** — done 7 Oct, verified | 7 Oct |
| Counting the consent choice | **Built 7 Oct** — anonymous, one row per decision | 7 Oct |

**One consequence of not storing the date, recorded without argument:** the
cross-sell sequence in §4 cannot be timed. We can still sell the rest of the
range off *what they bought*, just not *when their wedding is*. Cheaper to
build, less precise.

**One thing worth knowing about that decision:** a saved design holds the
customer's wording, and for most products that wording contains the date as
free text. So we hold it incidentally whether or not we use it. If the
intention was to not hold it at all, that is a different and larger change.

---

## 2. What a customer can do, and what we know when they do it

This is the spine. Everything else hangs off it.

| # | Action | Identified? | What we hold | Count to 7 Oct |
|---|---|---|---|---|
| 1 | Lands, leaves | No | A `session_id` | unknown |
| 2 | Designs something | No | Brief, motifs, size, season | **128 sessions** |
| 3 | Presses "Love it" | No | …plus intent to order | **61** |
| 4 | **Saves a design** | **Yes** | Email, the design, their wording | **0 — now possible** |
| 5 | Adds to basket | No | Basket lives in their browser only | unknown |
| 6 | Starts checkout | Yes, at the point they type it | Email, name, address | unknown |
| 7 | **Buys** | **Yes** | Order, spec, value, consent | **1** |
| 8 | Receives the order | Yes | …plus a delivery date | 0 |
| 9 | Unsubscribes | Yes | Suppression, for ever | 0 |

**Actions 4, 6, 7, 8 and 9 are addressable. 1, 2, 3 and 5 are not.**

That is the whole problem in one line: the three most common things anybody
does on this site leave us no way to speak to them.

---

## 3. The work, in order

Each item says what it is, what it depends on, and whether it is ready. Nothing
starts until the decision above it is settled.

### Ready now

**W1 — Turn on open and click tracking.** *Decided 7 Oct.*
Resend domain setting. Without it no later item can be judged. Five minutes,
no code. Do first so everything after it is measurable.

**W2 — Make the welcome email send.** *Blocked on three passages only
Nicholas can write.*
Built, deployed, and has never sent. It is the closest thing to done in this
file and it fires on action 4 and action 7. **Next session: review the three
passages together.**

**W3 — Prove the save works end to end.** *Needs Nicholas signed in.*
Fixed 7 Oct but never watched succeeding. Until it is, action 4 is theoretical
and W4 cannot start.

### After W3 proves out

**W4 — "You saved a design and have not ordered."** *The big one.*
The research equivalent of abandoned checkout, which with welcome accounts for
40–60% of all flow revenue. Our version is stronger than most: we can show
people **their own design, with their own names on it**, not a product photo.
Needs a trigger on saved-not-ordered after N days, and N agreed.

**W5 — Post-purchase, beyond the receipt.**
Order confirmation, dispatch and review request already exist. What is missing
is the moment after the wedding, when the product has been seen by a hundred
guests and advocacy is cheapest. One message, triggered off delivery plus a
delay.

**W6 — Sell the rest of the range off what they bought.**
Without the date this is "you bought save the dates, here are the invitations",
triggered by purchase rather than by calendar. Less precise, still worth it —
the range is designed to be bought in sequence.

### Housekeeping, before the list is big enough to matter

**W8 — Count the consent choice.** *Prerequisite for §4a.*
Record whether a visitor accepted or declined, so we know what share of traffic
can ever be retargeted or measured. Small. Needs doing before launch or the
retargeting decision is a guess.

**W7 — Suppression.** Anyone who has not opened anything in twelve months stops
receiving. Protects deliverability, which protects the order confirmations that
actually matter.

### Not doing, and why

| | |
|---|---|
| Winback at 60–120 days | They are married |
| Replenishment | Nobody reorders a wedding |
| VIP / loyalty | Needs a frequency this business will never see |
| Retargeting the unidentified | **Not ruled out** — see §4a. Parked until the shop is open |

---

## 4a. Google retargeting — the one thing that reaches the unidentified

Actions 1, 2, 3 and 5 leave no address, so email cannot reach them. Paid
retargeting can, and it is the only thing that can.

**The plumbing already exists.** The Ads tag `AW-18457098398` is live with
Consent Mode v2 correctly implemented. Nothing needs building.

**The size threshold is no longer the obstacle it was.** Google dropped the
minimum audience to **100 active users in 30 days** for Search and Display in
December 2025, down from 1,000. YouTube still needs 1,000. At 92 design
sessions a fortnight, Display is plausibly in range.

**Two things decide whether it is worth doing, and we can answer neither yet.**

1. **The consent accept rate.** Since 7 October a visitor who declines sends
   Google nothing at all, by design, because the privacy policy says so. Only
   accepters can enter a remarketing audience. If most people decline, the
   audience never reaches 100 and the spend does nothing. **We do not currently
   record the choice**, so this is unknown — and it is a small piece of work to
   start counting it.

2. **Where the ad would send them.** The site is behind a holding page saying
   "we will be open very soon". Paying to bring someone back to a wall is
   spending money to annoy a warm prospect. **This cannot sensibly start before
   launch.**

**Recommended order:** start counting the consent choice now, so that by launch
we know whether an audience can form at all. Decide the spend at launch, not
before.

---

## 4. What we are leaving on the table, knowingly

Recorded so it is a choice rather than an oversight.

A wedding is a **sequence** of purchases on a known timetable — save the dates
6–12 months out, invitations 6–8 weeks out, on-the-day items weeks before,
thank yous after. With the date we could time each one. Without it, W6 fires
off the last purchase instead, which is later and blunter.

If the range ever stops selling itself in sequence, this is the first thing to
revisit.

---

## 5. Consent — one decision still open

UK PECR allows a **soft opt-in**: we may email an existing customer about our
own similar products without a separate tick, provided we offered an opt-out
when we took their details and in every message since. It covers the
*negotiation* of a sale, not only completed ones.

The plumbing is already right, and predates this file: `consent_text` stores
the exact words someone agreed to, with `consent_at` and `consent_source`;
`unsubscribed_at` and a one-click `unsubscribe_token` with no login wall; and
the upsert will never re-grant consent to someone who has unsubscribed.

**Decided 7 October: soft opt-in.** With one caveat that limits what it buys.

**The checkout already asks explicitly, with an unticked box:** *"Email me
occasionally with new designs, seasonal ideas and offers."* So a customer who
leaves it unticked has been offered the choice and declined it. Soft opt-in
exists for where we did not ask separately but gave an opportunity to object —
not to overrule someone who took that opportunity. In practice, then, we are
already running explicit consent at checkout, and soft opt-in changes nothing
there.

**Where it does apply is completing the range (W6).** "You bought save the
dates, here are the matching invitations" is about the order they already
started rather than a newsletter, and that is the most defensible use of the
exception. It needs no change to a live page.

**It does not apply to W4**, which needs no exception at all: a saved design is
the customer asking us to keep something for them.

**If the reachable list ever needs to be bigger**, the lever is changing the
checkout from an opt-in tick to opt-out wording. That is a live page and a
change of tone from notably respectful to assumed, so it is a decision rather
than a tweak, and it is not taken.

The 10 holding-page signups sit outside both: they agreed to be told when we
open, which is one announcement, not a mailing list.

---

## 6. Current state, for reference

| | |
|---|---|
| CRM tool | None. Not needed yet |
| Marketing platform | None. Resend holds 0 contacts, 0 broadcasts |
| Customer table | `contacts` — sound, **1 row** |
| Transactional emails | 7, live, through Resend on a verified domain |
| Lifecycle emails | **None** |
| People we could email today | **1** |

The list is owned in `contacts` and the admin exports it. A CRM becomes worth
paying for when several sequences run at once and want managing rather than
coding — not before.

---

## 7. Measurement

Once W1 is on, count per trigger: sent, opened, clicked, ordered, and revenue
per recipient. The benchmarks worth measuring against, from the 2025–26
published data:

| | |
|---|---|
| Flows vs campaigns | ~18× revenue per recipient |
| Welcome flow | 40–60% open, ~2% order rate (top decile 9.9%) |
| Abandoned checkout | Highest revenue per recipient of any flow |
| Welcome + abandoned checkout | 40–60% of all flow revenue |
