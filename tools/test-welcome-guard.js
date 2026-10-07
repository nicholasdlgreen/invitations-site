// Runs the welcome-email guard against stubs.
//
// WHY THIS EXISTS
//
// Nothing stopped the welcome email going out with its unwritten sections
// still in it. buildWelcomeHtml carried three passages in [SQUARE BRACKETS]
// that only Nicholas could write, both senders built the html and posted it,
// and no test looked. The Terms page had already reached the live site
// carrying five such blanks in October 2026 — a customer could read, and be
// bound by, "operated by [LEGAL ENTITY NAME]". This is the same fault one
// layer further out, where the output is an email that cannot be recalled.
//
// WHAT NEARLY SLIPPED THROUGH AGAIN
//
// The first detector written for this looked for /\[[A-Z][A-Z ]+\]/ — capitals
// all the way to the closing bracket. Both real blanks read
// "[ONE OR TWO LINES ON HOW IT STARTED — the year, the reason...]", with
// ordinary prose after the dash, so it matched neither and reported the
// template clean while two blanks sat in it. The pattern below starts at a run
// of capitals and then accepts anything up to the bracket. The mutation at the
// foot of this file puts the broken pattern back and proves it is caught.

var WEBHOOK = readFile('netlify/functions/stripe-webhook.js');
var SENDER  = readFile('netlify/functions/send-welcome.js');

var passed = 0, failed = 0;
function ok(name, cond){
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}

var ENV = { SUPABASE_URL:'https://db.test', SUPABASE_ANON_KEY:'anon',
            SUPABASE_SERVICE_KEY:'svc', RESEND_API_KEY:'k',
            FROM_EMAIL:'orders@foreverprint.com', STRIPE_SECRET_KEY:'sk_test' };
var QUIET = { log:function(){}, error:function(){}, warn:function(){} };

// Loads stripe-webhook.js for real, so the template and the pattern under test
// are the ones that ship.
function loadWebhook(src){
  var ex = {};
  new Function('exports','process','console','require', src)(
    ex, { env: ENV }, QUIET,
    function(name){
      if (name === 'node-fetch') return function(){ return Promise.resolve({ ok:true }); };
      if (name === 'stripe')     return function(){ return {}; };
      return {};
    });
  return ex;
}

// Runs send-welcome.js end to end. Records every call it makes, so "it did not
// send" can be told apart from "it did not even ask for the contact".
function runSender(opts){
  opts = opts || {};
  var calls = [], sent = [];
  var fakeFetch = function(url, init){
    calls.push(url);
    function reply(v){ return Promise.resolve({ ok:true, status:200,
      json:function(){ return Promise.resolve(v); },
      text:function(){ return Promise.resolve(JSON.stringify(v)); } }); }
    if (url.indexOf('/auth/v1/user') > -1)
      return reply({ email:'guest@example.com', email_confirmed_at:'2026-10-01T00:00:00Z',
                     user_metadata:{ marketing_optin:true, full_name:'Charlotte Thornton' } });
    if (url.indexOf('claim_welcome_email') > -1)
      return reply([{ email:'guest@example.com', name:'Charlotte Thornton',
                      unsubscribe_token:'tok' }]);
    if (url.indexOf('api.resend.com') > -1) { sent.push(JSON.parse(init.body)); return reply({ id:'e1' }); }
    return reply(null);
  };
  var hook = loadWebhook(opts.webhookSrc || WEBHOOK);
  var ex = {};
  new Function('exports','process','fetch','console','require', opts.senderSrc || SENDER)(
    ex, { env: ENV }, fakeFetch, QUIET,
    function(name){ return name.indexOf('stripe-webhook') > -1 ? hook : {}; });
  var out = null;
  ex.handler({ httpMethod:'POST', headers:{ authorization:'Bearer t' } })
    .then(function(r){ out = JSON.parse(r.body); });
  drainMicrotasks();
  function hit(s){ return calls.some(function(u){ return u.indexOf(s) > -1; }); }
  return { body: out, sent: sent, claimed: hit('claim_welcome_email'), recorded: hit('upsert_contact_from_signup') };
}

print('\nTHE TEMPLATE IS INSPECTED BY RUNNING IT, NOT BY READING IT');
var hook = loadWebhook(WEBHOOK);
ok('the guard is exported', typeof hook.unfilledWelcomeBlanks === 'function');
var blanks = hook.unfilledWelcomeBlanks();
ok('it finds the sections still unwritten', blanks.length === 2);
ok('it names the one about how it started',
   blanks.join(' ').indexOf('HOW IT STARTED') > -1);
