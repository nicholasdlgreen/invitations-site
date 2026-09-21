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

    # 6. The hero image, in the markup and already the right size.
    #    Measured before this change: the browser could not even ASK for the
    #    hero until the product data came back — it started at 1441ms and
    #    finished at 2066ms, and it was a 1600px, 218KB JPEG being shown on a
    #    375px phone. In the HTML with a preload, it starts with the page; via
    #    Netlify's image service the same picture is about 26KB of WebP.
    if image:
        rel = image.replace(SITE, "")
        def cdn(w):
            return f"/.netlify/images?url={rel}&amp;w={w}&amp;fm=webp&amp;q=75"
        img_tag = (
            f'<img class="lp-hero-img" data-prerendered src="{cdn(800)}" '
            f'srcset="{cdn(400)} 400w, {cdn(800)} 800w, {cdn(1200)} 1200w" '
            f'sizes="(max-width: 768px) 92vw, 44vw" '
            f'alt="{esc(name)}" width="800" height="644" '
            f'fetchpriority="high" decoding="async"/>'
        )
        html = html.replace(
            '<div id="lp-hero-img-wrap"></div>',
            f'<div id="lp-hero-img-wrap">{img_tag}</div>',
        )
        # Tell the browser about it before it reaches the markup.
        html = html.replace(
            '<link rel="preconnect" href="https://jvcpzmumkyjdyibmwlsd.supabase.co" crossorigin/>',
            f'<link rel="preload" as="image" href="{cdn(800)}" '
            f'imagesrcset="{cdn(400)} 400w, {cdn(800)} 800w, {cdn(1200)} 1200w" '
            f'imagesizes="(max-width: 768px) 92vw, 44vw"/>\n'
            '<link rel="preconnect" href="https://jvcpzmumkyjdyibmwlsd.supabase.co" crossorigin/>',
        )

    # 7. The product's own words, when it has any.
    #
    #    intro_long, buyer_guide and faqs have existed as fields for a while and
    #    three products already had them written — but nothing ever read them,
    #    so every page fell back to the template's generic copy. That is why the
    #    twenty product pages measured 95% identical: the only per-product text
    #    the page could show was the name and the tagline.
    #
    #    Anything a product does not have simply keeps the generic version, so
    #    this fills in page by page as the copy gets written.
    intro = (product.get("intro_long") or "").strip()
    guide = (product.get("buyer_guide") or "").strip()
    if intro or guide:
        # Use the product name exactly as stored. Lower-casing the first
        # letter turned "Save the Date" into "save the Date", and any rule
        # clever enough to fix that would also ruin "RSVP Cards".
        heading = esc(name) if name else "this"
        parts = ['<section class="lp-section lp-section-white">', '<div class="container">',
                 '<div class="lp-intro-wrap">']
        if intro:
            parts.append(f'<p class="lp-intro-lead">{esc(intro)}</p>')
        if guide:
            parts.append(f'<h2 class="lp-section-h2">Choosing your <em>{heading}</em></h2>')
            parts.append('<div class="lp-section-divider"></div>')
            parts.append(f'<p class="lp-intro-body">{esc(guide)}</p>')
        parts += ['</div>', '</div>', '</section>']
        html = html.replace("<!--LP_INTRO-->", "\n".join(parts), 1)

    # 8. The product's own FAQs, replacing the generic five. The visible list
    #    and the FAQPage structured data are built from the same source, because
    #    schema that does not match what the reader can see is a violation.
    faqs = product.get("faqs") or []
    if isinstance(faqs, list) and faqs:
        items = []
        for f in faqs:
            q = (f.get("q") or "").strip()
            a = (f.get("a") or "").strip()
            if not q or not a:
                continue
            items.append(
                '<details class="lp-faq-item">'
                f'<summary class="lp-faq-q"><span class="lp-faq-q-text">{esc(q)}</span>'
                '<span class="lp-faq-toggle">+</span></summary>'
                f'<div class="lp-faq-a">{esc(a)}</div></details>'
            )
        if items:
            start = html.find("<!--LP_FAQ_START-->")
            end = html.find("<!--LP_FAQ_END-->")
            if start != -1 and end != -1 and end > start:
                html = (html[:start] + "\n".join(items)
                        + html[end + len("<!--LP_FAQ_END-->"):])
            ld_faq = {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": (f.get("q") or "").strip(),
                     "acceptedAnswer": {"@type": "Answer", "text": (f.get("a") or "").strip()}}
                    for f in faqs if (f.get("q") or "").strip() and (f.get("a") or "").strip()
                ],
            }
            html = re.sub(
                r'(?s)(<script type="application/ld\+json" id="ld-faq">).*?(</script>)',
                lambda m: m.group(1) + json.dumps(ld_faq, ensure_ascii=False) + m.group(2),
                html, count=1,
            )

    # 7. The hero subtitle, when the product has one
    if tagline:
        html = re.sub(
            r'(<p class="lp-hero-sub" id="lp-sub">)(.*?)(</p>)',
            lambda m: m.group(1) + esc(tagline) + m.group(3),
            html,
            count=1,
            flags=re.S,
        )

    return html


