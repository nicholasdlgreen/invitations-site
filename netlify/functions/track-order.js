// /netlify/functions/track-order.js
//
// Customer order tracking, moved off the browser.
//
// It used to run in the page: fetch the whole order row with the public key,
// then compare the email in JavaScript. That meant the full record — name,
// address, phone, everything — reached the browser before any check, and the
// same public key could read every other order too.
//
// Now the lookup happens here with the service key, the email must match before
// anything is returned, and only the handful of fields the tracking page shows
// are sent back.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (falls back to SUPABASE_ANON_KEY)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SUPABASE_KEY) {
    console.error('[track-order] no Supabase key configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Tracking is unavailable right now' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const orderNumber = String(body.orderNumber || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  if (!orderNumber || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Order number and email are both needed' }) };
  }

  // One message for "no such order" and "wrong email" alike, so this cannot be
  // used to find out which order numbers exist.
  const notFound = { statusCode: 404, headers, body: JSON.stringify({ error: 'We could not find an order with those details.' }) };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}&select=order_number,customer_name,customer_email,status,created_at,total,dpd_tracking,items,paper`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error('lookup failed: ' + res.status);
    const rows = await res.json();
    if (!rows.length) return notFound;

    const row = rows[0];
    if (String(row.customer_email || '').trim().toLowerCase() !== email) return notFound;

    const items = Array.isArray(row.items) ? row.items : [];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orderNumber: row.order_number,
        name: row.customer_name || 'Customer',
        status: row.status || 'pending',
        createdAt: row.created_at,
        total: row.total,
        tracking: row.dpd_tracking || null,
        paper: row.paper || null,
        items: items.map(i => ({ name: i.name, qty: i.qty, size: i.size }))
      })
    };
  } catch (err) {
    console.error('[track-order]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Tracking is unavailable right now' }) };
  }
};
