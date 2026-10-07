# Customer relationships and marketing

Working plan, started 7 October 2026. **Last reviewed 7 October 2026**, against
the database and Resend rather than against this file. Organised by what a
customer *does*, because that is what we can detect and therefore what we can
act on.

The first draft of this file said "nothing here is built yet". That stopped
being true within the day. §0 below is the standing answer to "where are we",
and it is checked rather than remembered — every figure in it came from a query
run on the date shown.

Where this says what a message is *for*, that is a proposal. The words are
Nicholas's to write, as everything customer-facing on this site is.

---

## 0. Where we are — checked 7 October 2026

Verified by query, not from memory. Re-run these before trusting them again.

| | Item | State | How it was checked |
|---|---|---|---|
| **W1** | Open and click tracking | ✅ **Done** | Resend domain `foreverprint.com`: verified, Open Tracking `true`, Click Tracking `true` |
| **W3** | Saving a design works | ✅ **Done** | 1 row in `saved_designs`, image held as a storage URL, proven on the live site |
| **W8** | Counting the consent choice | ⚠ **Built, never fired** | `consent_log` exists and holds **0 rows**. Expected behind a holding page, but it means the accept rate is still unknown and the code is unproven in the wild |
| **W2** | Welcome email | 🔒 **Built, cannot send** | Two passages unwritten. `unfilledWelcomeBlanks()` refuses the send while any remain |
| **W4** | Saved-design reminder | 🔒 **Built, cannot send** | Scheduled daily 09:00, dry run only; `buildReminderHtml()` returns null until the copy exists |
| **W5** | After the wedding | ❌ Not started | |
| **W6** | Sell the rest of the range | ❌ Not started | |
| **W7** | Suppression at 12 months | ❌ Not started | |
| **§4a** | Google retargeting | ⏸ Parked | Tag live, Consent Mode v2 correct. Cannot sensibly start before launch |

**Two of the three "ready now" items are finished. The other two are complete
machines blocked on the same thing — words.**

### The funnel, 9 September to 7 October

From `studio_events`, which counts distinct sessions.

| | | |
|---|---|---|
| Generated a design | **129** | |
| Pressed "Love it" | **61** | 47% of them |
| Pressed "Save this design" | **6** | 10% of those who loved one |
| Designs actually saved | **1** | the other 5 hit the base64 fault fixed 7 Oct |
| Orders | **1** | |
| **People we could email today** | **1** | |

The gap between 61 and 6 is the whole of §0a.

---

## 0a. The three journeys, and what each one has

The framing Nicholas asked for: somebody visits and buys, visits and saves, or
visits and does neither.

### Journey 1 — visits and buys. Identified.

**In place:** order confirmation, dispatch email, Trustpilot review invitation
(BCC'd on dispatch, so Trustpilot invites them after their own delay — our own
review sweep is deliberately unscheduled so nobody is asked twice), and an
explicit unticked consent box at checkout.

**Missing:** everything after delivery. W5 and W6 are both unbuilt.

**Well served up to delivery, silent after it.**

### Journey 2 — visits and saves. Identified.

**In place:** an account is required, saving is proven, the W4 reminder is
built, scheduled and dry-running safely, and the welcome fires on first sign-in
after confirmation.

**Missing:** only the copy. Two finished machines waiting on words.

**Worth remembering:** 6 sessions pressed Save and 1 design exists. The other 5
were lost to the fault fixed on 7 October, and we hold no address for any of
them.

### Journey 3 — visits and does neither. Not identified.

**In place:** `studio_events`, GA4, and the Ads tag with Consent Mode v2.

**Missing:** any way to reach them.

**The finding that matters.** 61 people pressed "Love it" — the strongest
signal anyone gives us — and that button takes them straight into the order
flow. **Nothing ever asks them to save.** `showSavePrompt()` in
`design-studio-ai-create.html` only runs when a logged-out visitor
independently presses "Save this design", which 3 sessions have ever done, all
on 17 September.

So the route from journey 3 to journey 2 exists and is almost never offered.

---

## 0b. Where to start, when we come back to this

In this order, and reviewed before anything is built.

1. **The "Love it" moment.** 61 people reached it and 1 address came out. It is
   the cheapest address capture on the site and it is not currently asked for.
   It feeds W4, which is already built and waiting. Review the screen and bring
   options; change nothing first.
