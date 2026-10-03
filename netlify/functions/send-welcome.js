// /netlify/functions/send-welcome.js
//
// The welcome email, for someone who has registered rather than ordered.
//
// Until now the only thing that created a contacts row was checkout, so the
// welcome email could not reach anyone who had merely signed up — their
// consent sat in `profiles`, which the email system never reads. Someone could
// tick "keep me in touch", confirm their address, and hear nothing from us
// until they spent money.
//
// WHY IT RUNS ON SIGN-IN, NOT ON THE REGISTRATION FORM
//
// Registering proves nothing: 115 of the first 134 accounts never confirmed
// their address, which is what a bot signup looks like. Emailing those would
// be sending to addresses nobody owns, and sender reputation is the one thing
// in email you cannot buy back. So the trigger is the first sign-in AFTER the
// address has been confirmed — by then we know the address is real and theirs.
//
// Being called on every sign-in is deliberate and safe: claim_welcome_email
// marks the contact welcomed in the same statement that hands it back, so the
// second call returns nothing. It also means a customer who confirms on their
// phone and never lands on the right page still gets it, next time they sign in.
//
// AUTHENTICATION
//
// The caller sends the user's own Supabase access token. We ask Supabase who
// that token belongs to and believe only the answer, never the request body —
// so this cannot be used to send mail to an address the caller does not own,
// and it needs no shared secret of its own.

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'orders@foreverprint.com';

const CONSENT_TEXT = 'Keep me in touch with new products, offers and ideas';

// One welcome email, one template. stripe-webhook.js owns it because that is
// where it was written; this sends the same thing to someone who registered.
const { buildWelcomeHtml } = require('./stripe-webhook.js');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Who does this token belong to? Supabase answers, not the caller.
async function userFromToken(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.json();
}

async function rpc(name, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY,
               Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: `Foreverprint <${FROM_EMAIL}>`, to, subject, html })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!SUPABASE_URL || !RESEND_API_KEY) {
    console.warn('[send-welcome] not configured — SUPABASE_URL or RESEND_API_KEY missing');
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ sent: false, reason: 'not configured' }) };
  }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Sign-in required' }) };
  }

  try {
    const user = await userFromToken(token);
    if (!user || !user.email) {
      return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Sign-in required' }) };
    }
    // An unconfirmed address is not known to be theirs, and is what a bot
    // signup looks like. Nothing is sent and nothing is recorded.
    if (!user.email_confirmed_at && !user.confirmed_at) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ sent: false, reason: 'email not confirmed' }) };
    }

    const meta = user.user_metadata || {};
    const consent = meta.marketing_optin === true;

    // Record them either way. Without consent this writes a contact with
    // marketing_consent false, which is the honest record of someone who
    // registered and did not opt in — and claim_welcome_email will refuse it.
    await rpc('upsert_contact_from_signup', {
      p_email: user.email,
      p_name: meta.full_name || null,
      p_consent: consent,
      p_consent_text: CONSENT_TEXT,
      p_source: 'account signup'
    });

    if (!consent) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ sent: false, reason: 'no marketing consent' }) };
    }

    // Claim-and-send: the database hands the contact back only if they may be
    // welcomed, and marks them welcomed in the same step, so being called on
    // every sign-in sends exactly one email.
    const rows = await rpc('claim_welcome_email', { p_email: user.email });
    const contact = Array.isArray(rows) ? rows[0] : null;
    if (!contact) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ sent: false, reason: 'already welcomed, or not eligible' }) };
    }

    const unsubscribeUrl = `https://foreverprint.com/.netlify/functions/unsubscribe?token=${contact.unsubscribe_token}`;
    try {
      await sendEmail({
        to: contact.email,
        subject: 'Welcome to Foreverprint',
        html: buildWelcomeHtml(contact, unsubscribeUrl)
      });
    } catch (sendErr) {
      // The claim is taken before sending, so hand it back if the send fails —
      // otherwise they are marked welcomed forever and never receive it.
      console.error('[send-welcome] send failed, releasing the claim:', sendErr.message);
      await fetch(`${SUPABASE_URL}/rest/v1/contacts?email=eq.${encodeURIComponent(contact.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY,
                   Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ welcome_sent_at: null })
      });
      throw sendErr;
    }

    console.log('[send-welcome] welcomed', contact.email);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ sent: true }) };

  } catch (err) {
    console.error('[send-welcome]', err.message);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Could not send the welcome email' }) };
  }
};
