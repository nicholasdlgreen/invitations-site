// /netlify/functions/print-prep.js
//
// Converts artwork to a print-ready PDF/X-1a (CMYK) at the EXACT physical size
// the customer ordered, then stores the result in Supabase Storage.
//
// WHY THIS EXISTS / WHAT WENT WRONG BEFORE:
//   The old version handed the image to pdfRest's /pdf tool and let it choose
//   the page size. That tool has no page-size option for images, so it fell
//   back to placing them at 72-96 DPI: an A5 card came out 496 x 649mm and an
//   uploaded photo came out 2015 x 1511mm. The printer then scaled those down,
//   which is why prints were the wrong size AND looked low-resolution.
//   It also called /set-page-boxes and /printers-marks, which are not real
//   pdfRest endpoints (correct path: /pdf-with-page-boxes-set; printer's marks
//   does not exist as a tool), so trim boxes and crop marks silently never
//   applied.
//
// HOW IT WORKS NOW:
//   We build the page ourselves at an exact size and place the artwork on it.
//     page = trim + bleed on all sides + a margin that holds the crop marks
//   1. /upload           — pdfRest fetches the artwork by URL
//   2. /blank-pdf        — a blank page at the exact custom size (PDF units)
//   3. /pdf-with-added-image — artwork placed at exact position and size
//   4. /pdfx             — convert to PDF/X-1a (this is what forces CMYK)
//   5. /pdf-with-page-boxes-set — TrimBox (the cut line) and BleedBox
//   Customer-supplied PDFs skip steps 2-3: their own page is kept.
//
//   Crop marks are drawn into the artwork itself by the browser before upload
//   (see buildPrintReadyRaster in upload-and-print.html), because pdfRest has
//   no printer's-marks tool.
//
// PDF units: 1 unit = 1/72 inch. mm -> units = mm / 25.4 * 72.
//
// Env vars required:
//   PDFREST_API_KEY  — set in Netlify site settings
//
// Notes:
//   - EU endpoint (eu-api.pdfrest.com) for GDPR.
//   - Free pdfRest tier WATERMARKS output. Upgrade before real orders.

const PDFREST_BASE = 'https://eu-api.pdfrest.com';
const SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
// Anon key — same as in upload-and-print.html. Public by design (used by browser).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Y3B6bXVta3lqZHlpYm13bHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTY2MzYsImV4cCI6MjA4OTg5MjYzNn0.JBOAoMdotrbxmL3M4nFhdJ6yQWX45YbgtDCgMtJktSE';

const MM = 72 / 25.4;            // millimetres -> PDF units
const round2 = n => Math.round(n * 100) / 100;

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

