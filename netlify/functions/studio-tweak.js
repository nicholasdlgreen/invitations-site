// netlify/functions/studio-tweak.js
//
// "Make some tweaks" — TARGETED image editing via fal.ai Flux Kontext [pro].
// Unlike image-to-image, Kontext performs local, instruction-based edits
// ("change the pink flowers to black") while keeping the rest of the design.
//
// Requires env var: FAL_KEY (or FAL_API_KEY)

const https = require('https');

const HOST = 'fal.run';
const PATH = '/fal-ai/flux-pro/kontext';

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function postJSON(host, path, apiKey, bodyObj) {
  const body = JSON.stringify(bodyObj);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host, path: path, method: 'POST',
      headers: { 'Authorization': 'Key ' + apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let p=null; try{p=JSON.parse(data);}catch(e){} resolve({ status: res.statusCode, parsed: p, raw: data }); });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => { const buf = Buffer.concat(chunks); const mime = res.headers['content-type'] || 'image/jpeg'; resolve('data:' + mime + ';base64,' + buf.toString('base64')); });
    }).on('error', reject);
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'FAL_KEY not configured' }) };

  let imageUrl = '', tweak = '';
  try {
    const b = JSON.parse(event.body || '{}');
    imageUrl = (b.imageUrl || '').toString();
    tweak = (b.tweak || '').toString().trim();
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!imageUrl) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing image' }) };
  if (!tweak) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing tweak instruction' }) };

  // Kontext wants an EDITING INSTRUCTION. Frame it to preserve the rest.
  const prompt = tweak + ', while keeping the rest of the design, composition and the empty centre space exactly the same.';

  try {
    const gen = await postJSON(HOST, PATH, apiKey, {
      image_url: imageUrl,
      prompt: prompt,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '2'
    });

    if (gen.status !== 200 || !gen.parsed) {
      let msg = 'Tweak service error (' + gen.status + ')';
      if (gen.parsed && gen.parsed.detail) msg += ': ' + JSON.stringify(gen.parsed.detail).slice(0, 300);
      else if (gen.raw) msg += ': ' + gen.raw.slice(0, 300);
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: msg }) };
    }

    const images = gen.parsed.images || [];
    if (!images.length || !images[0].url) {
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: 'No image returned' }) };
    }

    const dataUrl = await fetchImage(images[0].url);
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ image: dataUrl }) };

  } catch (err) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'Tweak failed: ' + (err.message || String(err)) }) };
  }
};
