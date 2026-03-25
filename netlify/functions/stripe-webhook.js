// netlify/functions/stripe-webhook.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;

    const {
      id: sessionId,
      amount_total,
      customer_details,
      metadata,
      shipping_details,
    } = session;

    const totalGBP = (amount_total / 100).toFixed(2);
    const customerName = customer_details?.name || "Unknown";
    const customerEmail = customer_details?.email || "Unknown";
    const shippingAddress = shipping_details?.address
      ? [
          shipping_details.address.line1,
          shipping_details.address.line2,
          shipping_details.address.city,
          shipping_details.address.postal_code,
        ]
          .filter(Boolean)
          .join(", ")
      : "Not provided";

    const metaLines = Object.entries(metadata || {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    try {
      const emailBody = {
        from: "onboarding@resend.dev",
        to: process.env.NOTIFY_EMAIL,
        subject: `💍 New Order — £${totalGBP} from ${customerName}`,
        html: `
          <h2 style="color:#2d2d2d;font-family:Georgia,serif;">New Wedding Invitation Order</h2>
          <table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 12px;font-weight:bold;width:160px">Session ID</td><td style="padding:6px 12px">${sessionId}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:6px 12px;font-weight:bold">Customer</td><td style="padding:6px 12px">${customerName}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold">Email</td><td style="padding:6px 12px">${customerEmail}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:6px 12px;font-weight:bold">Shipping to</td><td style="padding:6px 12px">${shippingAddress}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold">Total Paid</td><td style="padding:6px 12px"><strong>£${totalGBP}</strong></td></tr>
            ${
              metaLines
                ? `<tr style="background:#f9f9f9"><td style="padding:6px 12px;font-weight:bold;vertical-align:top">Order Details</td><td style="padding:6px 12px;white-space:pre-line">${metaLines.replace(/\n/g, "<br>")}</td></tr>`
                : ""
            }
          </table>
          <p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin-top:24px">
            View full details in your <a href="https://dashboard.stripe.com">Stripe dashboard</a>.
          </p>
        `,
      };

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify(emailBody),
      });

      if (!resendResponse.ok) {
        const err = await resendResponse.text();
        console.error("Resend email failed:", err);
      } else {
        console.log(`Order notification sent for session ${sessionId}`);
      }
    } catch (emailErr) {
      console.error("Email error (non-fatal):", emailErr);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
