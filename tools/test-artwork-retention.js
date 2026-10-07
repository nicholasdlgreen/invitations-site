// Runs netlify/functions/artwork-retention.js against stubs.
//
// A source test is not enough here. This is the only unattended thing on the
// site that destroys customer data, and the rule that matters -- never delete
// a file an order refers to -- has to be exercised, not read. CLAUDE.md: a
// Netlify function needs a test that RUNS it.
var SRC = readFile('netlify/functions/artwork-retention.js');

var passed = 0, failed = 0;
function ok(name, cond) {
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}

var DAY = 86400000;
function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }

// The world the function sees. ORDERS holds one order pointing at two files:
// one on the row, one buried inside items[] -- which is where a multi-item
// order keeps them, and the shape a naive check would miss.
function run(opts) {
  var deleted = null;
  var env = {
    SUPABASE_URL: 'https://db.test',
    SUPABASE_SERVICE_KEY: 'service-key',
    ARTWORK_RETENTION_LIVE: opts.live ? 'true' : ''
  };
  var fakeFetch = function (url, init) {
    var body = { ok: true, status: 200, json: function () { return Promise.resolve(this._v); } };
    function reply(v) { var r = Object.create(body); r._v = v; return Promise.resolve(r); }

    if (url.indexOf('/rest/v1/orders') > -1) return reply(opts.orders);
    if (url.indexOf('/rest/v1/saved_designs') > -1) return reply(opts.designs || []);
    if (url.indexOf('storage_objects_artwork') > -1)
      return Promise.resolve({ ok: false, status: 404, text: function(){ return Promise.resolve('no view'); } });
    if (url.indexOf('/storage/v1/object/list/') > -1) return reply(opts.objects);
    if (url.indexOf('/storage/v1/object/artwork') > -1 && init && init.method === 'DELETE') {
      deleted = JSON.parse(init.body).prefixes;
      return reply({ ok: true });
    }
    return reply([]);
  };
  var exports = {};
  new Function('exports', 'process', 'fetch', 'console', SRC)(
    exports, { env: env }, fakeFetch, { log: function(){}, error: function(){} });
  var out = null;
  exports.handler().then(function (r) { out = JSON.parse(r.body); });
  drainMicrotasks();
  return { report: out, deleted: deleted };
}

var ORDERS = [{
  artwork_url: 'https://db.test/storage/v1/object/public/artwork/ORDERED-on-row.pdf',
  print_ready_url: null,
  items: [{ printArtworkUrl: 'https://db.test/.../artwork/ORDERED-in-items.pdf' }]
}];

var OBJECTS = [
  { name: 'ORDERED-on-row.pdf',   created_at: daysAgo(400), metadata: { size: 1048576 } },
  { name: 'ORDERED-in-items.pdf', created_at: daysAgo(400), metadata: { size: 1048576 } },
  { name: 'abandoned-old.pdf',    created_at: daysAgo(30),  metadata: { size: 2097152 } },
  { name: 'abandoned-6-days.pdf', created_at: daysAgo(6),   metadata: { size: 1048576 } },
  { name: 'abandoned-4-days.pdf', created_at: daysAgo(4),   metadata: { size: 1048576 } },
  { name: 'uploaded-today.pdf',   created_at: daysAgo(0),   metadata: { size: 1048576 } }
];

print('A DRY RUN CHANGES NOTHING');
var dry = run({ orders: ORDERS, objects: OBJECTS, live: false });
ok('it reports rather than deletes',        dry.deleted === null);
ok('and says so',                           /DRY RUN/.test(dry.report.mode));

print('\nTHE RULE THAT MATTERS: AN ORDERED FILE IS NEVER DELETED');
ok('both ordered files are kept',           dry.report.kept_because_an_order_or_saved_design_claims_them === 2);
ok('even though they are 400 days old',     dry.report.would_delete === 2);
ok('the one on the order row is safe',      dry.report.sample.indexOf('ORDERED-on-row.pdf') === -1);
ok('and the one inside items[] too',        dry.report.sample.indexOf('ORDERED-in-items.pdf') === -1);

print('\nFIVE DAYS IS THE LINE');
ok('6 days unclaimed goes',                 dry.report.sample.indexOf('abandoned-6-days.pdf') > -1);
ok('30 days unclaimed goes',                dry.report.sample.indexOf('abandoned-old.pdf') > -1);
ok('4 days unclaimed stays',                dry.report.sample.indexOf('abandoned-4-days.pdf') === -1);
ok('todays upload stays',                   dry.report.sample.indexOf('uploaded-today.pdf') === -1);
ok('two are kept for being too new',        dry.report.kept_because_newer_than_cutoff === 2);

print('\nARMED, IT DELETES EXACTLY THOSE AND NO OTHERS');
var live = run({ orders: ORDERS, objects: OBJECTS, live: true });
ok('it deleted something',                  live.deleted !== null);
ok('exactly two files',                     live.deleted && live.deleted.length === 2);
ok('neither of them ordered',               live.deleted &&
   live.deleted.indexOf('ORDERED-on-row.pdf') === -1 &&
   live.deleted.indexOf('ORDERED-in-items.pdf') === -1);
ok('and it says it was live',               /LIVE/.test(live.report.mode));

print('\nA SAVED DESIGN PROTECTS ITS IMAGE TOO');
// Saved designs keep a LINK to the bucket, not the picture. Without this the
// image would be swept five days after it was saved and the customer would
// come back to a broken design — the exact thing saving exists to prevent.
var WITH_DESIGN = [{
  design_data: { image: 'https://db.test/storage/v1/object/public/artwork/saved-ai-abc.jpg' },
  metadata:    { thumbnail_url: 'https://db.test/storage/v1/object/public/artwork/saved-ai-abc.jpg' }
}];
var SAVED_OBJ = OBJECTS.concat([
  { name: 'saved-ai-abc.jpg', created_at: daysAgo(90), metadata: { size: 1048576 } }
]);
var withDesign = run({ orders: ORDERS, designs: WITH_DESIGN, objects: SAVED_OBJ, live: false });
ok('a 90-day-old image is kept when a saved design links to it',
   withDesign.report.sample.indexOf('saved-ai-abc.jpg') === -1);
ok('and it is counted as claimed',
   withDesign.report.kept_because_an_order_or_saved_design_claims_them === 3);

var noDesign = run({ orders: ORDERS, designs: [], objects: SAVED_OBJ, live: false });
ok('MUTATION: with no saved design, that same image IS swept',
   noDesign.report.sample.indexOf('saved-ai-abc.jpg') > -1);

print('\nMUTATION: IF THE CLAIM CHECK BREAKS, THIS MUST FAIL');
// No orders at all — every file becomes unclaimed, so the ordered ones would
// be deleted. If this does NOT change the count, the claim check is not doing
// anything and the test above passed by coincidence.
var noOrders = run({ orders: [], objects: OBJECTS, live: false });
ok('with no orders, the ordered files are no longer protected',
   noOrders.report.would_delete === 4 && noOrders.report.kept_because_an_order_or_saved_design_claims_them === 0);

print('\n' + passed + ' passed, ' + failed + ' failed');
