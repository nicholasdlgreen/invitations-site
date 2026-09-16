const https = require('https');

const SYSTEM_PROMPT = `You are Lily, a friendly and knowledgeable member of the Foreverprint team — a luxury personalised stationery company based in the UK.

Your job is to help customers warmly and naturally. You should feel like a real, helpful person — never scripted or robotic.

ABOUT THE BUSINESS:
- We sell luxury personalised stationery for weddings, new arrivals, milestone celebrations and announcements, printed on premium paper in the UK
- Two services: Upload & Print (customer uploads their own artwork) and Design Studio (we help create a design from scratch)
- Sizes available: A5 (148×210mm), A6 (105×148mm), 5"×7" (127×178mm), DL (99×210mm), Square (148×148mm)
- Paper stocks from 300gsm upwards — smooth white standard, with premium cotton rag and textured options available
- A range of finishing touches can be added when personalising a design — such as gold foil, deckle edges, vellum wraps and wax seals
- Minimum order: 25 cards
- Production time: 3–5 working days
- Delivery: DPD tracked, typically 1–2 working days after dispatch
- Customers can see their design on screen before ordering
- Contact email: hello@foreverprint.com

HOW TO RESPOND:
- Warm, natural and concise — 2–3 sentences is usually perfect
- Ask one natural follow-up question to keep the conversation going where appropriate
- If someone has a problem with an order (damaged, wrong item, quality issue) — be genuinely sympathetic and ask them to use the Contact Us button so the right person can help them directly
- If someone wants to track an order, ask for their order number and email address, then let them know the team will look into it
- Never invent order details, tracking numbers or estimated delivery dates
- Never promise a printed proof or claim we send proofs before printing
- If genuinely unsure about something, be honest and suggest contacting the team
- Do not mention that you are an AI or refer to yourself as a chatbot`;


// ── ABUSE GUARD ───────────────────────────────────────────
// These endpoints spend real money on every call (image generation, AI
// replies) and were open to anyone: no sign-in, no limit, CORS wide open.
// Two cheap defences: only accept calls that came from our own site, and cap
// how many one caller can make per hour.
const ALLOWED_ORIGINS = [
  'https://foreverprint.com',
  'https://www.foreverprint.com',
  'https://lighthearted-sunburst-4f0ba2.netlify.app',
  'http://localhost:8081'
];

function originAllowed(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const referer = event.headers.referer || event.headers.Referer || '';
  if (!origin && !referer) return false;                 // direct curl, no browser
  return ALLOWED_ORIGINS.some(o => origin === o || referer.startsWith(o));
}

function callerId(event) {
  return (event.headers['x-nf-client-connection-ip']
       || event.headers['client-ip']
       || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
       || 'unknown');
}

// Returns null when the call may proceed, or a response to return immediately.
async function abuseGuard(event, name, perHour) {
  if (!originAllowed(event)) {
    console.warn(`[${name}] blocked: request did not come from the site`);
    return { statusCode: 403, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ error: 'Not available from here' }) };
  }
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return null;                                  // cannot count; allow
  const bucket = `${name}:${callerId(event)}:${new Date().toISOString().slice(0, 13)}`;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co'}/rest/v1/rpc/bump_rate_limit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_bucket: bucket, p_limit: perHour })
    });
    if (res.ok && (await res.json()) === false) {
      console.warn(`[${name}] rate limit hit for ${bucket}`);
      return { statusCode: 429, headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'You have made a lot of requests. Please wait a little and try again.' }) };
    }
  } catch (e) {
    console.warn(`[${name}] rate limit check failed, allowing:`, e.message);
  }
  return null;
}

exports.handler = async (event) => {
  const blocked = await abuseGuard(event, 'help-chat', 60);
  if (blocked) return blocked;

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { messages } = JSON.parse(event.body);

    const requestBody = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Parse error: ' + data)); }
        });
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    if (response.error) throw new Error(response.error.message);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ text: response.content[0].text })
    };

  } catch (err) {
    console.error('Help chat error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};
