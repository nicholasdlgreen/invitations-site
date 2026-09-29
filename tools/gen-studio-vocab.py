#!/usr/bin/env python3
"""Generate the step-3 vocabulary migration from the approved proposal.

The chips are database rows, not code, and there is no admin screen for them,
so the whole vocabulary is written here once and emitted as SQL. Re-run this
rather than hand-editing the .sql file.
"""
import json, re, sys, pathlib

PAL = {
 'sage green':'#DDE3D3','cream':'#E8DDD8','gold':'#B8976A','blush':'#F0DDD8','dusty blue':'#B7C4CE',
 'terracotta':'#C97B5A','burgundy':'#7A4E4E','navy':'#2F3E4E','emerald':'#3E5641','champagne':'#C9B79E',
 'mauve':'#D8B7C4','olive':'#8A9A7B','forest green':'#2E4636','holly red':'#9E2B2B','silver':'#C4C7CA',
 'midnight blue':'#1F2A3C','copper':'#A9633C','white':'#FBFAF7','soft pink':'#EBC9CE','chocolate brown':'#5A4034',
 'frosted grey':'#D5DBDD','black':'#262322','bright pink':'#D6417E','coral':'#E8785C','teal':'#2F6E6B',
 'purple':'#6B4A80','orange':'#E08A34','baby blue':'#C2D7E8','lemon':'#F0E0A8','peach':'#F3D3BC',
 'lavender':'#D2C6E0','mint':'#CBE2D6','soft grey':'#D3D3CE','mustard':'#D2A33C','brick red':'#A8503F',
 'warm grey':'#BDB5AC','oxford blue':'#1E355E','claret':'#6E2B36','dusty rose':'#D9AEAC','lilac':'#C9B6D6',
}
MED = {
 'wc':('watercolour','in soft watercolour'),
 'ink':('ink linework','in fine ink linework'),
 'gou':('hand-painted','in hand-painted gouache'),
 'press':('pressed flowers','made from pressed and dried flowers'),
 'eng':('engraved','in the manner of fine engraving'),
 'pen':('hand-drawn','in loose hand-drawn pen'),
 'tex':('textured paper','on textured cotton paper'),
 'wash':('painterly wash','in a loose painterly wash'),
 'lino':('lino print','in a hand-cut lino print'),
 'cut':('cut paper','in layered cut paper'),
 'emb':('embroidery','as fine embroidery on linen'),
 'air':('airbrush','in a soft airbrush finish'),
 'arch':('architectural','as a fine architectural drawing'),
}
LAYOUT = {
 'border':('a border','arranged as a border around the edge'),
 'corners':('corners','the decoration kept to the corners'),
 'wreath':('a wreath','arranged as a wreath'),
 'laurel':('a wreath','arranged as a laurel wreath'),
 'side':('down one side','as a loose spray down one side'),
 'allover':('all-over','as a delicate all-over pattern'),
 'sparing':('sparing','kept very sparing'),
 'one':('one motif','as a single motif in the centre'),
 'scattered':('scattered','scattered loosely across the card'),
 'winter':('a winter scene','as a small winter scene filling the card'),
 'street':('a street scene','as a small street scene filling the card'),
 'sprig':('a single sprig','as one single sprig'),
}

def T(**kw): return kw

