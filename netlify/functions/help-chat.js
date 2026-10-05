// ── WHO AMY IS ────────────────────────────────────────────
// Her identity, manner and limits. Fixed text: this is the agreed voice and
// does not change with the catalogue.
const PROMPT_HEAD = `You are Amy, the assistant on the foreverprint website — a UK company making luxury personalised stationery for weddings, new arrivals and celebrations.

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
- If anyone asks whether you are a real person, an AI, or a bot: tell them plainly and warmly that you are foreverprint's assistant, here to help, and that a real person is an email away at hello@foreverprint.com. Never claim to be human.
- Do not pretend to remember a customer or a past order.
`;

// ── WHAT SHE IS CAREFUL ABOUT ─────────────────────────────
const PROMPT_TAIL = `WHERE TO BE CAREFUL:
- Never invent prices, delivery dates, tracking numbers or order details. If you do not know, say so and point them to the team.
- Never promise a printed proof. They see their design on screen before ordering; we do not post a proof.
- If something has gone wrong — damaged, late, wrong item, disappointed — lead with sympathy, do not get defensive, and move them to the Contact button so a person picks it up.
- For "where is my order", ask for the order number and the email used, and point them to the order tracking page.
- If a question is really about taste or judgement ("will navy look right?"), be encouraging and honest rather than authoritative.`;

// ── WHAT SHE KNOWS, IF THE DATABASE CANNOT BE REACHED ─────
// The catalogue as it stood on 5 October 2026. This is a FALLBACK ONLY — the
// live version is built from the database below. It is kept because an outage
// at Supabase must make Amy slightly out of date, never silent, and because a
// prompt with no catalogue at all would have her improvising.
const KNOWLEDGE_FALLBACK = `WHAT YOU KNOW:
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
`;



// ── WHAT SHE KNOWS, READ FROM THE CATALOGUE ───────────────
// Amy used to carry a snapshot of the catalogue written into this file. It
// drifted for about four months without anyone noticing: she knew four of the
// fifteen sizes we sell, said "up to A1" when we sell A0, could not name a
// single paper, and said nothing at all about what delivery costs — which was
// the question that finally exposed it.
//
// The fix is not a better snapshot, it is not having one. These five tables
// ARE the shop: the order page, the landing pages and the price list all read
// them, so anything Amy says from here is what a customer sees on the page.
//
// Read with the ANON key, not the service key. Every one of these tables is
// already public to the browser — the widget itself reads print_sizes with the
// anon key — so there is nothing to elevate for, and a prompt-injection in a
// customer message can never reach more than the shop window.
const SB_URL  = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY;

// Held between invocations. Netlify reuses a warm container, so a busy widget
// reads the catalogue once every few minutes rather than once per message.
// Five minutes is short enough that a price or paper change reaches Amy while
// Nicholas is still looking at the site, and long enough that a conversation
// costs one read at most.
const CATALOGUE_TTL_MS = 5 * 60 * 1000;
let catalogueText = null, catalogueAt = 0;

async function sbRows(path) {
  const res = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON }
  });
  if (!res.ok) throw new Error(path.split('?')[0] + ' returned ' + res.status);
  return res.json();
}

