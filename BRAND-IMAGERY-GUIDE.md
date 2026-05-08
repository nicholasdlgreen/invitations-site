[BRAND-IMAGERY-GUIDE (1).md](https://github.com/user-attachments/files/27530214/BRAND-IMAGERY-GUIDE.1.md)
# Foreverprint — Product Imagery Brand Guide

A reference for generating consistent product placeholder imagery. Use this
to ensure new product images stay in the same visual family.

---

## Generation tool

- **Tool**: Google Nano Banana (Gemini 2.5 Flash Image), accessed via Google AI Studio
- **Cost**: ~£0.03 per image; free tier available
- **License**: Outputs are owned by user; commercial use permitted for marketing/hero imagery on the site
- **Note**: Outputs include invisible SynthID watermark — does not affect web display or print quality

---

## Visual language — the constants

These elements appear in EVERY image to maintain brand coherence:

| Element | Specification |
|---|---|
| **Style** | Editorial flat-lay product photography |
| **Camera angle** | Directly overhead (90°) |
| **Lighting** | Soft natural daylight, often side-lit with subtle shadows for depth |
| **Quality bar** | Premium wedding stationery, fine art photography |
| **Card composition** | Centered, with foliage framing on multiple sides |
| **Visible texture** | Paper texture on cards, linen/textile on backgrounds |
| **Atmosphere** | Refined editorial composition, never cluttered |

---

## Brand colour palette

| Colour | Hex (approximate) | Use |
|---|---|---|
| Cream | `#FAF7F2` | Card stock, backgrounds |
| Warm ivory | `#F4EFE8` | Alternative background (Order of Service) |
| Sage green | `#A8C4B8` | Eucalyptus, olive leaves |
| Gold | `#B8976A` | Monograms, accent type, wax seals |
| Espresso | `#3D2E24` | Body text on cards |
| Soft brown | `#7A6558` | Secondary text |
| Dusty pink | `#D4A5A5` | Roses (Wedding Invitations only) |
| Pure white | `#FFFFFF` | Roses (Order of Service only) |

---

## Typography on cards (consistent hierarchy)

The card design follows the same template across products:

1. **Monogram emblem** at top — 2 letters with botanical wreath (e.g. `E&T`), in gold
2. **Descriptive line** in small italic serif — "Together with their families" / "Save the Date" / "Order of Service"
3. **Names** as the focal text in large refined serif
4. **Date** in regular serif: "Saturday, the Fourteenth of September, Two Thousand and Twenty-Four"
5. **Venue** in smaller regular serif
6. **Footer line** in small italic: "A reception to follow" / "Invitation to follow" / "A celebration of marriage"

---

## Product differentiation matrix

This is the core reference. New products should follow the same logic — pick a unique combination of format + florals + props + mood.

| Aspect | Wedding Invitation | Save the Date | Order of Service |
|---|---|---|---|
| **Format** | A5 portrait card | 5×7 landscape postcard | 5×5 square folded booklet |
| **Hero element** | Names | Date (large gold numerals) | Names + monogram |
| **Florals** | Eucalyptus, dusty pink roses, white wax flowers | Eucalyptus, lavender, ivy, dusty pink rose buds | Olive leaves, rosemary, white garden roses |
| **Signature prop** | None (central composition) | Wax-sealed cream envelope | Ivory candle (unlit) + cream silk satin ribbon |
| **Background** | Cream paper | Cream linen | Warm ivory linen |
| **Mood** | Formal romantic | Relaxed intimate | Quiet ceremonial |
| **Lighting style** | Even overhead | Side-lit warm | Side-lit, slightly more solemn |
| **Placeholder names** | Eleanor & Thomas | Charlotte & George | Florence & William |
| **Date shown** | 14 September 2024 | 7 June 2025 | 14 September 2024 |
| **Venue shown** | Cotswold Manor, Oxfordshire | Cotswold Manor, Oxfordshire | St. Mary's Church, Cotswold |

---

## Reusable prompt template

For any new product, use this structure and fill in the bracketed placeholders:

```
Editorial flat-lay product photography of [PRODUCT FORMAT — e.g. "an A5 portrait
card" / "a small landscape postcard" / "a folded square booklet"] on [BACKGROUND
— e.g. "cream textured paper" / "warm ivory linen background"]. The card
features [CARD CONTENT — typography hierarchy from top to bottom, including
monogram, descriptive line, names, date, venue, footer]. The composition
includes [FLORALS — sage-family foliage selection] and [SIGNATURE PROP — optional
distinguishing element to differentiate from existing products]. Soft natural
daylight [LIGHTING DETAIL — "from above" / "from the side creating gentle
shadows"], premium wedding stationery style, refined editorial composition with
[MOOD — "quiet solemnity" / "relaxed intimacy" / "formal romance"], fine art
photography quality with subtle paper texture visible.
```

---

## Format conventions for future products

When adding a new product, choose a format that visually distinguishes it from
the existing set:

| Product type | Suggested format |
|---|---|
| Menus | Small portrait card OR landscape (depending on style) |
| Place cards | Small folded tent card (showing the fold) |
| Table numbers | Small square card on stand (3D presentation) |
| RSVP cards | Smaller portrait card with a stamp |
| Info / Direction cards | Small portrait card alongside the invitation suite |
| Welcome signs | Large landscape "displayed" on an easel, in context |
| Seating charts | Large landscape, photographed on display |
| Thank you cards | Small portrait or square card with envelope |

---

## Florals palette by product mood

When choosing florals for new products, pick a combination that signals the
right mood — but stays within the sage/cream/dusty-pink/white family:

| Mood | Floral selection |
|---|---|
| **Formal romantic** (e.g. invitations) | Eucalyptus + dusty pink roses + white wax flowers |
| **Relaxed intimate** (e.g. save the dates, RSVPs) | Eucalyptus + lavender + ivy + rose buds |
| **Ceremonial / sacred** (e.g. order of service, blessings) | Olive leaves + rosemary + white garden roses |
| **Modern minimal** (e.g. minimalist menus, place cards) | Single sprig (eucalyptus or olive), monstera leaf |
| **Bohemian / outdoor** (e.g. festival-style menus) | Pampas grass, dried wildflowers, dried palm |
| **Garden / spring wedding** | Wisteria, sweet peas, hellebores, mixed greens |

---

## Names already used (avoid repetition)

To keep variety across the suite, these names have been used:

- **Eleanor & Thomas** — Wedding Invitations
- **Charlotte & George** — Save the Dates
- **Florence & William** — Order of Service

**Suggested unused names** from the same classic British register for future
products:

Sophie & Oliver · Isabella & Henry · Beatrice & Edward · Eleanor & James ·
Olivia & Edward · Amelia & Hugo · Phoebe & Theodore · Matilda & Charles ·
Harriet & Frederick · Cecilia & Arthur · Genevieve & Rupert

---

## Technical specs

| Item | Spec |
|---|---|
| Source dimensions | 2816 × 1536 (Nano Banana default wide ratio) |
| Output dimensions | 1600 × 1280 (5:4 ratio, centred crop) |
| Format | JPEG, quality 85 |
| Target file size | ~400–500 KB |
| Naming convention | `{product-slug}-card.jpg` (lowercase, hyphenated) |
| Storage location | GitHub repo root |
| URL pattern in admin | `/{product-slug}-card.jpg` (with leading slash) |

---

## Quality checklist before deploying

For each generated image, confirm:

- [ ] Text on the card is legible and reads correctly (AI sometimes mangles text — regenerate if so)
- [ ] No weird artifacts (twisted leaves, asymmetric flowers, distorted props)
- [ ] Composition is balanced — props not cropped awkwardly at edges
- [ ] Lighting matches existing images (consistent warm tone)
- [ ] Colour palette stays in cream / sage / gold family
- [ ] Format clearly communicates product type at a glance
- [ ] Mood is appropriate for product (formal / relaxed / ceremonial)
- [ ] Sparkle / diamond artifacts in corners are minimal (small one in lower-right is a recurring AI tell — acceptable but minimise)

---

## Deployment process

1. **Generate** ~10 candidates in Nano Banana per prompt
2. **Pick** the strongest based on quality checklist above
3. **Send to Claude** for processing (5:4 crop + JPG optimisation)
4. **Download** processed file from chat
5. **Upload** to GitHub repo root via "Add file → Upload files → drag → commit"
6. **Set URL** in admin: Product Types → [Product] → `hero_image_url` = `/{filename}.jpg`
7. **Hard refresh** the product landing page (Cmd/Ctrl+Shift+R) to verify

---

## Suite tracker — current state

(Update this table as new products are added.)

| Product | Filename | Status |
|---|---|---|
| Wedding Invitations | `wedding-invitations-card.jpg` | ✓ Live |
| Save the Dates | `save-the-dates-card.jpg` | Pending deployment |
| Order of Service | `order-of-service-card.jpg` | Pending deployment |

---

## When to revise this guide

This document should be updated when:

- A new product is added to the catalogue (extend the differentiation matrix)
- The brand palette or typography evolves
- A better generation tool replaces Nano Banana
- Real product photography replaces placeholders (then this becomes a guide for
  the photographer instead)

Keep this file in the repo at `/BRAND-IMAGERY-GUIDE.md` so it's discoverable
and versioned alongside the code.
