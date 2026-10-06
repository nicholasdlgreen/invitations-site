# Working on this site

Read this before changing anything. It is short on purpose; the detail lives in
`docs/`.

## The references

| File | What it governs |
|---|---|
| `docs/BRAND.md` | **How the site looks and sounds.** Colour, type, shape, components, voice. Read it before building or restyling any page. |
| `docs/PRICING.md` | How pricing works. Read before touching prices, margins or rates. |
| `docs/STATUS.md` | What is done, what is outstanding, what blocks launch. |
| `BRAND-IMAGERY-GUIDE.md` | Generating product photography. |
| `docs/ARTWORK-SPEC.md` | Press-file geometry. |

**If you change how the site looks, change `docs/BRAND.md` in the same commit.**
The same rule `docs/PRICING.md` already carries. A guideline nobody updates
becomes a guideline nobody trusts.

## Design rules that are easy to get wrong

These are the ones that have actually caused bugs. `docs/BRAND.md` explains why.

- **Always `var(--token)`, never a hex literal.** The palette is written down
  once, in `header.html`.
- **Never leave a colour to be inherited inside a link.** The home page's pod
  icons rendered in the browser's default blue for a year because a rule set a
  size but no colour. Nobody chose blue — it was the absence of a choice.
- **Serif (Cormorant Garamond) for display, sans (Jost) for everything else.**
- **Sentence case for form labels.** Not uppercase with tracking.
- **No placeholder text that repeats the label.** It makes an empty field look
  filled. Format hints go beside the label, in `--pale`.
- **`novalidate` on any form you validate yourself**, or the browser's own
  validation swallows the submit and your styled errors never run.
- **The brand is `foreverprint`** — lowercase f, outside body prose.
- **Focus rings use `var(--focus, var(--soft))`** — never gold. Gold was 2.74:1
  and pale gold 1.89:1, both under the 3:1 an interface element needs.
- **Page titles use `var(--text-h1)` at weight 400.** Heroes are a separate role
  and keep their own larger scale.
- **The primary button is below WCAG AA (2.74:1) and that is a known, accepted
  decision** — Nicholas chose on 6 Oct to leave the gold alone. See
  `docs/BRAND.md` §8. Do not "fix" it on your own initiative.

## How the pages are built

- `header.html` and `footer.html` are fetched by each page **at runtime** and
  dropped into the body. (`tools/build_pages.py` does something different — it
  pre-renders the product pages.) Because they land in the body and each page's
  own `:root` is in the head, the shared tokens win the cascade.
- **A token used in page CSS needs a fallback**: write
  `var(--token, var(--local))`, not `var(--token)`. Browsers cache
  `header.html`, so after a deploy a visitor can run old tokens against new CSS,
  and a bare `var()` that misses resolves to `currentColor`.
- **Anything you add to a single page's header or footer area is overwritten on
  the next deploy.** A one-line change there lands on 53 pages. Check the diff
  before committing; this has gone wrong twice.
- `header.html` holds the only `:root` block that takes effect. Nine pages
  declare their own and are silently overridden — see `docs/BRAND.md` §7a.

## How we work

- **Review first, then build.** Show findings or options and wait, rather than
  changing things and reporting afterwards. This is a live commercial site.
- **Propose wording; never ship copy that has not been agreed.** Use Nicholas's
  words verbatim when he gives them.
- **Never change the structure of a page to work around a problem** — for
  example the number of steps in the order flow. Read terse corrections
  narrowly: fix what was asked, flag the rest.
- **Commit when asked. Never push.** Pushing deploys to the live site; that is
  Nicholas's to do.

## Testing

- There is **no node** locally. JavaScript tests run under `jsc`:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc`
- Python tests are plain `python3 tools/test-*.py`, each printing
  `N passed, M failed`.
- **Verify in a browser, not by reading the source.** The preview is
  `preview_start` with name `invitations-site`, after `python3
  tools/preview-sync.py`. Several real bugs were invisible in the source and
  obvious in the rendered page — the blue icons, the swallowed form submit, the
  overridden palettes.
- **Mutation-test every new test**: put the bug back, confirm the test fails,
  restore. Tests that pass by coincidence have slipped through here before.

## Design and brand tests

| Test | Guards |
|---|---|
| `tools/test-brand-doc.py` | `docs/BRAND.md` still matches `header.html`; contrast figures recomputed |
| `tools/test-path-icon-colour.py` | Pod icons state a colour and use the gold token |
| `tools/test-focus-and-headings.py` | Focus rings clear 3:1; page titles share one size |
