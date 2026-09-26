// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session and saves order to Supabase.
// Requires environment variables set in Netlify dashboard:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL        e.g. https://jvcpzmumkyjdyibmwlsd.supabase.co
//   SUPABASE_ANON_KEY   your anon/public key

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
// Writing the order needs the service key once orders are no longer publicly
// writable. Reads of published pricing still work with either key.
const SUPABASE_WRITE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn('[create-checkout] SUPABASE_SERVICE_KEY not set — orders may fail to save once tables are locked');
}

async function supabaseInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_WRITE_KEY,
      'Authorization': `Bearer ${SUPABASE_WRITE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  return res.json();
}

async function supabasePatch(table, match, data) {
  const [col, val] = Object.entries(match)[0];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_WRITE_KEY,
      'Authorization': `Bearer ${SUPABASE_WRITE_KEY}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
}

function generateOrderNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}


// ── PRICE VERIFICATION ────────────────────────────────────
// The browser used to be the only thing deciding what an order cost: whatever
// total it posted went straight to Stripe. Anyone could edit that and buy a
// £150 order for pennies. We now rebuild the price here from published data
// and refuse anything materially cheaper.
//
// We compute a FLOOR — the least an item could legitimately cost — rather than
// an exact figure, so genuine extras (delivery, options we cannot see) never
// block a real customer. Paying less than the floor is the attack; paying more
// is not.

