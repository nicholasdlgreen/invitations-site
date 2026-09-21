// /netlify/functions/send-review-requests-due.js
//
// The daily sweep that actually gets us to 100 reviews.
//
// send-review-request.js only fires when somebody clicks "Delivered" in admin.
// That is fine when you remember; the problem is that review collection only
// works if it happens every time, and a manual step in a busy week is the
// first thing to slip. Google needs roughly 100 post-fulfilment reviews before
// it will show a star rating, so a 60%-of-the-time habit does not get there.
//
// So this runs once a day and asks anyone whose order went out a few days ago
// and who has not been asked yet.
//
// Deliberate safety rules, because this emails real customers unattended:
//   * Only orders still marked 'dispatched'. Cancelled or pending are skipped.
//   * Only orders dispatched between WINDOW_MIN_DAYS and WINDOW_MAX_DAYS ago.
//     The upper bound means old or imported rows can never be swept up by a
//     later deploy — it only ever looks at a moving two-week window.
//   * Never more than MAX_PER_RUN in one go, so a mistake is small and visible.
//   * review_email_sent_at is the single send-once guard, shared with the
//     manual path, so an order can never be asked twice.
//   * Status is left alone. We know the order was dispatched; we do not
//     actually know it was delivered, so we do not claim it was.
//
// Schedule lives in netlify.toml.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, FROM_EMAIL, REVIEW_URL

const { buildReviewHtml, sendEmail } = require('./send-review-request.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const REVIEW_URL   = process.env.REVIEW_URL || '';

const WINDOW_MIN_DAYS = 4;    // give the post time to arrive
const WINDOW_MAX_DAYS = 18;   // anything older is history, not a fresh order
const MAX_PER_RUN     = 25;

exports.handler = async () => {
  if (!SERVICE_KEY) {
    console.error('[review-sweep] SUPABASE_SERVICE_KEY not set — nothing done');
    return { statusCode: 500, body: 'not configured' };
  }
  if (!REVIEW_URL) {
    // Not an error: the review platform simply is not chosen yet.
    console.log('[review-sweep] REVIEW_URL not set — skipping, nothing sent');
    return { statusCode: 200, body: JSON.stringify({ skipped: 'REVIEW_URL not set' }) };
  }

  const now = Date.now();
  const notAfter  = new Date(now - WINDOW_MIN_DAYS * 864e5).toISOString();
  const notBefore = new Date(now - WINDOW_MAX_DAYS * 864e5).toISOString();

  const sb = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  const query =
    `orders?select=*` +
    `&status=eq.dispatched` +
    `&review_email_sent_at=is.null` +
    `&dispatched_at=lte.${notAfter}` +
    `&dispatched_at=gte.${notBefore}` +
    `&customer_email=not.is.null` +
    `&order=dispatched_at.asc` +
    `&limit=${MAX_PER_RUN}`;

  let due = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: sb });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    due = await res.json();
  } catch (err) {
    console.error('[review-sweep] could not read orders:', err.message);
    return { statusCode: 500, body: err.message };
  }

  if (!due.length) {
    console.log('[review-sweep] nothing due');
    return { statusCode: 200, body: JSON.stringify({ sent: 0, failed: 0 }) };
  }

  let sent = 0;
  const failed = [];

  for (const order of due) {
    try {
      await sendEmail({
        to: order.customer_email,
        subject: `How did we do? Your Foreverprint order ${order.order_number}`,
        html: buildReviewHtml(order, REVIEW_URL)
      });

      // Stamped immediately after a successful send. If the stamp fails we
      // would rather know about it loudly than risk asking twice tomorrow.
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: { ...sb, Prefer: 'return=minimal' },
        body: JSON.stringify({
          review_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
      if (!patch.ok) {
        console.error('[review-sweep] SENT but could not stamp', order.order_number,
                      '— it may be asked again tomorrow');
      }
      sent++;
    } catch (err) {
      // One bad address must not stop the rest of the run.
      console.error('[review-sweep] failed for', order.order_number, ':', err.message);
      failed.push(order.order_number);
    }
  }

  console.log(`[review-sweep] sent ${sent}, failed ${failed.length}`);
  return {
    statusCode: 200,
    body: JSON.stringify({ sent, failed: failed.length, failedOrders: failed })
  };
};