THEMES = {
'wedding': T(
  palette=['sage green','cream','gold','blush','dusty blue','terracotta','burgundy','navy','emerald','champagne','mauve','olive'],
  pairs=[('sage green','cream'),('blush','gold'),('dusty blue','champagne'),('burgundy','gold'),('terracotta','olive'),('mauve','sage green')],
  medium=['wc','ink','gou','press','eng','pen','tex','wash'],
  era=[('classic','classic'),('modern','modern'),('vintage','vintage'),('art deco','art deco'),('minimal','minimal'),('bohemian','bohemian')],
  layout=['border','corners','wreath','side','allover','sparing'],
  motif=[('eucalyptus','trailing eucalyptus'),('blush roses','blush roses'),('wildflowers','delicate wildflowers'),
         ('greenery','soft greenery'),('gold foliage','gold foliage'),('a monogram','a monogram'),
         ('a crest','a hand-drawn heraldic crest'),('bows','silk ribbon bows'),('lace','fine lace detailing')],
  mood=[('warm & romantic','warm and romantic'),('soft & airy','soft and airy'),('candlelit','candlelit'),
        ('bright & fresh','bright and fresh'),('timeless','timeless'),('grand','grand'),
        ('sunlit','sunlit'),('softly lit','softly lit')]),
'christmas': T(
  palette=['forest green','holly red','cream','gold','silver','midnight blue','copper','burgundy','white','soft pink','chocolate brown','frosted grey'],
  pairs=[('holly red','forest green'),('gold','cream'),('midnight blue','silver'),('forest green','copper'),('soft pink','holly red'),('white','silver')],
  medium=['wc','ink','gou','lino','eng','pen','tex','cut'],
  era=[('traditional','traditional'),('Scandinavian','Scandinavian'),('mid-century','mid-century'),
       ('Victorian','Victorian'),('modern','modern'),('folk','folk-art')],
  layout=['border','wreath','corners','allover','one','winter'],
  motif=[('a Christmas tree','a Christmas tree'),('holly and berries','holly and berries'),('mistletoe','mistletoe'),
         ('pine and fir','pine and fir branches'),('snowflakes','falling snowflakes'),('baubles','hanging baubles'),
         ('a star','a single star'),('candles','lit candles'),('a robin','a robin'),('a stag','a stag'),
         ('a partridge','a partridge'),('gingerbread','gingerbread'),('a nutcracker','a nutcracker')],
  mood=[('warm & cosy','warm and cosy'),('festive & joyful','festive and joyful'),('elegant','elegant'),
        ('nostalgic','nostalgic'),('calm & wintry','calm and wintry'),('playful','playful'),
        ('candlelit','candlelit'),('frosty','frosty')]),
'birthday': T(
  audience=[('a child','for a child'),('a teenager','for a teenager'),('a big milestone','for a milestone birthday'),
            ('a grown-up','for a grown-up'),('a glamorous night','for a glamorous night out')],
  palette=['black','gold','bright pink','coral','teal','navy','emerald','burgundy','silver','purple','orange','cream'],
  pairs=[('black','gold'),('bright pink','orange'),('teal','coral'),('navy','silver'),('purple','gold'),('black','silver')],
  medium=['wc','ink','gou','pen','cut','air','tex','wash'],
  era=[('modern','modern'),('art deco','art deco'),('retro','retro'),('disco','1970s disco'),
       ('classic','classic'),('maximalist','maximalist')],
  layout=['border','corners','allover','scattered','one','sparing'],
  motif=[('balloons','balloons'),('confetti','falling confetti'),('streamers','paper streamers'),
         ('a disco ball','a disco ball'),('champagne','champagne coupes'),('candles','lit candles'),
         ('stars','scattered stars'),('sparkles','sparkles'),('florals','florals'),('cake','a layer cake'),
         ('ribbons','curling ribbons'),('fireworks','fireworks')],
  mood=[('celebratory','celebratory'),('glamorous','glamorous'),('elegant','elegant'),('relaxed','relaxed'),
        ('vibrant','vibrant'),('playful','playful'),('bold','bold'),('neon-lit','neon-lit')]),
'baby': T(
  palette=['blush','baby blue','sage green','cream','lemon','peach','lavender','mint','soft grey','gold','terracotta','coral'],
  pairs=[('blush','cream'),('baby blue','sage green'),('lemon','mint'),('peach','cream'),('lavender','soft grey'),('sage green','terracotta')],
  medium=['wc','ink','gou','pen','cut','emb','tex','wash'],
  era=[('classic','classic'),('modern','modern'),('Scandinavian','Scandinavian'),('vintage','vintage'),
       ('whimsical','whimsical'),('preppy','preppy')],
  layout=['border','wreath','corners','allover','one','sparing'],
  motif=[('soft florals','soft florals'),('greenery','soft greenery'),('woodland animals','woodland animals'),
         ('safari animals','safari animals'),('the moon and stars','the moon and stars'),('clouds','soft clouds'),
         ('a rainbow','a rainbow'),('a teddy','a teddy bear'),('baby shoes','tiny baby shoes'),
         ('balloons','balloons'),('gingham','a gingham check'),('a bunny','a bunny')],
  mood=[('sweet & gentle','sweet and gentle'),('soft & dreamy','soft and dreamy'),('joyful','joyful'),
        ('playful','playful'),('elegant','elegant'),('calm','calm'),('sunlit','sunlit'),('softly lit','softly lit')]),
'moving': T(
  palette=['sage green','cream','navy','terracotta','mustard','dusty blue','coral','gold','forest green','brick red','warm grey','olive'],
  pairs=[('sage green','cream'),('navy','mustard'),('terracotta','olive'),('dusty blue','coral'),('forest green','gold'),('brick red','cream')],
  medium=['wc','ink','gou','pen','lino','arch','tex','wash'],
  era=[('modern','modern'),('classic','classic'),('mid-century','mid-century'),('folk','folk-art'),
       ('minimal','minimal'),('whimsical','whimsical')],
  layout=['border','corners','allover','one','street','sparing'],
  motif=[('a house','a house'),('a front door','a front door'),('a window box','a window box'),
         ('keys','a set of keys'),('greenery','soft greenery'),('florals','florals'),
         ('a removal box','a removal box'),('a doormat','a doormat'),('a garden gate','a garden gate'),
         ('a chimney','a smoking chimney'),('a cat in a window','a cat in a window')],
  mood=[('warm & welcoming','warm and welcoming'),('fresh','fresh'),('fun','fun'),('elegant','elegant'),
        ('homely','homely'),('sunlit','sunlit')]),
'graduation': T(
  palette=['navy','gold','black','burgundy','emerald','cream','silver','teal','coral','oxford blue','claret','white'],
  pairs=[('navy','gold'),('black','gold'),('burgundy','cream'),('emerald','silver'),('teal','coral'),('oxford blue','white')],
  medium=['ink','gou','wc','eng','pen','cut','tex','wash'],
  era=[('classic','classic'),('modern','modern'),('art deco','art deco'),('collegiate','collegiate'),
       ('minimal','minimal'),('bold','bold')],
  layout=['border','corners','laurel','one','allover','sparing'],
  motif=[('a mortar board','a mortar board'),('laurels','laurel leaves'),('a scroll','a rolled scroll'),
         ('confetti','falling confetti'),('stars','scattered stars'),('sparkles','sparkles'),
         ('a book','a stack of books'),('a tassel','a tassel'),('a pennant','a felt pennant'),
         ('bunting','bunting'),('a crest','a university-style crest')],
  mood=[('celebratory','celebratory'),('elegant','elegant'),('fun','fun'),('bold','bold'),
        ('proud','proud'),('sunlit','sunlit')]),
'thankyou': T(
  palette=['sage green','cream','gold','blush','dusty blue','terracotta','navy','emerald','dusty rose','mustard','lilac','white'],
  pairs=[('sage green','cream'),('blush','gold'),('dusty blue','cream'),('terracotta','mustard'),('lilac','sage green'),('mustard','navy')],
  medium=['wc','ink','gou','press','pen','eng','tex','wash'],
  era=[('classic','classic'),('modern','modern'),('vintage','vintage'),('minimal','minimal'),
       ('bohemian','bohemian'),('folk','folk-art')],
  layout=['border','wreath','corners','sprig','allover','sparing'],
  motif=[('florals','florals'),('greenery','soft greenery'),('wildflowers','delicate wildflowers'),
         ('fruit','ripe fruit'),('a bird','a small bird'),('a bee','a bee'),('a ribbon','a ribbon'),
         ('a posy','a tied posy')],
  mood=[('warm','warm'),('elegant','elegant'),('soft','soft'),('fresh','fresh'),
        ('timeless','timeless'),('sunlit','sunlit')]),
'greeting': T(
  palette=['cream','gold','blush','sage green','dusty blue','terracotta','burgundy','navy','emerald','mustard','lilac','coral'],
  pairs=[('sage green','cream'),('blush','gold'),('dusty blue','coral'),('terracotta','mustard'),('navy','cream'),('lilac','sage green')],
  medium=['wc','ink','gou','pen','lino','press','tex','wash'],
  era=[('classic','classic'),('modern','modern'),('vintage','vintage'),('minimal','minimal'),
       ('bohemian','bohemian'),('folk','folk-art')],
  layout=['border','wreath','corners','allover','one','sparing'],
  motif=[('florals','florals'),('greenery','soft greenery'),('fruit','ripe fruit'),('a bird','a small bird'),
         ('a cat','a cat'),('a dog','a dog'),('hearts','small hearts'),('stars','scattered stars'),
         ('a rainbow','a rainbow'),('a landscape','a distant landscape')],
  mood=[('warm','warm'),('joyful','joyful'),('elegant','elegant'),('soft','soft'),('fun','fun'),
        ('calm','calm'),('sunlit','sunlit')]),
}

