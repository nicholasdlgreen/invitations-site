-- Design Studio prompt vocabulary, reworked 2026-09-25.
--
-- ROLLBACK: tools/sql/studio_prompts_20260925_rollback.sql restores both tables
-- wholesale from studio_prompt_options_backup_20260925 and
-- studio_config_backup_20260925, taken immediately before this ran.
--
-- Every statement is self-contained and safely re-runnable: no temp tables, no
-- explicit transaction, and every insert guarded by a not-exists on
-- (product_slug, category, label) — which the table has no unique index for.
--
-- What changes:
--   1. Two new chip groups, Setting and Season, so the brief describes the
--      event and not only the decoration. This is the real gap against Minted,
--      whose Venue and Season filters had no equivalent here.
--   2. Style and motif words filled out per category.
--   3. The "bold typographic" chips fixed — their phrase asked for lettering
--      inside a prompt that ends "no lettering or words in the image".
--   4. Colour labels consolidated where several names shared one swatch.
--   5. greeting-cards given its own config and chips; it had neither, so it
--      fell through to the hardcoded wedding florals in the page.

-- 1a. SETTING — wedding products only. A birthday party has no venue worth
--     describing to an illustrator. The phrase carries its own preposition so it
--     drops into the template and still reads as a sentence.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'setting', v.label, v.phrase, v.ord, true, false
from (values ('wedding-invitations'),
    ('save-the-dates'),
    ('rsvp-cards'),
    ('order-of-service'),
    ('menu-cards'),
    ('table-numbers'),
    ('table-plans'),
    ('welcome-signs'),
    ('signage'),
    ('engagement-cards'),
    ('engagement-party-invitations')) as p(slug)
cross join (values
    ('country garden', 'with an English country garden feeling', 1),
    ('coastal', 'with a coastal, sea-air feeling', 2),
    ('countryside', 'with a rolling open countryside feeling', 3),
    ('barn', 'with a rustic timber barn feeling', 4),
    ('manor house', 'with a grand manor house feeling', 5),
    ('vineyard', 'with a sunlit vineyard feeling', 6),
    ('woodland', 'with a dappled woodland feeling', 7),
    ('city', 'with a chic city feeling', 8),
    ('abroad', 'with a sun-warmed destination feeling', 9)
  ) as v(label, phrase, ord)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'setting' and o.label = v.label);

-- 1b. SEASON — wedding, announcements and thank yous. Left off celebrations
--     for now; trivial to extend later.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'season', v.label, v.phrase, v.ord, true, false
from (values ('wedding-invitations'),
    ('save-the-dates'),
    ('rsvp-cards'),
    ('order-of-service'),
    ('menu-cards'),
    ('table-numbers'),
    ('table-plans'),
    ('welcome-signs'),
    ('signage'),
    ('engagement-cards'),
    ('engagement-party-invitations'),
    ('baby-shower-invitations'),
    ('christening-invitations'),
    ('new-arrival-cards'),
    ('moving-cards'),
    ('thank-you-cards')) as p(slug)
cross join (values
    ('spring', 'in fresh spring tones', 1),
    ('summer', 'in high summer tones', 2),
    ('autumn', 'in warm autumnal tones', 3),
    ('winter', 'in crisp winter tones', 4)
  ) as v(label, phrase, ord)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'season' and o.label = v.label);

-- 2. TYPOGRAPHIC FIX. "bold typographic" told the model to make lettering the
--    design while the same prompt forbade lettering. What a type-led card
--    actually needs from us is the opposite: get out of the way, leave space.
update studio_prompt_options
set label = 'type-led', phrase = 'a restrained type-led design, almost no ornament, leaving the sheet open and uncluttered'
where active and category = 'style' and label = 'bold typographic';

update studio_prompt_options
set label = 'hand-drawn', phrase = 'loose hand-drawn ink flourishes and marks'
where active and category = 'style' and label = 'hand-lettered';

-- 3a. WEDDING STYLES. Papier's own counts put Border at 59 of 120 designs and
--     type-led at 46 — their two biggest — and we had neither as a style.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'style', v.label, v.phrase,
       (select coalesce(max(display_order),0) from studio_prompt_options o2
         where o2.product_slug = p.slug and o2.category = 'style')
       + row_number() over (partition by p.slug order by v.label),
       true, false
