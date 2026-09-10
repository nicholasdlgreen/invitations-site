// /netlify/functions/print-prep.js
//
// Converts an uploaded artwork file to a print-ready PDF/X-1a using pdfRest,
// then stores the result back in Supabase Storage. Called from the browser
// (upload-and-print proceedToStripe flow) just before Stripe redirect, so the
// print-ready file exists by the time the order is captured.
//
// Architecture:
//   1. Browser uploads original file to Supabase → gets `artworkUrl`
//   2. Browser POSTs { fileUrl: artworkUrl } to this function
//   3. This function asks pdfRest to fetch the file by URL (no proxy upload)
//   4. pdfRest converts to PDF/X-1a (CMYK, embedded fonts, etc.)
//   5. This function downloads the result, uploads to Supabase as print-ready
//   6. Returns the Supabase URL of the print-ready PDF
//
// Env vars required:
//   PDFREST_API_KEY  — your pdfRest API key (already set in Netlify)
//
// Notes:
//   - We use the EU endpoint (eu-api.pdfrest.com) for GDPR compliance.
//   - Free pdfRest tier outputs WATERMARKED PDFs. Upgrade to remove the
//     watermark before going live with real orders.
//   - Supabase anon key is hardcoded to match the existing pattern in
//     upload-and-print.html. Long-term we should move it to env vars.

