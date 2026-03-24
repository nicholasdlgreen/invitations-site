// ══════════════════════════════════════════════════════════
// INVITATIONS — ARTWORK PREFLIGHT CHECK
// Netlify serverless function
//
// Checks uploaded artwork files for print-readiness.
// Thresholds are read from Supabase pricing_config table.
// Falls back to hardcoded defaults if Supabase is unreachable.
// ══════════════════════════════════════════════════════════
 
const sharp = require('sharp');
const busboy = require('busboy');
const https  = require('https');
 
// ── HARDCODED FALLBACK THRESHOLDS ─────────────────────
// These mirror the defaults in pricing-editor.html
// Only used if Supabase is unreachable
const FALLBACK = {
  minDpi: 300,
  warnDpi: 150,
  maxFileMb: 200,
  warnFileMb: 50,
  bleedMm: 3,
  automatedTypes: ['jpg','jpeg','png','tif','tiff'],
  manualTypes: ['pdf','ai','eps','svg'],
};
 
const SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9PtQ9cNyzpuR3XithsFgQ_vTYQbbmt';
 
// ── FETCH THRESHOLDS FROM SUPABASE ────────────────────
async function getThresholds() {
  return new Promise((resolve) => {
    const url = `${SUPABASE_URL}/rest/v1/pricing_config?id=eq.1&select=config`;
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          const pf = rows?.[0]?.config?.preflight;
          if (pf) { resolve({ ...FALLBACK, ...pf }); return; }
        } catch(e) {}
        resolve(FALLBACK);
      });
    });
    req.on('error', () => resolve(FALLBACK));
    req.setTimeout(3000, () => { req.destroy(); resolve(FALLBACK); });
}
 
// Standard invitation sizes (mm) — used to sense-check dimensions
const KNOWN_SIZES = [
  { name: 'A6 (standard)',     w: 148, h: 105 },
  { name: 'A5',                w: 210, h: 148 },
  { name: 'DL',                w: 210, h: 99  },
  { name: 'Square 130mm',      w: 130, h: 130 },
  { name: 'Square 148mm',      w: 148, h: 148 },
  { name: 'Square 160mm',      w: 160, h: 160 },
  { name: 'A4',                w: 297, h: 210 },
];
 
// ── HELPERS ───────────────────────────────────────────
 
function parseMultipart(event, maxMb = 200) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] },
      limits: { fileSize: maxMb * 1024 * 1024 }
    });
 
    const chunks = [];
    let filename = '';
    let mimetype = '';
    let fileSizeBytes = 0;
    let limitHit = false;
 
    bb.on('file', (name, file, info) => {
      filename = info.filename;
      mimetype = info.mimeType;
      file.on('data', chunk => {
        chunks.push(chunk);
        fileSizeBytes += chunk.length;
      });
      file.on('limit', () => { limitHit = true; });
    });
 
    bb.on('finish', () => {
      resolve({
        buffer: Buffer.concat(chunks),
        filename,
        mimetype,
        fileSizeBytes,
        limitHit
      });
    });
 
    bb.on('error', reject);
 
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    bb.write(bodyBuffer);
    bb.end();
  });
}
 
function mmToPixels(mm, dpi) {
  return Math.round(mm * dpi / 25.4);
}
 
function pixelsToMm(px, dpi) {
  return (px / dpi) * 25.4;
}
 
function closestInvitationSize(widthMm, heightMm) {
  let best = null;
  let bestDiff = Infinity;
  const tolerance = 10; // mm — within 10mm we call it a match
  for (const size of KNOWN_SIZES) {
    // Check both orientations
    for (const [w, h] of [[size.w, size.h], [size.h, size.w]]) {
      const diff = Math.abs(widthMm - w) + Math.abs(heightMm - h);
      if (diff < bestDiff) { bestDiff = diff; best = { ...size, diff }; }
    }
  }
  return bestDiff <= tolerance ? best : null;
}
 