# Pages that keep their own navigation or have none.
CHROME_SKIP = {"header.html", "footer.html", "admin.html"}


def inline_chrome():
    """Put the header and footer into every page's HTML.

    Until now both were fetched by JavaScript and injected after load. Two
    consequences, both bad:

      * A product page's HTML contained ONE internal link. Everything else —
        all 21 products, the studio, the footer — existed only after scripts
        ran. Internal links are how search engines discover pages and judge
        which matter, so the site looked like a shop with no aisles.
      * Scripts inside injected HTML never execute. The mobile menu button
        calls toggleMobileNav, which is defined in header.html and was
        therefore never defined at all — the burger menu did nothing on any
        page. Verified undefined on the live site before this change.

    The fetch stays as a fallback and is made null-safe, so if this step ever
    fails the site behaves exactly as it did before.
    """
    try:
        header = open(os.path.join(ROOT, "header.html"), encoding="utf-8").read().strip()
        footer = open(os.path.join(ROOT, "footer.html"), encoding="utf-8").read().strip()
    except OSError as e:
        log(f"could not read header/footer ({e}) — navigation left as it was")
        return

    done = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".html") or name in CHROME_SKIP:
            continue
        path = os.path.join(ROOT, name)
        try:
            html = open(path, encoding="utf-8").read()
        except OSError:
            continue
        before = html

        # Placeholders come in three shapes across the site: a div, a
        # <header>/<footer> element, and one with an inline style. Match the
        # shape rather than the exact string, so a page is never quietly
        # skipped and left with no navigation in its markup.
        def swap(kind, markup, page):
            return re.sub(
                r'<(div|%s)\s+id="site-%s"[^>]*>\s*</\1>' % (kind, kind),
                lambda m: markup,
                page,
                count=1,
            )

        html = swap("header", header, html)
        html = swap("footer", footer, html)

        # The injector now finds nothing to replace. Make that harmless rather
        # than a null reference error — spacing varies from page to page, so
        # this matches the shape rather than an exact string.
        html = re.sub(
            r"document\.getElementById\(\s*'site-(header|footer)'\s*\)\s*\.\s*(outerHTML|innerHTML)\s*=\s*html\s*;",
            lambda m: "var __c=document.getElementById('site-%s'); if(__c) __c.%s=html;" % (m.group(1), m.group(2)),
            html,
        )

        if html != before:
            open(path, "w", encoding="utf-8").write(html)
            done += 1
    log(f"navigation written into {done} pages")


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
    inline_chrome()
    write_sitemap(written)
    return 0


if __name__ == "__main__":
    sys.exit(main())