# The four motifs that belong to a christening and nowhere else.
CHRISTENING_MOTIF = [('a delicate cross','a delicate cross'),('a dove','a dove'),
                     ('olive branches','olive branches'),('angel wings','angel wings')]

PRODUCT_THEME = {
 'wedding-invitations':'wedding','save-the-dates':'wedding','rsvp-cards':'wedding','menu-cards':'wedding',
 'place-cards':'wedding','table-numbers':'wedding','table-plans':'wedding','signage':'wedding',
 'welcome-signs':'wedding','order-of-service':'wedding','engagement-cards':'wedding',
 'engagement-party-invitations':'wedding',
 'christmas-cards':'christmas',
 'birthday-invitations':'birthday','party-invitations':'birthday',
 'new-arrival-cards':'baby','baby-shower-invitations':'baby','christening-invitations':'baby',
 'moving-cards':'moving','graduation-cards':'graduation',
 'thank-you-cards':'thankyou','greeting-cards':'greeting',
}

def q(x): return "'" + x.replace("'", "''") + "'"

def theme_rows(theme):
    """The vocabulary for one theme, in the order it is shown."""
    t = THEMES[theme]
    out = []
    for i, (a, b) in enumerate(t.get('pairs', [])):
        out.append(('pair', a + ' & ' + b, a + '|' + b, None, i))
    for i, c in enumerate(t['palette']):
        assert c in PAL, c
        out.append(('colour', c, c, PAL[c], i))
    for i, k in enumerate(t['medium']):
        out.append(('medium',) + MED[k] + (None, i))
    for i, (l, p) in enumerate(t['era']):
        out.append(('era', l, p, None, i))
    for i, k in enumerate(t['layout']):
        out.append(('layout',) + LAYOUT[k] + (None, i))
    for i, (l, p) in enumerate(t['motif']):
        out.append(('motif', l, p, None, i))
    for i, (l, p) in enumerate(t['mood']):
        out.append(('mood', l, p, None, i))
    for i, (l, p) in enumerate(t.get('audience', [])):
        out.append(('audience', l, p, None, i))
    return out

