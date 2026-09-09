// netlify/functions/studio-nano.js
//
// Foreverprint AI Design Studio — image generation via fal.ai (Flux Pro 1.1).
// Reliable, fast, print-quality. Uses the synchronous fal.run endpoint.
//
// Requires env var: FAL_KEY  (or FAL_API_KEY) — set in Netlify site settings.

const https = require('https');

const FAL_ENDPOINT_HOST = 'fal.run';
const FAL_ENDPOINT_PATH = '/fal-ai/flux-pro/v1.1-ultra';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

// helper: POST JSON to fal, return parsed body
function postJSON(host, path, apiKey, bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: path,
      method: 'POST',
      headers: {
        'Authorization': 'Key ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, parsed: parsed, raw: data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// helper: fetch an image URL and return base64 + mime
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const mime = res.headers['content-type'] || 'image/jpeg';
        resolve('data:' + mime + ';base64,' + buf.toString('base64'));
      });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'FAL_KEY not configured' }) };

  let brief = '';
  let sizeName = 'a7';
  try {
    const body = JSON.parse(event.body || '{}');
    brief = (body.brief || '').toString().trim();
    sizeName = (body.size || 'a7').toString();
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!brief) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing brief' }) };

  const fullPrompt = brief +
    ' A decorative design only — leave a large clean empty area in the centre for text. ' +
    'No letters, no words, no text anywhere. Flat, straight-on, fills the frame, soft cream background, luxury print quality.';

  // Flux Pro Ultra generates up to 2K/4MP. It uses aspect_ratio presets.
  // Square -> 1:1; all portrait invitation sizes -> 3:4 (closest to invitation ratio).
  const isSquare = (sizeName === 'square');
  const aspectRatio = isSquare ? '1:1' : '3:4';

  try {
    const gen = await postJSON(FAL_ENDPOINT_HOST, FAL_ENDPOINT_PATH, apiKey, {
      prompt: fullPrompt,
      aspect_ratio: aspectRatio,
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true,
      safety_tolerance: '2'
    });

    if (gen.status !== 200 || !gen.parsed) {
      let msg = 'Design service error (' + gen.status + ')';
      if (gen.parsed && gen.parsed.detail) msg += ': ' + JSON.stringify(gen.parsed.detail).slice(0, 300);
      else if (gen.raw) msg += ': ' + gen.raw.slice(0, 300);
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: msg }) };
    }

    const images = gen.parsed.images || [];
    if (!images.length || !images[0].url) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'No image returned', raw: JSON.stringify(gen.parsed).slice(0, 300) }) };
    }

    // fetch the image URL and return as base64 data URL (so the page can show it directly)
    const dataUrl = await fetchImage(images[0].url);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ image: dataUrl, sourceUrl: images[0].url, width: (images[0].width||imageSize.width), height: (images[0].height||imageSize.height) })
    };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'Generation failed: ' + (err.message || String(err)) }) };
  }
};
