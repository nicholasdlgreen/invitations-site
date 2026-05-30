// netlify/functions/studio-generate.js
//
// Foreverprint AI Design Studio — creative generation engine.
// Runs a three-step loop server-side:
//   1. ART-DIRECT  — Claude writes a rich creative concept from the brief
//   2. RENDER      — Claude draws that concept as print-ready SVG
//   3. REFINE      — Claude critiques and improves the SVG (optional)
// Returns { concept, svg }.
//
// Env: ANTHROPIC_API_KEY (already set in Netlify).
// Model: Sonnet, for quality (locked; not exposed to the client).

const MODEL = 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';

const ARTDIRECT_SYSTEM = `You are the lead designer at Foreverprint, a luxury British wedding-stationery house. A couple described their wedding. Write a rich, specific CREATIVE CONCEPT for one A5 portrait invitation — the art-direction a senior designer writes before drawing.

Think like a real designer, not a template-filler:
- Make the couple's motifs STRUCTURAL (a cascading asymmetric arch, a fine repeating border framing the names) — never just "a few flowers placed on the card".
- Give a precise colour palette with hex values, drawn from their brief.
- Typographic mood: typeface character for names vs details, scale, spacing.
- Composition: where the eye travels, how negative space is used, how the motif frames the typography.
- One distinctive, memorable idea that makes it unforgettable.

Be concrete and visual. 150 words max. No preamble.`;

const RENDER_SYSTEM = `You are an expert SVG illustrator for luxury wedding stationery. Given a creative concept, produce one beautiful, print-ready SVG invitation.

Requirements:
- Output ONLY valid SVG, from <svg to </svg>. No markdown, no commentary.
- viewBox="0 0 297 420" (A5 portrait).
- Draw genuine, sophisticated artwork: layered botanical line-art using <path> Bezier curves, flourishes, frames or arches — NOT crude ellipses or scattered blobs. Vary line weights; use elegant curves.
- The decoration must FRAME and elevate the typography per the concept's composition.
- Include these as real <text> elements (serif fonts: Cormorant Garamond, Georgia, serif): "Charlotte & James", "together with their families", "Saturday · the Fourteenth of June · Two Thousand & Twenty-Six", "Blenheim Palace, Oxfordshire", "Reception to follow".
- Honour the concept's palette and composition precisely. Keep artwork within the viewBox with a clean margin. Make it genuinely elegant — this is a luxury brand.`;

const CRITIQUE_SYSTEM = `You are an exacting art director improving an SVG wedding invitation against its concept: refine the composition, enrich the linework, fix any crude or broken shapes, strengthen the typographic hierarchy, ensure elegant margins. Output ONLY the improved SVG (from <svg to </svg>), no commentary.`;

function cors() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function extractSvg(text) {
  const m = text && text.match(/<svg[\s\S]*<\/svg>/i);
  return m ? m[0] : null;
}

async function callClaude(apiKey, system, user, maxTokens) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || 1000,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error('AI service error (' + resp.status + '): ' + t.slice(0, 200));
  }
  const data = await resp.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const brief = (payload.brief || '').toString().slice(0, 1000).trim();
  const refine = payload.refine !== false; // default true
  if (!brief) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing brief' }) };

  try {
    // Step 1 — art-direct
    const concept = await callClaude(apiKey, ARTDIRECT_SYSTEM, `The couple's brief: "${brief}"`, 500);

    // Step 2 — render to SVG
    let raw = await callClaude(apiKey, RENDER_SYSTEM, `Creative concept to realise:\n\n${concept}`, 3000);
    let svg = extractSvg(raw);
    if (!svg) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'Renderer did not return valid SVG', concept }) };
    }

    // Step 3 — refine (best-effort; keep step-2 svg if this fails)
    if (refine) {
      try {
        const crit = await callClaude(apiKey, CRITIQUE_SYSTEM, `Concept:\n${concept}\n\nCurrent SVG:\n${svg}`, 3000);
        const improved = extractSvg(crit);
        if (improved) svg = improved;
      } catch (e) { /* keep the step-2 svg */ }
    }

    return { statusCode: 200, headers: cors(), body: JSON.stringify({ concept, svg }) };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: (err.message || 'Generation failed').slice(0, 300) }) };
  }
};
