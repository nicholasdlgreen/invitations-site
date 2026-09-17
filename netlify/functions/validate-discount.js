/**
 * validate-discount — checks a discount code and says what it is worth.
 *
 * The browser never sees the code table. It asks this function, which answers
 * only with the outcome for the basket in hand. Two reasons:
 *
 *   1. If the codes were readable from the browser, anyone could list every
 *      code the business has ever issued.
 *   2. The answer here is advisory. create-checkout validates the code again
 *      before taking any money, because anything decided in a browser can be
 *      edited in a browser.
 *
 * Guessing is rate limited per IP: codes are short and a determined visitor
 * would otherwise simply try thousands.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MAX_ATTEMPTS = 15;          // per IP per hour — plenty for a real customer

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/**
 * Work out what a code is worth against a basket.
 * Shared with create-checkout via the exported function below, so the money
 * is calculated in exactly one place.
 */
function evaluate(row, { goodsTotal, deliveryCost, email, emailUses }) {
  const now = new Date();

  if (!row)                        return { valid: false, message: "That code isn't recognised." };
  if (!row.active)                 return { valid: false, message: 'That code is no longer available.' };
  if (row.starts_at  && new Date(row.starts_at)  > now) return { valid: false, message: "That code isn't active yet." };
  if (row.expires_at && new Date(row.expires_at) < now) return { valid: false, message: 'That code has expired.' };
  if (row.max_uses != null && row.used_count >= row.max_uses) {
    return { valid: false, message: 'That code has been fully redeemed.' };
  }
  if (row.min_order_value != null && goodsTotal < Number(row.min_order_value)) {
    return {
      valid: false,
      message: `That code needs an order of £${Number(row.min_order_value).toFixed(2)} or more.`,
    };
  }
  if (row.max_uses_per_email != null && email && emailUses >= row.max_uses_per_email) {
    return { valid: false, message: "You've already used that code." };
  }

  // Discounts apply to the goods, not to delivery — except the free delivery
  // type, which is only ever the delivery charge.
  let amount = 0;
  let label  = '';
  if (row.type === 'percent') {
    amount = goodsTotal * (Number(row.value) / 100);
    label  = `${Number(row.value)}% off`;
  } else if (row.type === 'fixed') {
    amount = Math.min(Number(row.value), goodsTotal);
    label  = `£${Number(row.value).toFixed(2)} off`;
  } else if (row.type === 'free_delivery') {
    amount = deliveryCost || 0;
    label  = 'Free delivery';
    if (amount <= 0) {
      return { valid: false, message: 'Your delivery is already free.' };
    }
  }

  amount = Math.max(0, Math.round(amount * 100) / 100);
  if (amount <= 0) return { valid: false, message: "That code doesn't reduce this order." };

  return {
    valid: true,
    code: String(row.code).toUpperCase(),
    type: row.type,
    label,
    description: row.description || '',
    amount,
  };
}

async function lookup(code, email) {
  const rows = await sb(`discount_codes?code=ilike.${encodeURIComponent(code)}&select=*&limit=1`);
  const row = rows && rows[0];
  let emailUses = 0;
  if (row && row.max_uses_per_email != null && email) {
    const used = await sb(
      `discount_redemptions?code_id=eq.${row.id}&email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=id`
    );
    emailUses = Array.isArray(used) ? used.length : 0;
  }
  return { row, emailUses };
}

function callerId(event) {
  return (event.headers['x-nf-client-connection-ip']
       || event.headers['client-ip']
       || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
       || 'unknown');
}

// Uses the same bump_rate_limit counter the other functions use, rather than
// a second scheme of its own.
async function tooManyAttempts(event) {
  if (!SERVICE_KEY) return false;
  const bucket = `discount:${callerId(event)}:${new Date().toISOString().slice(0, 13)}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_rate_limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ p_bucket: bucket, p_limit: MAX_ATTEMPTS }),
    });
    if (res.ok && (await res.json()) === false) return true;
  } catch (e) {
    // A broken limiter must not block a genuine order; the code itself is
    // still validated properly either way.
    console.warn('[discount] rate limit check failed, allowing:', e.message);
  }
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!SERVICE_KEY) {
    console.error('[discount] SUPABASE_SERVICE_KEY is not set');
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ valid: false, message: 'Discount codes are unavailable right now.' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const code = String(body.code || '').trim();
    const goodsTotal   = Math.max(0, Number(body.goodsTotal) || 0);
    const deliveryCost = Math.max(0, Number(body.deliveryCost) || 0);
    const email        = body.email ? String(body.email).trim() : '';

    if (!code) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ valid: false, message: 'Enter a code.' }) };
    }

    if (await tooManyAttempts(event)) {
      return {
        statusCode: 429,
        headers: JSON_HEADERS,
        body: JSON.stringify({ valid: false, message: 'Too many attempts. Please try again in a few minutes.' }),
      };
    }

    const { row, emailUses } = await lookup(code, email);
    const result = evaluate(row, { goodsTotal, deliveryCost, email, emailUses });
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(result) };
  } catch (e) {
    console.error('[discount] validation failed:', e.message);
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ valid: false, message: 'We could not check that code just now.' }),
    };
  }
};

// Shared with create-checkout so the discount is calculated in one place only.
exports.evaluate = evaluate;
exports.lookup = lookup;
