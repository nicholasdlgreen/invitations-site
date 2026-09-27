-- The design studio learns that a card has an inside.
--
-- studio_fields.face  — 'front' or 'inside'. Everything that existed is front.
-- studio_config.folded — does the studio draw this product as a folded card?
--
-- folded is stored rather than derived on purpose. "Folded" lives in the
-- printing family for a product sold only that way (a greeting card's single
-- route is tagged 'flat', meaning "its only format") and in the fold tag for a
-- product sold both ways. For a Christmas card, sold flat AND folded, no
-- derivation can answer it. It is a decision, so it is stored as one.
alter table studio_fields
  add column if not exists face text not null default 'front';
alter table studio_fields drop constraint if exists studio_fields_face_check;
alter table studio_fields
  add constraint studio_fields_face_check check (face in ('front','inside'));

alter table studio_config
  add column if not exists folded boolean not null default false;

comment on column studio_config.folded is
  'True when the design studio should draw this product as a folded card: a front, and an inside the customer may have printed or leave blank.';

-- Seeded: the four products we sell ONLY as a folded card. Order of service is
-- left out deliberately — it is a four-page leaflet with fifteen wording boxes,
-- not a front with a message inside. Christmas cards get the inside boxes but
-- folded stays false until someone decides; they are sold both ways.
