// netlify/functions/create-checkout.js
// Creates a Stripe Checkout Session and returns the URL.
// Requires STRIPE_SECRET_KEY environment variable set in Netlify dashboard.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { cart, customer, successUrl, cancelUrl } = body;

    if (!cart || !cart.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    // Build Stripe line items from cart
    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: item.name,
          description: `${item.qty} invitations · ${item.paper || 'Smooth White'}`,
        },
        unit_amount: Math.round((item.total / item.qty) * 100), // pence per unit
      },
      quantity: item.qty,
    }));

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      customer_email: customer?.email || undefined,
      metadata: {
        customer_name: customer?.name || '',
        customer_email: customer?.email || '',
        delivery_address: customer?.address || '',
        order_notes: customer?.notes || '',
      },
      shipping_address_collection: {
        allowed_countries: ['GB'],
      },
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url, sessionId: session.id }),
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
