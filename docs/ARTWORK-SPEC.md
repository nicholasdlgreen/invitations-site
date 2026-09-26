# Foreverprint artwork specification

*What we accept from customers, what we do to it, and what we send to press.
Written 26 September 2026 from the live code and database, not from intention —
every figure below is the one the site actually uses.*

**This document exists to be shared with the printer.** If anything here would
cause a job to print wrong, say so and we will change the site, not the file.

---

## 1. What we send you

One **PDF per order line**, RGB, with:

- **One page per printed face.** Single sided is one page. Double sided is two,
  in the order **front, back**. A folded card is four: front, inside left,
  inside right, back.
- **3mm bleed** on every edge.
- **Crop marks** at each trim corner, 5mm clear area, drawn 3mm out from trim
  and 4mm long.
- Page size = trim + 6mm bleed + 10mm marks. An A5 card is **164 × 226mm**.

Raster content is placed at **300 DPI** where the customer's file allows it;
see §4 for what happens when it does not.

> **To confirm with PrintedEasy:** is one PDF with a page per face, in that
> order, what you want — or would you rather have one file per face?

### Colour

We send **RGB** and do not convert. A previous CMYK conversion step was removed
deliberately. The upload screen still tells customers "CMYK preferred", which
**contradicts this** and should be corrected on the site.

> **To confirm with PrintedEasy:** you receive RGB. Is that what you want, or
> should we convert to a profile you specify?

---

## 2. Sizes

Trim sizes, from `print_sizes` in the database. Bleed size is trim + 6mm.

| Size | Trim (mm) | With bleed (mm) | Pixels at 300 DPI |
|---|---|---|---|
| Business card | 85 × 55 | 91 × 61 | 1075 × 720 |
| A6 | 105 × 148 | 111 × 154 | 1311 × 1819 |
| DL | 99 × 210 | 105 × 216 | 1240 × 2551 |
| A5 | 148 × 210 | 154 × 216 | 1819 × 2551 |
| Square 148 | 148 × 148 | 154 × 154 | 1819 × 1819 |
| Square 210 | 210 × 210 | 216 × 216 | 2551 × 2551 |
| A4 | 210 × 297 | 216 × 303 | 2551 × 3579 |
| A3 | 297 × 420 | 303 × 426 | 3579 × 5031 |

Large format — A2, A1, A0 and their landscape variants — is printed at a lower
target resolution; see §4.

**A folded card's size is the finished piece**, not the flat sheet. A finished
A5 order of service is printed on a flat A4 folded in half, and we impose it.
The customer supplies artwork at the finished size and never sees the flat one.

---

## 3. What we accept from customers

| | |
|---|---|
| Formats | PDF, AI, INDD, JPG, PNG, TIF, EPS |
| Maximum size | 100MB |
| Preferred | PDF at 300 DPI with 3mm bleed |
| Colour | any; we pass RGB through |

**Vector PDFs pass through untouched.** We do not rasterise them and we do not
offer repositioning, because doing so would be a lie about a file we are not
altering.

**Raster files are placed by us** into the bleed area, using the position the
customer sets on the proof — fill or fit, zoom, rotation and pan. Each face
keeps its own position.

---

## 4. Resolution rules

Target resolution depends on viewing distance, so it varies by size:

| Longest edge | Target DPI |
|---|---|
| up to 450mm (to A3) | **300** |
| 451–900mm (A2, A1) | **200** |
| over 900mm (A0) | **150** |

The site measures **effective DPI as positioned** — after the customer's zoom
and scaling, not the file's nominal DPI — and treats it as:

- **at or above target** — fine, no comment
- **below target** — warn, "may look slightly soft", customer may continue
- **below two thirds of target** — treated as too low to print well

For an A5 card that means 300 DPI wanted, below 300 warned, **below 200
considered too low**.

> **To confirm with PrintedEasy:** is 200 DPI at A5 the right floor, or do you
> refuse below some other figure? We would rather match your threshold than
> invent one.

---

## 5. Safe zone

The proof shows a **5mm safe zone** inside the trim. Anything closer to the
edge risks being cut. This is advisory — we do not block on it.

> **To confirm with PrintedEasy:** is 5mm the right margin for your guillotine
> tolerance on these stocks?

---

## 6. Wrong-size artwork — the rules we apply

Sizes are checked per face with a **2mm tolerance**, and a file supplied
rotated 90° is accepted as-is.

| What the customer supplied | What we do |
|---|---|
| Trim size + 6mm | Accept — correct, with bleed |
| Exactly trim size | Accept — **we add the bleed** by extending the artwork |
| Same proportions, different size, enough resolution | **Scale it to fit** and say the resulting DPI |
| Same proportions, too few pixels | Refuse, and tell them the minimum pixel size |
| Different proportions | Offer **fill** (crops) or **fit** (leaves a border) and show both on the proof |

**Bleed we add ourselves is extended artwork, not white.** A customer supplying
exactly 148 × 210mm gets their design scaled very slightly to cover 154 × 216mm.

> **To confirm with PrintedEasy:** where a customer gives us no bleed, is
> scaling up by 4% to create it acceptable to you, or would you rather receive
> the file at trim and handle it your end?

---

## 7. Double-sided

- The customer supplies **one file per face**, or one multi-page PDF which we
  split in face order.
- **Every face is checked** for size and bleed independently, and the order
  cannot proceed until all faces pass.
- **Each face carries its own position** into the press file.
- Page order in the PDF is front, then back.

> **To confirm with PrintedEasy:** for a double-sided job, do you want the back
> supplied the same way up as the front (head to head), or rotated (head to
> foot)? We currently send both faces the same way up.

---

## 8. What we never do

- **We never alter the customer's design** beyond scaling, rotating and
  positioning it as they direct on the proof.
- **We never convert colour.**
- **We never proof digitally for approval.** The on-screen proof is a check, not
  a contract, and nothing on the site calls it a proof to the customer.

---

## 9. Open questions for PrintedEasy

Collected from the sections above:

1. One PDF with a page per face, or one file per face?
2. RGB accepted, or convert to a profile you name?
3. What is your real minimum resolution at each size?
4. Is 5mm the right safe margin for your trimming?
5. Is scaling up 4% to create missing bleed acceptable?
6. Head to head or head to foot for double-sided?

---

## 10. Where these rules live in the code

| Rule | Where |
|---|---|
| Bleed, marks, target DPI | `PRINT_DPI`, `PRINT_BLEED_MM`, `PRINT_MARKS_MM` in `upload-and-print.html` |
| Sizes | `print_sizes` table, with `SIZE_SPECS` as a fallback |
| DPI by size | `printDpiFor()` |
| Per-face size check | `checkFace()` |
| Press file | `buildPrintReadyPdf()`, `buildPressFileForAllFaces()` |
| Safe zone and guides | `drawProofGuides()` |

Change a rule here and change it there in the same commit.