async function supabaseSelect(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status}`);
  return res.json();
}

async function loadPricingContext() {
  const ctx = { products: {}, legacyPrices: [], basePerFifty: 150, envelopes: {}, papers: {} };
  try {
    const [snapRows, cfgRows, envRows, paperRows] = await Promise.all([
      supabaseSelect('pricing_config?select=payload&order=published_at.desc&limit=1'),
      supabaseSelect('site_config?id=eq.pricing&select=data'),
      supabaseSelect('envelopes?select=id,price_each&active=eq.true'),
      supabaseSelect('paper_stocks?select=name,price_extra&active=eq.true')
    ]);
    const payload = snapRows?.[0]?.payload;
    if (payload?.schema_version === 2 && Array.isArray(payload.products)) {
      payload.products.forEach(p => { ctx.products[p.slug] = p; });
    } else if (Array.isArray(payload?.prices)) {
      ctx.legacyPrices = payload.prices;
    }
    const cfg = cfgRows?.[0]?.data;
    if (cfg?.basePerFifty != null) ctx.basePerFifty = parseFloat(cfg.basePerFifty);
    (envRows || []).forEach(e => { ctx.envelopes[e.id] = parseFloat(e.price_each) || 0; });
    (paperRows || []).forEach(p => { ctx.papers[p.name] = parseFloat(p.price_extra) || 0; });
  } catch (e) {
    console.warn('[price-check] could not load pricing data:', e.message);
    return null;                       // cannot verify — see caller
  }
  return ctx;
}

// The least this item could legitimately cost, mirroring the site's own rules.
function floorPriceFor(item, ctx) {
  const b = item.basis || {};
  const qty = parseInt(b.qty || item.qty, 10);
  if (!qty || qty < 1) return null;

  const product = ctx.products[b.productSlug];
  let base = null;

  if (product && Array.isArray(product.sheet_sells)) {
    // Fold and printed sides are part of the key, not decoration. Without
    // them .find() takes whichever row happens to come first for a paper,
    // size and quantity — and once double-sided rates are published there are
    // two. Landing on the dearer row would put the floor ABOVE what a
    // legitimate single-sided order claims and reject it at checkout.
    // Rows published before either existed carry neither, and those are flat
    // and single.
    const wantFold  = b.fold || 'flat';
    const wantSides = b.printedSides || 'single';
    const hit = product.sheet_sells.find(s =>
      s.paper === b.paperName && s.size === b.size && parseInt(s.qty, 10) === qty &&
      (s.fold  || 'flat')   === wantFold &&
      (s.sides || 'single') === wantSides);
    if (hit) {
      const finish = Array.isArray(product.finish_sells)
        ? (product.finish_sells.find(f => f.name === (b.finish || 'None')) || {}).sell
        : 0;
      base = parseFloat(hit.sell) + (parseFloat(finish) || 0);
    }
  }
  if (base == null && ctx.legacyPrices.length) {
    const hit = ctx.legacyPrices.find(p =>
      p.size === b.size && parseInt(p.qty, 10) === qty);
    if (hit) base = parseFloat(hit.sellPrice);
  }
  if (base == null) {
    // Same fallback formula the site uses when nothing is published.
    base = Math.round((qty / 50) * ctx.basePerFifty) + (ctx.papers[b.paperName] || 0);
  }

  const envelopes = b.envelopeId ? (ctx.envelopes[b.envelopeId] || 0) * qty : 0;
  return base + envelopes;             // delivery deliberately excluded
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart, customer, successUrl, cancelUrl, artworkUrl, printReadyUrl, delivery, marketing, attribution, discountCode } = JSON.parse(event.body);

    if (!cart?.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    // ── Verify what the browser says this costs ──────────
    const ctx = await loadPricingContext();
    if (ctx) {
      for (const item of cart) {
        const claimed = parseFloat(item.total);
        if (!(claimed > 0)) {
          return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid item price' }) };
        }
        const floor = floorPriceFor(item, ctx);
        if (floor != null && claimed < floor - 0.01) {
          console.warn('[price-check] rejected: claimed', claimed, 'floor', floor, 'basis', JSON.stringify(item.basis || {}));
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Prices have changed since this basket was created. Please refresh the page and try again.' })
          };
        }
      }
    } else {
      // No pricing data to check against: let the order through rather than
      // block a real customer, but make it obvious in the logs.
      console.warn('[price-check] SKIPPED — pricing data unavailable');
    }

    // ── Where the order came from ───────────────────────────────────
    // Browser-supplied, so treat it as untrusted: keep only the fields we
    // know, trim each one, and never let it grow without bound.
    const ATTR_FIELDS = ['gclid','gbraid','wbraid','msclkid','utm_source','utm_medium',
                         'utm_campaign','utm_term','utm_content','landing_page','referrer','seen_at'];
    const cleanTouch = t => {
      if (!t || typeof t !== 'object') return null;
      const out = {};
      for (const f of ATTR_FIELDS) {
        if (typeof t[f] === 'string' && t[f]) out[f] = t[f].slice(0, 300);
      }
      return Object.keys(out).length ? out : null;
    };
    const attrLast  = cleanTouch(attribution && attribution.last);
    const attrFirst = cleanTouch(attribution && attribution.first);
    const attrJson  = (attrLast || attrFirst) ? { first: attrFirst, last: attrLast } : null;

    // ── Discount ────────────────────────────────────────────────────
    // Re-checked here against the database. The browser was told what the
    // code is worth so it could show the customer, but that answer is not
    // trusted with money — this is the figure Stripe is given.
    let discount = null;
    if (discountCode) {
      try {
        const { evaluate, lookup } = require('./validate-discount');
        const goodsTotal   = cart.reduce((t, i) => t + (+i.total || 0), 0)
                           - cart.reduce((t, i) => t + (+(i.basis && i.basis.deliveryCost) || 0), 0);
        const deliveryCost = (delivery && +delivery.cost) || 0;
        const { row, emailUses, previousOrders } = await lookup(String(discountCode).trim(), customer?.email || '');
        const result = evaluate(row, {
          goodsTotal, deliveryCost, email: customer?.email || '', emailUses, previousOrders,
          emailKnown: true,          // by checkout we always know who they are
        });
        if (result.valid) {
          discount = result;
        } else {
          // The customer was shown a discount and it no longer applies —
          // usually a per-customer rule that could only be judged once we
          // knew their email. Stop and say so. Charging full price quietly
          // would be indefensible.
          console.warn('[discount] rejected at checkout:', discountCode, '-', result.message);
          return {
            statusCode: 409,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: result.message, discountRejected: true, code: String(discountCode).toUpperCase() }),
          };
        }
      } catch (e) {
        // A failure here must never stop someone paying. They lose the
        // discount, which they can raise with us, rather than the order.
        console.error('[discount] could not apply:', e.message);
      }
    }

    const orderNumber = generateOrderNumber();
    const grossTotal  = cart.reduce((s, i) => s + i.total, 0);
    const discountAmt = discount ? Math.min(discount.amount, grossTotal) : 0;
    const total       = Math.max(0, Math.round((grossTotal - discountAmt) * 100) / 100);
    const subtotal    = total / 1.2;
    const vat         = total - subtotal;

    // ── Save pending order to Supabase ──────────────────
    let orderId = null;
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const [row] = await supabaseInsert('orders', {
          order_number:     orderNumber,
          customer_name:    customer?.name     || '',
          customer_email:   customer?.email    || '',
          customer_phone:   customer?.phone    || '',
          delivery_address: customer?.address  || '',
          notes:            customer?.notes    || '',
          items:            cart,
          subtotal:         +subtotal.toFixed(2),
          vat:              +vat.toFixed(2),
          total:            +total.toFixed(2),
          status:           'pending',
          artwork_url:      artworkUrl || null,
          print_ready_url:  printReadyUrl || null,
          discount_code:            discount ? discount.code : null,
          discount_amount:          discount ? +discountAmt.toFixed(2) : null,
          subtotal_before_discount: discount ? +grossTotal.toFixed(2) : null,
          // What the customer chose and the date they were shown — so the
          // confirmation email promises the same thing the checkout did.
          delivery:         delivery
                              ? `${delivery.name}${delivery.arrival ? ' · estimated ' + delivery.arrival : ''}`
                              : null,
          // Attribution: the full picture in jsonb, the fields we report on
          // lifted out alongside it. Last touch wins for the flat columns —
          // that is the click Google will be paid for.
          attribution:    attrJson,
          gclid:          attrLast?.gclid || attrFirst?.gclid || null,
          utm_source:     attrLast?.utm_source   || null,
          utm_medium:     attrLast?.utm_medium   || null,
          utm_campaign:   attrLast?.utm_campaign || null,
          utm_term:       attrLast?.utm_term     || null,
          landing_page:   attrLast?.landing_page || attrFirst?.landing_page || null,
          marketing_consent:      !!(marketing && marketing.granted),
          marketing_consent_text: marketing && marketing.granted ? marketing.text : null,
          marketing_consent_at:   marketing && marketing.granted ? new Date().toISOString() : null,
        });
        orderId = row?.id;
      } catch (e) {
        console.error('Supabase order save failed:', e.message);
        // Don't block checkout — order still goes through Stripe
      }
    }

    // ── Add them to the customer list ───────────────────
    // Every customer gets a row (we need it to fulfil the order); the consent
    // flag decides whether they can be marketed to. Never blocks checkout.
    if (SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && customer?.email) {
      try {
        const key = process.env.SUPABASE_SERVICE_KEY;
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_contact_from_order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            p_email: customer.email,
            p_name: customer.name || null,
            p_consent: !!(marketing && marketing.granted),
            p_consent_text: marketing?.text || null,
            p_source: marketing?.source || 'checkout',
            p_total: +total.toFixed(2),
            p_products: cart.map(i => i.name).filter(Boolean)
          })
        });
      } catch (e) {
        console.warn('[contacts] could not record the customer:', e.message);
      }
    }

    // A single-use Stripe coupon for this order, so the payment page shows
    // the discount as its own line and the customer can see what they saved.
    let stripeCoupon = null;
    if (discount && discountAmt > 0) {
      try {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(discountAmt * 100),
          currency: 'gbp',
          duration: 'once',
          name: `${discount.code} — ${discount.label}`,
          max_redemptions: 1,
        });
        stripeCoupon = coupon.id;
      } catch (e) {
        console.error('[discount] Stripe coupon failed:', e.message);
      }
    }

    // ── Create Stripe Checkout Session ──────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cart.map(item => ({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.name,
            description: `${item.qty} invitations · ${item.paper || 'Smooth White'}`,
          },
          unit_amount: Math.round((item.total / item.qty) * 100),
        },
        quantity: item.qty,
      })),
      mode: 'payment',
      ...(stripeCoupon ? { discounts: [{ coupon: stripeCoupon }] } : {}),
     success_url: `${successUrl}&ref=${orderNumber}`,
      cancel_url:  cancelUrl,
      customer_email:    customer?.email || undefined,
      metadata: {
        order_number:     orderNumber,
        order_id:         orderId  || '',
        customer_name:    customer?.name     || '',
        delivery_address: customer?.address  || '',
        artwork_url:      artworkUrl || '',
        print_ready_url:  printReadyUrl || '',
        notes:            customer?.notes    || '',
        discount_code:    discount ? discount.code : '',
        discount_amount:  discount ? discountAmt.toFixed(2) : '',
      },
      shipping_address_collection: { allowed_countries: ['GB'] },
      billing_address_collection:  'auto',
      phone_number_collection:     { enabled: true },
    });

    // Update order with Stripe session ID
    if (orderId) {
      try { await supabasePatch('orders', { id: orderId }, { stripe_session_id: session.id }); }
      catch (e) { console.error('Could not attach session id:', e.message); }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, sessionId: session.id, orderNumber }),
    };

  } catch (err) {
    console.error('Checkout error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
