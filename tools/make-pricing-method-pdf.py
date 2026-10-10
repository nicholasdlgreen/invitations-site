#!/usr/bin/env python3
# Builds foreverprint-pricing-method.pdf -- the document that explains our
# pricing method to PrintedEasy so they can verify it.
#
# Run:  <venv>/bin/python tools/make-pricing-method-pdf.py foreverprint-pricing-method.pdf
#
# Needs reportlab, which is not installed system-wide and there is no node
# here either:
#     python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install reportlab
#
# THE PDF ITSELF IS GITIGNORED. The repository is public and the document sets
# out the 20% trade discount, our cost base and our whole method in one place.
# This builder is kept because the figures in it will go stale -- they were
# measured on the dates stated and should be re-measured before it is sent
# again.
#
# Every number in here came from the live database or the live PrintedEasy
# site. If you change one, change it because you measured it.
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, PageBreak)

GOLD  = colors.HexColor('#B8976A')
INK   = colors.HexColor('#3D2E24')
PALE  = colors.HexColor('#B0A098')
LINE  = colors.HexColor('#E8DDD8')
CREAM = colors.HexColor('#FAF7F2')

OUT = sys.argv[1]

def S(name, **kw):
    base = dict(name=name, fontName='Helvetica', fontSize=9.5, leading=13.2,
                textColor=INK, alignment=TA_LEFT, spaceAfter=6)
    base.update(kw); return ParagraphStyle(**base)

body    = S('body')
small   = S('small', fontSize=8.3, leading=11.5, textColor=colors.HexColor('#6B5B50'))
h1      = S('h1', fontName='Helvetica-Bold', fontSize=19, leading=23, spaceAfter=4, spaceBefore=0)
sub     = S('sub', fontSize=10.5, leading=15, textColor=PALE, spaceAfter=16)
h2      = S('h2', fontName='Helvetica-Bold', fontSize=13, leading=16,
            spaceBefore=12, spaceAfter=6, textColor=INK)
h3      = S('h3', fontName='Helvetica-Bold', fontSize=10, leading=14,
            spaceBefore=10, spaceAfter=4, textColor=colors.HexColor('#7A6450'))
bullet  = S('bullet', leftIndent=11, bulletIndent=1, spaceAfter=3)
qstyle  = S('q', leftIndent=13, bulletIndent=1, spaceAfter=5.5)
cell    = S('cell', fontSize=8.4, leading=11.5, spaceAfter=0)
cellb   = S('cellb', fontSize=8.4, leading=11.5, spaceAfter=0, fontName='Helvetica-Bold')
cellm   = S('cellm', fontSize=8.2, leading=11.5, spaceAfter=0, fontName='Courier')
hdr     = S('hdr', fontSize=8.2, leading=11, fontName='Helvetica-Bold',
            textColor=colors.white, spaceAfter=0)

def P(t, s=body):  return Paragraph(t, s)
def B(t):          return Paragraph(t, bullet, bulletText='•')
def Q(t, n):       return Paragraph(t, qstyle, bulletText=str(n) + '.')

def table(rows, widths, head=True, mono=None, align=None):
    mono = mono or []
    data = []
    for i, r in enumerate(rows):
        out = []
        for j, c in enumerate(r):
            if i == 0 and head:      st = hdr
            elif j in mono:          st = cellm
            elif j == 0 and head:    st = cellb
            else:                    st = cell
            out.append(Paragraph(str(c), st))
        data.append(out)
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0, hAlign='LEFT')
    cmds = [('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 4.5), ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
            ('LINEBELOW', (0,0), (-1,-2), 0.4, LINE)]
    if head:
        cmds += [('BACKGROUND', (0,0), (-1,0), colors.HexColor('#6B5B50')),
                 ('LINEBELOW', (0,0), (-1,0), 0, colors.white)]
    for i in range(1 if head else 0, len(rows)):
        if (i % 2) == (0 if head else 1):
            cmds.append(('BACKGROUND', (0,i), (-1,i), CREAM))
    t.setStyle(TableStyle(cmds))
    return t

def note(t):
    """A called-out paragraph with a gold rule down the left."""
    tb = Table([[Paragraph(t, S('n', fontSize=9, leading=13.5))]], colWidths=[165*mm], hAlign='LEFT')
    tb.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),9), ('RIGHTPADDING',(0,0),(-1,-1),6),
                            ('TOPPADDING',(0,0),(-1,-1),6), ('BOTTOMPADDING',(0,0),(-1,-1),6),
                            ('LINEBEFORE',(0,0),(0,-1),2.2,GOLD),
                            ('BACKGROUND',(0,0),(-1,-1),CREAM)]))
    return tb