PROMPT_RE = re.compile(r'^A \{mood\}, \{style\} (.+?) design (?:\{\w+\} ?)+\. (.+)$', re.S)

def new_prompt(old):
    m = PROMPT_RE.match(old)
    assert m, old
    noun, tail = m.group(1), m.group(2)
    return ('A {lead} ' + noun + ' design{audience}, {medium}, {layout}, {motif}, {colour}. ' + tail)

def main():
    cfg = json.loads(pathlib.Path(sys.argv[1]).read_text())
    prompts = {r['product_slug']: r['base_prompt'] for r in cfg}
    L = []
    L.append('-- Step 3 vocabulary: six boxes, eight themes, twenty-two products.')
    L.append('-- Generated by tools/gen-studio-vocab.py — do not hand-edit.')
    L.append('--')
    L.append('-- Ten of the products are the wedding day in a different format and their')
    L.append('-- chip lists had drifted apart for no reason anyone decided, so the')
    L.append('-- vocabulary is written once per theme and joined onto the products that')
    L.append('-- share it. Changing a wedding word now changes it in all twelve places.')
    L.append('begin;')
    L.append('')
    L.append('-- keep a copy of what is there now, so this is reversible')
    L.append('drop table if exists studio_prompt_options_pre_20260929;')
    L.append('create table studio_prompt_options_pre_20260929 as select * from studio_prompt_options;')
    L.append('drop table if exists studio_config_pre_20260929;')
    L.append('create table studio_config_pre_20260929 as select * from studio_config;')
    L.append('-- the backups sit in the public schema, which PostgREST serves, so they')
    L.append('-- are gated like every other table rather than left open to the anon key')
    for t in ('studio_prompt_options_pre_20260929', 'studio_config_pre_20260929'):
        L.append('alter table %s enable row level security;' % t)
        L.append('create policy %s_admin_only on %s for all to public '
                 'using (is_admin()) with check (is_admin());' % (t, t))
    L.append('')
    slugs = sorted(PRODUCT_THEME)
    L.append('delete from studio_prompt_options where product_slug in (%s);' %
             ', '.join(q(s) for s in slugs))
    L.append('')
    # One statement, so it does not depend on a temp table surviving between
    # statements — it does not, under autocommit, and the insert then joined
    # against nothing and quietly wrote no rows.
    L.append('-- the vocabulary, written once per theme')
    L.append('with v (theme, category, label, phrase, swatch_hex, display_order) as (values')
    rows = []
    total = 0
    for theme in sorted(THEMES):
        rs = theme_rows(theme)
        total += len(rs)
        rows.append('  -- %s (%d)' % (theme, len(rs)))
        rows += ['  (%s, %s, %s, %s, %s, %d)' %
                 (q(theme), q(c), q(l), q(p), q(h) + '::text' if h else 'null::text', o)
                 for c, l, p, h, o in rs]
    # a comma after every data row except the last; comment lines carry none
    data = [r for r in rows if not r.strip().startswith('--')]
    joined = []
    di = 0
    for r in rows:
        if r.strip().startswith('--'):
            joined.append(r)
        else:
            di += 1
            joined.append(r + (',' if di < len(data) else ''))
    L.append('\n'.join(joined))
    L.append('), m (product_slug, theme) as (values')
    slugs2 = sorted(PRODUCT_THEME)
    L.append(',\n'.join('  (%s, %s)' % (q(s), q(PRODUCT_THEME[s])) for s in slugs2))
    L.append(')')
    L.append('insert into studio_prompt_options '
             '(product_slug, category, label, phrase, swatch_hex, display_order, active, default_on)')
    L.append('select m.product_slug, v.category, v.label, v.phrase, v.swatch_hex, '
             'v.display_order, true, false')
    L.append('  from m join v on v.theme = m.theme;')
    L.append('')
    L.append('-- the four motifs that belong to a christening and nowhere else')
    L.append('insert into studio_prompt_options '
             '(product_slug, category, label, phrase, swatch_hex, display_order, active, default_on) values')
    base = len(THEMES['baby']['motif'])
    L.append(',\n'.join(
        "  ('christening-invitations', 'motif', %s, %s, null, %d, true, false)" % (q(l), q(p), base + i)
        for i, (l, p) in enumerate(CHRISTENING_MOTIF)) + ';')
    L.append('')
    L.append('-- the template, so every phrase lands in a slot that reads as English')
    for slug in slugs:
        L.append('update studio_config set base_prompt = %s where product_slug = %s;' %
                 (q(new_prompt(prompts[slug])), q(slug)))
    L.append('')
    L.append('commit;')
    L.append('-- %d distinct chips across %d themes, plus %d for the christening'
             % (total, len(THEMES), len(CHRISTENING_MOTIF)))
    print('\n'.join(L))

main()
