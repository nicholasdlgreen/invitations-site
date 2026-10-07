// /netlify/functions/saved-design-reminder.js
//
// docs/CRM.md W4 — someone saved a design and has not ordered.
//
// This is the abandoned-checkout equivalent for this business, and the
// published benchmarks put welcome plus abandoned checkout at 40–60% of all
// flow revenue. Ours has an advantage most shops do not: we can show people
// THEIR OWN design, with their own names on it, rather than a product photo.
//
// ── IT CANNOT SEND UNTIL THE WORDS EXIST ────────────────────────────
// buildReminderHtml() is deliberately not written. Copy on this site is
// Nicholas's, never Claude's, and an unattended email to a real customer is
// the last place to break that rule. Until the body exists and
// SAVED_REMINDER_LIVE=true is set in Netlify, this runs as a DRY RUN: it works
// out exactly who it would email and writes that to the function log, and
// sends nothing.
//
// ── SAFETY RULES, because this emails real people unattended ────────
//   * reminder_sent_at is the single send-once guard. One design, one email,
//     ever — a redeploy or a second schedule cannot repeat it.
//   * A moving window. Designs saved between WINDOW_MIN_DAYS and
//     WINDOW_MAX_DAYS ago only, so rows that predate this function can never
//     be swept up by a later deploy. The upper bound is the important half.
//   * Anyone who has ordered is skipped, checked by email against orders at
//     the moment of sending rather than trusted from a flag.
//   * Anyone who has unsubscribed is skipped.
//   * Never more than MAX_PER_RUN in one run, so a mistake is small and
//     visible rather than a mailshot.
//   * ONE message per saved design. A second nudge is a separate decision and
//     would need marketing consent; a single reminder about a thing somebody
//     asked us to keep is a service message, which is why this one does not.
//
// Schedule lives in netlify.toml.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, FROM_EMAIL

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'hello@foreverprint.com';
const LIVE         = String(process.env.SAVED_REMINDER_LIVE || '').toLowerCase() === 'true';

const WINDOW_MIN_DAYS = 3;    // long enough not to be pushy about a considered buy
const WINDOW_MAX_DAYS = 21;   // older than this is not a live intention
const MAX_PER_RUN     = 25;

const headers = () => ({
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
});

async function sb(path, init) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...(init || {}), headers: headers() });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json();
}

// saved_designs holds a user_id, not an address. auth.users is not exposed
// through PostgREST, so the Auth admin API is the supported way to resolve it.
async function emailForUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: headers() });
  if (!res.ok) return null;
  const u = await res.json();
  return (u && u.email) ? String(u.email).toLowerCase() : null;
}

// Checked at send time rather than trusted from a flag: somebody may have
// ordered between the design being saved and this running.
async function hasOrdered(email) {
  const rows = await sb(`orders?select=id&customer_email=eq.${encodeURIComponent(email)}&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

async function hasUnsubscribed(email) {
  const rows = await sb(
    `contacts?select=unsubscribed_at&email=eq.${encodeURIComponent(email)}&limit=1`);
  return Array.isArray(rows) && rows.length > 0 && !!rows[0].unsubscribed_at;
}

// NOT WRITTEN ON PURPOSE. See the header. Returning null is what keeps this
// function in dry run even if someone sets the environment variable.
function buildReminderHtml(/* design, email, unsubscribeUrl */) {
  return null;
}

exports.handler = async () => {
  if (!SERVICE_KEY) {
    console.error('[saved-reminder] SUPABASE_SERVICE_KEY not set — nothing done');
    return { statusCode: 500, body: 'not configured' };
  }

  try {
    const now       = Date.now();
    const notAfter  = new Date(now - WINDOW_MIN_DAYS * 864e5).toISOString();
    const notBefore = new Date(now - WINDOW_MAX_DAYS * 864e5).toISOString();

    const designs = await sb(
      'saved_designs?select=id,user_id,product_type,design_data,metadata,created_at' +
      '&reminder_sent_at=is.null' +
      `&created_at=lte.${notAfter}` +
      `&created_at=gte.${notBefore}` +
      '&order=created_at.asc' +
      `&limit=${MAX_PER_RUN}`);

    const would = [], skipped = { no_email: 0, ordered: 0, unsubscribed: 0 };

    for (const d of designs || []) {
      const email = await emailForUser(d.user_id);
      if (!email)                      { skipped.no_email++;     continue; }
      if (await hasOrdered(email))     { skipped.ordered++;      continue; }
      if (await hasUnsubscribed(email)){ skipped.unsubscribed++; continue; }
      would.push({ design: d.id, product: d.product_type, saved: d.created_at, email: email });
    }

    const body = LIVE ? buildReminderHtml() : null;
    const report = {
      mode: (LIVE && body) ? 'LIVE — emails were sent'
          : LIVE ? 'DRY RUN — SAVED_REMINDER_LIVE is set but the email body is not written yet'
                 : 'DRY RUN — nothing was sent',
      rule: `saved ${WINDOW_MIN_DAYS}–${WINDOW_MAX_DAYS} days ago, never reminded, has not ordered`,
      examined: (designs || []).length,
      would_email: would.length,
      skipped,
      sample: would.slice(0, 5).map(w => ({ product: w.product, saved: w.saved }))
    };

    if (LIVE && body) {
      // Reserved for when the words exist. The send-once guard is written
      // BEFORE the send, so a failure half way cannot re-email anybody.
      report.sent = 0;
    }

    console.log('[saved-reminder]', JSON.stringify(report));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(report, null, 2) };
  } catch (e) {
    console.error('[saved-reminder] failed:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

exports._internals = { WINDOW_MIN_DAYS, WINDOW_MAX_DAYS, MAX_PER_RUN, buildReminderHtml };
