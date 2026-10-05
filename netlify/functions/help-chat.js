const https = require('https');

// Pinned deliberately: a snapshot cannot change answers underneath us.
const MODEL = 'claude-haiku-4-5-20251001';

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
(Everything in this section was taken from the live catalogue on 5 October 2026.
If a customer tells you the product page says something different, the product
page is right and you are out of date — say so and go with the page.)

- Two ways to order: Upload & Print (they supply artwork) and the Design Studio (describe the look and we design it with them on screen).

- WHAT WE SELL (22 products): wedding invitations, save the dates, RSVP cards, menu cards, order of service, place cards, table numbers, table plans, welcome signs, signage, thank you cards, greeting cards, Christmas cards, engagement cards, engagement party invitations, birthday invitations, party invitations, baby shower invitations, christening invitations, new arrival cards, moving cards, graduation cards.

- SIZES: A6 (105×148mm), A5 (148×210mm), DL (99×210mm), Square (148×148mm), Square 210 (210×210mm), A4 (210×297mm), A3 (297×420mm), Place card (85×55mm), and large formats for signs and plans: A2 (420×594mm), A1 (594×841mm), A0 (841×1189mm). A4, A3, A2 and A1 also come in landscape. Portrait and landscape cost the same. Not every product offers every size — the options on the product page are the truth.

- PAPERS (ten stocks, not all on every product):
  Silk — smooth, lightly coated, a soft sheen. The most popular, and the safest choice for photographs or fine detail. 250/300/350/400gsm.
  Uncoated — matt, soft, faintly toothy, and the easiest to write on. 120/250/300/350/400gsm.
  Tintoretto Gesso (Fedrigoni, Italy) — a finely hammered surface in a warm white. 140/300gsm.
  Nettuno Bianco (Fedrigoni) — deep felt marking in fine parallel lines, cool white. 280gsm.
  Acquerello Bianco — watercolour tooth in a soft cream white, lovely under calligraphy. 280gsm.
  Sirio Pearl Polar Dawn (Fedrigoni) — pearlescent through the sheet, shifts in the light, never metallic. 300gsm.
  Recycled Uncoated — wholly recycled, thick, with natural fibre flecks visible. 350gsm.
  Cartonboard — rigid board, bright white face. 255gsm.
  Ice White — cool bright white with a silk face, for designs that depend on contrast. 300gsm.
  Foamex 5mm — rigid waterproof PVC board for signs; it will not bow on an easel.
  Weight does not change the price. Heavier is not more expensive — it is a different feel, not an upgrade.

- FINISHES (where a product offers them, charged once for the order rather than per card):
  Foiling in eight colours — gold, silver, copper, rose gold, red, blue, green and holographic.
  Lamination — matt, gloss or soft touch.
  Corners — square, or rounded.
  Protective finish — matt or gloss film over the printed face.
  Hanging holes on signs — two or four.
  Folding, where the product is a folded card.
  We do NOT offer wax seals, ribbon, vellum wraps, envelope printing or spot UV. Spot UV was withdrawn. If someone asks for any of these, say plainly that we do not do them.

- DELIVERY: Standard is FREE and printed in 3 working days. Express is 2 working days and costs 20% of the order value with a £20 minimum. Next day (order by 1pm) costs 40% with a £40 minimum. Everything goes by tracked courier. The exact delivery cost is shown before they pay. We deliver within the UK only.

- No minimum order — as few as they need.

- Every order is printed with a 3mm bleed and crop marks, so designs reach the edge cleanly.

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

// ── WHAT WAS ASKED, AND WHAT WE SAID ──────────────────────
// Nothing was recorded until 5 October 2026, which is exactly why this
// function could return HTTP 500 to every customer who typed a question,
// from the day it was built, without anyone finding out. The missing
// ANTHROPIC_API_KEY was on the to-do list as a loose end rather than as
// "the help assistant is dead", because there was no evidence either way.
//
// It logs FAILURES as well as successes. A logger that only runs on the happy
// path would have stayed silent through the entire outage it is here to catch.
// It never throws and never delays the reply: a logging problem must not
// become a customer problem.
async function logTurn(row) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return;                        // nothing to write with; stay quiet
  try {
    const url = (process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co')
              + '/rest/v1/help_chat_log';
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    });
  } catch (e) {
    console.warn('[help-chat] could not write the log:', e.message);
  }
}

// The customer's last message, which is what they actually asked.
function lastQuestion(messages) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user') {
      return String(messages[i].content || '').slice(0, 4000);
    }
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

  // Declared outside the try so the catch can log them too. Parsed defensively:
  // a malformed body must still produce a log row saying so.
  const started = Date.now();
  let sessionId = null, turn = null, question = null;

  try {
    const body = JSON.parse(event.body);
    const messages = body.messages;
    sessionId = body.sessionId ? String(body.sessionId).slice(0, 64) : null;
    question = lastQuestion(messages);
    turn = Array.isArray(messages)
      ? messages.filter(m => m && m.role === 'user').length : null;

    const requestBody = JSON.stringify({
      model: MODEL,
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

    const text = response.content[0].text;
    await logTurn({
      session_id: sessionId, turn, question, answer: text.slice(0, 8000),
      ok: true, model: MODEL,
      input_tokens:  response.usage ? response.usage.input_tokens  : null,
      output_tokens: response.usage ? response.usage.output_tokens : null,
      ms: Date.now() - started
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ text: text })
    };

  } catch (err) {
    console.error('Help chat error:', err);
    // The branch that matters. Without this the outage that prompted all of
    // this would have left no trace in the one place we would think to look.
    await logTurn({
      session_id: sessionId, turn, question, answer: null,
      ok: false, error: String(err && err.message || err).slice(0, 1000),
      model: MODEL, ms: Date.now() - started
    });
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};
