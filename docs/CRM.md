# Customer relationships and marketing

Draft, 7 October 2026. **Nothing here is built.** This is the plan to argue
with. Where it says what a message is *for*, that is a proposal; the words
themselves are Nicholas's to write, as everything customer-facing on this site
is.

---

## 0. The state of things in one table

| | |
|---|---|
| CRM tool | **None** |
| Marketing platform | **None.** Resend holds 0 contacts and 0 broadcasts |
| Written plan before this file | **None** |
| Customer table | `contacts` — well built, **1 row**, Nicholas's own |
| Transactional emails | 7, through Resend on a verified domain |
| Lifecycle or campaign emails | **None** |
| People we could email today | **1** |
| People who designed something in the last fortnight | **92** |

---

## 1. Why the standard playbook only half applies

The ecommerce CRM canon is eight flows: welcome, abandoned checkout, abandoned
cart, browse abandonment, post-purchase, winback, sunset, replenishment. It is
well evidenced. Klaviyo's 2026 data has flows earning **~41% of email revenue
from 5.3% of sends**, with revenue per recipient about **18× a scheduled
campaign**. Omnisend's 2025 report: automated email drove **37% of sales from
2% of volume**, and *"one in every three people who click an automated message
make a purchase, compared to one in 18 for scheduled messages"*.

The consensus on order is unambiguous: **welcome and abandoned checkout first**,
because *"those two alone can drive 40 to 60% of total flow revenue"*.

**But that canon assumes repeat purchase, and we sell weddings.** One per
customer. So of the eight:

| Flow | Applies here? |
|---|---|
| Welcome | Yes |
| Abandoned design / checkout | Yes — and we cannot do it yet (§3) |
| Post-purchase | Yes, and it is unusually important (§4) |
| Sunset / suppression | Yes — deliverability housekeeping |
| Browse abandonment | Only once we can identify a browser |
| **Winback at 60–120 days** | **No.** They are married |
| **Replenishment** | **No.** Nobody reorders a wedding |
| **VIP / loyalty** | **No.** Needs frequency we will never see |

Half the standard stack is dead weight. Copying it would be the wrong plan,
competently executed.

---

## 2. What we sell is a sequence, not a purchase

A wedding is not one order. It is a known series of them, on a timetable set by
a date the customer tells us:

| Item | When they buy |
|---|---|
| Save the dates | 6–12 months before |
| Invitations | 6–8 weeks before |
| RSVP cards | with the invitations |
| Order of service | weeks before |
| Menus, place cards, table numbers, table plan | weeks before |
| Thank you cards | after |

**That is our replenishment cycle.** It is date-anchored rather than
behaviour-anchored, and it is predictable to the week. Someone who buys save
the dates in March is in market for invitations in September whether or not
they open an email.

Almost no ecommerce business has a reliable future date for its customers. It
is the single biggest asset in this plan — and we are currently throwing it
away (§3).

---

## 3. The gate: we cannot email people we cannot identify

Nicholas's framing is three pathways. Tested against what we can actually see:

| Pathway | What we hold | Can we email them? |
|---|---|---|
| **Visits and buys** | Email, name, order spec, consent, value | **Yes** |
| **Visits and saves** | Email via the account | **Yes — from 7 October.** Saving had never once worked |
| **Visits and does neither** | A `session_id` | **No.** No address exists |

The pathways are right about *what to say*. They sit on top of a prior
question — *do we have an address at all* — and until today the answer was "only
if they paid".

**Measured 7 October:** 128 sessions generated a design, 61 pressed "Love it",
92 generated one in the last fortnight, and exactly 1 order exists. We can see
what every one of those people designed — the brief, the motifs, the size, the
season. We could not contact a single one.

**So the first piece of CRM work is not a flow. It is identity capture.**

### Three things we are discarding that we should keep

1. **The email address**, at the moment someone has just watched a design
   appear with their own names on it. The highest-intent moment on the site.
   Fixing "save this design" (done 7 October) turns this from impossible to
   possible — but only for people willing to make an account.
2. **The wedding date.** The customer types it into the studio. It is rendered
   onto the card, baked into the print file, and then **not retained as data**:
   `orders.items` holds the spec only. A saved design now holds the wording,
   so the date arrives with saves — as free text ("Saturday 14 June 2026"),
   needing parsing, and only for people who used the studio.
3. **What they designed.** `studio_events` holds 872 rows of brief, motif,
   palette and size choices, keyed on a session nobody can name.

---

## 4. Triggers, by pathway