story = []
A = story.append

# ─────────────────────────────────────────────────────────── title
A(P('How foreverprint prices work', h1))
A(P('Our cost base is your published price list. This document sets out exactly how we read it, '
    'how we interpret it, and how it reaches a customer — so that you can check it and tell us '
    'where we have it wrong.', sub))

A(P('In one paragraph', h2))
A(P('We buy from PrintedEasy at <b>20% off your published list price</b>, so your list price is our '
    'cost base. We read that price list directly from your website, store it, and sell from a '
    'published snapshot of it. <b>Today we sell at cost</b> — every product carries a 0% margin, so '
    'the customer pays what we pay and the whole trade discount is passed on. That will change when '
    'we set margins, but the mechanism below will not.'))
A(Spacer(1, 4))
A(note('<b>What we would like from you.</b> Section 8 lists eight specific questions. Three of them '
       'affect money directly: whether the 20% applies to the delivery line, whether foiling is '
       'available on the Luxury products, and whether a price dip we have found at quantity 475 is '
       'deliberate. We have made a working assumption on each and flagged it as an assumption.'))

# ─────────────────────────────────────────────────────────── 1
A(P('1. How we read your prices', h2))
A(P('We have no feed or API from you, so we read the public site. A script '
    '(<font face="Courier" size="8.5">printedeasy_refresh.py</font>) does this:', body))
A(B('It opens the relevant product page and reads the <b>pricing form</b> out of the HTML — every '
    'input, select and default. We do not guess at option names; we use yours.'))
A(B('It then posts that form back to your own quoting endpoint, '
    '<font face="Courier" size="8.5">/product/pricing/&lt;product&gt;</font>, the same one your page uses when '
    'a visitor changes a dropdown, and reads <font face="Courier" size="8.5">totalSellingPrice</font> '
    'from the JSON you return.'))
A(B('It multiplies that by 0.80 and stores the result as our cost.'))
A(Spacer(1, 3))
A(P('Three deliberate choices about how we do it:', h3))
A(B('<b>Rate-limited to roughly three requests a second</b>, with a 0.3 second pause between quotes. '
    'A full refresh of our whole range takes about 35 minutes. We are not trying to be a burden.'))
A(B('<b>It never publishes.</b> The script writes new costs into our database and prints a diff. '
    'Changing what a customer actually sees is a separate, manual step that a person takes after '
    'reading that diff. A price change at your end never moves our prices without a human deciding.'))
A(B('<b>We strip your upsells before quoting.</b> Scodix, spot UV and foiling fields are removed so '
    'that the base price is the plain printed card. Finishing is priced separately — see section 4.'))
A(Spacer(1, 3))
A(note('<b>If you would rather we did not scrape, say so.</b> A price list in any machine-readable '
       'form — CSV, a feed, anything — would be better for both of us, and we would switch to it '
       'immediately. We read the public site because it is the only source we have, not because we '
       'prefer it.'))

A(P('Keeping it honest: the sentinel check', h3))
A(P('Your stock-weight dropdown will accept a value that does not exist and quietly substitute a '
    'default, returning a plausible price for a product you do not sell. We therefore probe each '
    'configuration with a deliberately impossible value '
    '(<font face="Courier" size="8.5">__fp_sentinel__</font>). If the real answer equals the '
    'impossible one, we know the field was ignored and we discard the quote rather than record a '
    'fictional price.'))

