// Netlify Function: curate-album
//
// Receives a list of photo URLs and asks Claude to score each for
// inclusion in a wedding album, then returns the scores so the
// frontend can pick the best N.
//
// Required env var: ANTHROPIC_API_KEY (set in Netlify dashboard)
//
// Request body:  { photos: [{ id, url }], batchSize?, signal? }
// Response body: { scores: [{ id, score, category, notes }] }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_BATCH_SIZE = 8;
const MAX_PARALLEL_BATCHES = 3;

const CURATION_PROMPT = `You are helping curate a wedding album. For each numbered image below, give it a score from 1-10 for inclusion in the album, and categorize it.

Categories:
- ceremony: vows, ring exchange, walking down the aisle, first kiss
- portrait: posed shots of the couple or individuals
- group: family or friends group photos
- candid: genuine spontaneous moments, laughter, tears, dancing
- detail: rings, dress, shoes, decor, food, flowers
- scene: venue, landscape, ambiance shots

Scoring criteria:
- Image quality (sharpness, exposure, color)
- Emotional impact and storytelling value
- Composition and framing
- Uniqueness (penalize near-duplicates of other shots)

Return ONLY a JSON array, no other text. Format:
[
  {"index": 1, "score": 8, "category": "candid", "notes": "brief note"},
  {"index": 2, "score": 5, "category": "detail", "notes": "brief note"}
]`;

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Netlify environment' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { photos, batchSize = DEFAULT_BATCH_SIZE } = body;

  if (!Array.isArray(photos) || photos.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'photos array required' }) };
  }

  // Split photos into batches
  const batches = [];
  for (let i = 0; i < photos.length; i += batchSize) {
    batches.push(photos.slice(i, i + batchSize));
  }

  // Process batches with limited parallelism
  const allScores = [];
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const slice = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    const results = await Promise.all(slice.map(scoreBatch));
    for (const r of results) {
      allScores.push(...r);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ scores: allScores })
  };
};

async function scoreBatch(batch) {
  // Build the message content: alternating images + numbered references
  const content = [];
  batch.forEach((photo, idx) => {
    content.push({
      type: 'image',
      source: { type: 'url', url: photo.url }
    });
    content.push({
      type: 'text',
      text: `Image ${idx + 1}`
    });
  });
  content.push({
    type: 'text',
    text: '\n\n' + CURATION_PROMPT
  });

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Claude API error:', res.status, errText);
      // Return neutral scores so we don't lose photos on API failure
      return batch.map(p => ({ id: p.id, score: 5, category: 'unknown', notes: 'scoring failed' }));
    }

    const data = await res.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';

    // Extract JSON from the response (handle cases where Claude adds prose)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON in Claude response:', text);
      return batch.map(p => ({ id: p.id, score: 5, category: 'unknown', notes: 'parse failed' }));
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON parse failed:', e, jsonMatch[0]);
      return batch.map(p => ({ id: p.id, score: 5, category: 'unknown', notes: 'parse failed' }));
    }

    // Map indices back to photo IDs
    return parsed.map(item => {
      const photo = batch[item.index - 1];
      if (!photo) return null;
      return {
        id: photo.id,
        score: typeof item.score === 'number' ? item.score : 5,
        category: item.category || 'unknown',
        notes: item.notes || ''
      };
    }).filter(Boolean);
  } catch (err) {
    console.error('Batch scoring failed:', err);
    return batch.map(p => ({ id: p.id, score: 5, category: 'unknown', notes: 'request failed' }));
  }
}
