// Runs netlify/functions/saved-design-reminder.js against stubs.
//
// This emails real customers unattended, so every rule that stops it emailing
// the wrong person is exercised rather than read. CLAUDE.md: a Netlify
// function needs a test that RUNS it, and exercises the branch that is NOT
// normally taken.
var SRC = readFile('netlify/functions/saved-design-reminder.js');

var passed = 0, failed = 0;
function ok(name, cond){
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}
var DAY = 86400000;
function daysAgo(n){ return new Date(Date.now() - n * DAY).toISOString(); }

function run(opts){
  opts = opts || {};
  var sent = [];
  var fakeFetch = function (url, init) {
    function reply(v){ return Promise.resolve({ ok:true, status:200,
      json:function(){ return Promise.resolve(v); }, text:function(){ return Promise.resolve(''); } }); }
    if (url.indexOf('/rest/v1/saved_designs') > -1) return reply(opts.designs || []);
    if (url.indexOf('/auth/v1/admin/users/') > -1) {
      var id = url.split('/users/')[1];
      var e = (opts.emails || {})[id];
      if (!e) return Promise.resolve({ ok:false, status:404, json:function(){return Promise.resolve({});} });
      return reply({ email: e });
    }
    if (url.indexOf('/rest/v1/orders') > -1) {
      var em = decodeURIComponent((url.match(/customer_email=eq\.([^&]+)/)||[])[1] || '');
      return reply((opts.ordered || []).indexOf(em) > -1 ? [{ id: 1 }] : []);
    }
    if (url.indexOf('/rest/v1/contacts') > -1) {
      var em2 = decodeURIComponent((url.match(/email=eq\.([^&]+)/)||[])[1] || '');
      return reply((opts.unsubscribed || []).indexOf(em2) > -1 ? [{ unsubscribed_at: daysAgo(1) }] : [{ unsubscribed_at: null }]);
    }
    if (url.indexOf('api.resend.com') > -1) { sent.push(JSON.parse(init.body)); return reply({ id:'e1' }); }
    return reply([]);
  };
  var exports = {};
  new Function('exports','process','fetch','console','require', SRC)(
    exports,
    { env: { SUPABASE_URL:'https://db.test', SUPABASE_SERVICE_KEY:'svc',
             RESEND_API_KEY:'k', FROM_EMAIL:'hello@foreverprint.com',
             SAVED_REMINDER_LIVE: opts.live ? 'true' : '' } },
    fakeFetch, { log:function(){}, error:function(){} }, function(){ return {}; });
  var out = null;
  exports.handler().then(function(r){ out = JSON.parse(r.body); });
  drainMicrotasks();
  return { report: out, sent: sent };
}

var DESIGNS = [
  { id:'d-fresh',   user_id:'u1', product_type:'wedding-invitations', created_at: daysAgo(1)  },
  { id:'d-due',     user_id:'u2', product_type:'wedding-invitations', created_at: daysAgo(7)  },
  { id:'d-bought',  user_id:'u3', product_type:'save-the-dates',      created_at: daysAgo(7)  },
  { id:'d-unsub',   user_id:'u4', product_type:'menu-cards',          created_at: daysAgo(7)  },
  { id:'d-ancient', user_id:'u5', product_type:'place-cards',         created_at: daysAgo(90) },
  { id:'d-nouser',  user_id:'u6', product_type:'rsvp-cards',          created_at: daysAgo(7)  }
];
var EMAILS = { u1:'a@x.com', u2:'b@x.com', u3:'c@x.com', u4:'d@x.com', u5:'e@x.com' };

// The sweep itself filters by date in the query, so the stub returns what that
// query WOULD return: inside the window only.
var IN_WINDOW = DESIGNS.filter(function(d){
  var age = (Date.now() - new Date(d.created_at)) / DAY;
  return age >= 3 && age <= 21;
});

print('IT SENDS NOTHING UNTIL THE WORDS EXIST');
var dry = run({ designs: IN_WINDOW, emails: EMAILS, ordered:['c@x.com'], unsubscribed:['d@x.com'] });
ok('no email was sent',                       dry.sent.length === 0);
ok('and it says it is a dry run',             /DRY RUN/.test(dry.report.mode));
ok('even when LIVE is set, because the body is unwritten',
   /body is not written/.test(run({ designs: IN_WINDOW, emails: EMAILS, live: true }).report.mode));

print('\nWHO IT WOULD EMAIL');
ok('the one who saved and did not order',     dry.report.would_email === 1);
ok('someone who has ordered is skipped',      dry.report.skipped.ordered === 1);
ok('someone who unsubscribed is skipped',     dry.report.skipped.unsubscribed === 1);
ok('a design whose user is gone is skipped',  dry.report.skipped.no_email === 1);

print('\nTHE WINDOW');
ok('a design saved yesterday is not in the window',
   IN_WINDOW.filter(function(d){ return d.id === 'd-fresh'; }).length === 0);
ok('a design saved 90 days ago is not either',
   IN_WINDOW.filter(function(d){ return d.id === 'd-ancient'; }).length === 0);
ok('the query asks for both ends of the window',
   /created_at=lte\./.test(SRC) && /created_at=gte\./.test(SRC));
ok('and only rows never reminded',            /reminder_sent_at=is\.null/.test(SRC));
ok('with a per-run cap',                      /limit=\$\{MAX_PER_RUN\}/.test(SRC));

print('\nORDERS AND UNSUBSCRIBES ARE CHECKED AT SEND TIME, NOT TRUSTED');
ok('orders are queried per person',           /orders\?select=id&customer_email=eq\./.test(SRC));
ok('unsubscribes are queried per person',     /contacts\?select=unsubscribed_at/.test(SRC));

print('\nMUTATION: EACH GUARD REMOVED MUST CHANGE THE OUTCOME');
function mutates(name, src){
  var old = SRC, before = failed;
  SRC = src;
  var r = run({ designs: IN_WINDOW, emails: EMAILS, ordered:['c@x.com'], unsubscribed:['d@x.com'] });
  var caught = !(r.report && r.report.would_email === 1);
  SRC = old; failed = before;
  if (caught) { passed++; print('  ok   ' + name + ' is caught'); }
  else        { failed++; print('  FAIL ' + name + ' SLIPPED THROUGH'); }
}
mutates('the has-ordered check removed',
        SRC.replace('if (await hasOrdered(email))     { skipped.ordered++;      continue; }', ''));
mutates('the unsubscribe check removed',
        SRC.replace('if (await hasUnsubscribed(email)){ skipped.unsubscribed++; continue; }', ''));

print('\n' + passed + ' passed, ' + failed + ' failed');
