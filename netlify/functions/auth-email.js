// /netlify/functions/auth-email.js
//
// Supabase's Send Email Hook. Supabase stops sending account emails itself and
// POSTs here instead, so confirmation, password reset and sign-in links go out
// through Resend, from orders@foreverprint.com, looking like everything else we
// send — rather than Supabase's unbranded default from a shared sender whose
// reputation we do not control.
//
// READ THIS BEFORE CHANGING ANYTHING HERE
//
// When the hook is enabled, Supabase does NOT fall back to its own email if
// this fails. A non-2xx reply fails the auth operation itself, so a bug in this
// file means nobody can register, confirm an address or reset a password. It is
// the most consequential function on the site for its size.
//
// To roll back: turn the hook off in Supabase → Authentication → Hooks. Supabase
// resumes sending its own emails immediately, with no deploy needed.
//
// THE LINK
//
// The verify endpoint lives on the SUPABASE API domain, not on foreverprint.com.
// Building it from the site URL produces a link that 404s for every customer, so
// it is built from SUPABASE_URL and the token hash Supabase sends us. The
// redirect_to in the payload is where the customer lands afterwards, and is
// whatever auth.js asked for: /login.html?verified=true after a signup,
// /reset-password.html after a reset.

const crypto = require('crypto');

const SUPABASE_URL   = process.env.SUPABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'orders@foreverprint.com';
const HOOK_SECRET    = process.env.SEND_EMAIL_HOOK_SECRET;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Standard Webhooks signature ───────────────────────────────────────────
// Supabase signs with the scheme at standardwebhooks.com: HMAC-SHA256 over
// "{id}.{timestamp}.{body}", base64, compared constant-time. The secret arrives
// as "v1,whsec_<base64>"; the key is the base64 AFTER that prefix.
function verifySignature(headers, rawBody) {
  if (!HOOK_SECRET) throw new Error('SEND_EMAIL_HOOK_SECRET is not set');

  const id   = headers['webhook-id'];
  const ts   = headers['webhook-timestamp'];
  const sigs = headers['webhook-signature'];
  if (!id || !ts || !sigs) throw new Error('missing webhook signature headers');

  // Replay window. Supabase retries within seconds; five minutes is generous.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > 300) throw new Error('webhook timestamp outside the replay window');

  const secret = HOOK_SECRET.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  const key = Buffer.from(secret, 'base64');
  const expected = crypto.createHmac('sha256', key)
    .update(`${id}.${ts}.${rawBody}`)
    .digest('base64');

  // The header may carry several space-separated "v1,<sig>" values.
  const ok = String(sigs).split(' ').some(part => {
    const value = part.includes(',') ? part.split(',')[1] : part;
    const a = Buffer.from(value || '', 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) throw new Error('webhook signature did not match');
}

// ── What each kind of email says ──────────────────────────────────────────
// WORDING NOT YET AGREED WITH NICHOLAS. Kept deliberately short and factual:
// these are the emails standing between a customer and their account, so they
// say what to do and nothing else.
const KINDS = {
  signup: {
    subject: 'Confirm your email address',
    heading: 'Confirm your email address',
    body: 'Thank you for creating a foreverprint account. Confirm your address and you are ready to go.',
    button: 'Confirm my email'
  },
  magiclink: {
    subject: 'Your sign-in link',
    heading: 'Your sign-in link',
    body: 'Use the link below to sign in. It can only be used once.',
    button: 'Sign in'
  },
  recovery: {
    subject: 'Reset your password',
    heading: 'Reset your password',
    body: 'Use the link below to choose a new password. If you did not ask for this, you can ignore it and nothing will change.',
    button: 'Choose a new password'
  },
  email_change: {
    subject: 'Confirm your new email address',
    heading: 'Confirm your new email address',
    body: 'Confirm this address and we will use it for your account from now on.',
    button: 'Confirm this address'
  },
  invite: {
    subject: 'You have been invited to foreverprint',
    heading: 'You have been invited',
    body: 'Accept the invitation below to set up your account.',
    button: 'Accept the invitation'
  }
};
// Anything we have not written copy for still has to send SOMETHING, or the
// customer is simply locked out.
const FALLBACK = {
  subject: 'Confirm your request',
  heading: 'Confirm your request',
  body: 'Use the link below to continue.',
  button: 'Continue'
};

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildAuthEmailHtml(kind, actionUrl, code) {
  return `
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <div style="background:#FAF7F2;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EFE9E1;border-radius:14px;overflow:hidden;">
      <div style="background:#3D2E24;padding:26px 28px;">
        <div style="font-family:Georgia,serif;font-size:21px;color:#fff;letter-spacing:.04em;">foreverprint</div>
      </div>
      <div style="padding:28px;">
        <div style="font-family:Georgia,serif;font-size:23px;color:#3D2E24;margin-bottom:12px;">${esc(kind.heading)}</div>
        <p style="font-size:14px;line-height:1.75;color:#5C4A3D;margin:0 0 22px;">${esc(kind.body)}</p>
        <p style="margin:0 0 22px;">
          <a href="${esc(actionUrl)}" style="display:inline-block;background:#3D2E24;color:#fff;text-decoration:none;font-size:14px;padding:13px 26px;border-radius:999px;">${esc(kind.button)}</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#9A8778;margin:0 0 6px;">
          If the button does not work, copy this into your browser:<br>
          <span style="color:#7A6558;word-break:break-all;">${esc(actionUrl)}</span>
        </p>
        ${code ? `<p style="font-size:12px;line-height:1.7;color:#9A8778;margin:14px 0 0;">Or enter this code: <strong style="color:#3D2E24;letter-spacing:.08em;">${esc(code)}</strong></p>` : ''}
        <p style="font-size:12px;line-height:1.7;color:#9A8778;margin:22px 0 0;">
          Any trouble at all, just reply to this email &mdash; a real person will answer.
        </p>
      </div>
      <div style="background:#FAF7F2;padding:16px 28px;border-top:1px solid #EFE9E1;">
        <div style="font-size:11px;color:#9A8778;">foreverprint &middot; Printed with care in the UK</div>
      </div>
    </div>
  </div>`;
}

// The link the customer clicks. Pure, and exported, because getting it wrong
// breaks every account email at once and it is the one thing here that can be
// checked without a live Supabase.
//
// Two things it must get right:
//   - the verify endpoint is on the SUPABASE API domain, not foreverprint.com.
//     Building it from the site URL gives every customer a link that 404s.
//   - an email change sends to BOTH addresses and carries two hashes.
//     token_hash_new belongs to the new address; using the old one there
//     confirms the wrong address.
function buildActionUrl(supabaseUrl, d) {
  const data = d || {};
  const type = String(data.email_action_type || '');
  const tokenHash = (type === 'email_change' && data.token_hash_new)
    ? data.token_hash_new
    : data.token_hash;
  if (!tokenHash) throw new Error('no token hash on the payload');
  return `${String(supabaseUrl || '').replace(/\/+$/, '')}/auth/v1/verify`
    + `?token=${encodeURIComponent(tokenHash)}`
    + `&type=${encodeURIComponent(type)}`
    + (data.redirect_to ? `&redirect_to=${encodeURIComponent(data.redirect_to)}` : '');
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: `foreverprint <${FROM_EMAIL}>`, to, subject, html })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: { message: 'Method Not Allowed' } }) };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  // Header names arrive lower-cased from Netlify, but normalise anyway.
  const headers = {};
  Object.keys(event.headers || {}).forEach(k => { headers[k.toLowerCase()] = event.headers[k]; });

  try {
    verifySignature(headers, rawBody);
  } catch (err) {
    console.error('[auth-email] rejected:', err.message);
    return { statusCode: 401, headers: JSON_HEADERS,
             body: JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }) };
  }

  try {
    const payload = JSON.parse(rawBody);
    const user = payload.user || {};
    const d = payload.email_data || {};
    const type = String(d.email_action_type || '');
    const kind = KINDS[type] || FALLBACK;

    if (!user.email) throw new Error('no email address on the payload');

    const actionUrl = buildActionUrl(SUPABASE_URL, d);

    await sendEmail({
      to: user.email,
      subject: kind.subject,
      html: buildAuthEmailHtml(kind, actionUrl, d.token || null)
    });

    console.log(`[auth-email] sent ${type || 'unknown'} to ${user.email}`);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({}) };

  } catch (err) {
    // Supabase surfaces this to the client and does NOT send its own email, so
    // say something a customer could act on rather than leaking the reason.
    console.error('[auth-email] failed:', err.message);
    return { statusCode: 500, headers: JSON_HEADERS,
             body: JSON.stringify({ error: { http_code: 500, message: 'Could not send the email. Please try again.' } }) };
  }
};

exports.buildAuthEmailHtml = buildAuthEmailHtml;
exports.buildActionUrl = buildActionUrl;
exports.verifySignature = verifySignature;
exports.KINDS = KINDS;
