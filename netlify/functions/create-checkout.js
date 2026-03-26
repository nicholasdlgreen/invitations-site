// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session and saves order to Supabase.
// Requires environment variables set in Netlify dashboard:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL        e.g. https://jvcpzmumkyjdyibmwlsd.supabase.co
//   SUPABASE_ANON_KEY   your anon/public key

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
}

function generateOrderNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart, customer, successUrl, cancelUrl, artworkUrl } = JSON.parse(event.body);

    if (!cart?.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    const orderNumber = generateOrderNumber();
    const total       = cart.reduce((s, i) => s + i.total, 0);
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
        });
        orderId = row?.id;
      } catch (e) {
        console.error('Supabase order save failed:', e.message);
        // Don't block checkout — order still goes through Stripe
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
      success_url: `${successUrl}?order=success&ref=${orderNumber}`,
      cancel_url:  cancelUrl,
      customer_email:    customer?.email || undefined,
      metadata: {
        order_number:     orderNumber,
        order_id:         orderId  || '',
        customer_name:    customer?.name     || '',
        delivery_address: customer?.address  || '',
        artwork_url:      artworkUrl || '',
        notes:            customer?.notes    || '',
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