# ─────────────────────────────────────────────────────────── 2
A(P('2. Product — what we buy, and from which of your products', h2))
A(P('Our site sells 36 products. They are printed as only <b>five</b> things at your end. This '
    'mapping is the single place your vocabulary meets ours:'))
A(Spacer(1, 2))
A(table([
    ['Our family', 'Your product', 'What it is', 'Our products using it'],
    ['flat-card', 'Postcards', 'A flat printed card, ordinary stocks', '32'],
    ['flat-card', 'Luxury Flat', 'A flat printed card, Fedrigoni stocks', 'the same 32, by stock'],
    ['folded-card', 'Greeting Cards', 'Folded, quoted at finished size', '33'],
    ['folded-leaflet', 'Luxury Folded', 'Folded, quoted at <b>flat</b> size', '31'],
    ['large-format', 'Posters', 'Paper, large format', 'used for signage'],
    ['display-board', 'Display Boards', 'Rigid board', '3'],
], [26*mm, 30*mm, 66*mm, 43*mm]))
A(Spacer(1, 6))
A(P('A product is routed to <b>Luxury Flat rather than Postcards by the stock chosen</b>, not by '
    'price tier — the Fedrigoni range exists only there.'))

A(P('Paper: your names and ours', h3))
A(table([
    ['Our name', 'Your stock value', 'Weights we buy (gsm)', 'Bought on'],
    ['Uncoated', 'uncoated', '120, 250, 300, 350, 400', 'family default'],
    ['Silk', 'silk', '250, 300, 350, 400', 'family default'],
    ['Tintoretto Gesso', 'tintoretto', '140, 300', 'Luxury Flat when flat'],
    ['Nettuno Bianco', 'nettuno', '280', 'Luxury Flat when flat'],
    ['Acquerello Bianco', 'acquerello', '280', 'Luxury Flat when flat'],
    ['Sirio Pearl Polar Dawn', 'polardawn', '300', 'Luxury Flat when flat'],
    ['Recycled Uncoated', 'recycled', '350', 'Luxury Flat when flat'],
    ['Cartonboard', 'cartonboard', '255', 'family default'],
    ['Ice White', 'icewhite', '300', 'family default'],
    ['Foamex 5mm', 'foamex5mm', '5mm substrate', 'Display Boards'],
], [38*mm, 30*mm, 50*mm, 47*mm]))
A(Spacer(1, 6))
A(P('We deliberately do <b>not</b> buy every weight you list. Cartonboard 280gsm costs roughly three '
    'times the 255, so we sell the 255 only. Those weights are absent above on purpose.'))

A(P('Size, and one place where your products differ from each other', h3))
A(B('Where you list a size, we ask for it by name.'))
A(B('Where you do not, we ask for it as a <b>custom size</b> in millimetres. Checked on 25 September: '
    'a custom 85×55 on Luxury Flat returns exactly the listed 85×55 price, £29.00 both ways. '
    'We take your menu as what you advertise, not the limit of what you will print.'))
A(B('<b>Greeting Cards asks for the finished size; Luxury Folded asks for the unfolded size.</b> '
    'A size on our site always means the finished piece, so a finished A5 order of service is sent to '
    'Luxury Folded as a flat A4. If that reading is wrong, every folded price we hold is wrong.'))

# ─────────────────────────────────────────────────────────── 3
A(P('3. Print — how we read your quantity ladder', h2))
A(P('Your quantity field says "type any amount", and your price is <b>not a formula</b>. We swept it '
    'densely on 24 September — about 250 live quotes across three configurations — and found that '
    'it steps in <b>whole pounds</b>, and the steps land in different places for every paper, weight '
    'and size. Flat cards step every 20–30 units; folded cards every 10; posters every 2–3 below 40.'))