from (values ('wedding-invitations'),
    ('save-the-dates'),
    ('rsvp-cards'),
    ('order-of-service'),
    ('menu-cards'),
    ('table-numbers'),
    ('table-plans'),
    ('welcome-signs'),
    ('signage'),
    ('engagement-cards'),
    ('engagement-party-invitations')) as p(slug)
cross join (values
    ('bordered', 'built around a decorative border frame'),
    ('type-led', 'a restrained type-led design, almost no ornament, leaving the sheet open and uncluttered'),
    ('pattern', 'a delicate repeating pattern'),
    ('toile', 'a toile de Jouy illustrated scene'),
    ('lace', 'fine lace-like detailing'),
    ('ornate', 'ornate and highly decorated, with flourishes and scrollwork'),
    ('hand-drawn', 'loose hand-drawn ink illustration')
  ) as v(label, phrase)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'style' and o.label = v.label);

-- 3b. CELEBRATION STYLES. A blend, not a replacement: the elegant words stay,
--     these give a 40th somewhere to go that a wedding word cannot reach.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'style', v.label, v.phrase,
       (select coalesce(max(display_order),0) from studio_prompt_options o2
         where o2.product_slug = p.slug and o2.category = 'style')
       + row_number() over (partition by p.slug order by v.label),
       true, false
from (values ('birthday-invitations'),
    ('party-invitations'),
    ('graduation-cards')) as p(slug)
cross join (values
    ('pattern', 'a bold repeating pattern'),
    ('maximalist', 'maximalist and exuberant, layered and full'),
    ('hand-drawn', 'loose hand-drawn ink illustration'),
    ('illustrated', 'richly illustrated by hand')
  ) as v(label, phrase)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'style' and o.label = v.label);

-- 3c. ANNOUNCEMENT STYLES. Preppy and pattern are the gingham/stripe register
--     Minted and Vistaprint both lead with here, and we had nothing for it.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'style', v.label, v.phrase,
       (select coalesce(max(display_order),0) from studio_prompt_options o2
         where o2.product_slug = p.slug and o2.category = 'style')
       + row_number() over (partition by p.slug order by v.label),
       true, false
from (values ('baby-shower-invitations'),
    ('christening-invitations'),
    ('new-arrival-cards'),
    ('moving-cards')) as p(slug)
cross join (values
    ('preppy', 'preppy, in gingham and fine stripes'),
    ('pattern', 'a soft repeating pattern'),
    ('hand-drawn', 'loose hand-drawn ink illustration'),
    ('whimsical', 'whimsical and gently playful')
  ) as v(label, phrase)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'style' and o.label = v.label);

-- 4. MOTIFS. Bows are a headline style at both Minted and Vistaprint
--    independently, which makes it a live trend, not one site's guess.
insert into studio_prompt_options (product_slug, category, label, phrase, display_order, active, default_on)
select p.slug, 'touch', v.label, v.phrase,
       (select coalesce(max(display_order),0) from studio_prompt_options o2
         where o2.product_slug = p.slug and o2.category = 'touch')
       + row_number() over (partition by p.slug order by v.label),
       true, false
from (values ('wedding-invitations'),
    ('save-the-dates'),
    ('rsvp-cards'),
    ('order-of-service'),
    ('menu-cards'),
    ('table-numbers'),
    ('table-plans'),
    ('welcome-signs'),
    ('signage'),
    ('engagement-cards'),
    ('engagement-party-invitations'),
    ('baby-shower-invitations'),
    ('christening-invitations'),
    ('new-arrival-cards'),
    ('moving-cards'),
    ('birthday-invitations'),
    ('party-invitations'),
    ('graduation-cards')) as p(slug)
cross join (values
    ('bows', 'silk bows and trailing ribbon'),
    ('a crest', 'a hand-drawn heraldic crest')
  ) as v(label, phrase)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = p.slug and o.category = 'touch' and o.label = v.label);

-- 5. COLOUR CONSOLIDATION. blush, blush pink and soft pink were all #F0DDD8 —
--    one swatch under three names on different products. Where a product
--    already has the canonical label the duplicate goes; otherwise it is
--    renamed onto the canonical swatch.
delete from studio_prompt_options o
using (values
    ('blush pink','blush'),('soft pink','blush'),('seafoam','mint'),
    ('soft blue','baby blue'),('ivory','cream'),('pale yellow','lemon'),
    ('rust','terracotta')
  ) as m(dupe, canon)
where o.category = 'colour' and o.label = m.dupe
  and exists (select 1 from studio_prompt_options c
              where c.product_slug = o.product_slug
                and c.category = 'colour' and c.label = m.canon);

