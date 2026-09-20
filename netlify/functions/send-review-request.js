// /netlify/functions/send-review-request.js
//
// "How did we do?" — sent when an order is marked delivered in admin.
//
// Why this exists: Google will not show a star rating on our ads or listings
// until roughly 100 eligible post-fulfilment reviews have been collected, and
// only reviews gathered through Google or one of its licensed partners count.
// Every order that ships without this email is a review we can never go back
// and ask for, so it runs from the first order rather than "later".
//
// Two rules this function will not break, because breaking them is illegal
// under the UK's DMCC Act and would also get our ratings discounted by Google:
//   1. Every delivered customer gets asked. We never pick who to ask based on
//      how we think they feel.
//   2. Nothing is offered in exchange. No discount, no entry into a draw.
//
// Like send-dispatch, this emails customers, so the caller must present a
// valid admin session token.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY,
//      FROM_EMAIL, REVIEW_URL

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL  || 'orders@foreverprint.com';
// Where the "leave a review" button points. Set once the review platform is
// chosen. Until then this function refuses to send rather than mail customers
// a dead button.
const REVIEW_URL   = process.env.REVIEW_URL || '';

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

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Foreverprint <${FROM_EMAIL}>`, to, subject, html })
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildReviewHtml(o, reviewUrl) {
  const firstName = esc(String(o.customer_name || '').trim().split(' ')[0] || 'there');
  const items = Array.isArray(o.items) ? o.items : [];
  const what = items.length
    ? items.map(i => `${esc(i.name || 'Your order')}${i.qty ? ` &middot; ${esc(i.qty)} cards` : ''}`).join('<br>')
    : 'Your order';

  return `
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <div style="background:#FAF7F2;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EFE9E1;border-radius:14px;overflow:hidden;">
      <div style="background:#3D2E24;padding:26px 28px;">
        <div style="font-family:Georgia,serif;font-size:21px;color:#fff;letter-spacing:.04em;">foreverprint</div>
      </div>

      <div style="padding:30px 28px 6px;">
        <div style="font-family:Georgia,serif;font-size:23px;color:#3D2E24;margin-bottom:12px;">How did we do, ${firstName}?</div>
        <p style="font-size:14px;line-height:1.75;color:#5C4A3D;margin:0;">
          Your order should be with you by now. We are a small business and still new,
          so an honest word from you genuinely counts &mdash; whether it went beautifully
          or it did not.
        </p>
      </div>

      <div style="padding:22px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:8px;">Order ${esc(o.order_number)}</div>
        <div style="font-size:14px;line-height:1.8;color:#5C4A3D;">${what}</div>
      </div>

      <div style="padding:26px 28px 6px;text-align:center;">
        <a href="${esc(reviewUrl)}"
           style="display:inline-block;background:#B8976A;color:#fff;text-decoration:none;font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:14px 32px;border-radius:60px;">
          Leave a review
        </a>
        <div style="font-size:12px;color:#8C7B6E;margin-top:12px;line-height:1.7;">
          It takes a minute, and it helps the next couple decide.
        </div>
      </div>

      <div style="padding:24px 28px 30px;">
        <div style="border-top:1px solid #EFE9E1;padding-top:18px;font-size:13px;line-height:1.8;color:#5C4A3D;">
          If something was not right, please reply to this email first and let us put it
          straight. We would much rather fix it than read about it later.
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
  if (!REVIEW_URL) {
    return {
      statusCode: 503, headers,
      body: JSON.stringify({
        error: 'No review link is set yet. Add a REVIEW_URL environment variable in Netlify ' +
               '(the link customers use to leave a review), then redeploy. The order has still ' +
               'been marked delivered.',
        needsConfig: true
      })
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { orderId, resend } = body;
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
    // Don't ask the same customer twice because a status was toggled.
    if (order.review_email_sent_at && !resend) {
      return {
        statusCode: 409, headers,
        body: JSON.stringify({ error: 'Already sent', sentAt: order.review_email_sent_at })
      };
    }

    await sendEmail({
      to: order.customer_email,
      subject: `How did we do? Your Foreverprint order ${order.order_number}`,
      html: buildReviewHtml(order, REVIEW_URL)
    });

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
      method: 'PATCH',
      headers: { ...sb, Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'delivered',
        delivered_at: order.delivered_at || new Date().toISOString(),
        review_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, to: order.customer_email }) };
  } catch (err) {
    console.error('[send-review-request]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
