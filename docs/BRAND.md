# How Foreverprint looks and sounds

*Last verified 6 October 2026 against the live stylesheets and against the
pages as a browser actually renders them. This is the canonical reference — if
you change how the site looks, change this file in the same commit.*

*Product photography has its own guide at `BRAND-IMAGERY-GUIDE.md` and is not
repeated here. Its palette already agrees with this one.*

**Every value below was measured, not recalled.** Where the source and the
rendered page disagree, this file records what renders, and says so.

---

## 0. The state of things in one table

| | |
|---|---|
| Pages carrying the shared header | **53** |
| Where the tokens actually live | `header.html`, one `:root` block |
| Colour tokens | **17** |
| Type scale steps | **8**, all fluid `clamp()` |
| Typefaces in use | **2** (a third is loaded and unused — §3) |
| Pages whose own `:root` disagrees | **9**, all silently overridden (§7) |
| Literal hex where a token exists | **91 uses** across 9 files (§7) |
| Components that drift | inputs, cards — by 1–2px (§7e) |

---

## 1. How this file works

`header.html` holds the single `:root` block. **Each page fetches it at runtime**
with JavaScript and drops it into the body — `tools/build_pages.py` does
something else entirely (it pre-renders the product pages). An earlier draft of
this file said build time; that was wrong, and it matters, because a runtime
fetch can be cached or can fail.

Because it lands in the `<body>` and each page's own `:root` sits in the
`<head>`, the header's values come later in the cascade and win. Three
consequences worth knowing before changing anything:

- **The tokens have one home.** Change a colour in `header.html` and it changes
  everywhere, in one edit.
- **A page's own `:root` is decoration.** Nine pages declare tokens that never
  take effect. Reading those files tells you the wrong thing (§7).

- **A stale header is a real failure mode.** Browsers cache `header.html`. After
  a deploy a returning visitor can run yesterday's tokens against today's page
  CSS. This is not hypothetical — it happened repeatedly while verifying this
  work locally, and it is why `--focus` carries a fallback (§5). **A token used
  by page CSS should be written `var(--token, var(--local-fallback))`** where a
  sensible local fallback exists.

Anything added directly to a page is overwritten on the next deploy. This has
caught us out before: a comment added to one page appeared on all 53. The
header and footer are also each injected **twice** on some pages — harmless,
but it means two copies of the same `:root` in the DOM.

---

## 2. Colour

### The palette

| Token | Value | What it is for |
|---|---|---|
| `--cream` | `#FAF7F2` | Page background. The default ground for everything. |
| `--white` | `#FFFFFF` | Cards and panels sitting on the cream |
| `--gold` | `#B8976A` | The brand colour. Buttons, links, eyebrows, icons, rules |
| `--gold-lt` | `#D4B896` | Focus borders, dividers, the lighter gold edge |
| `--text` | `#3D2E24` | Body text and headings. Espresso, never black |
| `--soft` | `#7A6558` | Secondary text, labels, descriptions |
| `--pale` | `#B0A098` | Tertiary text, placeholders, "(optional)" |
| `--border` | `#E8DDD8` | Card and input borders |
| `--hairline` | `#EFE6E0` | Lighter rules and separators |
| `--focus` | `#7A6558` | **A role, not a colour**: the ring showing a keyboard user where they are |
| `--brown` | `#6B4F3A` | Dark ground, used sparingly |

### Status colours

| Token | Value | Use |
|---|---|---|
| `--ok` | `#5A9E6F` | Success, delivered, in production |
| `--warn` | `#C97B3A` | Attention, being checked |
| `--err` | `#C94A3A` | Errors and form validation |

### Decorative tints

`--blush #F0DDD8`, `--lav #DDD5E8`, `--sage #D1DDD0`, `--mist #E8EBF0`.
Backgrounds for category cards and illustration only. **Never for text, never
for interface furniture.**

### The rules

1. **Always `var(--token)`, never the hex.** The hex is written down once, in
   `header.html`. A literal is a copy that cannot be updated.
2. **Never leave a colour to be inherited on a link.** This is not theoretical:
   the home page's pod icons rendered in the browser's default link blue
   (`#0000EE`) for exactly this reason — a rule that set a size but no colour,
   inside an `<a>`. Nobody chose blue; it was the absence of a choice.
   `tools/test-path-icon-colour.py` now guards it.
