// /netlify/functions/send-dispatch.js
//
// "Your order is on its way" — sent when the order is marked dispatched in
// admin, with the tracking number.
//
// This emails customers, so it is not open: the caller must present a valid
// admin session token. Without that check, anyone could email your customers
// from your domain.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY,
//      FROM_EMAIL, TRUSTPILOT_BCC

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY      = process.env.SUPABASE_ANON_KEY;
const FROM_EMAIL    = process.env.FROM_EMAIL || 'orders@foreverprint.com';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// The caller must be a signed-in admin, not just anyone who found the URL.
async function callerIsAdmin(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !ANON_KEY) return false;
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!who.ok) return false;
    const user = await who.json();
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_users?select=user_id&user_id=eq.${user.id}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } }
    ).then(r => r.ok ? r.json() : []);
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    return false;
  }
}

// Trustpilot's Automatic Feedback Service. BCC'ing their address on this
// email is what triggers a review invitation: they read the customer's
// address off it and send the invitation themselves after the delay set in
// the Trustpilot dashboard.
//
// Why this email and not the order confirmation: dispatch is the real
// fulfilment moment, and it is a step we take anyway because it carries the
// tracking number. Anything that only exists to trigger a review eventually
// gets skipped on a busy week.
//
// The address is a credential — anyone holding it could fire invitations in
// our name — so it lives in the environment, not in the repository.
const TRUSTPILOT_BCC = process.env.TRUSTPILOT_BCC || '';

async function sendEmail({ to, subject, html }) {
  const payload = { from: `Foreverprint <${FROM_EMAIL}>`, to, subject, html };
  if (TRUSTPILOT_BCC) payload.bcc = TRUSTPILOT_BCC;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

function buildDispatchHtml(o, tracking, carrier) {
  const firstName = String(o.customer_name || '').trim().split(' ')[0] || 'there';
  const items = Array.isArray(o.items) ? o.items : [];
  const what = items.length
    ? items.map(i => `${i.name || 'Your order'}${i.qty ? ` &middot; ${i.qty} cards` : ''}`).join('<br>')
    : 'Your order';
  return `
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <div style="background:#FAF7F2;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EFE9E1;border-radius:14px;overflow:hidden;">
      <div style="background:#3D2E24;padding:26px 28px;">
        <div style="font-family:Georgia,serif;font-size:21px;color:#fff;letter-spacing:.04em;">foreverprint</div>
      </div>

      <div style="padding:30px 28px 6px;">
        <div style="font-family:Georgia,serif;font-size:23px;color:#3D2E24;margin-bottom:12px;">It&rsquo;s on its way, ${firstName}.</div>
        <p style="font-size:14px;line-height:1.75;color:#5C4A3D;margin:0;">
          Your order has been printed and is now with ${carrier || 'our courier'}. Delivery is normally
          1&ndash;2 working days from today.
        </p>
      </div>

      <div style="padding:22px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:8px;">Order ${o.order_number}</div>
        <div style="font-size:14px;line-height:1.8;color:#5C4A3D;">${what}</div>
      </div>

      ${tracking ? `
      <div style="padding:22px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:8px;">Tracking</div>
        <div style="font-size:15px;color:#3D2E24;font-family:Georgia,serif;letter-spacing:.04em;">${tracking}</div>
        <div style="font-size:12px;color:#8C7B6E;margin-top:6px;">Tracking can take a few hours to show any movement.</div>
      </div>` : ''}

      <div style="padding:24px 28px 30px;">
        <div style="border-top:1px solid #EFE9E1;padding-top:18px;font-size:13px;line-height:1.8;color:#5C4A3D;">
          Anything not right when it arrives, reply to this email and we will sort it.
          We would rather hear from you than have you disappointed.
        </div>
      </div>

      <div style="background:#FAF7F2;padding:16px 28px;text-align:center;font-size:11px;color:#8C7B6E;">
        Foreverprint &middot; Printed with care in the UK
      </div>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_KEY not configured' }) };
  }
  if (!(await callerIsAdmin(event))) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin sign-in required' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { orderId, tracking, carrier, resend } = body;
  if (!orderId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'orderId is required' }) };

  const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    const rows = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers: sb })
      .then(r => r.ok ? r.json() : []);
    const order = rows[0];
    if (!order) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
    if (!order.customer_email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'That order has no customer email' }) };
    }
    // Don't email the same customer twice because a status was toggled.
    if (order.dispatch_email_sent_at && !resend) {
      return {
        statusCode: 409, headers,
        body: JSON.stringify({ error: 'Already sent', sentAt: order.dispatch_email_sent_at })
      };
    }

    await sendEmail({
      to: order.customer_email,
      subject: `Your Foreverprint order ${order.order_number} is on its way`,
      html: buildDispatchHtml(order, tracking, carrier)
    });

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { ...sb, Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'dispatched',
        dpd_tracking: tracking || order.dpd_tracking || null,
        carrier: carrier || order.carrier || null,
        dispatched_at: order.dispatched_at || new Date().toISOString(),
        dispatch_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, to: order.customer_email }) };
  } catch (err) {
    console.error('[send-dispatch]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
