#!/usr/bin/env python3
"""
Build a real HTML page for every product, and the sitemap to match.

Why this exists
---------------
product.html is a single template that fills itself in from Supabase once the
browser runs its JavaScript. That works for people, but the HTML that leaves
the server says "Wedding Invitations" for all twenty-odd products. Anything
that reads a page without running scripts sees the wrong thing:

  * link previews on WhatsApp, Facebook, LinkedIn and Slack
  * Google's first crawl, before the slower rendering pass
  * crawlers that never render at all

Google's own guidance: "server-side or pre-rendering is still a great idea
because it makes your website faster for users and crawlers, and not all bots
can run JavaScript."

So at deploy time we write one file per product with its own title,
description, canonical, social tags, heading and Product structured data
already in place. The page's JavaScript still runs and sets the same values,
so nothing downstream changes — it simply no longer has to.

Safety
------
If Supabase cannot be reached, this exits 0 without touching anything. The
previously generated files are committed to the repo, so a failed build
publishes the last good pages rather than breaking the site.

Run locally with:  python3 tools/build_pages.py
"""

import json
import os
import re
import sys
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://foreverprint.com"
TEMPLATE = os.path.join(ROOT, "product.html")

# Static pages that belong in the sitemap alongside the generated ones.
CORE_PAGES = [
    ("/", "1.0", "weekly"),
    ("/products", "0.9", "weekly"),
    ("/upload-and-print.html", "0.9", "weekly"),
    ("/design-studio", "0.8", "weekly"),
    ("/how-it-works", "0.6", "monthly"),
    ("/delivery.html", "0.5", "monthly"),
    ("/track-order", "0.4", "monthly"),
    ("/returns.html", "0.3", "yearly"),
    ("/privacy.html", "0.2", "yearly"),
    ("/terms.html", "0.2", "yearly"),
]


def log(msg):
    print("[build-pages] " + msg)


def read_supabase_config():
    """Take the URL and anon key from the file the browser already uses, so
    there is only ever one copy of them."""
    cfg = os.path.join(ROOT, "supabase-config.js")
    try:
        src = open(cfg, encoding="utf-8").read()
    except OSError:
        return None, None
    url = re.search(r"url\s*:\s*['\"]([^'\"]+)", src)
    key = re.search(r"anonKey\s*:\s*['\"]([^'\"]+)", src)
    return (url.group(1) if url else None), (key.group(1) if key else None)