3. **There is no black and no pure grey.** Everything warm.

---

## 3. Typography

### The two families

| Family | Role |
|---|---|
| **Cormorant Garamond** (serif) | Display only — page headings, card titles, prices, the confirmation heading |
| **Jost** (sans) | Everything else — body, labels, buttons, navigation, forms |

**A third, Great Vibes, is loaded on all 53 pages and used by nothing.** Two
`<link>` tags per page request it; no element references it and the browser
never downloads the font file. It is a dead reference, not a performance
problem, but it should come out (§7).

### The scale

All fluid. Each step interpolates between a floor and a ceiling, so nothing is
set in fixed pixels.

| Token | Value | Renders |
|---|---|---|
| `--text-xs` | `clamp(13px, 0.55vw + 11px, 15px)` | Labels, eyebrows, buttons |
| `--text-sm` | `clamp(15px, 0.6vw + 12px, 17px)` | Secondary text, form labels |
| `--text-body` | `clamp(17px, 0.7vw + 14px, 19px)` | Body copy |
| `--text-lg` | `clamp(19px, 0.8vw + 15px, 22px)` | Lead paragraphs |
| `--text-h3` | `clamp(21px, 1.3vw + 16px, 27px)` | Sub-headings |
| `--text-h2` | `clamp(30px, 2.4vw + 19px, 42px)` | Section titles |
| `--text-h1` | `clamp(2rem, 3.6vw, 3rem)` | Page titles |
| `--nav-size` | `clamp(16px, 0.5vw + 14px, 18px)` | Navigation |

### Weights

`300` light (large display), `400` regular (the default), `500` medium
(emphasis, buttons, labels). `600` exists in the loaded set and is used 30
times; prefer 500.

### The rules

1. **Serif for display, sans for use.** A serif button or a sans page title is
   wrong.
2. **Sentence case for form labels.** Decided for the checkout on 5 October:
   uppercase with letter-spacing is the heaviest way to set small type, and a
   short form does not need shouting at. Eyebrows above headings are the one
   place uppercase tracking belongs.
3. **Never a fixed px font-size for body text.** Use the scale.

---

## 4. Shape and space

| Radius | Use | Frequency |
|---|---|---|
| `60px` | Buttons and chips — a full pill | 1,132 |
| `50%` | Circular icon wells and avatars | 694 |
| `20px` | Cards and panels | 318 |
| `16px` / `12px` / `10px` | Smaller insets, inputs | 169 / 59 / 57 |

A pill for anything you press, a 20px card for anything you read. The 8px and
14px values in circulation are drift, not a decision (§7).

---

## 5. Components

### Button

Verified identical on nine pages — this is the most consistent thing on the
site and should stay that way.

| | |
|---|---|
| Background | `var(--gold)` |
| Text | white, `--text-xs`, uppercase, `letter-spacing` ~`.16em` |
| Padding | `15px 38px` |
| Radius | `60px` |

`.btn` solid gold · `.btn-out` outlined · `.btn-light` / `.btn-out-light` for
dark grounds. On a dark ground the light pair is required — a gold button on
brown does not have the contrast.

### Input

| | | Consistent? |
|---|---|---|
| Border colour | `var(--border)` `#E8DDD8` | **Yes** — every form field on every page measured |
| Border width | `1px solid` | **Yes** |
| Radius | `10px` | **No** — `track-order.html` uses `8px` (§7e) |
| Padding | `12px 16px` | **No** — the five auth pages use `13px 16px` (§7e) |
| Focus | border becomes `var(--focus, var(--soft))` — `#7A6558`, 5.48:1 | **Yes**, all 24 rules |
| Error | border becomes `var(--err)`, message beneath in `--text-xs` | |
| Label | sentence case, `--text-sm`, `var(--soft)` | |

**Use `10px` and `12px 16px`.** Those are the majority and the newer work.

**No placeholder text that repeats the label.** "So we can reply" under *Email
address* says nothing and makes an empty field look filled. If a format genuinely
needs explaining, put it beside the label in `--pale`, as
*Order number (optional, like INV-2026-0000)*.

**Always `novalidate` on a form you validate yourself.** Otherwise the browser's
own validation intercepts the submit and your styled messages never run — this
was a live bug on the contact page.

