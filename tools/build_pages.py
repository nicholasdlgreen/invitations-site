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


def link_products(text, products, self_slug):
    """Link the first mention of each other product, once, in a single pass.

    The copy names place cards, table numbers and the table plan because that
    is how couples talk about them — but naming a product without linking it
    wastes the strongest on-site signal there is. Links spread authority across
    the twenty pages and give search engines one topic cluster instead of
    twenty islands.

    Done in ONE pass over the original text rather than a substitution per
    product. Running them in sequence meant a later name could match inside a
    link already written, which produced
    <a href="/wedding-<a href="/invitations">invitations</a>">.
    """
    candidates = []
    self_name = ""
    for p in products:
        slug = (p.get("slug") or "").strip()
        name = (p.get("name") or "").strip()
        if slug == self_slug:
            self_name = name
            continue
        # 'invitations' is the catch-all bucket and never gets a page built,
        # so a link to it would be a 404.
        if not slug or not name or slug == "invitations":
            continue
        candidates.append((name, slug))
    if not candidates:
        return text

    # The page's own name goes into the pattern too, matched but never linked.
    # Without it, "Party Invitations" matched inside "Engagement Party
    # Invitations" and the page linked its own name to a different product.
    # Longest first, so the longer name always wins at a given position.
    matchable = list(candidates)
    if self_name:
        matchable.append((self_name, None))
    matchable.sort(key=lambda c: len(c[0]), reverse=True)
    lookup = {name.lower(): slug for name, slug in matchable}
    pattern = re.compile(
        r"(?<!\w)(" + "|".join(re.escape(n) for n, _ in matchable) + r")(s?)(?!\w)",
        re.I,
    )

    linked = set()

    def sub(m):
        slug = lookup.get(m.group(1).lower())
        if not slug or slug in linked:
            return m.group(0)
        linked.add(slug)
        return f'<a href="/{slug}">{m.group(1)}{m.group(2)}</a>'

    return pattern.sub(sub, text)


