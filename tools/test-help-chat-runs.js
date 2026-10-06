// The help-chat function actually RUNS.
//
// Every other test on this function reads its source. That is why, on
// 5 October 2026, a refactor that split the file into PROMPT_HEAD /
// PROMPT_TAIL / KNOWLEDGE_FALLBACK rebuilt it from three slices and silently
// dropped the first five lines — which held `const https = require('https')`
// and `const MODEL = ...`. Every source test still passed: they looked for
// "model: MODEL", which was still there. Only the DEFINITIONS had gone.
//
// It deployed. Amy returned HTTP 502, "ReferenceError: MODEL is not defined",
// to every question for a day, and the whole point of the previous day's work
// had been to stop exactly that.
//
// So this one executes the handler against stubs and insists on a reply. An
// unbound identifier anywhere on the path now fails here instead of in front
// of a customer.

var SRC = read('netlify/functions/help-chat.js');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// ── a Netlify-ish environment ─────────────────────────────────────────
var ANTHROPIC_REPLY = JSON.stringify({
  content: [{ text: 'Place cards are 85 x 55mm.' }],
  usage: { input_tokens: 1200, output_tokens: 40 }
});

function makeEnv(){
  var calls = { anthropic: 0, fetches: [] };
  var https = {
    request: function (opts, cb) {
      calls.anthropic++;
      calls.lastPath = opts.path;
      calls.sentApiKey = opts.headers['x-api-key'];
      var res = { on: function (ev, fn) {
        if (ev === 'data') fn(ANTHROPIC_REPLY);
        if (ev === 'end') fn();
      } };
      // Called back on the next turn, as the real one is.
      Promise.resolve().then(function(){ cb(res); });
      return { on: function(){}, write: function(b){ calls.body = b; }, end: function(){} };
    }
  };
  var fetchStub = function (url) {
    calls.fetches.push(String(url));
    return Promise.resolve({
      ok: true, status: 200,
      json: function () {
        // The catalogue reads; shapes match what buildKnowledge expects.
        if (/print_sizes/.test(url))      return Promise.resolve([{name:'A5',width_mm:148,height_mm:210}]);
        if (/paper_stocks/.test(url))     return Promise.resolve([{name:'Silk',description:'Smooth.',weights:[{gsm:300}]}]);
        if (/finish_types/.test(url))     return Promise.resolve([{name:'Foiling',options:[{name:'Gold'},{name:'None'}]}]);
        if (/delivery_options/.test(url)) return Promise.resolve([{name:'Standard',price:'0.00',surcharge_pct:'0',production_days:3,delivery_days:1}]);
        if (/product_types/.test(url))    return Promise.resolve([{name:'Place Cards'}]);
        return Promise.resolve([]);
      }
    });
  };
  var env = { ANTHROPIC_API_KEY: 'sk-ant-test', SUPABASE_ANON_KEY: 'anon-test',
              SUPABASE_URL: 'https://example.supabase.co' };
  return { https: https, fetch: fetchStub, env: env, calls: calls };
}

function run(event){
  var e = makeEnv();
  var exports_ = {};
  var module_ = { exports: exports_ };
  var fn = new Function('require','exports','module','process','fetch','Buffer','console', SRC);
  fn(function(name){ if (name === 'https') return e.https; throw new Error('unexpected require: ' + name); },
     exports_, module_, { env: e.env }, e.fetch,
     { byteLength: function (s) { return String(s).length; } },
     { warn: function(){}, error: function(){}, log: function(){} });
  var out = null, err = null;
  exports_.handler(event).then(function(r){ out = r; }, function(x){ err = x; });
  for (var i = 0; i < 40; i++) drainMicrotasks();
  return { out: out, err: err, calls: e.calls };
}

var EVENT = {
  httpMethod: 'POST',
  headers: { origin: 'https://foreverprint.com', referer: 'https://foreverprint.com/' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'what size are place cards?' }],
                         sessionId: 'test-run' })
};

print('\nTHE HANDLER RUNS WITHOUT AN UNBOUND NAME');
var r = run(EVENT);
is('it did not throw', r.err ? String(r.err) : null, null);
is('it returned something', r.out !== null, true);
if (r.out) {
  is('with HTTP 200', r.out.statusCode, 200);
  var body = JSON.parse(r.out.body || '{}');
  is('and Amy’s words in the body', body.text, 'Place cards are 85 x 55mm.');
  is('no error field', body.error === undefined, true);
}

print('\nIT CALLED ANTHROPIC, WITH THE MODEL AND THE KEY');
is('one call to the API', r.calls.anthropic, 1);
is('at the messages endpoint', r.calls.lastPath, '/v1/messages');
is('with the key from the environment', r.calls.sentApiKey, 'sk-ant-test');
// This is the identifier that was missing. It has to reach the request body.
is('and MODEL resolved into the request',
   /"model":"claude-haiku-4-5-20251001"/.test(r.calls.body || ''), true);

print('\nIT READ THE CATALOGUE, NOT A SNAPSHOT');
var cat = r.calls.fetches.filter(function(u){ return /print_sizes|paper_stocks|finish_types|delivery_options|product_types/.test(u); });
is('all five tables were read', cat.length, 5);
is('and the prompt carried the live sizes', /148×210mm/.test(r.calls.body || ''), true);

print('\nA BROKEN BODY STILL ANSWERS, AND STILL LOGS');
var bad = run({ httpMethod: 'POST',
                headers: { origin: 'https://foreverprint.com' }, body: 'not json' });
is('it did not throw', bad.err ? String(bad.err) : null, null);
is('it returned 500 rather than crashing', bad.out && bad.out.statusCode, 500);

print('\nMUTATION: REMOVING THE DEFINITION MUST FAIL THIS TEST');
// Exactly the edit that shipped: the name is used but never defined.
var BROKEN = SRC.replace(/^const MODEL = .*$/m, '');
(function(){
  var e = makeEnv(), ex = {}, caught = null;
  try {
    new Function('require','exports','module','process','fetch','Buffer','console', BROKEN)(
      function(){ return e.https; }, ex, { exports: ex }, { env: e.env }, e.fetch,
      { byteLength: function(s){ return String(s).length; } },
      { warn: function(){}, error: function(){}, log: function(){} });
    ex.handler(EVENT).then(function(){}, function(x){ caught = x; });
    for (var i = 0; i < 40; i++) drainMicrotasks();
  } catch (x) { caught = x; }
  // The handler catches its own errors and returns 500, which is itself the
  // tell: a 200 is only possible when every name resolves.
  var res = null;
  try {
    var e2 = makeEnv(), ex2 = {};
    new Function('require','exports','module','process','fetch','Buffer','console', BROKEN)(
      function(){ return e2.https; }, ex2, { exports: ex2 }, { env: e2.env }, e2.fetch,
      { byteLength: function(s){ return String(s).length; } },
      { warn: function(){}, error: function(){}, log: function(){} });
    ex2.handler(EVENT).then(function(r){ res = r; }, function(){});
    for (var j = 0; j < 40; j++) drainMicrotasks();
  } catch (x) {}
  // !! because a broken handler resolves to nothing at all, and `null`
  // is not `false` — the first version of this assertion compared the two
  // and failed while the behaviour under test was perfectly correct.
  is('a file with MODEL undefined cannot return 200', !!(res && res.statusCode === 200), false);
})();

print('\n' + pass + ' passed, ' + fail + ' failed\n');