### Card

White on cream, `1px solid var(--border)`, **`20px` radius — consistent
everywhere measured**. Padding is not: content cards use `32px`, the auth
pages' `.auth-card` uses `48px 40px`. Either reads correctly; they are simply
not the same component wearing the same name.

---

## 6. Voice

These are decisions already taken, recorded here so they are not re-litigated.
Wording is Nicholas's to write; this section says only what has been settled.

- **The brand is `foreverprint`** — lowercase f, always, outside body prose.
- **Never promise a turnaround we have not agreed.** The contact page promised a
  reply "within one working day" in five places and it came out of all five. We
  can say what we will do, not when.
- **Never promise a digital proof.** Say "check" or "preview".
- **Do not assume a happy reader.** Someone whose order is wrong uses the same
  pages as someone delighted. "How can we help?" rather than "We would love to
  hear from you".
- **Do not name a product the order might not be.** We sell more than
  invitations; tracking says "your order".
- **Copy must match the catalogue.** We once promised wax seals we do not sell.

---

## 7. Where the site does not follow this

Everything here was checked in a browser. Items marked **cosmetic only** do not
change a single rendered pixel today.

### a. Nine pages declared tokens that never applied — **aligned 6 October**

`account.html`, `login.html`, `register.html`, `forgot-password.html`,
`reset-password.html` carry a whole alternative palette: `--border #E5DDD0`,
`--err #B85C5C`, `--ok #5C8A6A`, `--pale #A89788`, `--soft #7A6A5C`,
`--warn #C99B5F`. `design-studio-tweak.html` differs on eleven tokens including
fixed-px type. `admin.html` differs on `--gold-dk`. `docs/ORDER-PAGE.html` and
`step3/preview.html` differ on `--line` and `--white`.

**None of it rendered.** The injected header overrode every one — verified on
`login.html`, which declared `#E5DDD0` while the browser reported `#E8DDD8`.

**They were aligned to the house values rather than deleted**, and the
distinction matters. Those blocks sit in each page's `<head>`, so they are the
palette the page paints with *before* the runtime header fetch lands. Deleting
them would leave a page with no tokens at all for that window — a flash of
unstyled colour on a slow connection. Aligning the 39 differing values stops
the source lying without taking that risk. Verified afterwards: `login.html`
renders pixel-identical.

### b. 91 literal hex values where a token exists — *cosmetic only*

Worst: `admin.html` (6 token colours hard-coded), `upload-and-print.html` (5),
`design-studio.html` and `design-studio-ai-create.html` (4 each). They match the
token today, which is exactly why nobody notices; they would not survive a
palette change.

### c. Great Vibes loaded and unused — *cosmetic only*

53 pages, two `<link>` tags each, zero elements using it.

### d. Page headings — **fixed 6 October**

Was: eight different sizes across eight pages — 48, 48, 43.2, 43.2, 40.8, 39.9,
38.4, 38px — with weight drifting between 300 and 400 for no reason.

All page titles now use `var(--text-h1)` at weight 400. **The token itself was
repointed**: it held `clamp(40px, 3.8vw + 21px, 58px)` and was used by nothing,
while 24 product pages set `clamp(2rem, 3.6vw, 3rem)` through `.lp-h1`. Adopting
the old token value would have enlarged those 24 pages by about a fifth, so the
token was moved to the size the site already used. The pages that were right
did not move; the outliers came to them.

**Deliberate exceptions, both roles rather than faults:**

- **Heroes keep their own, larger scale.** A hero is not a page title. The
  homepage (`.hero-h1`), `wedding-albums` (`.hero h1`, up to 84px), the album
  builder (`.builder-hero h1`) and `saved-designs` (`.page-hero h1`) all have
  one. Anything whose selector contains `hero` is outside the page-title rule.
- **`index.html`'s `<h1>` is `hero-h1-seo`** — 15px, gold, Jost. An SEO heading
  styled as a kicker, on purpose.

### e. Inputs and cards drift by a pixel or two — **visible, just barely**

Measured on six pages. The border colour is `--border` on every field without
exception, which is the part that would be obvious if it were wrong. What drifts
is smaller:

| | Most pages | The exception |
|---|---|---|
| Input radius | `10px` | `8px` on `track-order.html` |
| Input padding | `12px 16px` | `13px 16px` on the five auth pages |
| Card padding | `32px` | `48px 40px` on `.auth-card` |

A 2px corner difference is not going to be spotted side by side, but it is the
kind of thing that accumulates. Worth settling in this file rather than fixing
page by page.

### f. Duplicate font loading — *minor*

Pages request Google Fonts in their own `<head>` and again via the injected
header — two `<link>` tags for the same families on every page.

---

## 8. Accessibility — measured, not assumed

Every pair below is a real WCAG 2.1 contrast ratio computed from the tokens.
**AA needs 4.5:1 for normal text, 3:1 for large text and for interface
elements** such as borders and focus rings.

| Pair | Ratio | |
|---|---|---|
| Body text on cream `--text` / `--cream` | **12.17** | AAA |
| Body text on white | **13.01** | AAA |
| White on brown `--white` / `--brown` | **7.49** | AAA |
| Secondary text `--soft` on cream | **5.13** | AA |
| Secondary text on white | **5.48** | AA |
| Error `--err` on white | **4.64** | AA |
| Warning `--warn` on white | **3.29** | large text only |
| Success `--ok` on white | **3.20** | large text only |
| **White on gold — the primary button** | **2.74** | **fails AA** |
| **Gold text on white** | **2.74** | **fails AA** |
| **Gold text on cream** | **2.56** | **fails AA** |
| **`--pale` placeholder on white** | **2.52** | **fails AA** |
| ~~`--gold-lt` focus border~~ → `--focus` `#7A6558` | **5.48** | **fixed 6 Oct** — was 1.89 |

### What this means, plainly

**The primary button does not meet AA.** Its text renders at 13.2px, weight
500 — measured, not assumed — so the large-text exemption does not apply. Gold
is the brand, and white-on-gold is the most-used component on the site.

**The focus ring is fixed.** It was `--gold-lt` (1.89:1) on most pages and
`--gold` (2.74:1) on the five sign-in pages — both under the 3:1 an interface
element needs, and the sign-in pages are exactly where a keyboard user most
needs to see where they are. All 24 rules now use a new `--focus` role token
set to `#7A6558`, **5.48:1**. That colour was already in the palette, so
nothing new was introduced, and the brand gold was not touched.

**Nicholas decided on 6 October to leave the gold as it is for now.** That is a
deliberate, informed choice, recorded here so it is not re-opened by accident.
The alternatives remain available, in increasing order of disruption:

1. Darken only the focus ring — no brand impact at all.
2. Keep gold for large display type and backgrounds, introduce a darker
   `--gold-ink` for small gold text — brand intact, the eye barely notices.
3. Darken `--gold` itself — passes everywhere, changes the whole site.

Nothing about the gold has been changed. It is recorded so the choice stays
informed — and so that anyone who later wonders why the button is 2.74:1 finds
the answer rather than "fixing" it unasked.

---

## 9. Not yet decided

- **The contrast question in §8.** Nothing moves until it is answered.
- Whether the auth pages' alternative palette was ever an intention, or drift.
  Until that is answered, deleting those blocks is safe but changing the
  rendered colours is not.
- A spacing scale. Padding is currently chosen per page; there are no `--space`
  tokens.
- Dark mode. Nothing on the site declares one, and `color-scheme` is unset.

---

## 10. Where this could go next

Our tokens are named for **what they are** — `--gold`, `--cream` — not for
**what they are for**. Google's Material 3 separates these into tiers: a
reference tier holding raw values, a system tier naming roles, and a component
tier pointing at roles.

That distinction is not academic here. The blue-star bug happened because there
was no role to reach for: a rule needed "the colour an icon should be" and the
only thing available was a colour named after itself, so the author left it out
and the browser filled the gap. A role layer would look like:

```
--gold: #B8976A;            /* reference — what it is */
--icon-colour: var(--gold); /* role — what it is for  */
```

The lesson worth taking from the best-documented systems — Shopify's Polaris
among them — is that they explain **when and why** to use something, not only
what it looks like. That is what §5 and §6 here try to do, and why §7 records
exceptions rather than hiding them.

This is a suggestion for later, not work in progress. One tier is working
adequately for a site this size.