2. **The copy for W2 and W4.** Two finished machines, blocked. W4 is one short
   email. W2 needs two passages: how foreverprint started, and the team.
   Nicholas said on 7 October that the welcome email as drafted **is not good
   enough**, so that is a rewrite and not just a gap-fill.

W5, W6, W7 and retargeting are all real and all serve volumes this business
does not have yet.

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
| 2 | Designs something | No | Brief, motifs, size, season | **129 sessions** |
| 3 | Presses "Love it" | No | …plus intent to order | **61** |
| 4 | **Saves a design** | **Yes** | Email, the design, their wording | **working, proven 7 Oct** |
| 5 | Adds to basket | No | Basket lives in their browser only | unknown |
| 6 | Starts checkout | Yes, at the point they type it | Email, name, address | unknown |
| 7 | **Buys** | **Yes** | Order, spec, value, consent | **1** |
| — | *Pressed Save while logged out and was shown the prompt* | No | — | **3 sessions, all 17 Sep** |
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

**W1 — Turn on open and click tracking.** **DONE 7 Oct.**
Resend domain setting. Verified on the domain itself: Open Tracking `true`,
Click Tracking `true`. Everything after it is now measurable.

**W2 — Make the welcome email send.** *Blocked, and now a rewrite rather than
a gap-fill.*
Built, deployed, and has never sent. It is the closest thing to done in this
file and it fires on action 4 and action 7. The passage on where the cards are printed was written on 7 Oct from checked
facts about the trade printer. Two remain: how it started, and the team. On
reading it whole, **Nicholas judged the email not good enough** — so the next
move is the email itself, not only the blanks.

It can no longer go out half-written: `unfilledWelcomeBlanks()` renders the
template and refuses the send while any `[CAPITALS]` blank is in it, checked
**before** the claim is taken so nobody is marked welcomed and then skipped.
Guarded by `tools/test-welcome-guard.js`.

**W3 — Prove the save works end to end.** **DONE 7 Oct.**
Nicholas saved a design while signed in. Verified independently: the row is
**1,705 bytes**, the image is a storage URL rather than base64, the file is in
the bucket and returns HTTP 200, and all 10 lines of wording survived. The
image is 1,061,467 bytes — as base64 that is about 1.4MB, stored twice, so the
row would have been nearly 3MB. That is why both routes failed and why it now
works. **Action 4 is live and W4 is unblocked.**

### After W3 proves out

**W4 — "You saved a design and have not ordered."** **Machinery built 7 Oct,
cannot send — waiting on the words.**
The research equivalent of abandoned checkout, which with welcome accounts for
40–60% of all flow revenue. Our version is stronger than most: we can show
people **their own design, with their own names on it**, not a product photo.

`netlify/functions/saved-design-reminder.js`, scheduled daily at 09:00, and it
runs as a **dry run that reports who it would email**. It stays that way even
if the environment variable is set, because `buildReminderHtml()` returns null
until the copy exists. Copy is Nicholas's, and an unattended email to a real
customer is the last place to break that rule.

Settings, all constants at the top of the file and easy to change:

| | | Why |
|---|---|---|
| First reminder | **3 days** | A considered purchase; sooner reads as pushy |
| Window closes | **21 days** | Older is not a live intention, and the upper bound means rows predating the function can never be swept up by a later deploy |
| Cap per run | **25** | A mistake stays small and visible |
| Messages | **One, ever** | Guarded by `saved_designs.reminder_sent_at` |

Skipped at send time rather than trusted from a flag: anyone who has ordered
since saving, anyone who has unsubscribed, and any design whose account has
gone.

**One message, not a series, and that is a consent decision.** A single
reminder about something the customer asked us to keep is a service message. A
second nudge is marketing and would need the tick.

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

**W8 — Count the consent choice.** **BUILT 7 Oct — but it has recorded
nothing.** `consent_log` holds 0 rows. Behind a holding page that is what you
would expect, so it is not evidence of a fault; it is also not evidence the
code works. Check it again once real traffic arrives, and before the
retargeting decision rests on it.

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
   audience never reaches 100 and the spend does nothing. We now record the choice (W8), but it has
   captured nothing yet, so the rate is still unknown.

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
| Lifecycle emails | **Two built, neither able to send** — W2 and W4, both on copy |
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