def build_page(template, product, pricing, all_products=()):
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
    # The buying guide, given the same section grammar as everything else on
    # the page: eyebrow label, centred heading, divider, then a readable
    # column. It sits between "From design to doorstep" and the FAQs, which
    # are both cream, so a white section separates them — and it puts the
    # reading next to the other reading rather than between the hero and the
    # price, where it interrupted the buying decision.
    #
    # intro_long is deliberately NOT rendered. The hero paragraph already
    # says what the product is, beside the photograph where it belongs, and
    # having both meant the same point twice within a screen of each other.
    guide = (product.get("buyer_guide") or "").strip()
    if guide:
        parts = [
            '<section class="lp-section lp-section-white">',
            '<div class="container">',
            '<span class="lp-section-tag">Choosing yours</span>',
            f'<h2 class="lp-section-h2">Choosing your <em>{esc(name)}</em></h2>',
            '<div class="lp-section-divider"></div>',
            '<div class="lp-intro-wrap">',
            f'<p class="lp-intro-body">{link_products(esc(guide), all_products, slug)}</p>',
            '</div>', '</div>', '</section>',
        ]
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
def build_guide(template, guide, products):
    """Render one guide article to /guides/<slug>.

    Guides exist because product pages do not earn links — nobody links to a
    menu cards page. Timelines, wording templates and checklists do get cited,
    and the internal links from a guide then pass that authority on to the
    pages that actually sell.
    """
    slug = guide["slug"]
    title = (guide.get("meta_title") or "").strip() or f'{guide["title"]} | Foreverprint'
    desc = re.sub(r"\s+", " ", (guide.get("meta_description") or "").strip())[:300]
    url = f"{SITE}/guides/{slug}"
    by_slug = {p.get("slug"): p for p in products if p.get("slug")}

    html = template
    html = html.replace("{{TITLE}}", esc(title))
    html = html.replace("{{DESC}}", esc(desc))
    html = html.replace("{{URL}}", esc(url))
    html = html.replace("{{H1}}", esc(guide["title"]))

    # A banner photograph. Falls back to the first related product's hero, so
    # a guide never ships as a wall of prose just because nobody set one.
    banner = (guide.get("hero_image") or "").strip()
    if not banner:
        for ps in guide.get("related_products") or []:
            prod = by_slug.get(ps)
            if prod and (prod.get("hero_image_url") or "").strip():
                banner = prod["hero_image_url"].strip()
                break
    if banner:
        def cdn(w):
            return f"/.netlify/images?url={banner}&amp;w={w}&amp;fm=webp&amp;q=75"
        html = html.replace("{{BANNER}}",
            '<div class="gd-banner">'
            f'<img src="{cdn(1200)}" srcset="{cdn(600)} 600w, {cdn(1200)} 1200w, {cdn(1800)} 1800w" '
            'sizes="100vw" alt="" width="1200" height="380" fetchpriority="high" decoding="async" '
            # The image service is a resize proxy, not the source of truth. If
            # it is unavailable — or we are running the site locally, where it
            # does not exist — fall back to the original file rather than
            # showing a broken banner.
            f'onerror="this.onerror=null;this.removeAttribute(\'srcset\');this.src=\'{banner}\';"/>'
            "</div>")
    else:
        html = html.replace("{{BANNER}}", "")

    intro = (guide.get("intro") or "").strip()
    html = html.replace("{{INTRO}}",
                        f'<p class="gd-intro">{esc(intro)}</p>' if intro else "")

    # Body. Product names in the prose become links, using the same one-pass
    # linker the product pages use, so a guide feeds the pages it mentions.
    def paras(text):
        """Blank line starts a paragraph; a single newline is a line break
        within one. Example wording is written line by line and would
        otherwise collapse into run-on prose."""
        for para in [p for p in re.split(r"\n\s*\n", text) if p.strip()]:
            body = link_products(esc(para.strip()), products, None)
            yield body.replace("\n", "<br>")

    out = []
    steps_open = False
    for sec in guide.get("sections") or []:
        heading = (sec.get("heading") or "").strip()
        text = (sec.get("text") or "").strip()
        layout = (sec.get("layout") or "prose").strip().lower()

        if layout == "steps" and not steps_open:
            out.append('<ol class="gd-steps">')
            steps_open = True
        elif layout != "steps" and steps_open:
            out.append("</ol>")
            steps_open = False

        if layout == "steps":
            out.append('<li class="gd-step">')
            if heading:
                out.append(f"<h2>{esc(heading)}</h2>")
            out.extend(f"<p>{b}</p>" for b in paras(text))
            out.append("</li>")

        elif layout == "example":
            # Everything up to the first blank line after the wording is the
            # specimen; anything after it is the note explaining it.
            if heading:
                out.append(f"<h2>{esc(heading)}</h2>")
            blocks = list(paras(text))
            # A trailing block with no line breaks is commentary, not wording.
            note = ""
            if len(blocks) > 1 and "<br>" not in blocks[-1]:
                note = blocks.pop()
            out.append('<div class="gd-specimen">')
            out.extend(f"<p>{b}</p>" for b in blocks)
            out.append("</div>")
            if note:
                out.append(f'<p class="gd-specimen-note">{note}</p>')

        else:
            if heading:
                out.append(f"<h2>{esc(heading)}</h2>")
            out.extend(f"<p>{b}</p>" for b in paras(text))

    if steps_open:
        out.append("</ol>")
    html = html.replace("{{SECTIONS}}", "\n".join(out))

    # FAQs, visible and in the schema, built from one source.
    faqs = [f for f in (guide.get("faqs") or [])
            if (f.get("q") or "").strip() and (f.get("a") or "").strip()]
    if faqs:
        items = "".join(
            '<details class="gd-faq-item">'
            f'<summary class="gd-faq-q"><span class="gd-faq-q-text">{esc(f["q"].strip())}</span>'
            '<span class="gd-faq-toggle">+</span></summary>'
            f'<div class="gd-faq-a">{esc(f["a"].strip())}</div></details>'
            for f in faqs
        )
        html = html.replace("{{FAQS}}",
            '<section class="gd-faqs"><div class="gd-wrap">'
            '<h2 class="gd-faq-h">Common questions</h2>' + items + "</div></section>")
        ld_faq = {"@context": "https://schema.org", "@type": "FAQPage",
                  "mainEntity": [{"@type": "Question", "name": f["q"].strip(),
                                  "acceptedAnswer": {"@type": "Answer", "text": f["a"].strip()}}
                                 for f in faqs]}
        html = html.replace('<script type="application/ld+json" id="ld-guide-faq">{}</script>',
                            '<script type="application/ld+json" id="ld-guide-faq">'
                            + json.dumps(ld_faq, ensure_ascii=False) + "</script>")
    else:
        html = html.replace("{{FAQS}}", "")

    # Related products, as cards.
    cards = []
    for ps in guide.get("related_products") or []:
        prod = by_slug.get(ps)
        if not prod:
            continue
        img = prod.get("hero_image_url") or ""
        cards.append(
            f'<a class="gd-card" href="/{esc(ps)}">'
            + (f'<div class="gd-card-img"><img src="{esc(img)}" alt="" loading="lazy"></div>' if img
               else '<div class="gd-card-img"></div>')
            + f'<div class="gd-card-name">{esc(prod.get("name") or ps)}</div></a>'
        )
    html = html.replace("{{RELATED}}",
        '<section class="gd-related"><div class="gd-wrap">'
        '<h2 class="gd-related-h">What you will need</h2>'
        '<div class="gd-related-grid">' + "".join(cards) + "</div></div></section>"
        if cards else "")

    ld = {"@context": "https://schema.org", "@type": "Article",
          "headline": guide["title"], "description": desc,
          "mainEntityOfPage": {"@type": "WebPage", "@id": url},
          "publisher": {"@type": "Organization", "name": "Foreverprint",
                        "url": SITE}}
    html = html.replace('<script type="application/ld+json" id="ld-article">{}</script>',
                        '<script type="application/ld+json" id="ld-article">'
                        + json.dumps(ld, ensure_ascii=False) + "</script>")
    return html


