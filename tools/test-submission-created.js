// Runs netlify/functions/submission-created.js against a stubbed Resend.
//
// Source tests cannot see an unbound name, and this function's entire job is to
// fire exactly when nobody is watching. CLAUDE.md: a Netlify function needs a
// test that RUNS it, and exercises the branch that is NOT normally taken.
var SRC = readFile('netlify/functions/submission-created.js');

var passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}

function run(formName, data, opts) {
  opts = opts || {};
  var sent = null, logged = [];
  var fakeFetch = function (url, init) {
    sent = JSON.parse(init.body);
    if (opts.resendFails)
      return Promise.resolve({ ok: false, status: 422,
        text: function () { return Promise.resolve('bad from address'); } });
    return Promise.resolve({ ok: true, status: 200,
      json: function () { return Promise.resolve({ id: 'email_1' }); } });
  };
  var exports = {};
  new Function('exports', 'process', 'fetch', 'console', SRC)(
    exports,
    { env: { RESEND_API_KEY: opts.noKey ? '' : 'key', FROM_EMAIL: 'orders@foreverprint.com',
             NOTIFY_EMAIL: 'hello@foreverprint.com' } },
    fakeFetch,
    { log: function (m) { logged.push(String(m)); },
      error: function (m, x) { logged.push(String(m) + ' ' + (x || '')); } });

  var out = null;
  exports.handler({ body: JSON.stringify({ payload: { form_name: formName, data: data } }) })
    .then(function (r) { out = r; });
  drainMicrotasks();
  return { sent: sent, result: out, logged: logged.join(' | ') };
}

var MSG = { topic: 'A problem with my order', name: 'Jane Hall',
            email: 'jane@example.com', order: 'FP-2026-0042',
            message: 'The envelopes are the wrong colour.' };

print('A CONTACT MESSAGE REACHES SOMEBODY');
var c = run('contact', MSG);
ok('an email was sent',                       !!c.sent);
ok('to the notify address',                   c.sent && c.sent.to === 'hello@foreverprint.com');
ok('from our own address',                    c.sent && c.sent.from === 'orders@foreverprint.com');
ok('the subject carries the topic',           c.sent && c.sent.subject.indexOf('A problem with my order') > -1);
ok('the message body is in it',               c.sent && c.sent.html.indexOf('wrong colour') > -1);
ok('so is the order number',                  c.sent && c.sent.html.indexOf('FP-2026-0042') > -1);

print('\nREPLY GOES BACK TO THE CUSTOMER, NOT TO US');
ok('reply_to is their address',               c.sent && c.sent.reply_to === 'jane@example.com');

print('\nA LAUNCH SIGNUP IS A DIFFERENT EMAIL');
var s = run('launch-signup', { email: 'someone@example.com' });
ok('its own subject',                         s.sent && /launch/i.test(s.sent.subject));
ok('carries the address',                     s.sent && s.sent.html.indexOf('someone@example.com') > -1);
ok('and does not set reply_to',               s.sent && s.sent.reply_to === undefined);

print('\nHOSTILE INPUT CANNOT BREAK THE EMAIL');
var x = run('contact', { topic: 'Something else', name: '<script>alert(1)</script>',
                         email: 'a@b.com', order: '', message: 'a < b & c > d' });
ok('markup in a name is escaped',             x.sent && x.sent.html.indexOf('<script>') === -1);
ok('and still readable',                      x.sent && x.sent.html.indexOf('&lt;script&gt;') > -1);
ok('ampersands survive',                      x.sent && x.sent.html.indexOf('a &lt; b &amp; c &gt; d') > -1);

print('\nTHE BRANCH NOBODY EXERCISES: IT FAILS');
var f = run('contact', MSG, { resendFails: true });
ok('it still returns 200, so Netlify does not retry and double-send',
   f.result && f.result.statusCode === 200);
ok('and it says so loudly in the log',        /COULD NOT NOTIFY/.test(f.logged));

var n = run('contact', MSG, { noKey: true });
ok('with no API key it does not throw',       n.result && n.result.statusCode === 200);
ok('and says nobody was told',                /nobody was told/.test(n.logged));

print('\nMUTATION: IF THE ESCAPING GOES, THIS MUST FAIL');
// Replace esc() with a pass-through by cutting the escaping chain out of the
// real source. An exact-text swap, so if the function is reformatted this
// mutation stops matching and says so rather than passing quietly.
var CHAIN = "\n  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')" +
            "\n  .replace(/\"/g, '&quot;')";
var unsafe = SRC.replace(CHAIN, '');
ok('the mutation actually changed the source', unsafe !== SRC);

var leaked = false;
var e2 = {};
new Function('exports','process','fetch','console', unsafe)(
  e2, { env: { RESEND_API_KEY: 'k', FROM_EMAIL: 'a@b.com', NOTIFY_EMAIL: 'c@d.com' } },
  function (u, i) {
    if (JSON.parse(i.body).html.indexOf('<script>') > -1) leaked = true;
    return Promise.resolve({ ok: true, json: function(){ return Promise.resolve({}); } });
  },
  { log: function(){}, error: function(){} });
e2.handler({ body: JSON.stringify({ payload: { form_name: 'contact',
    data: { topic: 't', name: '<script>alert(1)</script>', email: 'a@b.com', message: 'x' } } }) });
drainMicrotasks();
ok('without esc(), markup reaches the email', leaked);

print('\n' + passed + ' passed, ' + failed + ' failed');