A(P('So we do not model it. We sample it, at these points:'))
A(Spacer(1, 2))
A(table([
    ['Family', 'Quantities we quote and store'],
    ['Flat card, folded card, folded leaflet',
     '1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 375, 450, <b>475</b>, 500'],
    ['Large format', '1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 85, 100'],
    ['Display board', '1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50'],
], [52*mm, 113*mm], mono=[1]))
A(Spacer(1, 6))
A(P('Measured against the real curves, these points hold our average error to about <b>0.2–0.7%</b> '
    'of your price. <b>Every quantity we actually sell is sampled directly</b> — our customer-facing '
    'ladders are 10/25/50/100/150/200/250, 25/50/100/150/250, and 1/2/3/5/10/25/50, all of which '
    'appear above — so no price a customer sees is interpolated.'))

A(P('475 is not a typo', h3))
A(note('<b>Your price dips at 475.</b> On the configuration below, your list price is £49 at 450, '
       '<b>£48 at 475</b>, and £49 again at 500. We found this on both curves we swept, at exactly '
       'the same place. No amount of sampling either side predicts it, because a straight line from '
       '450 to 500 runs above it — so we sample 475 explicitly rather than smooth it away. '
       '<b>Is this intended?</b>'))

A(P('Worked example you can check against your own site', h3))
A(P('Postcards · Silk · 300gsm · A5 · single-sided. Left column is what your site quotes us; '
    'right is what we store as cost, after the 20%.'))
A(Spacer(1, 2))
rows = [['Qty','Your list','Our cost','Qty','Your list','Our cost','Qty','Your list','Our cost']]
L = [(1,22.00,17.60),(5,22.00,17.60),(10,22.00,17.60),(15,23.00,18.40),(20,23.00,18.40),
     (25,23.00,18.40),(30,23.00,18.40),(40,24.00,19.20),(50,24.00,19.20),(60,26.00,20.80),
     (75,27.00,21.60),(100,29.00,23.20),(125,30.00,24.00),(150,31.00,24.80),(200,34.00,27.20),
     (250,37.00,29.60),(300,39.00,31.20),(375,43.00,34.40),(450,49.00,39.20),(475,48.00,38.40),
     (500,49.00,39.20)]
for k in range(0, 21, 3):
    r = []
    for q, lst, cost in L[k:k+3]:
        mark = ' ←' if q == 475 else ''
        r += [str(q), '£%.2f%s' % (lst, mark), '£%.2f' % cost]
    while len(r) < 9: r.append('')
    rows.append(r)
A(table(rows, [13*mm,20*mm,20*mm,13*mm,20*mm,20*mm,13*mm,20*mm,20*mm]))
A(Spacer(1, 5))
A(P('The middle column is a clean staircase of whole pounds, which is the check that our 20% '
    'reconstruction is exact: divide any of our costs by 0.8 and a whole pound comes back.'))

A(P('Two rules we apply to your prices afterwards', h3))
A(B('<b>Minimum job charge.</b> Quantities 1, 5 and 10 all cost £22 on the example above. We carry '
    'that through rather than inventing a per-unit price, so a customer buying one card pays the '
    'one-card price, not a twentieth of twenty.'))
A(B('<b>We never quote more for fewer.</b> Your list occasionally prices a smaller quantity above a '
    'larger one. We mirror your costs exactly — the backward steps stay in our cost table, because '
    'that is what you charge — but before a price is shown we walk each curve down from the largest '
    'quantity and never let a price stand above the one above it. <b>It can only ever lower a price '
    'to the customer; it never changes what we pay you.</b>'))
A(B('<b>Orientation is never priced.</b> We checked: portrait and landscape cost the same at your '
    'end, so we do not charge for it.'))

# ─────────────────────────────────────────────────────────── 4
A(P('4. Finishing — priced the way you price it', h2))
A(P('We used to hold one price per finishing type: lamination was £5, whatever you chose, however '
    'many, whatever size. Measured against your calculator on 26 September that was wrong four ways '
    '— your charge varies by <b>option</b>, by <b>which sides</b>, by <b>quantity</b> and by '
    '<b>size</b>. Both-sides lamination is not twice front-only. Every laminated order was giving '
    'away £4–£7 of cost.'))