Proposals. None built. Timing conventions are from the research in §1.

### Pathway A — visited and bought

The one place we are strong, and the one with the most upside, because the
sequence in §2 means a buyer is a *future* buyer of something else.

| Trigger | Purpose | Exists? |
|---|---|---|
| Payment confirmed | Order confirmation | **Yes** |
| Marked dispatched | On its way, with tracking | **Yes** |
| Marked delivered | Review request | **Yes**, Trustpilot does the sweep |
| Delivered + N days | "How did they go down" — the moment advocacy is cheapest | No |
| **Wedding date minus N** | **The set.** Bought save the dates in March → invitations in September → on-the-day items weeks out | No — needs §3.2 |
| Wedding date + N | Thank you cards | No — needs §3.2 |

The date-anchored row is the one worth building. It is the only part of this
plan that is hard for a competitor to copy, because it depends on data most of
them also throw away.

### Pathway B — visited and saved

Live from 7 October. A saved design is a **stated intention**, with the design
itself as the hook.

| Trigger | Purpose |
|---|---|
| Design saved | Confirm it is kept, and how to come back to it |
| Saved, no order after N days | Bring them back to the thing they made |
| Saved, order placed | Stop the above, move to Pathway A |
| Saved, several designs, no order | They are undecided, not uninterested — different message |

The asset here is unusual: **we can show them their own design.** Not a product
photograph — the thing with their names on it.

### Pathway C — visited and did neither

By definition unreachable by email. Honest options:

- **On-site**, at the moment of leaving or returning — costs nothing, needs no address
- **Paid retargeting** — needs consent, and as of 7 October we send Google
  nothing at all when someone declines
- **Convert them to B** — the real answer. Make saving worth doing

Pathway C is mostly a brief for Pathway B: the work is moving people into it,
not marketing at them inside it.

---

## 5. What to build first

Research consensus is welcome and abandoned checkout. Adapted to this business:

1. **Make the welcome send.** It is built and blocked by three square-bracket
   placeholders only Nicholas can write. Nothing else in this plan is as close
   to done.
2. **Prove the save works end to end**, then the "saved but not ordered"
   trigger. This is our abandoned-checkout equivalent and the research says it
   is where the money is.
3. **Capture and parse the wedding date**, which unlocks §4's date-anchored
   sequence — the thing that makes this business different.
4. **Post-purchase advocacy**, because a hundred guests see the product.
5. Sunset/suppression before the list is big enough to damage deliverability.

Explicitly **not** doing: winback, replenishment, VIP. They do not apply.

---

## 6. Consent

UK PECR allows a **soft opt-in**: we may email an existing customer about our
own similar products without separate consent, provided we offered an opt-out
when we took the details and in every message since. It covers the
*"negotiation of a sale"*, not only completed ones.

The foundations are already right, and were built before this file existed:

- `contacts.consent_text` stores **the exact words someone agreed to**
- `consent_at`, `consent_source` record when and by which route
- `unsubscribed_at` + `unsubscribe_token`, one-click, no login wall
- the upsert will never re-grant consent to someone who has unsubscribed
- people who decline are recorded too, which is the honest record

Open question for Nicholas: **soft opt-in or explicit consent only?** The law
allows the former. Some businesses prefer the latter and accept the smaller
list.

The 10 holding-page signups are a separate case: they agreed to *"know when we
launch"*, which is a launch announcement, not a mailing list.

---

## 7. Tooling

Not yet needed. The list is owned in `contacts`, the admin already exports it,
and Resend can send broadcasts. A CRM becomes worth paying for when we are
running several date-anchored sequences at once and want them managed rather
than coded — not before.

The admin Customers tab says it best: *"Owned here, so whichever marketing tool
you choose later is an export rather than a place your list lives."*

---

## 8. Measurement

Open and click tracking are **off** on the Resend domain, so we currently have
no engagement data on anything sent. That is a deliberate-looking default
nobody chose; it should be a decision either way before the first campaign.

Worth counting from the start: list size by consent basis, and for each trigger
— sent, opened, clicked, ordered, and revenue per recipient so the §1
benchmarks mean something here.

---

## 9. Decisions needed before any of this is built

1. **Soft opt-in, or explicit consent only?**
2. **Do we store the wedding date?** It is one field already typed.
3. **What do we offer for an address** beyond "save your design"?
4. **Pathway C** — on-site prompts, paid retargeting, or leave it?
5. **The three welcome passages.** Blocking the one thing that is otherwise
   ready.
6. **Open/click tracking** — on or off, deliberately.
