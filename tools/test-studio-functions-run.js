// The studio functions actually RUN.
// Run:  jsc tools/test-studio-functions-run.js
//
// studio-nano.js returned width/height from `imageSize`, a name that does not
// exist in the file. It is read only when fal omits the dimensions, so it had
// never fired — but when it did it would have thrown a ReferenceError AFTER
// the image was generated and paid for, turning a good generation into a 500.
// Found on 6 October 2026 while reviewing the studio.
//
// Every other test on these files reads their source, and source tests cannot
// see an unbound name. This one executes both handlers against stubs, and
// deliberately runs studio-nano twice: once with dimensions in the response and
// once WITHOUT, which is the path that held the bug.

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// ── a Netlify-ish environment ─────────────────────────────────────────
function makeEnv(falBody){
  var calls = { posts: [], gets: [] };
  var https = {
    request: function (opts, cb) {
      calls.posts.push({ host: opts.hostname, path: opts.path, auth: opts.headers.Authorization });
      var res = { statusCode: 200, headers: {}, on: function (ev, fn) {
        if (ev === 'data') fn(falBody);
        if (ev === 'end') fn();
      } };
      Promise.resolve().then(function(){ cb(res); });
      return { on: function(){}, write: function(b){ calls.lastBody = b; }, end: function(){} };
    },
    get: function (url, cb) {
      calls.gets.push(String(url));
      var res = { headers: { 'content-type': 'image/jpeg' }, on: function (ev, fn) {
        if (ev === 'data') fn({ length: 3 });
        if (ev === 'end') fn();
      } };
      Promise.resolve().then(function(){ cb(res); });
      return { on: function(){ return this; } };
    }
  };
  // No SUPABASE_SERVICE_KEY, so the rate limiter allows and never calls out.
  var env = { FAL_KEY: 'fal-test-key' };
  return { https: https, env: env, calls: calls };
}

function run(file, falBody, event){
  var SRC = readFile(file);
  var e = makeEnv(falBody);
  var exports_ = {}; var module_ = { exports: exports_ };
  var fn = new Function('require','exports','module','process','fetch','Buffer','console', SRC);
  fn(function(name){ if (name === 'https') return e.https; throw new Error('unexpected require: ' + name); },
     exports_, module_, { env: e.env },
     function(){ return Promise.resolve({ ok: true, json: function(){ return Promise.resolve(true); } }); },
     { byteLength: function (s) { return String(s).length; },
       concat: function(){ return { toString: function(){ return 'AAAA'; } }; } },
     { warn: function(){}, error: function(){}, log: function(){} });
  var out = null, err = null;
  exports_.handler(event).then(function(r){ out = r; }, function(x){ err = x; });
  for (var i = 0; i < 60; i++) drainMicrotasks();
  return { out: out, err: err, calls: e.calls };
}

var FROM_SITE = { origin: 'https://foreverprint.com', referer: 'https://foreverprint.com/' };

// ── studio-nano ───────────────────────────────────────────────────────
print('\nSTUDIO-NANO RUNS WHEN fal RETURNS DIMENSIONS');
var WITH_DIMS = JSON.stringify({ images: [{ url: 'https://fal.example/a.jpg', width: 1536, height: 2048 }] });
var r1 = run('netlify/functions/studio-nano.js', WITH_DIMS, {
  httpMethod: 'POST', headers: FROM_SITE,
  body: JSON.stringify({ brief: 'gold botanical border', size: 'a5', widthMm: 148, heightMm: 210 })
});
is('it did not throw', r1.err ? String(r1.err) : null, null);
is('HTTP 200', r1.out && r1.out.statusCode, 200);
var b1 = JSON.parse((r1.out && r1.out.body) || '{}');
is('an image came back', /^data:image/.test(b1.image || ''), true);
is('width passed through', b1.width, 1536);
is('height passed through', b1.height, 2048);

print('\nAND WHEN fal OMITS THEM — THE PATH THAT HELD THE BUG');
var NO_DIMS = JSON.stringify({ images: [{ url: 'https://fal.example/a.jpg' }] });
var r2 = run('netlify/functions/studio-nano.js', NO_DIMS, {
  httpMethod: 'POST', headers: FROM_SITE,
  body: JSON.stringify({ brief: 'gold botanical border', size: 'a5', widthMm: 148, heightMm: 210 })
});
is('it did not throw a ReferenceError', r2.err ? String(r2.err) : null, null);
is('still HTTP 200', r2.out && r2.out.statusCode, 200);
var b2 = JSON.parse((r2.out && r2.out.body) || '{}');
is('the image still came back', /^data:image/.test(b2.image || ''), true);
is('width is null, not a crash', b2.width, null);
is('height is null, not a crash', b2.height, null);

print('\nIT ASKED FLUX ULTRA FOR THE RIGHT SHAPE');
is('one call to fal', r1.calls.posts.length, 1);
is('at the Flux Pro Ultra endpoint', r1.calls.posts[0].path, '/fal-ai/flux-pro/v1.1-ultra');
is('with the key from the environment', r1.calls.posts[0].auth, 'Key fal-test-key');
// 148 x 210 is 0.705, nearest preset 2:3. A portrait card must not be asked for 3:4.
is('A5 portrait asked for 2:3', /"aspect_ratio":"2:3"/.test(r1.calls.lastBody || ''), true);
is('and the prompt forbids text', /no words, no text anywhere/i.test(r1.calls.lastBody || ''), true);

print('\nA LANDSCAPE CARD IS NOT ASKED FOR A PORTRAIT COMPOSITION');
var r3 = run('netlify/functions/studio-nano.js', WITH_DIMS, {
  httpMethod: 'POST', headers: FROM_SITE,
  body: JSON.stringify({ brief: 'x', size: 'table-plan', widthMm: 420, heightMm: 297 })
});
is('it ran', r3.out && r3.out.statusCode, 200);
is('asked for a landscape ratio', /"aspect_ratio":"(3:2|4:3)"/.test(r3.calls.lastBody || ''), true);
is('and said so in words', /LANDSCAPE design/.test(r3.calls.lastBody || ''), true);

print('\nSTUDIO-TWEAK RUNS');
var r4 = run('netlify/functions/studio-tweak.js', JSON.stringify({ images: [{ url: 'https://fal.example/b.jpg' }] }), {
  httpMethod: 'POST', headers: FROM_SITE,
  body: JSON.stringify({ imageUrl: 'data:image/jpeg;base64,AAAA', tweak: 'make the flowers cream' })
});
is('it did not throw', r4.err ? String(r4.err) : null, null);
is('HTTP 200', r4.out && r4.out.statusCode, 200);
is('an image came back', /^data:image/.test(JSON.parse((r4.out && r4.out.body) || '{}').image || ''), true);
is('at the Kontext endpoint', r4.calls.posts[0].path, '/fal-ai/flux-pro/kontext');
is('and it asks Kontext to keep the rest',
   /keeping the rest of the design/.test(r4.calls.lastBody || ''), true);

print('\nBOTH REFUSE A REQUEST THAT DID NOT COME FROM THE SITE');
['netlify/functions/studio-nano.js','netlify/functions/studio-tweak.js'].forEach(function(f){
  var r = run(f, WITH_DIMS, { httpMethod: 'POST', headers: {},
    body: JSON.stringify({ brief: 'x', imageUrl: 'd', tweak: 't' }) });
  is('  ' + f.split('/').pop() + ' returns 403', r.out && r.out.statusCode, 403);
});

print('\n' + pass + ' passed, ' + fail + ' failed\n');
if (fail) throw new Error(fail + ' failed');
