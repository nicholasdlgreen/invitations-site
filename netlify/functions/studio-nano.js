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
  const blocked = await abuseGuard(event, 'studio-nano', 30);
  if (blocked) return blocked;

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
