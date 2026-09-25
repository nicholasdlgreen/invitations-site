// /netlify/functions/printedeasy-price-watch.js
//
// Weekly check that PrintedEasy still charge what our cost base says.
//
// We buy at 20% off their published price, and their terms say prices change
// without notice. Because the shop sells from a published snapshot, a rise at
// their end produces no error — just margin quietly disappearing until someone
// happens to notice. This is the someone.
//
// It is deliberately a canary, not a full re-scrape. It samples about 20
// prices and reads one of their product pages, so roughly 25 requests a week
// against a supplier's website rather than the 1,400 a full refresh needs.
// If anything has moved it emails, and a human runs tools/printedeasy_refresh.py
// and decides what to do about it. Nothing here changes a price.
//
// Two kinds of drift are worth knowing about and both are checked:
//   * a price we have on file no longer matches theirs
//   * a stock or weight appearing or disappearing from their range, which is
//     how a paper we sell quietly stops being buyable
//
// Schedule lives in netlify.toml.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, FROM_EMAIL,
//      ALERT_EMAIL (defaults to FROM_EMAIL)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL  || 'orders@foreverprint.com';
const ALERT_EMAIL  = process.env.ALERT_EMAIL || FROM_EMAIL;

const PE = 'https://www.printedeasy.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const DISCOUNT = 0.20;
const SAMPLE_SIZE = 20;
const TOLERANCE = 0.01;      // pennies of rounding, not a real change
// Netlify stops a function at 10 seconds. Rather than tuning the sample size
// and hoping it fits, the run works to a deadline and reports how far it got —
// a short check every week beats a timeout every week.
const DEADLINE_MS = 7000;
const PACE_MS = 150;

// Our vocabulary to theirs. Kept in step with tools/printedeasy_refresh.py —
// if a paper is added there it belongs here too.
const PE_STOCK = {
  'Uncoated': 'uncoated', 'Silk': 'silk', 'Gloss': 'gloss',
  'Cartonboard': 'cartonboard', 'Ice White': 'icewhite',
  'Tintoretto Gesso': 'tintoretto', 'Nettuno Bianco': 'nettuno',
  'Acquerello Bianco': 'acquerello', 'Sirio Pearl Polar Dawn': 'polardawn',
  'Recycled Uncoated': 'recycled',
  // Boards are chosen by substrate, and the thickness is part of its name.
  'Foamex 5mm': 'foamex5mm'
};
const LUXURY = new Set(['Tintoretto Gesso', 'Nettuno Bianco', 'Acquerello Bianco',
                        'Sirio Pearl Polar Dawn', 'Recycled Uncoated']);

// The fields that identify a stock differ by product: cards are a finish plus
// a weight in gsm, boards are a substrate whose name carries the thickness.
// Boards are priced plain here — lamination and drilled holes are separate
// finishes, and including them would make every rate look as if it had moved.
// Keep this in step with pe_form() in tools/printedeasy_refresh.py.
function peForm(family, stock, gsm) {
  if (family === 'display-board') {
    return { substrate: stock, 'printed-sides': 'single', lamination: 'none',
             'wrap-mounting': 'no', 'drilled-holes': 'none' };
  }
  return { 'stock-finish': stock, 'stock-weight': gsm, 'printed-sides': 'single' };
}

function peProduct(family, paper) {
  if (family === 'flat-card')      return LUXURY.has(paper) ? 'luxury-flat' : 'postcards';
  if (family === 'folded-card')    return 'greeting-cards';
  if (family === 'folded-leaflet') return 'luxury-folded';
  if (family === 'large-format')   return 'posters';
  if (family === 'display-board')  return 'display-boards';
  return null;
}

