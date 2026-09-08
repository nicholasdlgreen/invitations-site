// netlify/functions/studio-nano.js
//
// Foreverprint AI Design Studio — Nano Banana (Gemini image) generation.
// Takes the assembled brief from the studio page, asks Gemini to generate a
// decorative invitation design (no text, empty centre), returns a base64 image.
//
// Requires env var: GEMINI_API_KEY  (set in Netlify site settings)

// Nano Banana Pro (Gemini 3 Pro Image) — supports native 4K output for print quality.
// At 4K (~4096px), prints cleanly at 300 DPI up to ~13.7 inches — covers all invitation sizes.
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };

  let brief = '';
  try {
    const body = JSON.parse(event.body || '{}');
    brief = (body.brief || '').toString().trim();
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!brief) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing brief' }) };

  // Safety net: always reinforce the "decorative only, no text, leave space" rule,
  // even if the client brief forgot it.
  const fullPrompt = brief +
    '\n\nImportant: generate ONLY the decorative artwork for a wedding invitation. ' +
    'Leave a large, clean, empty area in the centre for text to be added later. ' +
    'Do NOT render any letters, words, names or dates. Flat, straight-on view, ' +
    'the design filling the whole frame, portrait orientation, soft cream background, print quality.';

  try {
    const resp = await fetch(API_URL + '?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { imageSize: '4K' }
        }
      })
    });

    // Read the body as TEXT first, then try to parse — so a non-JSON error
    // (HTML, plain text) never throws "unexpected token".
    const rawText = await resp.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (e) { data = null; }

    if (!resp.ok || !data) {
      // surface the real error message from Google, readable
      var msg = 'Nano service error (' + resp.status + ')';
      if (data && data.error && data.error.message) msg += ': ' + data.error.message;
      else if (rawText) msg += ': ' + rawText.slice(0, 300);
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: msg }) };
    }

    // Pull the first inline image out of the response.
    let imageB64 = null, mime = 'image/png';
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    for (const p of parts) {
      if (p.inlineData && p.inlineData.data) {
        imageB64 = p.inlineData.data;
        mime = p.inlineData.mimeType || mime;
        break;
      }
    }

    if (!imageB64) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'No image returned', raw: JSON.stringify(data).slice(0, 300) }) };
    }

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ image: 'data:' + mime + ';base64,' + imageB64 })
    };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'Generation failed: ' + (err.message || String(err)) }) };
  }
};