const PDFREST_BASE = 'https://eu-api.pdfrest.com';
const SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
// Anon key — same as in upload-and-print.html. Public by design (used by browser).
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Y3B6bXVta3lqZHlpYm13bHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTY2MzYsImV4cCI6MjA4OTg5MjYzNn0.JBOAoMdotrbxmL3M4nFhdJ6yQWX45YbgtDCgMtJktSE';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.PDFREST_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'PDFREST_API_KEY not configured in Netlify env vars' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { fileUrl, outputType = 'PDF/X-1a', inputType = 'pdf', bleedMm = 0, bleedBakedIn = false } = payload;
  if (!fileUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fileUrl in request body' }) };
  }

  try {
    // ─── Step 1: Tell pdfRest to fetch the file from Supabase ───
    // /upload supports url parameter — pdfRest downloads it directly. This
    // means our Netlify Function doesn't need to proxy file bytes (avoids
    // the 6MB request body limit).
    const uploadResp = await fetch(`${PDFREST_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: fileUrl })
    });

    const uploadResult = await uploadResp.json();
    if (!uploadResp.ok || !uploadResult.files || !uploadResult.files[0] || !uploadResult.files[0].id) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'pdfRest /upload failed',
          status: uploadResp.status,
          result: uploadResult
        })
      };
    }

    let fileId = uploadResult.files[0].id;
    console.log('[print-prep] Uploaded to pdfRest, fileId:', fileId);

    // ─── Step 1b: if the input is an IMAGE (e.g. an AI-studio JPEG), convert
    //     it to a standard PDF first. Uploaded PDFs skip this step. ───
    if (inputType === 'image') {
      const toPdfResp = await fetch(`${PDFREST_BASE}/pdf`, {
        method: 'POST',
        headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId, output: 'foreverprint_from_image' })
      });
      const toPdfResult = await toPdfResp.json();
      if (!toPdfResp.ok || !(toPdfResult.outputId || (toPdfResult.files && toPdfResult.files[0] && toPdfResult.files[0].id))) {
        return {
          statusCode: 502,
          body: JSON.stringify({ error: 'pdfRest image-to-PDF (/pdf) failed', status: toPdfResp.status, result: toPdfResult })
        };
      }
      // chain the resulting PDF's id into the pdfx step
      fileId = toPdfResult.outputId || toPdfResult.files[0].id;
      console.log('[print-prep] Converted image to PDF, fileId:', fileId);
    }

    // ─── Step 2: Convert to PDF/X-1a ───
    const pdfxResp = await fetch(`${PDFREST_BASE}/pdfx`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: fileId,
        output_type: outputType,
        output: 'foreverprint_print_ready'
      })
    });

    const pdfxResult = await pdfxResp.json();
    if (!pdfxResp.ok || !pdfxResult.outputUrl) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'pdfRest /pdfx conversion failed',
          status: pdfxResp.status,
          result: pdfxResult
        })
      };
    }

    console.log('[print-prep] PDF/X-1a created, outputId:', pdfxResult.outputId);

    // ─── Step 2b: if the file has bleed, define the TrimBox/BleedBox so the
    //     printer knows exactly where to cut. The artwork already extends into
    //     the bleed (baked in at flatten). We inset the TrimBox by bleedMm on
    //     all sides; the BleedBox is the full page. ───
    let boxedId = pdfxResult.outputId;
    if (bleedMm && bleedMm > 0 && boxedId) {
      try {
        const bleedPt = (bleedMm / 25.4) * 72;  // mm → PDF points
        // If bleed is baked into the artwork (AI designs): the page IS trim+bleed,
        //   so the TrimBox sits inset by bleedMm, BleedBox = full page.
        // If NOT baked in (customer uploads at trim size): the page IS the trim,
        //   so TrimBox = full page (no inset), BleedBox = full page. The printer
        //   then knows the whole file is the trim size. (Marks still drawn.)
        const trimInset = bleedBakedIn ? bleedPt : 0;
        const boxResp = await fetch(`${PDFREST_BASE}/set-page-boxes`, {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: boxedId,
            trim_box: { left: trimInset, bottom: trimInset, right: trimInset, top: trimInset, unit: 'inset' },
            bleed_box: { left: 0, bottom: 0, right: 0, top: 0, unit: 'inset' },
            output: 'foreverprint_boxed'
          })
        });
        const boxResult = await boxResp.json();
        if (boxResp.ok && (boxResult.outputId || boxResult.outputUrl)) {
          boxedId = boxResult.outputId || boxedId;
          // if it returned a fresh URL, use it downstream
          if (boxResult.outputUrl) pdfxResult.outputUrl = boxResult.outputUrl;
          console.log('[print-prep] TrimBox/BleedBox set for', bleedMm + 'mm bleed');
        } else {
          console.warn('[print-prep] set-page-boxes failed, proceeding without explicit boxes:', boxResult);
        }
      } catch(e) {
        console.warn('[print-prep] set-page-boxes error, proceeding:', e.message);
      }
    }

    // ─── Step 2c: draw VISIBLE crop marks (printer's marks) based on the
    //     TrimBox/BleedBox. PrintedEasy require visible marks over the bleed. ───
    if (bleedMm && bleedMm > 0 && boxedId) {
      try {
        const cmResp = await fetch(`${PDFREST_BASE}/printers-marks`, {
          method: 'POST',
          headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: boxedId,
            crop_marks: 'true',
            bleed_marks: 'false',
            registration_marks: 'false',
            color_bars: 'false',
            page_information: 'false',
            output: 'foreverprint_marks'
          })
        });
        const cmResult = await cmResp.json();
        if (cmResp.ok && (cmResult.outputId || cmResult.outputUrl)) {
          boxedId = cmResult.outputId || boxedId;
          if (cmResult.outputUrl) pdfxResult.outputUrl = cmResult.outputUrl;
          console.log('[print-prep] Crop marks added.');
        } else {
          console.warn('[print-prep] printers-marks failed, proceeding without visible marks:', cmResult);
        }
      } catch(e) {
        console.warn('[print-prep] printers-marks error, proceeding:', e.message);
      }
    }

    // ─── Step 3: Download the print-ready PDF from pdfRest ───
    // pdfRest URLs expire after 30 minutes, so we need to persist the file
    // to our own storage immediately.
    const fileResp = await fetch(pdfxResult.outputUrl);
    if (!fileResp.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Could not download converted file from pdfRest', status: fileResp.status })
      };
    }
    const fileBuffer = Buffer.from(await fileResp.arrayBuffer());

    // ─── Step 4: Upload print-ready PDF to Supabase Storage ───
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
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'Supabase upload failed',
          status: supabaseResp.status,
          details: errText
        })
      };
    }

    const printReadyUrl = `${SUPABASE_URL}/storage/v1/object/artwork/${storagePath}`;
    console.log('[print-prep] Print-ready PDF stored at:', printReadyUrl);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        printReadyUrl: printReadyUrl,
        outputType: outputType,
        pdfRestOutputId: pdfxResult.outputId
      })
    };
  } catch (err) {
    console.error('[print-prep] Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