def write_guides_index(guides, slugs):
    """The /guides hub. Built from the same template as the articles, so the
    two cannot drift apart visually, and it gives the guides one place to be
    linked from rather than relying on the footer alone."""
    try:
        tpl = open(os.path.join(ROOT, "guide.html"), encoding="utf-8").read()
    except OSError:
        return
    live = {g["slug"]: g for g in guides if g.get("slug") in set(slugs)}
    cards = []
    for sl in slugs:
        g = live.get(sl)
        if not g:
            continue
        summary = re.sub(r"\s+", " ", (g.get("intro") or "")).strip()
        if len(summary) > 150:
            summary = summary[:147].rstrip() + "..."
        cards.append(
            f'<a class="gd-card" href="/guides/{esc(sl)}" '
            'style="padding:20px 22px 22px;border-radius:14px;">'
            f'<div style="font-family:\'Cormorant Garamond\',serif;font-size:1.2rem;'
            f'color:var(--text);margin-bottom:8px;line-height:1.3;">{esc(g["title"])}</div>'
            f'<div style="font-size:var(--text-sm);color:var(--soft);line-height:1.8;">{esc(summary)}</div></a>'
        )

    html = tpl
    html = html.replace("{{TITLE}}", "Wedding Stationery Guides | Foreverprint")
    html = html.replace("{{DESC}}", esc(
        "Practical guides to wedding stationery: when to send save the dates and "
        "invitations, how many you need, what to write and what to order."))
    html = html.replace("{{URL}}", f"{SITE}/guides")
    html = html.replace("{{H1}}", "Wedding stationery guides")
    html = html.replace("{{INTRO}}",
        '<p class="gd-intro">When to send things, how many to order and what to put on them '
        '&mdash; the questions couples ask us most, answered properly.</p>')
    html = html.replace("{{SECTIONS}}",
        '<div class="gd-related-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">'
        + "".join(cards) + "</div>")
    html = html.replace("{{FAQS}}", "")
    html = html.replace("{{RELATED}}", "")
    # The hub is a list, not an article.
    html = html.replace('<script type="application/ld+json" id="ld-article">{}</script>',
                        '<script type="application/ld+json" id="ld-article">'
                        + json.dumps({"@context": "https://schema.org", "@type": "CollectionPage",
                                      "name": "Wedding stationery guides",
                                      "url": f"{SITE}/guides"}, ensure_ascii=False) + "</script>")
    # No "read our other guides" link on the page that lists them all.
    html = re.sub(r'(?s)<section class="gd-more">.*?</section>', "", html, count=1)
    open(os.path.join(ROOT, "guides.html"), "w", encoding="utf-8").write(html)


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

    # Root pages plus the guides folder. Guides live one level down, and
    # listing only the root left them with the placeholder and no navigation
    # in their markup — which is exactly the problem inlining exists to solve.
    pages = [(n, os.path.join(ROOT, n)) for n in sorted(os.listdir(ROOT))]
    guides_dir = os.path.join(ROOT, "guides")
    if os.path.isdir(guides_dir):
        pages += [(n, os.path.join(guides_dir, n)) for n in sorted(os.listdir(guides_dir))]

    done = 0
    for name, path in pages:
        if not name.endswith(".html") or name in CHROME_SKIP:
            continue
        try:
            html = open(path, encoding="utf-8").read()
        except OSError:
            continue
        before = html

        # Placeholders come in three shapes across the site: a div, a
        # <header>/<footer> element, and one with an inline style. Match the
        # shape rather than the exact string, so a page is never quietly
        # skipped and left with no navigation in its markup.
        # Inlined chrome is wrapped in markers so it can be found and replaced
        # on the NEXT build. Without them the header and footer were baked in
        # permanently: after the first inline the placeholder was gone, so
        # editing header.html or footer.html reached only pages that get
        # regenerated. Adding one footer link landed on 4 pages out of 55.
        def swap(kind, markup, page):
            wrapped = f"<!--CHROME:{kind}-->{markup}<!--/CHROME:{kind}-->"
            patterns = [
                # first time: the placeholder
                r'<(?:div|%s)\s+id="site-%s"[^>]*>\s*</(?:div|%s)>' % (kind, kind, kind),
                # later builds: our own marked block
                r'<!--CHROME:%s-->.*?<!--/CHROME:%s-->' % (kind, kind),
                # one-off migration for pages inlined before the markers existed
                r'<%s\b[^>]*>.*?</%s>' % (kind, kind),
            ]
            for pat in patterns:
                new_page, n = re.subn(pat, lambda m: wrapped, page, count=1, flags=re.S)
                if n:
                    return new_page
            return page

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


