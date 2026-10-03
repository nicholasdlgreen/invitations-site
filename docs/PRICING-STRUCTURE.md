# How pricing is stored, and why — 3 October 2026

The reference for setting margins. Written before restructuring the published
payload, so the shape being changed and the shape replacing it are both here.

---

## 1. The chain, end to end

```
PrintedEasy list price
   │  × 0.80            the trade discount we buy at — this is our COST
   ▼
sheet_rates / finish_rates          8,418 + 4,347 rows   ← what we pay
   │  × (1 + margin_pct/100)        margin is PER PRODUCT
   ▼
pricing_config.payload              one JSON document    ← what we charge
   │  pricing_for(slug)             cuts out one product
   ▼
the order page
```

**Every price on the site is `PrintedEasy list × 0.80 × (1 + margin)`.** At
today's 0% margin the middle and right are the same number: we sell at cost and
pass the whole trade discount to the customer.

## 2. Two things that happen between cost and sell

**Margin.** `product_types.margin_pct`, one figure per product. All 22 are at
**0** today.

**Curve flattening.** PrintedEasy's own staircase goes backwards in places —
occasionally they quote more for 50 than for 100. `noBackwardSteps` walks each
curve from the largest quantity down and clamps any rung that sits above the
one below it, so **we never quote more for fewer**. It runs separately on each
(paper, weight, size, fold, sides) curve, because flat and folded and
single- and double-sided are different curves and flattening them together
would drag one down onto another.

This is why **299 published prices sit below cost** at 0% margin. That is the
flattening working, not a fault, and it stops being a loss the moment a margin
exists.

## 3. Why the payload is 14 MB

It stores every price **once per product** rather than once per family.

| | |
|---|---|
| Source rows | **12,765** |
| Payload rows | **115,811** |
| | **9× duplication** |

`Silk · A5 · ×100` is stored **212 times** across 18 products. Among those 212
copies there are **12 distinct prices** — the real variation is weight, printed
sides and supplier family. The rest is copies.

**The duplication was deliberate.** The builder says so: margin is a product
decision, so a shared table would apply the wrong one. That reasoning is sound
and it is the thing any restructure has to answer.

## 4. The answer: store cost once, apply margin on the way out

Margin is a **multiplier**, and a multiplier can be applied when the price is
read instead of when it is written.

```
rate_sets   costs, flattened, ONE copy per supplier family
products    margin_pct, routes, which papers/sizes/finishes it offers
pricing_for reads the family's costs, filters to the product,
            multiplies by that product's margin, rounds
```

**Three things make this safe, each checked rather than assumed:**

1. **Flattening commutes with margin.** Flattening is a running minimum and
   margin is multiplication by a positive constant, so the order is preserved;
   and because rounding is monotone, `min(round(a·m), round(b·m))` equals
   `round(min(a,b)·m)`. Flattening the cost and then applying margin gives the
   same penny as today.
2. **Quantity sets do not vary by product.** `quantity_ladder` is **not used**
   when building the payload — rows are filtered by paper, size, weight, sides
   and route, never by quantity. So every product sharing a family sees the same
   rungs, and the flattened curve is identical for all of them.
3. **Only two things are genuinely per product**: the margin, and `rt`, the
   index into that product's own `routes` array. Both stay with the product.

**Expected result: 14 MB → about 1.5 MB.**

## 5. Why this matters for setting margins specifically

**Today, changing one product's margin means rebuilding and rewriting the whole
14 MB document.** Every one of the 78,431 sheet prices is recomputed because the
margin is baked into each stored price.

After the change, a margin is a **single number on one product**. Nothing is
recomputed and nothing is rewritten — the multiplication happens when a page
asks for a price.

So the restructure is not only a size fix. It turns margin-setting from a full
republish into an edit, which is exactly what you want while you are still
deciding what the margins should be.

## 6. What to watch when margins are set

- **Delivery is a subtraction from margin.** PrintedEasy's quoted price
  **excludes** carriage and our standard delivery is free, so every order
  currently absorbs their delivery charge. **What that charge is has not been
  established.** It has to be, before a margin means anything.
- **The 299 below-cost prices** disappear on their own once margin > 0.
- **Margin is per product, not per paper.** A product carrying both Silk and
  Fedrigoni stock applies one figure to both, so a margin chosen for the cheap
  end is also the margin on the expensive end.
- **Foiling and the other finishes carry the same margin** as the product.

## 7. What is NOT in this chain

- **VAT.** PrintedEasy apply it inconsistently by product — added on postcards,
  not on greeting cards. Recorded in the cost-base notes, unresolved.
- **Delivery.** Priced separately in `delivery_options`, not through this chain.