A(P('So finishing is now scraped the same way the print is. For each combination we take two quotes '
    '— the plain job, and the job with the finish applied — and store the <b>difference</b>, after '
    'the 20%:'))
A(Spacer(1, 2))
A(note('<font face="Courier" size="9">uplift = (price with finish − price without) × 0.80</font>'))
A(Spacer(1, 5))
A(P('Stored against (family, finish, option, which sides, size, quantity). What we hold today:'))
A(Spacer(1, 2))
A(table([
    ['Finish', 'Options', 'Sides', 'Your products', 'Rows', 'Range (our cost)'],
    ['Lamination', 'Matt, Gloss, Soft touch, Anti-scuff', 'front, both',
     'Postcards, Greeting Cards, Posters', '2,184', '£3.20 – £324.80'],
    ['Envelopes', 'Brilliant White', 'n/a',
     'Postcards, Greeting Cards, Luxury Folded', '210', '£0.00 – £39.20'],
    ['Corners', 'Rounded', 'n/a', 'Postcards only', '105', '£16.80 – £17.60'],
    ['Foiling', '8 colours', 'front', 'Postcards, Greeting Cards', '1,680', '£67.20 – £72.00'],
], [24*mm, 42*mm, 20*mm, 40*mm, 14*mm, 25*mm]))
A(Spacer(1, 6))

A(P('What we have concluded about each, and would like checked', h3))
A(B('<b>Lamination is a per-job cost that grows with quantity</b>, not a per-unit one. Front is not '
    'half of both. It does <b>not</b> vary with paper or weight — both-sides measured £11/£11/£12/£11 '
    'across 250–400gsm at quantity 100 — so we store one figure for all weights.'))
A(B('<b>Envelopes are the one genuinely per-unit charge</b> here, so the quantity ladder matters more '
    'for them, not less.'))
A(B('<b>Foiling is a flat setup fee.</b> Gold on A5 measures £67–£70 of cost at every quantity from '
    '1 to 500 — essentially flat. We treat it as a setup charge rather than a per-card cost.'))
A(B('<b>Which side a finish goes on is our decision, not the customer’s.</b> Every lamination option '
    'we sell is specified both sides; rounded corners is one operation on the card. We publish only '
    'that side, which keeps 567 unreachable prices per product out of our catalogue.'))
A(Spacer(1, 3))
A(note('<b>±1 is the resolution of your price list and we do not chase it.</b> You quote whole '
       'pounds, so an uplift is the difference between two rounded staircases and can be a pound out '
       'in either direction. We accept that rather than inventing precision you have not given us.'))

A(P('Where we deliberately record nothing', h3))
A(B('<b>Luxury Folded has no lamination field at all.</b> Every value we send, including the '
    'impossible one, returns the plain price. An early run duly recorded a pile of free lamination '
    'that does not exist. We now refuse to record a finish that does not move the price while its '
    'siblings do.'))
A(B('<b>Display Boards</b> name their lamination field and values differently, so they are excluded '
    'rather than probed with a field your form does not have.'))
A(B('<b>Rounded corners exist on Postcards only.</b> Greeting Cards has no such field, so we do not '
    'offer it there.'))

# ─────────────────────────────────────────────────────────── 5
A(P('5. Delivery', h2))
A(P('We solved your delivery rule from one real order of yours — £236.00 of goods billed £48 for '
    'Express and £95 for Express Plus. Eight candidate rules were tested against those two figures '
    'and only one reproduces both:'))
A(Spacer(1, 2))
A(note('<b>20% (Express) or 40% (Express Plus) of the ex-VAT goods value, rounded UP to the whole '
       'pound</b>, with minimums of £20 and £40. Express is offered up to £3,000 of goods, Express '
       'Plus up to £1,500. Standard delivery is free.'))
