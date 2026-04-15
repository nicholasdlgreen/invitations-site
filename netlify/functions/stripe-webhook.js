const fetch = require('node-fetch');
// netlify/functions/stripe-webhook.js
//
// Fires when Stripe confirms a successful payment.
// Does three things automatically:
//   1. Updates the order status in Supabase to "printing"
//   2. Emails a formatted job ticket + artwork link to the printer
//   3. Emails an order notification to the admin (you)
//
// Environment variables required (set in Netlify dashboard):
//   STRIPE_SECRET_KEY      — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET  — Webhook signing secret from Stripe dashboard
//   RESEND_API_KEY         — Resend API key
//   SUPABASE_URL           — https://jvcpzmumkyjdyibmwlsd.supabase.co
//   SUPABASE_ANON_KEY      — Supabase anon JWT key
//   NOTIFY_EMAIL           — Your email (order notifications)
//   PRINTER_EMAIL          — Printer's email (job tickets)
//   FROM_EMAIL             — Sending address (must be verified in Resend)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// ── SUPABASE ──────────────────────────────────────────────────────────────────
async function updateOrderStatus(sessionId, status) {
  if (!SUPABASE_KEY) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?stripe_session_id=eq.${sessionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      }
    );
  } catch (err) {
    console.error('Supabase update failed:', err.message);
  }
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'orders@invitations.co.uk',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// ── JOB TICKET EMAIL ─────────────────────────────────────────────────────────
function buildJobTicketHtml(o) {
  const fmt = v => `£${parseFloat(v || 0).toFixed(2)}`;
  const subtotal = o.total / 1.2;
  const vat      = o.total - subtotal;

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
                 color:#B0A098;font-family:Arial,sans-serif;vertical-align:top;width:160px;">${label}</td>
      <td style="padding:8px 14px;font-size:13px;color:#3D2E24;font-family:Arial,sans-serif;
                 line-height:1.6;">${value || '—'}</td>
    </tr>`;

  const checks = [
    'Artwork received &amp; verified',
    'Resolution checked (300 DPI+)',
    'Bleed confirmed (3mm all sides)',
    'Colour mode CMYK',
    'Sent to print',
    'Packed &amp; quality checked',
    'DPD label generated',
    'Dispatched &amp; tracking sent to customer',
  ].map(item => `
    <tr><td style="padding:5px 14px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:16px;height:16px;border:1.5px solid #E8DDD8;border-radius:3px;">&nbsp;</td>
        <td style="padding-left:10px;font-size:12px;color:#7A6558;
                   font-family:Arial,sans-serif;">${item}</td>
      </tr></table>
    </td></tr>`).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F0EDE8;">
<table width="660" cellpadding="0" cellspacing="0"
       style="margin:0 auto;background:#fff;border-radius:8px;border:2px solid #3D2E24;overflow:hidden;">

  <tr><td style="background:#3D2E24;padding:18px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:Georgia,serif;font-size:22px;color:#fff;letter-spacing:.06em;">
        Invita<span style="color:#D4B896;">tions</span>
      </td>
      <td style="text-align:right;">
        <div style="font-family:Georgia,serif;font-size:18px;color:#fff;">${o.orderNumber}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;">Order Date: ${o.orderDate}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;
                    letter-spacing:.1em;text-transform:uppercase;">Print Job Ticket</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Customer &amp; Delivery</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;border-radius:6px;">
      ${row('Customer', o.customerName)}
      ${row('Email', o.customerEmail)}
      ${row('Delivery Address', (o.deliveryAddress || '').replace(/,\s*/g, '<br>'))}
    </table>
  </td></tr>

  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Print Specification</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;border-radius:6px;">
      ${row('Quantity',   o.quantity ? `${o.quantity} invitations` : '—')}
      ${row('Paper Stock', o.paper || 'Smooth White 300gsm')}
      ${row('Size',       o.size  || 'A5 · 148 × 210mm')}
      ${row('Finish',     'Matt laminate')}
      ${row('Bleed',      '3mm all sides')}
      ${row('Colour Mode','CMYK')}
    </table>
  </td></tr>

  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Artwork</div>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FAF7F2;border-radius:6px;border:2px dashed #E8DDD8;">
      <tr><td style="padding:16px;text-align:center;">
        ${o.artworkUrl
          ? `<div style="font-size:12px;color:#7A6558;margin-bottom:8px;font-family:Arial,sans-serif;">
               Click to download the customer artwork file:
             </div>
             <a href="${o.artworkUrl}"
                style="color:#B8976A;font-size:13px;word-break:break-all;font-family:Arial,sans-serif;">
               &#128206; Download Artwork File
             </a>`
          : `<div style="font-size:12px;color:#B0A098;font-family:Arial,sans-serif;">
               No artwork file uploaded — check the admin dashboard
             </div>`}
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Order Value</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;border-radius:6px;">
      ${row('Subtotal (excl. VAT)', fmt(subtotal))}
      ${row('VAT (20%)',            fmt(vat))}
      ${row('Total Paid',           `<strong style="font-size:15px;color:#B8976A;">${fmt(o.total)}</strong>`)}
    </table>
  </td></tr>

  ${o.notes ? `
  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Customer Notes</div>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#FDF4E7;border-radius:6px;">
      <tr><td style="padding:12px 14px;font-size:13px;color:#3D2E24;
                     font-family:Arial,sans-serif;line-height:1.6;">${o.notes}</td></tr>
    </table>
  </td></tr>` : ''}

  <tr><td style="padding:20px 10px 0;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B8976A;
                padding:0 14px;margin-bottom:8px;font-family:Arial,sans-serif;">Production Checklist</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;border-radius:6px;">
      ${checks}
    </table>
  </td></tr>

  <tr><td style="padding:20px 24px;background:#FAF7F2;border-top:1px solid #E8DDD8;margin-top:20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:10px;color:#B0A098;font-family:Arial,sans-serif;">
        hello@invitations.co.uk · invitations.co.uk
      </td>
      <td style="text-align:right;font-size:10px;color:#B0A098;font-family:Arial,sans-serif;">
        Ref: ${o.orderNumber} · Generated ${new Date().toLocaleDateString('en-GB')}
      </td>
    </tr></table>
  </td></tr>

</table></body></html>`;
}