// Every pdfRest call goes through here so a failure is never swallowed.
async function pdfRest(path, apiKey, body) {
  const resp = await fetch(`${PDFREST_BASE}${path}`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let result;
  const text = await resp.text();
  try { result = JSON.parse(text); }
  catch (e) { throw new Error(`${path} returned non-JSON (status ${resp.status}): ${text.slice(0, 200)}`); }
  if (!resp.ok) {
    throw new Error(`${path} failed (status ${resp.status}): ${JSON.stringify(result).slice(0, 300)}`);
  }
  const id = result.outputId || (result.files && result.files[0] && result.files[0].id);
  if (!id && !result.outputUrl) {
    throw new Error(`${path} returned no output id: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return { id, url: result.outputUrl, raw: result };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.PDFREST_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: 'PDFREST_API_KEY not configured in Netlify env vars' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const {
    fileUrl,
    outputType = 'PDF/X-1a',
    inputType = 'pdf',              // 'image' | 'pdf'
    bleedMm = 3,                    // PrintedEasy require 3mm
    marksMm = 5,                    // margin outside the bleed holding crop marks
    trimMmW = null,                 // the ordered card size, e.g. 148
    trimMmH = null,                 // e.g. 210
    artworkIncludesMarks = false,   // legacy: raster spans the whole page
    pressReady = false,             // PDF we built ourselves: size/boxes/marks already correct
    bleedBakedIn = false            // customer PDF already includes bleed
  } = payload;

  if (!fileUrl) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing fileUrl in request body' }) };
  }
  // Images MUST come with a target size now — without it we cannot build a
  // correctly-sized page, and guessing is exactly the bug we are fixing.
  if (inputType === 'image' && (!trimMmW || !trimMmH)) {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: 'Missing trimMmW/trimMmH — required to build an image at the correct print size' })
    };
  }

  const warnings = [];

  try {
    // ─── Step 1: pdfRest fetches the artwork by URL (no 6MB proxy limit) ───
    const uploaded = await pdfRest('/upload', apiKey, { url: fileUrl });
    let fileId = uploaded.id;
    console.log('[print-prep] uploaded to pdfRest:', fileId);

    let pageWmm = null, pageHmm = null, trimInsetMm = null, bleedInsetMm = null;

    if (inputType === 'image') {
      // ─── Steps 2-3: build the page at the exact ordered size ───
      // Artwork we generate spans the full page (marks margin included).
      // A bare image (no marks drawn in) is treated as trim+bleed only.
      pageWmm = trimMmW + 2 * bleedMm + 2 * marksMm;
      pageHmm = trimMmH + 2 * bleedMm + 2 * marksMm;

      const imgWmm = artworkIncludesMarks ? pageWmm : trimMmW + 2 * bleedMm;
      const imgHmm = artworkIncludesMarks ? pageHmm : trimMmH + 2 * bleedMm;
      const imgXmm = artworkIncludesMarks ? 0 : marksMm;
      const imgYmm = artworkIncludesMarks ? 0 : marksMm;

      const blank = await pdfRest('/blank-pdf', apiKey, {
        page_count: 1,
        page_size: 'custom',
        custom_width: round2(pageWmm * MM),
        custom_height: round2(pageHmm * MM),
        output: 'foreverprint_page'
      });
      console.log('[print-prep] blank page created:', pageWmm, 'x', pageHmm, 'mm');

      const placed = await pdfRest('/pdf-with-added-image', apiKey, {
        id: blank.id,
        image_id: fileId,
        page: 1,
        x: round2(imgXmm * MM),
        y: round2(imgYmm * MM),
        width: round2(imgWmm * MM),
        height: round2(imgHmm * MM),
        output: 'foreverprint_placed'
      });
      fileId = placed.id;
      console.log('[print-prep] artwork placed at exact size');

      trimInsetMm = marksMm + bleedMm;   // from page edge in to the cut line
      bleedInsetMm = marksMm;            // from page edge in to the bleed edge
    } else {
      // A PDF we built ourselves already has the right page size, TrimBox,
      // BleedBox and crop marks — we only re-assert the boxes in case the
      // PDF/X conversion drops them. Otherwise it's a customer PDF: if they
      // supplied bleed the cut line sits bleedMm inside the page, if not the
      // page IS the trim size.
      if (pressReady) {
        trimInsetMm = marksMm + bleedMm;
        bleedInsetMm = marksMm;
      } else {
        trimInsetMm = bleedBakedIn ? bleedMm : 0;
        bleedInsetMm = 0;
      }
    }

    // ─── Step 4: PDF/X-1a — this is the step that enforces CMYK ───
    const pdfx = await pdfRest('/pdfx', apiKey, {
      id: fileId,
      output_type: outputType,
      output: 'foreverprint_print_ready'
    });
    let finalId = pdfx.id;
    let finalUrl = pdfx.url;
    console.log('[print-prep] converted to', outputType);

    // ─── Step 5: TrimBox + BleedBox so the printer knows where to cut ───
    // Real endpoint is /pdf-with-page-boxes-set and it takes inset margins.
    try {
      const boxes = [
        { box: 'trim',  pages: [{ range: '1', left: round2(trimInsetMm * MM),  right: round2(trimInsetMm * MM),  top: round2(trimInsetMm * MM),  bottom: round2(trimInsetMm * MM) }] },
        { box: 'bleed', pages: [{ range: '1', left: round2(bleedInsetMm * MM), right: round2(bleedInsetMm * MM), top: round2(bleedInsetMm * MM), bottom: round2(bleedInsetMm * MM) }] }
      ];
      const boxed = await pdfRest('/pdf-with-page-boxes-set', apiKey, {
        id: finalId,
        boxes: JSON.stringify(boxes),
        output: 'foreverprint_boxed'
      });
      finalId = boxed.id || finalId;
      if (boxed.url) finalUrl = boxed.url;
      console.log('[print-prep] TrimBox/BleedBox set');
    } catch (e) {
      // Report it — do NOT pretend the file is fully print-ready.
      warnings.push('Page boxes not set: ' + e.message);
      console.warn('[print-prep] page boxes failed:', e.message);
    }

    if (!finalUrl) throw new Error('No output URL from pdfRest after processing');

    // ─── Step 6: persist (pdfRest URLs expire after ~30 minutes) ───
    const fileResp = await fetch(finalUrl);
    if (!fileResp.ok) throw new Error('Could not download converted file from pdfRest, status ' + fileResp.status);
    const fileBuffer = Buffer.from(await fileResp.arrayBuffer());

    const fileName = `print_ready_${Date.now()}.pdf`;
    const storagePath = `print-ready/${fileName}`;
    const supabaseResp = await fetch(`${SUPABASE_URL}/storage/v1/object/artwork/${storagePath}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'false'
      },
      body: fileBuffer
    });
    if (!supabaseResp.ok) {
      const errText = await supabaseResp.text();
      throw new Error('Supabase upload failed, status ' + supabaseResp.status + ': ' + errText.slice(0, 200));
    }

    const printReadyUrl = `${SUPABASE_URL}/storage/v1/object/public/artwork/${storagePath}`;
    console.log('[print-prep] stored:', printReadyUrl);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        printReadyUrl,
        outputType,
        pageSizeMm: pageWmm ? { width: round2(pageWmm), height: round2(pageHmm) } : null,
        trimSizeMm: trimMmW ? { width: trimMmW, height: trimMmH } : null,
        bleedMm,
        warnings
      })
    };
  } catch (err) {
    console.error('[print-prep] failed:', err.message);
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: err.message, warnings })
    };
  }
};
