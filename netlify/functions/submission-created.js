// /netlify/functions/submission-created.js
//
// Tells somebody when a form on the site is filled in.
//
// Netlify invokes a function with this exact name on every verified form
// submission — there is no wiring to forget, which is the point. Until now
// nothing was configured at all: the contact page says "We will reply by email
// to the address you gave us", the submission was stored in a dashboard, and
// nobody was told. Found 7 October, after Nicholas's own test on 6 October
// never reached him and mail delivery was wrongly suspected.
//
// It handles both live forms:
//   contact        — someone writing in, needs a reply
//   launch-signup  — the holding page's "tell me when you open"
//
// Deliberately simple. The submission is already stored by Netlify whatever
// happens here, so the worst case is a missed notification rather than a lost
// message — but a throw would be silent, so every failure is logged loudly and
// the function still returns 200. Netlify retries nothing on a 500, and a
// retry would only duplicate the email.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL   || 'orders@foreverprint.com';
const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || 'hello@foreverprint.com';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

async function send(payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

function contactEmail(d) {
  const topic = d.topic || 'No topic given';
  const order = String(d.order || '').trim();
  const rows = [
    ['What it is about', topic],
    ['Name',             d.name  || '(not given)'],
    ['Email',            d.email || '(not given)'],
    ['Order number',     order || '(none given)']
  ];
  return {
    // The subject carries the topic so an urgent one is visible without
    // opening it, which is the whole reason the topic field exists.
    subject: `Contact form: ${topic}`,
    html:
      `<div style="font-family:system-ui,sans-serif;max-width:600px">` +
      `<h2 style="font-family:Georgia,serif;font-weight:400">Someone has written in</h2>` +
      `<table style="border-collapse:collapse;margin:16px 0">` +
      rows.map(([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#7A6558">${esc(k)}</td>` +
        `<td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`).join('') +
      `</table>` +
      `<div style="white-space:pre-wrap;border-left:3px solid #E8DDD8;padding:4px 0 4px 14px;margin:18px 0">` +
      `${esc(d.message || '(no message)')}</div>` +
      `<p style="color:#7A6558;font-size:14px">Reply straight to this email — it goes back to them.</p>` +
      `</div>`,
    // So hitting Reply in the mail client answers the customer, not ourselves.
    reply_to: d.email || undefined
  };
}

function signupEmail(d) {
  return {
    subject: 'Someone asked to be told when we launch',
    html:
      `<div style="font-family:system-ui,sans-serif;max-width:600px">` +
      `<h2 style="font-family:Georgia,serif;font-weight:400">New launch signup</h2>` +
      `<p style="font-size:18px"><strong>${esc(d.email || '(no address)')}</strong></p>` +
      `<p style="color:#7A6558;font-size:14px">From the holding page on the home page.</p>` +
      `</div>`
  };
}

exports.handler = async (event) => {
  try {
    if (!RESEND_API_KEY) {
      console.error('[submission-created] RESEND_API_KEY is not set — nobody was told');
      return { statusCode: 200, body: 'not configured' };
    }

    const body = JSON.parse(event.body || '{}');
    const payload = body.payload || body;
    const formName = payload.form_name || payload.formName || '';
    const d = payload.data || {};

    const built = formName === 'launch-signup' ? signupEmail(d) : contactEmail(d);

    await send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: built.subject,
      html: built.html,
      ...(built.reply_to ? { reply_to: built.reply_to } : {})
    });

    console.log('[submission-created] notified about', formName || 'contact');
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    // Loud, because the submission is safe in Netlify but nobody knows it is
    // there — which is exactly the fault this function exists to fix.
    console.error('[submission-created] COULD NOT NOTIFY:', e.message);
    return { statusCode: 200, body: 'logged' };
  }
};
