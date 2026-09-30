# The daily check

Two halves, because two different things go wrong.

## 1. The data — `tools/check-live.py`

```bash
python3 tools/check-live.py
```

Reads the live site through the publishable key and the same `pricing_for` RPC
the shop uses, so a pass means a customer can reach it, not that a row exists
somewhere an admin can see. About 40 seconds, 5,250 checks, exit 1 on any
failure — so it can sit in a cron or a build without anyone reading it.

It asserts, for all 22 products:

- every one of the six studio boxes has chips in it
- no colour bundle names a colour its palette lacks
- no chip sells a foil, promises a photograph or asks for lettering
- every swatch has a colour, so none render grey
- every prompt template has the new placeholders, none of the old ones, and
  still ends with the no-lettering rule
- every paper the product offers has a real rate — **a paper without one does
  not fail loudly, the page invents a price**
- every range shown has a priced paper behind it
- every price is a positive number, for a size the product actually sells
- every landing page and order page returns 200 with no raw `{placeholder}`

Useful flags: `--product <slug>`, `--quiet`, `--skip-pages`, and:

```bash
python3 tools/check-live.py --self-test
```

which breaks twelve things in a copy of the live data and asserts each check
notices. A checker that has never failed is one nobody should trust.

## 2. The page — `tools/check-live-browser.js`

The data check cannot see what the page does with correct data. The fault that
hid Luxury and Eco for five days was exactly that: the data was right and
arrived late, the step drew without it and latched. Nothing readable over HTTP
was wrong.

Paste the file into the console on a **live** page, with the cache disabled —
the fault only appears on a cold load.

```js
FP.fakeDesign('christmas-cards')     // then reload the URL it prints
FP.check({ slug:'christmas-cards', ranges:['signature','luxury','kinder'] })
```

Use the ranges `check-live.py` reported for that product. On the studio page:

```js
FP.checkStudio({ slug:'christmas-cards' })
```

Both return `{checks, fails, passed}`.

Verified against a copy of the page with the fix reverted: it reports the range
step missing and all three ranges unreachable. Verified against the fixed page:
11 checks, no failures.

## What neither half covers yet

- Checkout. Nothing here creates a Stripe session or proves a card can be taken.
- Email. Nothing proves Resend still sends the five order emails.
- The uploader and the press-file build.
- Anything about how it looks.

Those are the next ones worth adding, roughly in that order, and all of them
matter more once the shop is taking money.

## Running the site locally

The preview server is sandboxed: it may read the temp tree and never the repo.
So the pages it serves are a copy, and that copy has to be refreshed.

```bash
python3 tools/preview-sync.py
```

Then start the dev server (`invitations-site` in `.claude/launch.json`). Run the
sync again after editing anything you want to see — it copies only what a
browser fetches, so the 121MB repo becomes about 15MB and a re-run touches only
what changed.

This lives at a path derived from the project rather than the session, which is
what broke before: the old config pointed into a session scratchpad that is
wiped between sessions, so the dev server failed to start every time a new one
began.
