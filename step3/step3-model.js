// STEP 3 — building the model from live data.
//
// Everything on the step comes from the database. Nothing here invents a
// paper, a weight, a finish, an envelope, a quantity or a price. If it is not
// published, it is not offered.
//
// The host page owns the state (which paper, which weight, how many). This
// file turns that state plus the live data into the plain model Step3.render
// draws. The preview and upload-and-print.html both use it, so they cannot
// show different things.
(function (global) {
  'use strict';

  // Which tier a paper belongs to. The Fedrigoni range and the recycled stock
  // are named; anything else — including a paper added in admin tomorrow —
  // falls into Signature rather than vanishing off the page.
  var LUXURY = ['Tintoretto Gesso', 'Nettuno Bianco', 'Acquerello Bianco', 'Sirio Pearl Polar Dawn'];
  var KINDER = ['Recycled Uncoated'];
  var TIERS = [
    { id: 'signature', name: 'Signature', hint: 'Smooth' },
    { id: 'luxury',    name: 'Luxury',    hint: 'Italian' },
    { id: 'kinder',    name: 'Kinder',    hint: 'Recycled' }
  ];

  function tierOf(name) {
    if (LUXURY.indexOf(name) >= 0) return 'luxury';
    if (KINDER.indexOf(name) >= 0) return 'kinder';
    return 'signature';
  }

  function money(n) { return '£' + (Number(n) || 0).toFixed(2); }
  function shortMoney(n) { n = Number(n) || 0; return '£' + (n % 1 ? n.toFixed(2) : n.toFixed(0)); }

  // d is everything the host page knows. See upload-and-print.html for the
  // adapter that fills it in.
  function build(d) {
    var papers  = d.papers || [];
    var paper   = papers.filter(function (p) { return p.id === d.selectedPaper; })[0] || papers[0] || {};
    var tier    = tierOf(paper.name);
    var inTier  = papers.filter(function (p) { return tierOf(p.name) === tier; });
    var weights = d.weightsFor(paper) || [];
    var weight  = weights.filter(function (w) { return w.id === d.selectedWeight; })[0] || weights[0] || null;
    var gsm     = weight ? parseInt(weight.gsm, 10) : null;

    // ---- tiers, each with the cheapest price it can actually be bought at
    var tiers = TIERS.filter(function (t) {
      return papers.some(function (p) { return tierOf(p.name) === t.id; });
    }).map(function (t) {
      var mine = papers.filter(function (p) { return tierOf(p.name) === t.id; });
      var lowest = null;
      mine.forEach(function (p) {
        var w = (d.weightsFor(p) || []).filter(function (x) { return x.popular; })[0] || (d.weightsFor(p) || [])[0];
        var r = d.priceFor(p.name, w ? parseInt(w.gsm, 10) : null, d.qty);
        if (r && (lowest === null || r.sell < lowest)) lowest = r.sell;
      });
      var withPic = mine.filter(function (p) { return d.imageFor(p.name); })[0];
      return {
        id: t.id,
        name: t.name,
        hint: t.hint + (lowest === null ? '' : ' · from ' + shortMoney(lowest)),
        img: withPic ? d.imageFor(withPic.name) : null,
        on: t.id === tier
      };
    });

    // ---- finishing: only what this paper can physically take
    var finishing;
    var types = d.finishTypesFor(paper) || [];
    if (!types.length) {
      var canDo = (d.papersThatCanBeFinished() || []);
      finishing = {
        note: (paper.name || 'This paper') + ' takes no finishing — the mill’s surface is the finish.'
            + (canDo.length ? ' Foiling, lamination and spot UV are available on ' + canDo.slice(0, 3).join(' and ') + '.' : '')
      };
    } else {
      finishing = {
        rows: types.map(function (t) {
          var cost = d.finishCost(t.name);
          return {
            type: t.name,
            options: (t.options || []).map(function (o) {
              var none = String(o.name || '').toLowerCase() === 'none';
              return {
                name: o.name,
                label: o.name + (!none && cost ? '  +' + shortMoney(cost) : ''),
                on: d.selectedFinishes[t.name] === o.name
              };
            })
          };
        })
      };
    }

    // ---- quantities: only those with a published price for THIS paper/weight
    var ladder = (d.quantityLadder() || []).filter(function (q) {
      var r = d.priceFor(paper.name, gsm, q);
      return r && r.exact;
    });
    var onLadder = ladder.indexOf(d.qty) >= 0;
    var pricedAt = d.pricedAt;
    var qtyNote = '';
    if (!onLadder) {
      qtyNote = pricedAt == null
        ? 'We cannot quote ' + d.qty + ' online — it is above our largest published run. Email us and we will price it.'
        : d.qty + ' is priced at our ' + pricedAt + ' rate. Ask us and we will quote the exact run.';
    }

    var cannotQuote = !onLadder && pricedAt == null;

    return {
      sub: 'Everything about your order, on one page',
      labels: ['How should it feel', 'The paper', 'Finishing', 'Envelopes', 'How many', 'When you need them'],

      photo: {
        url: d.imageFor(paper.name),
        tag: d.artwork ? 'Your design' : (paper.name || ''),
        artwork: !!d.artwork,
        art: d.art || null
      },

      copy: d.copy,   // the host decides whether this describes the paper or a finish

      money: {
        total: cannotQuote ? '—' : money(d.total),
        per: cannotQuote
          ? 'Ask us for a price at this quantity'
          : money(d.qty ? d.total / d.qty : 0) + ' a card · ' + d.qty + ' × ' + (d.size || '') + ' · inc. VAT',
        cta: d.ctaLabel || 'Continue',
        ctaDisabled: cannotQuote
      },

      tiers: tiers,

      papers: inTier.map(function (p) {
        return { id: p.id, name: p.name, on: p.id === paper.id };
      }),
      weights: weights.length > 1 ? weights.map(function (w) {
        return { id: w.id, label: (w.gsm ? w.gsm + 'gsm' : (w.name || '')), on: weight && w.id === weight.id };
      }) : [],
      weightNote: weights.length === 1 && weights[0].gsm ? weights[0].gsm + 'gsm — one weight' : '',

      finishing: finishing,

      envelopes: {
        show: d.envelopesOffered !== false,
        items: [{ id: 'none', label: 'No envelopes', hex: '', on: !d.envelopesOn }].concat(
          (d.envelopes || []).map(function (e) {
            return { id: e.id, label: e.name, hex: e.hex, on: !!d.envelopesOn && d.selectedEnvelope === e.id };
          }))
      },

      quantities: ladder.map(function (q) { return { n: q, on: q === d.qty }; }),
      qtyCustom: { label: onLadder ? 'Another number…' : String(d.qty), on: !onLadder },
      qtyNote: qtyNote,

      deliveries: (d.deliveries || []).map(function (o) {
        return { id: o.id, name: o.name, when: o.when, cost: o.cost, on: o.on, disabled: o.disabled };
      }),

      foot: 'Not sure about the paper? <a href="/contact.html">Order a free sample pack</a> '
          + '— we post every one of them, no charge.'
    };
  }

  global.Step3Model = { build: build, tierOf: tierOf, TIERS: TIERS };
})(window);