ok('it names the one about the team',
   blanks.join(' ').indexOf('WHO IS ON THE TEAM') > -1);

print('\nTHE PASSAGE ABOUT PRINTING IS WRITTEN, AND CLAIMS ONLY WHAT IS TRUE');
var html = hook.buildWelcomeHtml({ name:'Charlotte' }, 'https://example.com');
ok('it says where the cards are made', /printing since\s*\n?\s*1976/.test(html));
ok('it does not name the trade printer', !/printed\s*easy|falkland/i.test(html));
// Their history is theirs. Ours would be a claim we cannot support.
ok('it does not claim WE have printed since 1976',
   !/we have been printing since|our (own )?presses/i.test(html));
// Litho is for long runs; a wedding order of sixty never touches that press.
ok('it does not mention the litho press', !/heidelberg|litho/i.test(html));

print('\nWHILE A SECTION IS UNWRITTEN, NOBODY IS EMAILED');
var held = runSender();
ok('the sender refuses', held.body.sent === false);
ok('and says why', held.body.reason === 'welcome template unfinished');
ok('no email is handed to Resend', held.sent.length === 0);
// The claim marks them welcomed. Taking it and then refusing would leave a
// customer flagged as already welcomed who never receives anything.
ok('the claim is NOT taken, so they can still be welcomed later', held.claimed === false);
ok('their contact row is still recorded', held.recorded === true);

print('\nONCE THE SECTIONS ARE WRITTEN IT SENDS AS NORMAL');
// The branch that is not normally taken today: prove the guard opens again,
// rather than only proving it is shut.
var FILLED = WEBHOOK.replace(/\[[A-Z]{2,}[^\]]*\]/g, 'Written at last.');
var filledHook = loadWebhook(FILLED);
ok('the filled template has no blanks left', filledHook.unfilledWelcomeBlanks().length === 0);
var out = runSender({ webhookSrc: FILLED });
ok('the sender sends', out.body.sent === true);
ok('the claim is taken', out.claimed === true);
ok('exactly one email goes out', out.sent.length === 1);
ok('it is the welcome', out.sent[0].subject === 'Welcome to foreverprint');
ok('to the right person', String(out.sent[0].to) === 'guest@example.com');

print('\nMUTATION: PUT EACH FAULT BACK AND CONFIRM IT IS CAUGHT');

// 1. The detector that reported a dirty template clean.
var BROKEN_PATTERN = WEBHOOK.replace('/\\[[A-Z]{2,}[^\\]]*\\]/g', '/\\[[A-Z][A-Z ]+\\]/g');
ok('the mutation changed the source', BROKEN_PATTERN !== WEBHOOK);
ok('the old capitals-only pattern misses both real blanks, and is caught',
   loadWebhook(BROKEN_PATTERN).unfilledWelcomeBlanks().length === 0);

// 2. The guard removed from the sign-in sender.
var NO_GUARD = SENDER.replace(/\n    const blanks = unfilledWelcomeBlanks\(\);[\s\S]*?\n    }\n/, '\n');
ok('the mutation changed the source', NO_GUARD !== SENDER);
var leaked = runSender({ senderSrc: NO_GUARD });
ok('without the guard the unfinished email IS sent, and is caught',
   leaked.sent.length === 1 &&
   /HOW IT STARTED/.test(leaked.sent[0].html));

// 3. A blank reintroduced into a template that was otherwise finished.
// Aimed at the html the customer would read, not at the file. The first
// attempt put it in a comment instead, and the guard rightly ignored it:
// unfilledWelcomeBlanks RENDERS the template, so a bracketed example sitting
// in the notes above it is not a blank. That distinction is the point of
// checking the output rather than the source.
var REGRESSED = FILLED.replace('foreverprint is a British printer',
                               '[SOMETHING NOBODY WROTE] foreverprint is a British printer');
ok('the mutation changed the source', REGRESSED !== FILLED);
ok('a single new blank is caught',
   loadWebhook(REGRESSED).unfilledWelcomeBlanks().length === 1);
ok('and nothing is sent', runSender({ webhookSrc: REGRESSED }).sent.length === 0);

print('\n' + passed + ' passed, ' + failed + ' failed');