A(Spacer(1, 5))
A(P('What our site charges the customer:'))
A(Spacer(1, 2))
A(table([
    ['Our option', 'What the customer pays', 'Lead time', 'Ceiling'],
    ['Standard', '<b>Free</b>', 'printed in 3 working days, then tracked', '—'],
    ['Express', '20% of order value, min £20', 'printed in 2 working days, order by 4pm', '£3,000'],
    ['Express Plus', '40% of order value, min £40', 'printed next working day, order by 1pm', '£1,500'],
], [26*mm, 48*mm, 66*mm, 25*mm]))
A(Spacer(1, 6))
A(P('<b>The same formula, applied to our prices rather than yours.</b> Since our prices are yours '
    'less 20%, our delivery charge lands 20% below yours too. Verified at £150, £236, £400, £800, '
    '£1,500 and £2,500 of print: the ratio is 0.8000 every time. Below about £150 the £20 minimum '
    'breaks the ratio, because a floor does not scale — we are 14.3% below you at £50 of print and '
    '16.7% at £100.'))
A(Spacer(1, 3))
A(note('<b>This is the open question that matters most to us.</b> Does your 20% trade discount apply '
       'to the <b>delivery line</b> on our invoice, or only to the print line? If it covers the whole '
       'invoice, our delivery breaks even exactly. If it covers print only, we are absorbing the '
       'difference on every expedited order. We cannot tell from the public site, and we have not '
       'guessed — the work is flagged as unresolved on our side until you tell us.'))

# ─────────────────────────────────────────────────────────── 6
A(P('6. How a cost becomes a price on our site', h2))
A(P('Four steps, and nothing else touches the number:'))
A(Spacer(1, 2))
A(table([
    ['', 'Step', 'Where it lives'],
    ['1', 'Your list price, read from your site', 'your website'],
    ['2', '× 0.80 — the trade discount. This is <b>our cost</b>', 'stored once, per (family, paper, weight, size, sides, quantity)'],
    ['3', '× (1 + margin). <b>Margin is 0% on all 36 products today</b>, so our sell price is our cost',
     'one number per product'],
    ['4', 'The no-backward-steps rule, which can only lower a price', 'applied when the page loads'],
], [8*mm, 78*mm, 79*mm]))
A(Spacer(1, 6))
A(P('<b>VAT is not in this chain.</b> We are not VAT registered, so no VAT is added to a shop price. '
    'Your own treatment of VAT is not consistent across products — it appears to be added on '
    'Postcards and not on Greeting Cards — which is one of the questions below.'))
A(Spacer(1, 3))
A(P('<b>Nothing is cached stale.</b> Prices are read live from a published snapshot. A refresh of '
    'your prices updates our costs; a person then reviews the diff and publishes. We have never '
    'automated that last step and do not intend to.'))

# ─────────────────────────────────────────────────────────── 7
# ─────────────────────────────────────────────────────────── 7
A(P('7. Where this leaves us commercially', h2))
A(P('Worth being plain about, since it affects how you read everything above. <b>We currently sell '
    'at your list price less 20%, with no margin added.</b> The customer pays what we pay. We are '
    'pre-launch and have not yet set margins; when we do, it changes one number per product and '
    'nothing else in this document.'))
A(P('8. What we would like you to confirm', h2))
A(P('In rough order of how much they cost us to get wrong.'))
A(Spacer(1, 3))
A(Q('<b>Does the 20% trade discount apply to the delivery line, or to print only?</b> This decides '
    'whether our expedited delivery breaks even or loses money on every order. Section 5.', 1))
A(Q('<b>Do you offer foiling on Luxury Flat and Luxury Folded?</b> We currently sell foiling on '
    'products that route to Postcards and Greeting Cards. If a customer picks a Fedrigoni stock, '
    'that routes to Luxury Flat — and we are not certain you foil there. If you do not, we are '
    'selling something we cannot buy.', 2))
A(Q('<b>Is the price dip at quantity 475 intended?</b> £49 at 450, £48 at 475, £49 at 500. '
    'Section 3.', 3))
