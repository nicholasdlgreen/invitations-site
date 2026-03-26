// netlify/functions/stripe-webhook.js
// Called by Stripe when a payment is confirmed.
// Marks the matching order as 'paid' in Supabase.
// Requires environment variables:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET   (from Stripe Dashboard → Webhooks)
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const WEBHOOK_SECRET    = process.env.STRIPE_WEBHOOK_SECRET;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session     = stripeEvent.data.object;
    const orderNumber = session.metadata?.order_number;
    const orderId     = session.metadata?.order_id;

    if (orderNumber && SUPABASE_URL) {
      try {
        // Update by order_number (most reliable)
        await supabasePatch('orders', { order_number: orderNumber }, {
          status:            'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent || '',
          updated_at:        new Date().toISOString(),
        });
        console.log(`Order ${orderNumber} marked as paid`);
      } catch (e) {
        console.error('Failed to update order status:', e.message);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