// "Silk, Uncoated and Ice White" — not "Silk and Uncoated and Ice White".
function sentenceList(a) {
  if (!a.length) return '';
  if (a.length === 1) return a[0];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

function describeSizes(sizes) {
  const card  = sizes.filter(s => Math.max(+s.width_mm, +s.height_mm) <= 300);
  const large = sizes.filter(s => Math.max(+s.width_mm, +s.height_mm) > 300);
  const fmt = s => `${s.name} (${s.width_mm}×${s.height_mm}mm)`;
  let out = '- SIZES: ' + card.map(fmt).join(', ') + '.';
  if (large.length) out += ' Large formats for signs and plans: ' + large.map(fmt).join(', ') + '.';
  return out + ' Portrait and landscape cost the same. Not every product offers every size — the options on the product page are the truth.';
}

function describePapers(papers) {
  const lines = papers.map(p => {
    const w = Array.isArray(p.weights) ? p.weights : [];
    // Foamex is measured in mm, everything else in gsm; the row says which.
    const unit = w.length && w[0].unit ? w[0].unit : 'gsm';
    // Sorted: the table's own order put Uncoated's 120gsm after its 400, so
    // the paper read as "250/300/350/400/120gsm". Ascending is how a weight
    // list is read, and the row order is display order, not weight order.
    const nums = w.map(x => x.gsm).filter(n => n != null).sort((a, b) => a - b);
    const spec = nums.length ? ' ' + nums.join('/') + unit + '.' : '';
    // First sentence of the stock's own description — the rest is detail for
    // the paper page, and Amy is meant to be brief.
    const first = String(p.description || '').split(/(?<=\.)\s/)[0] || '';
    return `  ${p.name} — ${first}${spec}`;
  });
  return '- PAPERS (' + papers.length + ' stocks, not all on every product):\n'
       + lines.join('\n')
       + '\n  Weight does not change the price. Heavier is not more expensive — it is a different feel, not an upgrade.';
}

function describeFinishes(finishes) {
  const real = o => o && o.name && o.name.toLowerCase() !== 'none';
  const lines = finishes.map(f => {
    const opts = (f.options || []).filter(real).map(o => o.name);
    return `  ${f.name} — ${sentenceList(opts)}.`;
  });
  return '- FINISHES (where a product offers them, charged once for the order rather than per card):\n'
       + lines.join('\n')
       + '\n  We do NOT offer wax seals, ribbon, vellum wraps, envelope printing or spot UV. If someone asks for any of these, say plainly that we do not do them.';
}

function describeDelivery(options) {
  const money = n => '£' + Number(n).toFixed(0);
  const lines = options.map(o => {
    const days = Math.max(0, (o.production_days || 1) - 1) + (o.delivery_days || 1);
    const pct = parseFloat(o.surcharge_pct) || 0;
    const cost = pct > 0
      ? `${pct}% of the order value with a ${money(o.surcharge_min)} minimum`
      : (parseFloat(o.price) > 0 ? money(o.price) : 'FREE');
    return `  ${o.name} — ${days} working day${days === 1 ? '' : 's'}, ${cost}.`;
  });
  return '- DELIVERY:\n' + lines.join('\n')
       + '\n  Everything goes by tracked courier. The exact delivery cost is shown before they pay. We deliver within the UK only.';
}

// Deliberately no prices. The landing pages carry a from-price, but margins
// are not set yet, so every published figure is currently at or near cost, and
// what Amy quotes is a pricing decision rather than a catalogue fact. She is
// still told never to invent one. Switching it on later is one more table read.
async function buildKnowledge() {
  const [sizes, papers, finishes, delivery, products] = await Promise.all([
    sbRows('print_sizes?select=name,width_mm,height_mm&active=is.true&order=display_order'),
    sbRows('paper_stocks?select=name,description,weights&active=is.true&order=display_order'),
    sbRows('finish_types?select=name,description,options&active=is.true&order=display_order'),
    sbRows('delivery_options?select=name,price,surcharge_pct,surcharge_min,production_days,delivery_days&active=is.true&order=display_order'),
    sbRows('product_types?select=name&active=is.true&order=name')
  ]);
  if (!sizes.length || !papers.length || !delivery.length) {
    throw new Error('catalogue came back empty');
  }
  return [
    'WHAT YOU KNOW:',
    '(Read from the live catalogue on every reply, so it cannot go stale. If a',
    'customer tells you the product page says something different, the product',
    'page is right — say so and go with the page.)',
    '',
    '- Two ways to order: Upload & Print (they supply artwork) and the Design Studio (describe the look and we design it with them on screen).',
    '',
    '- WHAT WE SELL (' + products.length + ' products): ' + products.map(p => p.name).join(', ') + '.',
    '',
    describeSizes(sizes),
    '',
    describePapers(papers),
    '',
    describeFinishes(finishes),
    '',
    describeDelivery(delivery),
    '',
    '- No minimum order — as few as they need.',
    '- Every order is printed with a 3mm bleed and crop marks, so designs reach the edge cleanly.',
    '- Artwork is checked automatically when uploaded: size, resolution, colour and bleed, with warnings before they order.',
    '- Contact: hello@foreverprint.com'
  ].join('\n');
}

// Never throws. A catalogue we cannot reach must leave Amy slightly out of
// date, never silent — the whole point of this change was that a customer
// asking a question got an apology.
async function knowledge() {
  if (catalogueText && Date.now() - catalogueAt < CATALOGUE_TTL_MS) return catalogueText;
  if (!SB_ANON) return KNOWLEDGE_FALLBACK;
  try {
    catalogueText = await buildKnowledge();
    catalogueAt = Date.now();
    return catalogueText;
  } catch (e) {
    console.warn('[help-chat] catalogue read failed, using the snapshot:', e.message);
    return catalogueText || KNOWLEDGE_FALLBACK;   // a stale read beats no catalogue
  }
}

async function systemPrompt() {
  return PROMPT_HEAD + '\n' + (await knowledge()) + '\n' + PROMPT_TAIL;
}

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
      system: await systemPrompt(),
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
