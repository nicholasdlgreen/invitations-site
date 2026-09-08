// netlify/functions/nano-print-test.js
//
// STANDALONE TEST — does NOT touch the studio. Calls Nano Banana Pro at 4K
// and reports the exact pixel dimensions of what comes back, so we can confirm
// whether we get a genuine print-ready file.
//
// Usage: just visit  /.netlify/functions/nano-print-test  in a browser.
// It generates one test image and tells you its dimensions + any error.

const https = require('https');

function readPngSize(buf) {
  // PNG: width/height are big-endian 32-bit ints at bytes 16-24
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'PNG' };
  }
  // JPEG: scan for SOF marker
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), fmt: 'JPEG' };
      }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return { w: 0, h: 0, fmt: 'unknown' };
}

exports.handler = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 500, body: 'GEMINI_API_KEY not configured' };

  const MODEL = 'gemini-3-pro-image-preview';
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: 'A soft watercolour botanical wedding invitation border with eucalyptus and blush roses, sage and cream, empty centre, no text, flat, print quality.' }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { imageSize: '4K', aspectRatio: '3:4' }
    }
  });

  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/' + MODEL + ':generateContent?key=' + encodeURIComponent(apiKey),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, raw: data }));
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    let parsed = null;
    try { parsed = JSON.parse(response.raw); } catch (e) {}

    if (response.status !== 200 || !parsed) {
      var m = 'HTTP ' + response.status;
      if (parsed && parsed.error) m += ': ' + parsed.error.message;
      else m += ': ' + response.raw.slice(0, 500);
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'FAILED — ' + m };
    }

    const parts = (((parsed.candidates || [])[0] || {}).content || {}).parts || [];
    let b64 = null, mime = '';
    for (const p of parts) { if (p.inlineData && p.inlineData.data) { b64 = p.inlineData.data; mime = p.inlineData.mimeType; break; } }
    if (!b64) return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'No image returned. Raw: ' + JSON.stringify(parsed).slice(0, 500) };

    const buf = Buffer.from(b64, 'base64');
    const size = readPngSize(buf);
    const dpi300 = { w: (size.w / 300).toFixed(1), h: (size.h / 300).toFixed(1) };

    const report =
      '=== NANO PRINT TEST RESULT ===\n\n' +
      'Model: ' + MODEL + '\n' +
      'Requested: 4K, aspect 3:4\n\n' +
      'ACTUAL IMAGE: ' + size.w + ' x ' + size.h + ' pixels (' + size.fmt + ', ' + mime + ')\n' +
      'File size: ' + (buf.length / 1024).toFixed(0) + ' KB\n\n' +
      'At 300 DPI this prints at: ' + dpi300.w + ' x ' + dpi300.h + ' inches\n\n' +
      'PRINT VERDICT:\n' +
      (size.w >= 1500
        ? '  ✓ PRINT-READY — big enough for 5x7 / A5 / A6 at 300 DPI'
        : '  ✗ NOT print-ready — only ' + size.w + 'px wide (need ~1500px+). imageSize likely ignored.') +
      '\n';

    return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: report };

  } catch (err) {
    return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: 'ERROR: ' + (err.message || String(err)) };
  }
};
