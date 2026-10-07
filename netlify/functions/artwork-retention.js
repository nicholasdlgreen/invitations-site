// /netlify/functions/artwork-retention.js
//
// Deletes uploaded artwork that no order ever claimed.
//
// The artwork bucket had no DELETE policy at all, so nothing could ever clean
// it up. Measured 7 October 2026: 140 files, 206MB, of which 130 files and
// 198MB — 96% of it — were unclaimed and more than a day old. It only grows,
// and every file in it is a customer's design sitting on our storage bill and
// in our data-protection obligations for no reason.
//
// ── THE ONE RULE THAT MATTERS ────────────────────────────────────────
// A file is deleted ONLY when nothing refers to it. Two things can claim a
// file, and BOTH are checked:
//
//   an order        — the printer is sent LINKS to these files in their job
//                     ticket and fetches them when they produce the job, so a
//                     deleted file is an order that cannot be printed, and a
//                     missing foil layer means it cannot even be placed.
//   a saved design  — the customer made an account specifically so their
//                     design would still be there when they came back. Added
//                     7 October: saved designs now store a link to the image
//                     in this bucket rather than carrying it as base64, so
//                     without this check a design would come back broken five
//                     days after it was saved. That is the precise failure the
//                     save feature exists to prevent.
//
// Retention for artwork that IS claimed is a separate decision, not made here.
//
// UNCLAIMED_DAYS is 5. A basket lives in the browser, so the server cannot see
// one: someone who uploads on Monday and orders on Saturday would find their
// basket pointing at a file that is gone. Five days covers the realistic
// return-to-basket window while still clearing the bill. Raising it is cheap;
// lowering it starts breaking real baskets.
//
// ── IT WILL NOT DELETE ANYTHING UNTIL IT IS TOLD TO ──────────────────
// Default is a dry run: it reports exactly what it WOULD delete and touches
// nothing. Set ARTWORK_RETENTION_LIVE=true in Netlify to arm it. That is
// deliberate — this is the only unattended thing on the site that destroys
// customer data, and it should be read before it is trusted.
//
// Schedule lives in netlify.toml.

const UNCLAIMED_DAYS = 5;
const MAX_PER_RUN    = 200;   // a mistake stays small and visible
const BUCKET         = 'artwork';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const LIVE         = String(process.env.ARTWORK_RETENTION_LIVE || '').toLowerCase() === 'true';

function headers() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
           'Content-Type': 'application/json' };
}

async function sb(path, init) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...(init || {}), headers: headers() });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Every file any order points at, wherever it is recorded. Orders carry the
// files on the row for single-item orders and inside items[] for the rest, and
// a foil job carries a third file, so the whole row is searched as text rather
// than guessing at the shape. Cheap: this table is small and stays small.
async function claimedPaths() {
  const [orders, designs] = await Promise.all([
    sb('orders?select=artwork_url,print_ready_url,items'),
    // design_data holds the image link; metadata holds the thumbnail. Both are
    // searched as text rather than guessing at the shape, the same way orders
    // are, because a saved design's payload changes as the studio changes.
    sb('saved_designs?select=design_data,metadata').catch(e => {
      // A failure here must never widen what gets deleted. Treat it as "cannot
      // prove these are unclaimed" and stop, rather than sweeping them away.
      throw new Error('could not read saved_designs, refusing to sweep: ' + e.message);
    })
  ]);
  const fromOrders = orders.map(r =>
    `${r.artwork_url || ''} ${r.print_ready_url || ''} ${r.items ? JSON.stringify(r.items) : ''}`);
  const fromDesigns = designs.map(d =>
    `${d.design_data ? JSON.stringify(d.design_data) : ''} ${d.metadata ? JSON.stringify(d.metadata) : ''}`);
  return fromOrders.concat(fromDesigns).join(' ');
}

async function listObjects() {
  // storage.objects is readable through PostgREST with the service key, and
  // gives created_at without paging through the Storage API's list endpoint.
  return sb(`storage_objects_artwork?select=name,created_at,size&order=created_at.asc&limit=${MAX_PER_RUN * 5}`)
    .catch(async () => {
      // No helper view: ask the Storage API instead.
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ limit: MAX_PER_RUN * 5, sortBy: { column: 'created_at', order: 'asc' } })
      });
      if (!res.ok) throw new Error(`storage list -> ${res.status} ${await res.text()}`);
      return (await res.json()).map(o => ({
        name: o.name, created_at: o.created_at,
        size: (o.metadata && o.metadata.size) || 0
      }));
    });
}

async function removeFiles(names) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: headers(), body: JSON.stringify({ prefixes: names })
  });
  if (!res.ok) throw new Error(`storage delete -> ${res.status} ${await res.text()}`);
  return res.json();
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase credentials are not set' }) };
  }

  try {
    const [claimed, objects] = await Promise.all([claimedPaths(), listObjects()]);
    const cutoff = Date.now() - UNCLAIMED_DAYS * 86400000;

    const doomed = [];
    let keptClaimed = 0, keptYoung = 0, bytes = 0;

    for (const o of objects) {
      if (claimed.includes(o.name)) { keptClaimed++; continue; }
      if (new Date(o.created_at).getTime() > cutoff) { keptYoung++; continue; }
      if (doomed.length >= MAX_PER_RUN) break;
      doomed.push(o.name);
      bytes += Number(o.size) || 0;
    }

    const report = {
      mode: LIVE ? 'LIVE — files were deleted' : 'DRY RUN — nothing was deleted',
      rule: `unclaimed and older than ${UNCLAIMED_DAYS} days`,
      examined: objects.length,
      kept_because_an_order_or_saved_design_claims_them: keptClaimed,
      kept_because_newer_than_cutoff: keptYoung,
      would_delete: doomed.length,
      would_free_mb: +(bytes / 1048576).toFixed(1),
      sample: doomed.slice(0, 5)
    };

    if (LIVE && doomed.length) {
      await removeFiles(doomed);
      report.deleted = doomed.length;
    }

    console.log('[artwork-retention]', JSON.stringify(report));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(report, null, 2) };
  } catch (e) {
    console.error('[artwork-retention] failed:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