def write_sitemap(slugs, guide_slugs=()):
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
    if guide_slugs:
        add("/guides", "0.6", "monthly")
        for g in guide_slugs:
            add("/guides/" + g, "0.6", "monthly")
    for loc, pri, freq in CORE_PAGES[3:]:
        add(loc, pri, freq)
    out.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(
        "\n".join(out) + "\n"
    )
    log(f"sitemap.xml: {len(slugs) + len(CORE_PAGES) + (len(guide_slugs) + 1 if guide_slugs else 0)} URLs")


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
        guides = fetch(
            url, key, "/rest/v1/guides?active=eq.true&select=*&order=display_order"
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
        html = build_page(template, p, pricing, products)
        open(os.path.join(ROOT, slug + ".html"), "w", encoding="utf-8").write(html)
        written.append(slug)

    log(f"wrote {len(written)} product pages")

    guide_slugs = []
    if guides:
        try:
            gt = open(os.path.join(ROOT, "guide.html"), encoding="utf-8").read()
        except OSError as e:
            log(f"cannot read guide.html ({e}) — guides skipped")
            gt = None
        if gt:
            os.makedirs(os.path.join(ROOT, "guides"), exist_ok=True)
            for g in guides:
                gslug = (g.get("slug") or "").strip()
                if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", gslug or ""):
                    log(f"skipping unusual guide slug: {gslug!r}")
                    continue
                page = build_guide(gt, g, products)
                open(os.path.join(ROOT, "guides", gslug + ".html"),
                     "w", encoding="utf-8").write(page)
                guide_slugs.append(gslug)
            write_guides_index(guides, guide_slugs)
            log(f"wrote {len(guide_slugs)} guides")

    inline_chrome()
    write_sitemap(written, guide_slugs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
