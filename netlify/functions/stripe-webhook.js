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
// Service key: this function updates orders, and once row-level rules are
// tightened the public key can no longer do that. Falls back to the anon key so
// a missing env var degrades rather than breaking payments outright — the
// warning below is the signal to set it.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.warn('[stripe-webhook] SUPABASE_SERVICE_KEY not set — falling back to the public key, which cannot update locked tables');
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
// The full order — line items, paper, sizes — lives in Supabase. Stripe
// metadata caps each value at 500 characters, so a cart does not fit there.
async function fetchOrderBySession(sessionId) {
  if (!SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  } catch (err) {
    console.warn('Could not read the order back:', err.message);
    return null;
  }
}

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

// ── CUSTOMER ORDER CONFIRMATION ───────────────────────────
// Until now the customer received nothing at all: the printer got a job ticket,
// the office got a notification, and the person who had just paid heard silence
// until the cards arrived. This is the email they actually want — proof it
// worked, what is coming, and when.
//
// No VAT line: the business is not VAT registered, so the total is simply the
// total. Add the breakdown back when registration comes through.
function buildCustomerConfirmationHtml(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const firstName = String(o.customerName || '').trim().split(' ')[0] || 'there';
  const itemRows = items.length
    ? items.map(i => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #EFE9E1;font-family:Arial,sans-serif;font-size:13px;color:#3D2E24;">
            ${i.name || 'Your design'}${i.size ? ` &middot; ${i.size}` : ''}${i.paper ? `<br><span style="color:#7A6558;font-size:12px;">${i.paper}</span>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #EFE9E1;text-align:right;font-family:Arial,sans-serif;font-size:13px;color:#3D2E24;white-space:nowrap;">
            ${i.qty ? i.qty + ' cards' : ''}
          </td>
        </tr>`).join('')
    : `<tr><td style="padding:10px 0;font-family:Arial,sans-serif;font-size:13px;color:#3D2E24;">Your order</td><td></td></tr>`;

  return `
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <div style="background:#FAF7F2;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EFE9E1;border-radius:14px;overflow:hidden;">

      <div style="background:#3D2E24;padding:26px 28px;">
        <div style="font-family:Georgia,serif;font-size:21px;color:#fff;letter-spacing:.04em;">foreverprint</div>
      </div>

      <div style="padding:30px 28px 8px;">
        <div style="font-family:Georgia,serif;font-size:23px;color:#3D2E24;margin-bottom:12px;">Thank you, ${firstName}.</div>
        <p style="font-size:14px;line-height:1.75;color:#5C4A3D;margin:0 0 6px;">
          Your order is confirmed and already with our print team. Here is everything for your records.
        </p>
      </div>

      <div style="padding:18px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:10px;">Order ${o.orderNumber}</div>
        <table style="width:100%;border-collapse:collapse;">${itemRows}</table>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <tr>
            <td style="padding:14px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#3D2E24;font-weight:bold;">Total paid</td>
            <td style="padding:14px 0 0;text-align:right;font-family:Georgia,serif;font-size:19px;color:#3D2E24;">&pound;${Number(o.total || 0).toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="padding:22px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:10px;">What happens now</div>
        <div style="font-size:14px;line-height:1.8;color:#5C4A3D;">
          <div style="margin-bottom:7px;">1. We prepare your artwork for press and print it &mdash; usually 3&ndash;5 working days.</div>
          <div style="margin-bottom:7px;">2. We email you as soon as it is on its way, with tracking.</div>
          <div>3. Delivery is normally 1&ndash;2 working days after that.</div>
        </div>
      </div>

      ${o.deliveryAddress && o.deliveryAddress !== 'Not provided' ? `
      <div style="padding:22px 28px 0;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#B8976A;margin-bottom:8px;">Delivering to</div>
        <div style="font-size:14px;line-height:1.7;color:#5C4A3D;">${o.deliveryAddress}</div>
        <div style="font-size:12px;color:#8C7B6E;margin-top:8px;">Not right? Reply to this email today and we will fix it before printing.</div>
      </div>` : ''}

      <div style="padding:24px 28px 30px;">
        <div style="border-top:1px solid #EFE9E1;padding-top:18px;font-size:13px;line-height:1.8;color:#5C4A3D;">
          Any questions at all, just reply to this email or write to
          <a href="mailto:hello@foreverprint.com" style="color:#B8976A;">hello@foreverprint.com</a> &mdash; a real person will answer.
          <br>You can also check progress any time at
          <a href="https://foreverprint.com/track-order" style="color:#B8976A;">foreverprint.com/track-order</a>
          using order ${o.orderNumber}.
        </div>
      </div>

      <div style="background:#FAF7F2;padding:16px 28px;text-align:center;font-size:11px;color:#8C7B6E;">
        Foreverprint &middot; Printed with care in the UK
      </div>
    </div>
  </div>`;
}

function buildJobTicketHtml(o) {
  const fmt = v => `&pound;${parseFloat(v || 0).toFixed(2)}`;
  const subtotal = o.total / 1.2;
  const vat      = o.total - subtotal;

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
                 color:#B0A098;font-family:Arial,sans-serif;vertical-align:top;width:160px;">${label}</td>
      <td style="padding:8px 14px;font-size:13px;color:#3D2E24;font-family:Arial,sans-serif;
                 line-height:1.6;">${value || '&mdash;'}</td>
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
      ${row('Quantity',   o.quantity ? `${o.quantity} invitations` : '&mdash;')}
      ${row('Paper Stock', o.paper || 'Smooth White 300gsm')}
      ${row('Size',       o.size  || '<strong style="color:#B00020;">NOT RECORDED &mdash; check the order before printing</strong>')}
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
        ${o.printReadyUrl
          ? `<div style="font-size:12px;color:#7A6558;margin-bottom:8px;font-family:Arial,sans-serif;">
               <strong>Print this file.</strong> Built to the ordered size with 3mm bleed
               and crop marks, trim box set. Supplied in RGB &mdash; your RIP handles
               the colour conversion.
             </div>
             <a href="${o.printReadyUrl}"
                style="color:#B8976A;font-size:13px;word-break:break-all;font-family:Arial,sans-serif;">
               &#128196; Download PRINT-READY file
             </a>
             <div style="font-size:11px;color:#B0A098;margin:10px 0 4px;font-family:Arial,sans-serif;">
               Customer's original upload (reference only &mdash; do not print):
             </div>
             ${o.artworkUrl ? `<a href="${o.artworkUrl}" style="color:#B0A098;font-size:11px;word-break:break-all;font-family:Arial,sans-serif;">&#128206; Original artwork</a>` : ''}`
          : o.artworkUrl
          ? `<div style="font-size:12px;color:#B00020;margin-bottom:8px;font-family:Arial,sans-serif;">
               <strong>No print-ready file was produced &mdash; prepress must prepare this
               before printing.</strong> Only the customer's original upload is available:
             </div>
             <a href="${o.artworkUrl}"
                style="color:#B8976A;font-size:13px;word-break:break-all;font-family:Arial,sans-serif;">
               &#128206; Download Artwork File
             </a>`
          : `<div style="font-size:12px;color:#B0A098;font-family:Arial,sans-serif;">
               No artwork file uploaded &mdash; check the admin dashboard
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
        hello@invitations.co.uk &middot; invitations.co.uk
      </td>
      <td style="text-align:right;font-size:10px;color:#B0A098;font-family:Arial,sans-serif;">
        Ref: ${o.orderNumber} &middot; Generated ${new Date().toLocaleDateString('en-GB')}
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
      New order &mdash; &pound;${parseFloat(o.total||0).toFixed(2)}
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
          ${o.quantity || '&mdash;'} invitations &middot; ${o.paper || 'Smooth White'}
        </td>
      </tr>
      <tr style="background:#FAF7F2;">
        <td style="padding:10px 14px;font-size:11px;color:#B0A098;">Total Paid</td>
        <td style="padding:10px 14px;font-size:15px;color:#B8976A;font-weight:bold;">
          &pound;${parseFloat(o.total||0).toFixed(2)}
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
      printReadyUrl:   metadata?.print_ready_url || null,
      items:           [],   // filled from Supabase below
      notes:           metadata?.notes      || null,
      total,
      orderDate:       new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
    };

    // 1. Update Supabase order status → printing
    await updateOrderStatus(sessionId, 'printing');

    // Enrich from the stored order: line items, paper and quantity for the
    // emails, and the print-ready file for the job ticket.
    const stored = await fetchOrderBySession(sessionId);
    if (stored) {
      order.items         = Array.isArray(stored.items) ? stored.items : [];
      order.paper         = order.paper       || stored.paper       || null;
      order.size          = order.size        || stored.size        || null;
      order.quantity      = order.quantity    || (order.items[0] && order.items[0].qty) || null;
      order.artworkUrl    = order.artworkUrl  || stored.artwork_url || null;
      order.printReadyUrl = order.printReadyUrl || stored.print_ready_url || null;
      order.customerEmail = (order.customerEmail && order.customerEmail !== 'Unknown')
        ? order.customerEmail : (stored.customer_email || order.customerEmail);
      if (!order.total) order.total = Number(stored.total) || 0;
    } else {
      console.warn(`Order ${order.orderNumber} not found in Supabase — emails will be sparse`);
    }

    // 2. Confirm to the customer. Sent before the internal emails: if anything
    //    fails, the person who paid should still have heard from us.
    try {
      if (order.customerEmail && order.customerEmail !== 'Unknown') {
        await sendEmail({
          to:      order.customerEmail,
          subject: `Your Foreverprint order ${order.orderNumber} is confirmed`,
          html:    buildCustomerConfirmationHtml(order),
        });
        console.log(`Confirmation sent to customer for ${order.orderNumber}`);
      } else {
        console.warn(`No customer email on ${order.orderNumber} — confirmation not sent`);
      }
    } catch (err) {
      console.error('Customer confirmation failed (non-fatal):', err.message);
    }

    // 3. Send job ticket to printer
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

    // 4. Send notification to admin
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