// ── ADMIN NOTIFICATION EMAIL ──────────────────────────────────────────────────
function buildAdminNotificationHtml(o) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#F0EDE8;">
<table width="540" cellpadding="0" cellspacing="0"
       style="margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:#3D2E24;padding:16px 24px;">
    <span style="font-family:Georgia,serif;font-size:18px;color:#fff;letter-spacing:.06em;">
      Invita<span style="color:#D4B896;">tions</span>
    </span>
    <span style="font-size:11px;color:rgba(255,255,255,.4);margin-left:12px;
                 letter-spacing:.1em;text-transform:uppercase;">New Order</span>
  </td></tr>
  <tr><td style="padding:28px 24px;">
    <h2 style="font-family:Georgia,serif;font-size:20px;color:#3D2E24;margin:0 0 20px;">
      New order — £${parseFloat(o.total||0).toFixed(2)}
    </h2>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #E8DDD8;border-radius:6px;overflow:hidden;font-family:Arial,sans-serif;">
      <tr style="background:#FAF7F2;">
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;width:130px;">Order Ref</td>
        <td style="padding:10px 14px;font-size:13px;color:#3D2E24;">${o.orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;">Customer</td>
        <td style="padding:10px 14px;font-size:13px;color:#3D2E24;">${o.customerName}</td>
      </tr>
      <tr style="background:#FAF7F2;">
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;">Email</td>
        <td style="padding:10px 14px;font-size:13px;color:#3D2E24;">${o.customerEmail}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;">Product</td>
        <td style="padding:10px 14px;font-size:13px;color:#3D2E24;">
          ${o.quantity || '—'} invitations · ${o.paper || 'Smooth White'}
        </td>
      </tr>
      <tr style="background:#FAF7F2;">
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;">Total Paid</td>
        <td style="padding:10px 14px;font-size:15px;color:#B8976A;font-weight:bold;">
          £${parseFloat(o.total||0).toFixed(2)}
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#7A6558;margin-top:20px;line-height:1.8;font-family:Arial,sans-serif;">
      Job ticket sent automatically to the printer.<br>
      <a href="https://lighthearted-sunburst-4f0ba2.netlify.app/admin.html"
         style="color:#B8976A;">View in admin dashboard →</a>
    </p>
  </td></tr>
</table></body></html>`;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const { id: sessionId, amount_total, customer_details, metadata, shipping_details } = session;

    const total = (amount_total / 100);

    const address = shipping_details?.address
      ? [
          shipping_details.address.line1,
          shipping_details.address.line2,
          shipping_details.address.city,
          shipping_details.address.postal_code,
        ].filter(Boolean).join(', ')
      : 'Not provided';

    const order = {
      orderNumber:     metadata?.order_number || sessionId.slice(-8).toUpperCase(),
      customerName:    customer_details?.name  || 'Unknown',
      customerEmail:   customer_details?.email || 'Unknown',
      deliveryAddress: address,
      quantity:        metadata?.quantity   || null,
      paper:           metadata?.paper      || null,
      size:            metadata?.size       || null,
      artworkUrl:      metadata?.artwork_url || null,
      notes:           metadata?.notes      || null,
      total,
      orderDate:       new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
    };

    // 1. Update Supabase order status → printing
    await updateOrderStatus(sessionId, 'printing');

    // 2. Send job ticket to printer
    try {
      await sendEmail({
        to:      process.env.PRINTER_EMAIL || 'printer@placeholder.com',
        subject: `PRINT JOB — ${order.orderNumber} — ${order.quantity || '?'} invitations — ${order.paper || 'Smooth White'}`,
        html:    buildJobTicketHtml(order),
      });
      console.log(`Job ticket sent to printer for ${order.orderNumber}`);
    } catch (err) {
      console.error('Printer email failed (non-fatal):', err.message);
    }

    // 3. Send notification to admin
    try {
      await sendEmail({
        to:      process.env.NOTIFY_EMAIL || 'hello@invitations.co.uk',
        subject: `New Order — £${total.toFixed(2)} from ${order.customerName}`,
        html:    buildAdminNotificationHtml(order),
      });
      console.log(`Admin notification sent for ${order.orderNumber}`);
    } catch (err) {
      console.error('Admin notification failed (non-fatal):', err.message);
    }
  }

  // Always return 200 — Stripe retries on anything else
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