const LISTED = {
  'luxury-flat':    { A6: 'A6', A5: 'A5', DL: 'DL', A4: 'A4', 'Square-210': '210x210' },
  'postcards':      { A6: 'A6', A5: 'A5', DL: 'DL' },
  'greeting-cards': { A6: 'A6', A5: 'A5', DL: 'DL', Square: '148x148' },
  // Finished size on our side, flat size on theirs — see the note in
  // tools/printedeasy_refresh.py. A finished A5 is a flat A4 folded in half.
  'luxury-folded':  { A6: 'A5', A5: 'A4', A4: 'A3' },
  'posters':        { A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4' },
  'display-boards': { A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4' }
};
const CUSTOM_DIMS = { Square: ['148', '148'], 'Square-210': ['210', '210'],
                      A6: ['105', '148'], A5: ['148', '210'], DL: ['99', '210'],
                      A4: ['210', '297'], A3: ['297', '420'] };

function peSize(prod, size) {
  const listed = (LISTED[prod] || {})[size];
  if (listed) return { size: listed, width: '', height: '' };
  const c = CUSTOM_DIMS[size];
  return c ? { size: 'custom', width: c[0], height: c[1] } : null;
}

// Folded leaflets refuse to price without these; their own JavaScript injects
// them, so they are not in the page HTML to be read.
const EXTRA_FORM = {
  'luxury-folded': { foldType: 'half', foldCount: '1', foldDirection: 'vertical',
                     'print-direction': 'outwards', 'colour-type': 'full', drilling: '0',
                     'hd-printing': 'std', 'low-coverage': 'no', 'pantone-printing': 'no',
                     rgbPrinting: 'no', silver_ink: 'no', 'printed-sides': 'double' }
};

// ── their site ────────────────────────────────────────────────────────────
const forms = {};
let cookie = '';

async function productPage(slug) {
  const res = await fetch(`${PE}/products/${slug}`, { headers: { 'User-Agent': UA, cookie } });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
  return res.text();
}

// Their form lives in the page HTML, so the defaults for options we do not care
// about (lamination, fold direction, Scodix) come along for free.
function readForm(html) {
  const f = {};
  const inputRe = /<input\b[^>]*>/gi;
  let m;
  while ((m = inputRe.exec(html))) {
    const tag = m[0];
    const name = (tag.match(/name="([^"]+)"/) || [])[1];
    if (!name) continue;
    const type = ((tag.match(/type="([^"]+)"/) || [])[1] || 'text').toLowerCase();
    const value = (tag.match(/value="([^"]*)"/) || [])[1] || '';
    if (type === 'hidden' || type === 'text' || type === 'number') f[name] = value;
    else if ((type === 'radio' || type === 'checkbox') && /\bchecked\b/.test(tag)) f[name] = value;
  }
  const selRe = /<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi;
  while ((m = selRe.exec(html))) {
    const opts = [...m[2].matchAll(/<option\b([^>]*)>/gi)];
    let chosen = null, first = null;
    for (const o of opts) {
      const v = (o[1].match(/value="([^"]*)"/) || [])[1] || '';
      if (first === null) first = v;
      if (/\bselected\b/.test(o[1])) chosen = v;
    }
    f[m[1]] = chosen !== null ? chosen : (first || '');
  }
  for (const k of Object.keys(f)) {
    if (k.startsWith('scodix') || ['spot-uv-price', 'foil-price', 'spot-uv-remove',
        'foiling-remove', 'spot-uv-remove-foiling'].includes(k)) delete f[k];
  }
  return f;
}

async function getForm(slug) {
  if (!forms[slug]) {
    const html = await productPage(slug);
    const f = readForm(html);
    const tok = html.match(/name="_token"\s+value="([^"]+)"/);
    if (tok) f._token = tok[1];
    Object.assign(f, EXTRA_FORM[slug] || {});
    forms[slug] = { fields: f, html };
  }
  return forms[slug];
}

async function listPrice(slug, over) {
  const { fields } = await getForm(slug);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...fields, ...over })) body.append(k, v == null ? '' : String(v));
  const res = await fetch(`${PE}/product/pricing/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': UA,
      Referer: `${PE}/products/${slug}`,
      cookie
    },
    body
  });
  if (!res.ok) throw new Error(`pricing ${res.status}`);
  const d = await res.json();
  return d.totalSellingPrice;
}

// The stocks and weights their product JavaScript declares. A paper vanishing
// from here is how one of ours quietly becomes unbuyable.
async function stockList(slug) {
  const { html } = await getForm(slug);
  const src = html.match(new RegExp(`js/products/${slug}\\.js\\?id=[a-f0-9]+`));
  let js = '';
  if (src) {
    js = await fetch(`${PE}/${src[0]}`, { headers: { 'User-Agent': UA } }).then(r => r.text());
  }
  const block = js.match(/var stocks\s*=\s*\{[\s\S]*?\n\s*\};/) ||
                js.match(/availableWeights\s*=\s*\{[\s\S]*?\}/);
  if (!block) return null;
  const out = {};
  // Literal weights: 'silk': [250,300] — or, on the Luxury pages,
  // 'silk': {'name': ..., 'weights': [250,300]}
  const lit = /'([a-z]+)'\s*:\s*(?:\{[^}]*'weights'\s*:\s*)?\[([0-9,\s]*)\]/gi;
  let m;
  while ((m = lit.exec(block[0]))) {
    out[m[1]] = m[2].split(',').map(s => parseInt(s, 10)).filter(Boolean).sort((a, b) => a - b);
  }
  // Some entries point at a variable instead — 'cartonboard': cartonboardAvailable
  // — so resolve those from its declaration. Missing this reads as the stock
  // having been discontinued, which would cry wolf every week.
  const ref = /'([a-z]+)'\s*:\s*([A-Za-z_$][\w$]*)\s*[,}]/gi;
  while ((m = ref.exec(block[0]))) {
    if (out[m[1]]) continue;
    const decl = js.match(new RegExp(`\\b${m[2]}\\s*=\\s*\\[([0-9,\\s]*)\\]`));
    if (decl) {
      out[m[1]] = decl[1].split(',').map(s => parseInt(s, 10)).filter(Boolean).sort((a, b) => a - b);
    }
  }
  return Object.keys(out).length ? out : null;
}

// ── ours ──────────────────────────────────────────────────────────────────
async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// PostgREST caps a response at 1,000 rows whatever limit you ask for, and says
// nothing about having truncated. This watch was asking for limit=2000 and
// quietly checking a quarter of the rates — so a price rise in a family that
// sorted late would never have been seen. Page until a page comes back empty,
// stepping by the rows actually received rather than the size requested,
// because a server capping lower than pageSize returns a short first page and
// stopping on that would be the same bug again. Needs a stable order=.
async function sbAll(path, pageSize = 1000) {
  const sep = path.includes('?') ? '&' : '?';
  const rows = [];
  for (let offset = 0, guard = 0; guard < 1000; guard++) {
    const page = await sb(`${path}${sep}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) return rows;
    rows.push(...page);
    offset += page.length;
  }
  throw new Error('sbAll gave up paging ' + path);
}

