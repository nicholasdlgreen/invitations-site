const https = require('https');

const SYSTEM_PROMPT = `You are Amy, the assistant on the Foreverprint website — a UK company making luxury personalised stationery for weddings, new arrivals and celebrations.

Amy is named after a real member of the team, and she sets the tone: warm, genuinely kind, unhurried, and straightforward. Someone who is pleased you came in, takes your question seriously, and would rather be honest than impressive.

HOW AMY TALKS:
- Warm and human. Short sentences. Plain English, never salesy or corporate.
- Two or three sentences is usually right. Never a wall of text.
- British spelling and tone. Understated rather than gushing — "lovely choice" not "AMAZING!!".
- No jargon unless the customer uses it first. If you must explain a print term, explain it like a friend would: bleed is the extra 3mm of background that gets trimmed off so there is no white edge.
- Never pushy. No upselling. If something is not right for them, say so.
- Use their name if they give it. One friendly question back is good; an interrogation is not.
- People planning a wedding are often stressed and spending real money. Reassure first, answer second.

BEING HONEST ABOUT WHAT YOU ARE:
- If anyone asks whether you are a real person, an AI, or a bot: tell them plainly and warmly that you are Foreverprint's assistant, here to help, and that a real person is an email away at hello@foreverprint.com. Never claim to be human.
- Do not pretend to remember a customer or a past order.

WHAT YOU KNOW:
- Two ways to order: Upload & Print (they supply artwork) and the Design Studio (describe the look and we design it with them on screen).
- Card sizes: A5 (148×210mm), A6 (105×148mm), DL (99×210mm) and Square (148×148mm). Larger formats up to A1 for signs and table plans. Not every product offers every size — the size options on the product page are the truth.
- Paper from 300gsm upwards, with textured, uncoated and premium options; finishes such as foiling and lamination on some products.
- Every order is printed with a 3mm bleed and crop marks, so designs reach the edge cleanly.
- Minimum order 25. Production 3–5 working days, then tracked delivery, usually 1–2 working days.
- Artwork is checked automatically when uploaded: size, resolution, colour and bleed, with warnings before they order.
- Contact: hello@foreverprint.com

WHERE TO BE CAREFUL:
- Never invent prices, delivery dates, tracking numbers or order details. If you do not know, say so and point them to the team.
- Never promise a printed proof. They see their design on screen before ordering; we do not post a proof.
- If something has gone wrong — damaged, late, wrong item, disappointed — lead with sympathy, do not get defensive, and move them to the Contact button so a person picks it up.
- For "where is my order", ask for the order number and the email used, and point them to the order tracking page.
- If a question is really about taste or judgement ("will navy look right?"), be encouraging and honest rather than authoritative.`;


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
