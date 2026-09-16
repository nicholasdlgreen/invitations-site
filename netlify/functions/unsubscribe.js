// /netlify/functions/unsubscribe.js
//
// One-click unsubscribe from a link in a marketing email. No sign-in, no
// "are you sure", no login wall — the law expects it to be simple, and making
// it awkward earns spam complaints instead of unsubscribes.
//
// The link carries a per-contact token, so knowing someone's email address is
// not enough to unsubscribe them, and the token cannot be used to read anything.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function page(title, message, tone) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} | Foreverprint</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    body{margin:0;background:#FAF7F2;font-family:'Jost',system-ui,sans-serif;color:#3D2E24;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
    .card{background:#fff;border:1px solid #EFE9E1;border-radius:20px;padding:44px 40px;max-width:460px;text-align:center;}
    h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:1.7rem;margin:0 0 14px;}
    p{font-size:.95rem;line-height:1.8;color:#5C4A3D;margin:0 0 10px;}
    .brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;letter-spacing:.14em;
           text-transform:uppercase;color:#B8976A;margin-bottom:22px;}
    a{color:#B8976A;}
    .note{font-size:.82rem;color:#8C7B6E;margin-top:20px;}
  </style></head><body>
    <div class="card">
      <div class="brand">Foreverprint</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <p class="note">${tone === 'ok'
        ? 'You will still receive emails about any order you place &mdash; those are not marketing.'
        : 'If this is not what you expected, email <a href="mailto:hello@foreverprint.com">hello@foreverprint.com</a> and we will sort it.'}</p>
      <p class="note"><a href="https://foreverprint.com">Back to foreverprint.com</a></p>
    </div>
  </body></html>`;
}

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token;
  const html = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body });

  if (!token) {
    return html(400, page('Link not recognised', 'That unsubscribe link looks incomplete.', 'err'));
  }
  if (!SERVICE_KEY) {
    console.error('[unsubscribe] SUPABASE_SERVICE_KEY not configured');
    return html(500, page('Something went wrong', 'We could not process that just now. Please email us and we will remove you by hand.', 'err'));
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unsubscribe_by_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ p_token: token })
    });
    const removed = res.ok ? await res.json() : false;

    if (removed === true) {
      return html(200, page('You are unsubscribed',
        'You will not receive any more marketing emails from us. Sorry to see you go &mdash; and thank you for having given us a try.', 'ok'));
    }
    // Unknown or already-used token: say the same thing either way, so the link
    // cannot be used to test whether an address is on the list.
    return html(200, page('You are unsubscribed',
      'You will not receive any more marketing emails from us.', 'ok'));
  } catch (err) {
    console.error('[unsubscribe]', err.message);
    return html(500, page('Something went wrong', 'We could not process that just now. Please email us and we will remove you by hand.', 'err'));
  }
};