update studio_prompt_options o
set label = m.canon, phrase = m.canon_phrase, swatch_hex = m.canon_hex
from (values
    ('blush pink','blush','#F0DDD8','blush'),
    ('soft pink','blush','#F0DDD8','blush'),
    ('seafoam','mint','#CDE4D4','mint'),
    ('soft blue','baby blue','#BBD0E0','soft baby blue'),
    ('ivory','cream','#E8DDD8','cream'),
    ('pale yellow','lemon','#EEE4B0','soft lemon'),
    ('rust','terracotta','#C97B5A','terracotta')
  ) as m(dupe, canon, canon_hex, canon_phrase)
where o.category = 'colour' and o.label = m.dupe;

-- 6. GREETING CARDS. Had no config and no chips at all, so the page fell
--    through to its hardcoded fallback: eucalyptus and blush roses offered to
--    someone designing a birthday card.
insert into studio_config (product_slug, product_noun, intro_title, intro_sub, base_prompt)
values (
  'greeting-cards',
  'greeting card',
  'Let''s design your card',
  'We''ll take it one step at a time — choose a size, add your wording, then describe the look. You can change anything as you go.',
  'A {mood}, {style} greeting card design {season} {touch} {colour} {finish}. A decorative design only, with generous clear empty space in the centre for text — no lettering or words in the image. Flat, straight-on, fills the frame, print quality.'
)
on conflict (product_slug) do nothing;

insert into studio_prompt_options (product_slug, category, label, phrase, swatch_hex, display_order, active, default_on)
select 'greeting-cards', v.cat, v.label, v.phrase, v.hex, v.ord, true, false
from (values
    ('style', 'watercolour', 'soft watercolour', null, 1),
    ('style', 'floral', 'floral', null, 2),
    ('style', 'botanical', 'fine botanical linework', null, 3),
    ('style', 'minimalist', 'elegant and minimalist', null, 4),
    ('style', 'modern', 'modern and clean', null, 5),
    ('style', 'vintage', 'vintage', null, 6),
    ('style', 'hand-drawn', 'loose hand-drawn ink illustration', null, 7),
    ('style', 'illustrated', 'richly illustrated by hand', null, 8),
    ('style', 'pattern', 'a delicate repeating pattern', null, 9),
    ('style', 'type-led', 'a restrained type-led design, almost no ornament, leaving the sheet open and uncluttered', null, 10),
    ('touch', 'florals', 'soft florals', null, 1),
    ('touch', 'greenery', 'greenery and foliage', null, 2),
    ('touch', 'a wreath', 'a botanical wreath', null, 3),
    ('touch', 'a border', 'a decorative border', null, 4),
    ('touch', 'gold accents', 'fine gold accents', null, 5),
    ('touch', 'hearts', 'delicate hearts', null, 6),
    ('touch', 'stars', 'scattered stars', null, 7),
    ('touch', 'bows', 'silk bows and trailing ribbon', null, 8),
    ('mood', 'warm', 'warm', null, 1),
    ('mood', 'joyful', 'joyful', null, 2),
    ('mood', 'elegant', 'elegant', null, 3),
    ('mood', 'soft', 'soft and gentle', null, 4),
    ('mood', 'fun', 'light-hearted and fun', null, 5),
    ('finish', 'soft light', 'soft natural light', null, 1),
    ('finish', 'textured', 'on textured cotton paper', null, 2),
    ('finish', 'painterly wash', 'a subtle painterly wash', null, 3),
    ('season', 'spring', 'in fresh spring tones', null, 1),
    ('season', 'summer', 'in high summer tones', null, 2),
    ('season', 'autumn', 'in warm autumnal tones', null, 3),
    ('season', 'winter', 'in crisp winter tones', null, 4),
    ('colour', 'cream', 'cream', '#E8DDD8', 1),
    ('colour', 'gold', 'gold', '#B8976A', 2),
    ('colour', 'blush', 'blush', '#F0DDD8', 3),
    ('colour', 'sage green', 'sage green', '#DDE3D3', 4),
    ('colour', 'dusty blue', 'dusty blue', '#B7C4CE', 5),
    ('colour', 'terracotta', 'terracotta', '#C97B5A', 6),
    ('colour', 'burgundy', 'burgundy', '#7A4E4E', 7),
    ('colour', 'navy', 'navy', '#2F3E4E', 8),
    ('colour', 'emerald', 'emerald', '#3E5641', 9)
  ) as v(cat, label, phrase, hex, ord)
