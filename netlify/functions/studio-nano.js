// netlify/functions/studio-nano.js
//
// Foreverprint AI Design Studio — Nano Banana (Gemini image) generation.
// Uses the built-in https module (like help-chat.js) so it works regardless of
// the Netlify Node version — no dependency on global fetch.
//
// Requires env var: GEMINI_API_KEY  (set in Netlify site settings)

const https = require('https');

// Nano Banana (Gemini 2.5 Flash Image) — the model confirmed working on this key.
const MODEL = 'gemini-2.5-flash-image';

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

  const fullPrompt = brief +
    '\n\nImportant: generate ONLY the decorative artwork for a wedding invitation. ' +
    'Leave a large, clean, empty area in the centre for text to be added later. ' +
    'Do NOT render any letters, words, names or dates. Flat, straight-on view, ' +
    'the design filling the whole frame, portrait orientation, soft cream background, print quality.';

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE']
    }
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/' + MODEL + ':generateContent?key=' + encodeURIComponent(apiKey),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (e) { parsed = null; }
          resolve({ status: res.statusCode, parsed: parsed, raw: data });
        });
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    // handle errors readably (never throw "unexpected token")
    if (response.status !== 200 || !response.parsed) {
      let msg = 'Nano service error (' + response.status + ')';
      if (response.parsed && response.parsed.error && response.parsed.error.message) msg += ': ' + response.parsed.error.message;
      else if (response.raw) msg += ': ' + response.raw.slice(0, 300);
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: msg }) };
    }

    const data = response.parsed;
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