// A spread rather than a random handful: every family, and within it a mix of
// papers and quantities, so drift in one corner cannot hide behind the rest.
function pickSample(rows, n) {
  const byFamily = {};
  for (const r of rows) (byFamily[r.supplier_family] = byFamily[r.supplier_family] || []).push(r);
  const fams = Object.keys(byFamily).sort();
  const out = [];
  let i = 0;
  while (out.length < n && i < 500) {
    for (const f of fams) {
      const list = byFamily[f];
      if (!list.length) continue;
      // Deterministic stride, so the same cells are checked every week and a
      // change shows up as a change rather than as a different sample.
      const pick = list[(i * 37) % list.length];
      if (pick && !out.includes(pick)) out.push(pick);
      if (out.length >= n) break;
    }
    i++;
  }
  return out;
}

function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendEmail(subject, html) {
  if (!process.env.RESEND_API_KEY) { console.log('[price-watch] no RESEND_API_KEY — not emailing'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Foreverprint <${FROM_EMAIL}>`, to: ALERT_EMAIL, subject, html })
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 200));
}

exports.handler = async () => {
  if (!SERVICE_KEY) {
    console.error('[price-watch] SUPABASE_SERVICE_KEY not set — nothing done');
    return { statusCode: 500, body: 'not configured' };
  }

  let rates;
  try {
    rates = await sbAll('sheet_rates?select=supplier_family,paper_name,weight_gsm,size,quantity,cost&order=id');
  } catch (err) {
    console.error('[price-watch] could not read sheet_rates:', err.message);
    return { statusCode: 500, body: err.message };
  }
  if (!rates.length) {
    console.log('[price-watch] no rates on file — nothing to check');
    return { statusCode: 200, body: JSON.stringify({ checked: 0 }) };
  }

  const sample = pickSample(rates, SAMPLE_SIZE);
  const moved = [], errors = [];
  let checked = 0;
  const startedAt = Date.now();

  for (const r of sample) {
    if (Date.now() - startedAt > DEADLINE_MS) break;
    const prod = peProduct(r.supplier_family, r.paper_name);
    const stock = PE_STOCK[r.paper_name];
    const dims = prod ? peSize(prod, r.size) : null;
    if (!prod || !stock || !dims) continue;
    try {
      const theirs = await listPrice(prod, {
        size: dims.size, width: dims.width, height: dims.height, quantity: r.quantity,
        ...peForm(r.supplier_family, stock, r.weight_gsm)
      });
      checked++;
      const expected = Number(r.cost) / (1 - DISCOUNT);
      if (!theirs || Math.abs(theirs - expected) > TOLERANCE) {
        moved.push({ ...r, expected, theirs, newCost: theirs ? theirs * (1 - DISCOUNT) : null });
      }
    } catch (err) {
      const unit = r.supplier_family === 'display-board' ? 'mm' : 'gsm';
      errors.push(`${r.paper_name} ${r.weight_gsm}${unit} ${r.size} x${r.quantity}: ${err.message}`);
    }
    await new Promise(r2 => setTimeout(r2, PACE_MS));
  }

  // Range check: have any stocks or weights come or gone?
  // One product per run, rotating weekly: the whole range is covered every
  // three weeks and no single run risks the deadline.
  const ALL = ['luxury-flat', 'greeting-cards', 'postcards'];
  const week = Math.floor(Date.now() / 6048e5);
  const rangeNotes = [];
  for (const slug of [ALL[week % ALL.length]]) {
    try {
      const theirs = await stockList(slug);
      if (!theirs) { rangeNotes.push(`${slug}: could not read their stock list`); continue; }
      const ourStocks = new Set(rates.filter(r => peProduct(r.supplier_family, r.paper_name) === slug)
                                     .map(r => PE_STOCK[r.paper_name]));
      for (const s of ourStocks) {
        if (!theirs[s]) { rangeNotes.push(`${slug}: we sell "${s}" but they no longer list it`); continue; }
        // A weight disappearing matters as much as a stock: it is what makes a
        // thickness we offer suddenly unbuyable.
        const ourGsms = new Set(rates.filter(r => PE_STOCK[r.paper_name] === s &&
                                                  peProduct(r.supplier_family, r.paper_name) === slug)
                                     .map(r => Number(r.weight_gsm)));
        for (const g of ourGsms) {
          if (!theirs[s].includes(g)) rangeNotes.push(`${slug}: we sell "${s}" at ${g}gsm but they now list only ${theirs[s].join('/')}gsm`);
        }
      }
      // Only flag a stock we have never heard of. Silk and Uncoated appear on
      // several of their products and we deliberately buy them on one route,
      // so "not bought here" is not news — "not known to us at all" is.
      const known = new Set(Object.values(PE_STOCK));
      for (const s of Object.keys(theirs)) {
        if (!known.has(s)) rangeNotes.push(`${slug}: they now offer "${s}" (${theirs[s].join('/')}gsm), which we do not sell at all`);
      }
    } catch (err) {
      rangeNotes.push(`${slug}: ${err.message}`);
    }
  }

  console.log(`[price-watch] checked ${checked}/${sample.length} in ${Date.now() - startedAt}ms, ` +
              `moved ${moved.length}, range notes ${rangeNotes.length}`);

  if (!moved.length && !rangeNotes.length) {
    return { statusCode: 200, body: JSON.stringify({ checked, moved: 0, errors: errors.length }) };
  }

  const rows = moved.map(m => {
    const pct = m.expected ? ((m.theirs - m.expected) / m.expected * 100) : 0;
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #EFE9E1;">${esc(m.paper_name)} ${esc(m.weight_gsm)}gsm<br>
        <span style="color:#8C7B6E;font-size:11px;">${esc(m.supplier_family)} &middot; ${esc(m.size)} &middot; ${esc(m.quantity)}</span></td>
      <td style="padding:6px 10px;border-bottom:1px solid #EFE9E1;text-align:right;">£${m.expected.toFixed(2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #EFE9E1;text-align:right;"><strong>${m.theirs ? '£' + Number(m.theirs).toFixed(2) : 'not offered'}</strong></td>
      <td style="padding:6px 10px;border-bottom:1px solid #EFE9E1;text-align:right;color:${pct > 0 ? '#B4433F' : '#3F7A4E'};">${m.theirs ? (pct > 0 ? '+' : '') + pct.toFixed(1) + '%' : '—'}</td>
    </tr>`;
  }).join('');

  const html = `
  <div style="background:#FAF7F2;padding:32px 16px;font-family:Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #EFE9E1;border-radius:14px;overflow:hidden;">
      <div style="background:#3D2E24;padding:22px 28px;">
        <div style="font-family:Georgia,serif;font-size:19px;color:#fff;">PrintedEasy prices have moved</div>
      </div>
      <div style="padding:24px 28px 8px;font-size:14px;line-height:1.7;color:#5C4A3D;">
        Checked ${checked} sample prices${checked < sample.length ? ` (of ${sample.length} planned — the run hit its time limit)` : ''}.
        <strong>${moved.length}</strong> no longer match what our cost base says.
        Our sell prices have <em>not</em> changed &mdash; nothing is published automatically.
      </div>
      ${moved.length ? `<div style="padding:8px 18px 0;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;color:#5C4A3D;">
          <thead><tr style="text-align:left;color:#8C7B6E;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">
            <th style="padding:6px 10px;">Item</th><th style="padding:6px 10px;text-align:right;">On file</th>
            <th style="padding:6px 10px;text-align:right;">Theirs now</th><th style="padding:6px 10px;text-align:right;">Change</th>
          </tr></thead><tbody>${rows}</tbody>
        </table></div>` : ''}
      ${rangeNotes.length ? `<div style="padding:18px 28px 0;">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#B8976A;margin-bottom:6px;">Range changes</div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#5C4A3D;">
          ${rangeNotes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      <div style="padding:22px 28px 30px;">
        <div style="border-top:1px solid #EFE9E1;padding-top:16px;font-size:13px;line-height:1.8;color:#5C4A3D;">
          <strong>What to do:</strong> run <code style="background:#FAF7F2;padding:2px 5px;border-radius:3px;">python3 tools/printedeasy_refresh.py</code>
          to see every change, then <code style="background:#FAF7F2;padding:2px 5px;border-radius:3px;">--write</code> to update our costs.
          Then open admin &rarr; Pricing &rarr; Publish to move the prices customers see.
        </div>
      </div>
      <div style="background:#FAF7F2;padding:14px 28px;text-align:center;font-size:11px;color:#8C7B6E;">
        Weekly price watch &middot; ${esc(new Date().toDateString())}
      </div>
    </div>
  </div>`;

  try {
    await sendEmail(`PrintedEasy: ${moved.length} price${moved.length === 1 ? '' : 's'} moved`, html);
  } catch (err) {
    console.error('[price-watch] could not email:', err.message);
  }

  return { statusCode: 200, body: JSON.stringify({ checked, moved: moved.length, rangeNotes, errors: errors.length }) };
};

// Exported so the mapping can be unit-checked without hitting either service.
exports._internals = { peProduct, peSize, pickSample, readForm, PE_STOCK };