where not exists (select 1 from studio_prompt_options o
  where o.product_slug = 'greeting-cards' and o.category = v.cat and o.label = v.label);

-- 7. PROMPT TEMPLATES. Open the two new slots. Setting sits immediately after
--    the noun so the model reads the venue as context for the whole design,
--    rather than as one more motif tacked on at the end.
update studio_config
set base_prompt = replace(base_prompt, ' design {touch}', ' design {setting} {season} {touch}')
where product_slug in ('wedding-invitations', 'save-the-dates', 'rsvp-cards', 'order-of-service', 'menu-cards', 'table-numbers', 'table-plans', 'welcome-signs', 'signage', 'engagement-cards', 'engagement-party-invitations')
  and base_prompt like '% design {touch}%';

update studio_config
set base_prompt = replace(base_prompt, ' design {touch}', ' design {season} {touch}')
where product_slug in ('baby-shower-invitations', 'christening-invitations', 'new-arrival-cards', 'moving-cards', 'thank-you-cards')
  and base_prompt like '% design {touch}%';

-- ======================================================================
-- FOLLOW-UP FIXES, found by rendering the brief rather than reading the SQL.
-- These ran as separate migrations on 2026-09-25; kept here so this file is
-- the whole story.
-- ======================================================================

-- 8. Two more chips asked for lettering inside a prompt that forbids it.
--    Caught by the audit query, not by eye.
update studio_prompt_options
set phrase = 'clean and minimal'
where active and category = 'style' and phrase = 'clean minimalist typography';

-- 9. THE RULE THAT MATTERS. {style} lands immediately before "<noun> design",
--    so it must be a bare adjective phrase: no article, no comma, no trailing
--    prepositional clause. Break it and you get, verbatim from the test:
--      "An ornate and highly decorated, with flourishes and scrollwork
--       wedding invitation design"
--      "A toile de Jouy, an illustrated scene wedding invitation design"
--    Nothing is lost by trimming — every template already ends with
--    "generous clear empty space in the centre for text".
--    'illustrated' and 'photographic' had this fault before today.
update studio_prompt_options set phrase = v.new
from (values
  ('built around a decorative border frame',          'elegantly bordered'),
  ('a restrained type-led design, almost no ornament, leaving the sheet open and uncluttered', 'sparing and type-led'),
  ('a delicate repeating pattern',                    'delicately patterned'),
  ('a bold repeating pattern',                        'boldly patterned'),
  ('a soft repeating pattern',                        'softly patterned'),
  ('a toile de Jouy illustrated scene',               'toile de Jouy'),
  ('fine lace-like detailing',                        'lace-like and delicate'),
  ('ornate and highly decorated, with flourishes and scrollwork', 'ornate and richly decorated'),
  ('loose hand-drawn ink illustration',               'loose and hand-drawn'),
  ('loose hand-drawn ink flourishes and marks',       'loose and hand-drawn'),
  ('richly illustrated by hand',                      'richly hand-illustrated'),
  ('a charming illustrated house',                    'charmingly illustrated'),
  ('maximalist and exuberant, layered and full',      'maximalist and exuberant'),
  ('preppy, in gingham and fine stripes',             'preppy and gingham-checked'),
  ('a photographic style with space for a photo',     'photographic')
) as v(old, new)
where active and category = 'style' and phrase = v.old;

-- ---------------------------------------------------------------- AUDIT
-- Run these after any change to the vocabulary. All three must come back
-- empty, and they are cheap.
--
-- a) no chip may ask for lettering, because every template forbids it:
--   select product_slug, label, phrase from studio_prompt_options
--   where active and (phrase ilike '%letter%' or phrase ilike '%typograph%'
--                     or phrase ilike '%script%' or phrase ilike '%words%');
--
-- b) {style} and {mood} must be bare adjective phrases:
--   select product_slug, category, label, phrase from studio_prompt_options
--   where active and category in ('style','mood')
--     and (phrase ~* '^(a|an|the) ' or phrase like '%,%'
--          or phrase ~* '\s(with|by|in|for|featuring|around)\s');
--
-- c) a template must have exactly the placeholders its chips can fill:
--   select c.product_slug from studio_config c, (values ('setting'),('season')) as g(cat)
--   where (c.base_prompt like '%{' || g.cat || '}%')
--      <> exists (select 1 from studio_prompt_options o
--                 where o.product_slug = c.product_slug
--                   and o.category = g.cat and o.active);
