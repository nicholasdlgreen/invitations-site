// netlify/functions/studio-ai.js
// Foreverprint — AI Design Studio engine
// Takes a customer's brief (and optional refinement instruction) and asks Claude
// to compose several DISTINCT wedding-invitation design specifications as JSON.
// The browser renders these specs into SVG, so real text stays crisp and legible.

exports.handler = async (event) => {
  // CORS / method guard
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const brief = payload.brief || {};
  const refine = (payload.refine || '').toString().slice(0, 300); // optional refinement instruction
  const previous = payload.previous || null;                      // optional prior design spec to iterate on
  const count = Math.min(Math.max(parseInt(payload.count || 3, 10), 1), 4);

  // ─── Build the prompt ──────────────────────────────────────────────
  const system = `You are the design engine for Foreverprint, a luxury British wedding-stationery studio.
You compose wedding-invitation DESIGN SPECIFICATIONS as strict JSON. You never write SVG, HTML or prose — only JSON.

Each design must be GENUINELY DISTINCT from the others: vary the layout, the decorative motif, the typographic treatment and the mood — not merely the colour. Aim for the range a thoughtful human designer would present: e.g. one classic and centred, one botanical and asymmetric, one strikingly minimal. Be creative and surprising while staying elegant and on-brand for a high-end British couple.

Return ONLY a JSON object of this exact shape, with no markdown fences and no commentary:
{
  "designs": [
    {
      "name": "short evocative design name",
      "rationale": "one short sentence on why it suits the brief",
      "bg": "#hex background (soft, paper-like)",
      "ink": "#hex primary text colour",
      "accent": "#hex accent colour",
      "leaf": "#hex motif/botanical colour",
      "motif": "one of: sprig | wreath | floralCorners | archFrame | borderRule | singleStem | scattered | none",
      "motifPlacement": "one of: top | topBottom | corners | fullBorder | sides",
      "layout": "one of: centred | leftAligned | archTop | bordered",
      "headingFont": "one of: serif | serifItalic | script | sansCaps",
      "letterSpacing": "one of: tight | normal | wide",
      "divider": true,
      "monogram": false
    }
  ]
}
Provide exactly ${count} designs. Use only colours that work for fine wedding stationery (no neon, no pure black backgrounds). Vary motif, layout and font across the designs.`;

  let userContent;
  if (refine && previous) {
    userContent = `The couple liked this design but asked to refine it. Current design spec:
${JSON.stringify(previous)}

Their refinement request: "${refine}"

Return ${count} NEW variations that respond to this request while keeping what worked. Same JSON shape as specified.`;
  } else {
    userContent = `Compose ${count} distinct invitation designs for this brief:
- Season: ${brief.season || 'unspecified'}
- Feeling/style: ${brief.feeling || 'unspecified'}
- Colour preference: ${brief.colour || 'let the designer choose'}
- Couple's notes: ${brief.notes ? '"' + brief.notes.toString().slice(0, 400) + '"' : 'none given'}

Make the three feel meaningfully different from one another. Same JSON shape as specified.`;
  }

  // ─── Call Claude ───────────────────────────────────────────────────
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: system,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'AI service error', detail: errText.slice(0, 300) }) };
    }

    const data = await resp.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    // Strip any stray code fences, then parse
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      // Last resort: pull the first {...} block
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) { parsed = JSON.parse(m[0]); }
      else { throw e; }
    }

    if (!parsed || !Array.isArray(parsed.designs)) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'Unexpected AI response shape' }) };
    }

    return { statusCode: 200, headers: cors(), body: JSON.stringify(parsed) };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'Generation failed', detail: (err.message || '').slice(0, 200) }) };
  }
};

function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
