const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const VAR_PROMPTS = {
  arch: 'Create a beautiful arch frame — a path element that rises from both lower corners and meets at the top in a graceful curve. Add a matching inner arch slightly inset. Elegant and romantic.',
  botanical: 'Add botanical leaf elements: dense corner clusters of filled ellipses (rotate-transformed) at all four corners in green (#5A8A6A), plus a gentle curved branch with leaves at top and bottom. Natural and organic.',
  deco: 'Create Art Deco stepped geometric borders — multiple nested rectangles offset at corners to create stepped effects, plus small diamond (rotated rect) ornaments at midpoints on each side. Glamorous and structured.'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { style, palette, n1, n2, date, venue, ol, variation, desc, accentColor, bgColor } = JSON.parse(event.body);

    const ac = accentColor || '#B8976A';

    const prompt = `You are a luxury wedding stationery designer. Create SVG decorative frame elements for a wedding invitation.

Context:
- Couple: ${n1 || 'Charlotte'} & ${n2 || 'James'}
- Style: ${style || 'Classic'} · ${palette || 'Cream & Gold'}
- Accent colour: ${ac}
${desc ? '- Customer notes: ' + desc : ''}

Design direction: ${VAR_PROMPTS[variation] || VAR_PROMPTS.arch}

Rules:
- Output ONLY raw SVG elements (rect, ellipse, path, line, circle). No <svg> tag, no markdown, no text.
- viewBox context is "0 0 260 360". Stay within these bounds.
- Use "${ac}" as your primary accent/stroke colour.
- Keep the central text zone (approximately x=40-220, y=85-220) clear of decoration.
- Decoration goes in corners, edges, and the areas above y=85 and below y=220.
- Make it genuinely elegant and balanced.`;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: 'Output ONLY raw SVG shape elements. No SVG wrapper tag. No markdown. No text elements. Just rect, ellipse, circle, path, and line elements.',
      messages: [{ role: 'user', content: prompt }]
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
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (response.error) throw new Error(response.error.message);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS },
      body: JSON.stringify({ svg: response.content[0].text, label: variation })
    };

  } catch (err) {
    console.error('studio-ai error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Could not generate variation. Please try again.' })
    };
  }
};
