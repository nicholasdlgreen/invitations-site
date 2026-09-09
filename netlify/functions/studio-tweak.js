// netlify/functions/studio-tweak.js
//
// "Make some tweaks" — image-to-image via fal.ai Flux dev image-to-image.
// Takes the current design image + a tweak instruction, returns an adjusted
// version that keeps the design's character but applies the requested change.
//
// Requires env var: FAL_KEY (or FAL_API_KEY)

const https = require('https');

const HOST = 'fal.run';
const PATH = '/fal-ai/flux/dev/image-to-image';

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

  let imageUrl = '', tweak = '', brief = '', strength = 0.7;
  try {
    const b = JSON.parse(event.body || '{}');
    imageUrl = (b.imageUrl || '').toString();   // data URL or http URL of current design
    tweak = (b.tweak || '').toString().trim();
    brief = (b.brief || '').toString().trim();
    if (typeof b.strength === 'number') strength = Math.max(0.25, Math.min(0.85, b.strength));
  } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!imageUrl) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing image' }) };

  // Combine the original brief with the tweak instruction so the model keeps
  // the design language but applies the change.
  const prompt = (brief ? brief + '. ' : '') +
    'Apply this change: ' + (tweak || 'subtle refinement') + '. ' +
    'Keep it a decorative wedding invitation design with a clear empty centre for text, no words, flat, print quality.';

  try {
    const gen = await postJSON(HOST, PATH, apiKey, {
      image_url: imageUrl,
      prompt: prompt,
      strength: strength,
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true
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