// ── MAIN HANDLER ─────────────────────────────────────
 
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
 
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
 
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
 
  try {
    // Load thresholds from Supabase (or fall back to hardcoded defaults)
    const T = await getThresholds();
    const MIN_DPI     = T.minDpi     || 300;
    const WARN_DPI    = T.warnDpi    || 150;
    const MAX_FILE_MB = T.maxFileMb  || 200;
    const WARN_MB     = T.warnFileMb || 50;
    const BLEED_MM    = T.bleedMm    || 3;
    const AUTO_TYPES  = T.automatedTypes || FALLBACK.automatedTypes;
    const MANUAL_TYPES= T.manualTypes   || FALLBACK.manualTypes;
 
    const { buffer, filename, mimetype, fileSizeBytes, limitHit } = await parseMultipart(event, MAX_FILE_MB);
    const ext = (filename || '').split('.').pop().toLowerCase();
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
 
    const checks = [];
 
    // ── CHECK 1: FILE SIZE ──────────────────────────
    if (limitHit || fileSizeMB > MAX_FILE_MB) {
      checks.push({
        status: 'err',
        label: 'File Size',
        val: fileSizeMB + ' MB',
        note: `Your file exceeds the ${MAX_FILE_MB}MB upload limit. Please compress or optimise the file before uploading. For PDFs, use Adobe Acrobat's "Reduce File Size" option. For images, reduce dimensions slightly at 300dpi.`
      });
      return respond(checks, headers);
    } else if (fileSizeMB > WARN_MB) {
      checks.push({
        status: 'warn',
        label: 'File Size',
        val: fileSizeMB + ' MB',
        note: `Your file is large (${fileSizeMB} MB). It has been received successfully. Large files can sometimes cause delays — if you experience issues, try optimising the file.`
      });
    } else {
      checks.push({
        status: 'ok',
        label: 'File Size',
        val: fileSizeMB + ' MB',
        note: `File size is within acceptable limits.`
      });
    }
 
    // ── CHECK 2: FILE TYPE ──────────────────────────
    const isImage  = AUTO_TYPES.includes(ext);
    const isVector = MANUAL_TYPES.includes(ext);
 
    if (!isImage && !isVector) {
      checks.push({
        status: 'err',
        label: 'File Type',
        val: ext.toUpperCase(),
        note: `This file type is not supported. Please upload a PDF, JPEG, PNG, TIFF, AI or EPS file. PDF or AI files are strongly preferred for the best print quality.`
      });
      return respond(checks, headers);
    }
 
    if (isVector && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png' && ext !== 'tif' && ext !== 'tiff') {
      // PDF/AI/EPS — we can't deeply inspect these without additional libraries
      // Give an informative response and flag for manual review
      checks.push({
        status: 'ok',
        label: 'File Type',
        val: ext.toUpperCase(),
        note: ext === 'pdf'
          ? 'PDF received. PDF is our preferred format and typically produces the best results.'
          : `${ext.toUpperCase()} file received. Vector files generally produce excellent print results.`
      });
 
      // File size already checked above — add PDF-specific guidance checks
      checks.push({
        status: 'info',
        label: 'Colour Mode',
        val: 'Please verify',
        note: 'For PDF and vector files, please ensure your colour mode is set to CMYK. RGB files will be converted before printing, which can cause colour shifts — particularly with vivid greens and oranges.'
      });
      checks.push({
        status: 'info',
        label: 'Bleed',
        val: '3mm required',
        note: 'Please confirm your file includes 3mm bleed on all sides. For a standard A6 invitation (148 × 105mm), your artwork file should be 154 × 111mm. Our team will verify this during production.'
      });
      checks.push({
        status: 'info',
        label: 'Fonts',
        val: 'Please verify',
        note: 'Please ensure all fonts are embedded or converted to outlines before uploading. Missing fonts will be substituted, which may alter the appearance of your design.'
      });
      checks.push({
        status: 'info',
        label: 'Manual Review',
        val: '',
        note: 'Our studio team will perform a full pre-press check on your file — resolution, bleed, colour mode, fonts and page dimensions — before anything goes to print. We will contact you if any issues are found.'
      });
 
      return respond(checks, headers);
    }
 
    // ── IMAGE FILE DEEP ANALYSIS ────────────────────
    // Use sharp to inspect raster images
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch (e) {
      checks.push({
        status: 'err',
        label: 'File Read',
        val: '',
        note: `We were unable to read your file. It may be corrupted or saved in an unsupported format. Please try re-saving the file and uploading again.`
      });
      return respond(checks, headers);
    }
 
    const { width, height, density, space, channels, format } = meta;
 
    // ── CHECK 3: FILE TYPE (confirmed from file contents) ──
    const formatLabels = { jpeg: 'JPEG', png: 'PNG', tiff: 'TIFF', webp: 'WebP' };
    checks.push({
      status: 'ok',
      label: 'File Type',
      val: (formatLabels[format] || format?.toUpperCase() || ext.toUpperCase()),
      note: format === 'png'
        ? 'PNG received. For best results, ensure the file is at least 300dpi at the final print size. Note: PDF is preferred for professional print work.'
        : format === 'tiff'
        ? 'TIFF received. Excellent choice for professional print — TIFF preserves full quality without compression.'
        : 'JPEG received. Ensure the file has not been heavily compressed, as this reduces print quality.'
    });
 
    // ── CHECK 4: RESOLUTION ─────────────────────────
    // sharp returns density in pixels per inch (dpi) when embedded in file metadata
    const dpi = density || null;
 
    if (!dpi) {
      // No DPI metadata — estimate from pixel dimensions
      // If pixels suggest a reasonable invitation size at 300dpi, it's probably fine
      const widthMmAt300 = pixelsToMm(width, 300);
      const heightMmAt300 = pixelsToMm(height, 300);
 
      if (width < 1000 || height < 700) {
        checks.push({
          status: 'err',
          label: 'Resolution',
          val: 'No DPI data · ' + width + ' × ' + height + ' px',
          note: `Your file does not contain resolution metadata and appears to have a low pixel count (${width} × ${height}px). This is likely to print poorly. Please re-export at 300dpi at the intended print size. For a standard A6 invitation, the minimum pixel dimensions are 1748 × 1240px.`
        });
      } else if (width < 1748 || height < 1240) {
        checks.push({
          status: 'warn',
          label: 'Resolution',
          val: 'No DPI data · ' + width + ' × ' + height + ' px',
          note: `Your file does not contain resolution metadata. The pixel dimensions (${width} × ${height}px) may be sufficient, but we recommend exporting at a confirmed 300dpi. For an A6 invitation (148 × 105mm), 300dpi requires at least 1748 × 1240 pixels.`
        });
      } else {
        checks.push({
          status: 'ok',
          label: 'Resolution',
          val: width + ' × ' + height + ' px',
          note: `No DPI metadata found, but the pixel dimensions appear sufficient for standard invitation sizes at 300dpi.`
        });
      }
    } else if (dpi < WARN_DPI) {
      checks.push({
        status: 'err',
        label: 'Resolution',
        val: dpi + ' dpi',
        note: `Your file is only ${dpi}dpi — well below the ${MIN_DPI}dpi minimum required for quality print. At this resolution, the printed invitation will appear blurry or pixelated. Please re-export your design at ${MIN_DPI}dpi from your design software.`
      });
    } else if (dpi < MIN_DPI) {
      checks.push({
        status: 'warn',
        label: 'Resolution',
        val: dpi + ' dpi',
        note: `Your file is ${dpi}dpi — below our recommended ${MIN_DPI}dpi minimum. The print may appear slightly soft, particularly for fine text and detailed illustrations. We recommend re-exporting at ${MIN_DPI}dpi if possible.`
      });
    } else {
      checks.push({
        status: 'ok',
        label: 'Resolution',
        val: dpi + ' dpi',
        note: `Resolution is ${dpi}dpi — above the ${MIN_DPI}dpi minimum required for sharp, professional print results.`
      });
    }
 
    // ── CHECK 5: DIMENSIONS ─────────────────────────
    const effectiveDpi = dpi || 300;
    const widthMm  = pixelsToMm(width,  effectiveDpi);
    const heightMm = pixelsToMm(height, effectiveDpi);
    const match = closestInvitationSize(widthMm, heightMm);
 
    // Check if dimensions include bleed (file should be slightly larger than finished size)
    const hasBleedLikely = match && (widthMm > match.w + 1 || heightMm > match.h + 1);
 
    if (match) {
      const expectedWithBleedW = match.w + (BLEED_MM * 2);
      const expectedWithBleedH = match.h + (BLEED_MM * 2);
      const hasBleed = widthMm >= expectedWithBleedW - 1 && heightMm >= expectedWithBleedH - 1;
 
      checks.push({
        status: 'ok',
        label: 'Dimensions',
        val: `${Math.round(widthMm)} × ${Math.round(heightMm)} mm`,
        note: `File dimensions match ${match.name}${hasBleed ? ' with bleed included — excellent' : ` (trim size). Please add ${BLEED_MM}mm bleed on all sides`}.`
      });
 
      if (hasBleed) {
        checks.push({
          status: 'ok',
          label: 'Bleed',
          val: BLEED_MM + 'mm detected',
          note: `Your file appears to include the ${BLEED_MM}mm bleed area required on all sides. This ensures no white edges appear after trimming.`
        });
      } else {
        const neededW = Math.round(expectedWithBleedW);
        const neededH = Math.round(expectedWithBleedH);
        checks.push({
          status: 'warn',
          label: 'Bleed',
          val: BLEED_MM + 'mm required',
          note: `Your file appears to be at the finished trim size (${match.name}) without bleed. Please add ${BLEED_MM}mm bleed on all sides — your artwork file should be ${neededW} × ${neededH}mm. Without bleed, a thin white border may appear at the edges after trimming.`
        });
      }
    } else if (widthMm < 50 || heightMm < 50) {
      checks.push({
        status: 'err',
        label: 'Dimensions',
        val: `${Math.round(widthMm)} × ${Math.round(heightMm)} mm`,
        note: `Your file dimensions appear very small (${Math.round(widthMm)} × ${Math.round(heightMm)}mm at ${effectiveDpi}dpi). This is unlikely to be the correct size for printing. Please ensure you are uploading the full-size artwork file.`
      });
    } else {
      checks.push({
        status: 'info',
        label: 'Dimensions',
        val: `${Math.round(widthMm)} × ${Math.round(heightMm)} mm`,
        note: `Your file is ${Math.round(widthMm)} × ${Math.round(heightMm)}mm. This does not match a standard invitation size — which is fine if you have a custom size in mind. Please confirm the finished dimensions match your intended print size when placing your order.`
      });
      checks.push({
        status: 'info',
        label: 'Bleed',
        val: BLEED_MM + 'mm required',
        note: `Please ensure your file includes ${BLEED_MM}mm bleed on all sides beyond the intended trim line. Our team will verify this during pre-press.`
      });
    }
 
    // ── CHECK 7: COLOUR MODE ────────────────────────
    const colourSpaceMap = {
      cmyk:  { status: 'ok',   label: 'CMYK', note: 'Your file is in CMYK colour mode — ideal for professional print. Colours will reproduce accurately.' },
      srgb:  { status: 'warn', label: 'RGB (sRGB)', note: 'Your file is in RGB colour mode. We will convert it to CMYK before printing, which can cause slight colour shifts — particularly with vivid greens, oranges and blues. If colour accuracy is important, please convert to CMYK in your design software before uploading.' },
      rgb:   { status: 'warn', label: 'RGB', note: 'Your file is in RGB colour mode. We will convert it to CMYK before printing, which can cause slight colour shifts. For best results, please convert to CMYK before uploading.' },
      p3:    { status: 'warn', label: 'Display P3', note: 'Your file uses the Display P3 colour space (common in recent Apple devices). This will be converted to CMYK before printing. Wide-gamut colours may shift noticeably — we recommend converting to CMYK before uploading.' },
      b_w:   { status: 'ok',   label: 'Greyscale', note: 'Your file is greyscale — correct for black and white invitation designs.' },
      grey:  { status: 'ok',   label: 'Greyscale', note: 'Your file is greyscale — correct for black and white invitation designs.' },
    };
 
    const colourInfo = colourSpaceMap[space] || {
      status: 'info',
      label: space || 'Unknown',
      note: `Colour space could not be fully determined (${space || 'unknown'}). Our team will verify and convert as needed before printing.`
    };
 
    checks.push({
      status: colourInfo.status,
      label: 'Colour Mode',
      val: colourInfo.label,
      note: colourInfo.note
    });
 
    return respond(checks, headers);
 
  } catch (err) {
    console.error('Preflight error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        checks: [{
          status: 'info',
          label: 'Check Error',
          val: '',
          note: 'An error occurred during the automated check. Your file has been received and our team will review it manually before printing.'
        }],
        summary: { errors: 0, warnings: 0, passed: 0 }
      })
    };
  }
};
 
// ── BUILD SUMMARY AND RESPOND ─────────────────────────
function respond(checks, headers) {
  const errors   = checks.filter(c => c.status === 'err').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const passed   = checks.filter(c => c.status === 'ok').length;
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ checks, summary: { errors, warnings, passed } })
  };
}
 