def fetch(url, key, path):
    req = urllib.request.Request(
        url.rstrip("/") + path,
        headers={"apikey": key, "Authorization": "Bearer " + key},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def esc(text):
    """Escape for an HTML attribute or text node."""
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def starting_price(pricing, slug):
    """Lowest published price for a product, or None. Structured data with an
    invented price is worse than structured data with no price."""
    try:
        for p in (pricing or {}).get("products", []):
            if p.get("slug") != slug:
                continue
            prices = []
            for tier in p.get("prices", []) or []:
                v = tier.get("sell") or tier.get("price")
                if isinstance(v, (int, float)) and v > 0:
                    prices.append(float(v))
            if prices:
                return min(prices)
    except Exception:
        pass
    return None


def build_page(template, product, pricing):
    slug = product["slug"]
    name = product.get("name") or slug.replace("-", " ").title()
    title = product.get("meta_title") or f"{name} | Foreverprint"
    desc = product.get("meta_description") or product.get("description") or ""
    desc = re.sub(r"\s+", " ", desc).strip()[:300]
    tagline = product.get("tagline") or ""
    url = f"{SITE}/{slug}"

    # Social previews and structured data need absolute image URLs — a
    # relative path shows no image at all when Facebook or WhatsApp fetches it.
    image = product.get("hero_image_url") or ""
    if image.startswith("/"):
        local = os.path.join(ROOT, image.lstrip("/"))
        image = SITE + image if os.path.exists(local) else ""
    elif image and not image.startswith("http"):
        image = ""

    html = template

    # 1. Title
    html = html.replace(
        "<title>Wedding Stationery | Foreverprint</title>",
        f"<title>{esc(title)}</title>",
    )

    # 2. Description
    html = html.replace(
        '<meta name="description" content="Premium UK-printed stationery. Next-day delivery available."/>',
        f'<meta name="description" content="{esc(desc)}"/>',
    )

    # 3. Canonical and social tags — the template deliberately ships without
    #    these so that a wrong value can never be served.
    head_block = (
        f'<link rel="canonical" href="{url}"/>\n'
        f'<meta property="og:title" content="{esc(title)}"/>\n'
        f'<meta property="og:description" content="{esc(desc)}"/>\n'
        f'<meta property="og:url" content="{url}"/>\n'
    )
    if image:
        head_block += f'<meta property="og:image" content="{esc(image)}"/>\n'
        head_block += '<meta name="twitter:card" content="summary_large_image"/>\n'
    html = re.sub(
        r"<!-- Canonical is set from the product slug.*?-->",
        head_block.rstrip("\n"),
        html,
        count=1,
        flags=re.S,
    )

    # 4. The visible heading
    html = html.replace(
        '<h1 class="lp-h1" id="lp-h1">Wedding Invitations</h1>',
        f'<h1 class="lp-h1" id="lp-h1">{esc(name)}</h1>',
    )

    # 5. Product structured data
    ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "url": url,
        "brand": {"@type": "Brand", "name": "Foreverprint"},
    }
    if desc:
        ld["description"] = desc
    if image:
        ld["image"] = image
    price = starting_price(pricing, slug)
    if price:
        ld["offers"] = {
            "@type": "AggregateOffer",
            "priceCurrency": "GBP",
            "lowPrice": round(price, 2),
            "availability": "https://schema.org/InStock",
            "url": url,
        }
    html = html.replace(
        '<script type="application/ld+json" id="ld-product">{}</script>',
        '<script type="application/ld+json" id="ld-product">'
        + json.dumps(ld, ensure_ascii=False)
        + "</script>",
    )

    # 6. The hero subtitle, when the product has one
    if tagline:
        html = re.sub(
            r'(<p class="lp-hero-sub" id="lp-sub">)(.*?)(</p>)',
            lambda m: m.group(1) + esc(tagline) + m.group(3),
            html,
            count=1,
            flags=re.S,
        )

    return html


def write_sitemap(slugs):
    today = date.today().isoformat()
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    def add(loc, pri, freq):
        out.extend(
            [
                "  <url>",
                f"    <loc>{SITE}{loc}</loc>",
                f"    <lastmod>{today}</lastmod>",
                f"    <changefreq>{freq}</changefreq>",
                f"    <priority>{pri}</priority>",
                "  </url>",
            ]
        )

    for loc, pri, freq in CORE_PAGES[:3]:
        add(loc, pri, freq)
    for slug in slugs:
        add("/" + slug, "0.8", "weekly")
    for loc, pri, freq in CORE_PAGES[3:]:
        add(loc, pri, freq)
    out.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(
        "\n".join(out) + "\n"
    )
    log(f"sitemap.xml: {len(slugs) + len(CORE_PAGES)} URLs")


def main():
    url, key = read_supabase_config()
    if not url or not key:
        log("no Supabase config found — leaving existing pages untouched")
        return 0

    try:
        products = fetch(
            url, key, "/rest/v1/product_types?active=eq.true&select=*&order=slug"
        )
        pricing_rows = fetch(
            url,
            key,
            "/rest/v1/pricing_config?select=payload&order=published_at.desc&limit=1",
        )
    except Exception as e:
        log(f"could not reach Supabase ({e}) — leaving existing pages untouched")
        return 0

    pricing = (pricing_rows or [{}])[0].get("payload") if pricing_rows else None

    try:
        template = open(TEMPLATE, encoding="utf-8").read()
    except OSError as e:
        log(f"cannot read product.html ({e}) — nothing written")
        return 0

    written = []
    for p in products:
        slug = (p.get("slug") or "").strip()
        # 'invitations' is a catch-all bucket, not a page we want indexed.
        if not slug or slug == "invitations":
            continue
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
            log(f"skipping unusual slug: {slug!r}")
            continue
        html = build_page(template, p, pricing)
        open(os.path.join(ROOT, slug + ".html"), "w", encoding="utf-8").write(html)
        written.append(slug)

    log(f"wrote {len(written)} product pages")
    write_sitemap(written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