A(Q('<b>Is 7pt really the minimum type size for foil, and what is the maximum foiled area?</b> '
    'Both are currently our inference from your Business Cards page, not your answer.', 4))
A(Q('<b>Is our reading of Luxury Folded sizes right?</b> We send a finished A5 as a flat A4, because '
    'your Luxury Folded form asks for the unfolded size while Greeting Cards asks for the finished '
    'one. If that is backwards, every folded price we hold is wrong.', 5))
A(Q('<b>Uncoated 120gsm</b> — we are unsure whether it is genuinely available across the sizes we '
    'offer. We would rather ask than infer; inferring is how we got Cartonboard wrong.', 6))
A(Q('<b>VAT.</b> Your quotes appear to include VAT on some products and not others. Can you confirm '
    'which of your prices are ex-VAT?', 7))
# The closing note travels with the last question. On its own it stranded two
# lines on a page of their own, which reads as a mistake rather than a design.
A(KeepTogether([
    Q('<b>Is reading your site acceptable, and is there a better source?</b> We rate-limit to about '
      'three requests a second and refresh occasionally, not continuously. If you would prefer a '
      'different arrangement, or can give us a price list in any machine-readable form, we will '
      'switch to it.', 8),
    Spacer(1, 4),
    P('Everything here is reproducible. Every figure quoted was measured against your live site or '
      'read from our database, with the date of measurement recorded. If any of it is wrong we '
      'would genuinely rather know now.', small)]))

# Bind each heading to the flowables after it. A heading alone at the foot of a
# page, with its text overleaf, is the one layout fault that makes a document
# look unproofed -- and the first build had two of them.
def bind(items):
    out, i = [], 0
    while i < len(items):
        it = items[i]
        is_head = isinstance(it, Paragraph) and getattr(it.style, 'name', '') in ('h1','h2','h3')
        if is_head:
            grp, j = [it], i + 1
            # take the heading plus the next two pieces of real content
            taken = 0
            while j < len(items) and taken < 2:
                nxt = items[j]
                if isinstance(nxt, Paragraph) and getattr(nxt.style, 'name', '') in ('h1','h2','h3'):
                    break
                grp.append(nxt)
                if not isinstance(nxt, Spacer):
                    taken += 1
                j += 1
            out.append(KeepTogether(grp))
            i = j
        else:
            out.append(it)
            i += 1
    return out

story = bind(story)

# ─────────────────────────────────────────────────────────── build
def page(canv, doc):
    canv.saveState()
    canv.setStrokeColor(GOLD); canv.setLineWidth(2)
    canv.line(22*mm, A4[1]-16*mm, 42*mm, A4[1]-16*mm)
    canv.setFont('Helvetica', 7.5); canv.setFillColor(PALE)
    canv.drawString(22*mm, A4[1]-13.5*mm, 'foreverprint · pricing method')
    canv.drawRightString(A4[0]-22*mm, A4[1]-13.5*mm, 'Prepared for PrintedEasy · 10 October 2026')
    canv.setStrokeColor(LINE); canv.setLineWidth(0.4)
    canv.line(22*mm, 16*mm, A4[0]-22*mm, 16*mm)
    canv.setFillColor(PALE); canv.setFont('Helvetica', 7.5)
    canv.drawString(22*mm, 11.5*mm, 'Commercially confidential')
    canv.drawRightString(A4[0]-22*mm, 11.5*mm, 'Page %d' % doc.page)
    canv.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=22*mm, rightMargin=22*mm,
                      topMargin=22*mm, bottomMargin=19*mm,
                      title='foreverprint pricing method — prepared for PrintedEasy',
                      author='foreverprint', subject='How we read, interpret and apply PrintedEasy pricing')
frame = Frame(doc.leftMargin, doc.bottomMargin,
              A4[0]-doc.leftMargin-doc.rightMargin,
              A4[1]-doc.topMargin-doc.bottomMargin, id='f')
doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=page)])
doc.build(story)
print('built', OUT)
