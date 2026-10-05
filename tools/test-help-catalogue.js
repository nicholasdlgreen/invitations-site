// Amy reads the catalogue instead of remembering it.
//
// Her facts used to be a snapshot typed into help-chat.js. It drifted for
// about four months with nobody noticing: four of fifteen sizes, "up to A1"
// when we sell A0, not one paper named, and nothing at all about what delivery
// costs — the question that finally exposed it. Rewriting the snapshot on
// 5 October fixed the symptom and left the cause, because the next catalogue
// change starts the drift again.
//
// So the five tables that ARE the shop — print_sizes, paper_stocks,
// finish_types, delivery_options, product_types, the same rows the order page
// and the landing pages read — are now assembled into her prompt on every
// reply, behind a five-minute cache.
//
// Run against tools/fixtures/catalogue.json, a real capture of those tables.
// Refresh it with the command in the commit message if the catalogue moves.

var SRC = read('netlify/functions/help-chat.js');
var C   = JSON.parse(read('tools/fixtures/catalogue.json'));
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Cut the generators out of the shipped file and run them, so this tests the
// code that deploys rather than a copy that can drift from it.
function grab(name){
  var at = SRC.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('no function ' + name);
  var i = SRC.indexOf('{', at), d = 0;
  for (var j = i; j < SRC.length; j++){
    if (SRC[j] === '{') d++;
    else if (SRC[j] === '}' && --d === 0) return SRC.slice(at, j + 1);
  }
}
var F = new Function(
  grab('sentenceList') + grab('describeSizes') + grab('describePapers') +
  grab('describeFinishes') + grab('describeDelivery') +
  'return {list:sentenceList, sizes:describeSizes, papers:describePapers,' +
  ' finishes:describeFinishes, delivery:describeDelivery};')();

var sizes = F.sizes(C.sizes), papers = F.papers(C.papers),
    finishes = F.finishes(C.finishes), delivery = F.delivery(C.delivery);

print('\nEVERY SIZE IN THE TABLE REACHES AMY');
is('the fixture has the sizes we sell', C.sizes.length, 15);
C.sizes.forEach(function(s){
  is('mentions ' + s.name, sizes.indexOf(s.name + ' (') >= 0, true); });
is('with dimensions', /A0 \(841×1189mm\)/.test(sizes), true);
is('A0 is not described as the limit at A1', /up to A1/.test(sizes), false);
is('large formats are separated from card sizes', /Large formats for signs and plans/.test(sizes), true);
is('A5 is a card size, not a sign', sizes.indexOf('A5') < sizes.indexOf('Large formats'), true);
is('A0 is a sign, not a card size', sizes.indexOf('A0') > sizes.indexOf('Large formats'), true);

print('\nEVERY PAPER, WITH ITS WEIGHTS IN ORDER');
is('the fixture has ten stocks', C.papers.length, 10);
C.papers.forEach(function(p){
  is('names ' + p.name, papers.indexOf(p.name) >= 0, true); });
is('weights read low to high', /Uncoated — .*120\/250\/300\/350\/400gsm/.test(papers), true);
is('and are not in table order', /120\/250/.test(papers) && !/400\/120/.test(papers), true);
is('Foamex is measured in mm, not gsm', /Foamex 5mm — .*5mm\./.test(papers), true);
is('no paper is left without a weight', /— [^\n]*\.(?!gsm)[^\n]*\d+(gsm|mm)\./.test(papers), true);
is('says weight does not change the price', /Weight does not change the price/.test(papers), true);

print('\nEVERY FINISH, AND WHAT WE REFUSE');
C.finishes.forEach(function(f){
  is('lists ' + f.name, finishes.indexOf(f.name + ' —') >= 0, true); });
is('all eight foils', ['Gold','Silver','Copper','Rose Gold','Red','Blue','Green','Holographic']
   .every(function(c){ return finishes.indexOf(c) >= 0; }), true);
is('"None" is never offered as a finish', /— None|, None|None and/.test(finishes), false);
is('still says what we do not sell', /do NOT offer wax seals/.test(finishes), true);

print('\nDELIVERY, PRICED THE WAY THE BASKET PRICES IT');
is('standard is free', /Standard — 3 working days, FREE/.test(delivery), true);
is('express is 20% with a GBP 20 minimum',
   /Express — 2 working days, 20% of the order value with a £20 minimum/.test(delivery), true);
is('next day is 40% with a GBP 40 minimum',
   /40% of the order value with a £40 minimum/.test(delivery), true);
is('the day count matches the basket formula', (function(){
  // Same arithmetic as estimatedArrival in upload-and-print.html.
  var o = C.delivery[0];
  var days = Math.max(0, (o.production_days || 1) - 1) + (o.delivery_days || 1);
  return delivery.indexOf(o.name + ' — ' + days + ' working day') >= 0;
})(), true);
is('the exact cost is promised before paying', /shown before they pay/.test(delivery), true);

print('\nTHE LISTS READ LIKE ENGLISH');
is('two items', F.list(['a','b']), 'a and b');
is('three items', F.list(['a','b','c']), 'a, b and c');
is('one item', F.list(['x']), 'x');
is('none', F.list([]), '');

print('\nA DATABASE OUTAGE MAKES HER STALE, NEVER SILENT');
is('a fallback snapshot still exists', /const KNOWLEDGE_FALLBACK = `/.test(SRC), true);
is('it is used when there is no key', /if \(!SB_ANON\) return KNOWLEDGE_FALLBACK;/.test(SRC), true);
is('a failed read falls back rather than throwing',
   /catch \(e\) \{[\s\S]{0,220}return catalogueText \|\| KNOWLEDGE_FALLBACK;/.test(SRC), true);
is('a stale cached read is preferred to the snapshot',
   /return catalogueText \|\| KNOWLEDGE_FALLBACK/.test(SRC), true);
is('an empty catalogue is treated as a failure',
   /catalogue came back empty/.test(SRC), true);
is('knowledge\\(\\) has no throw of its own', (function(){
  var k = grab('knowledge');
  return /throw/.test(k);
})(), false);

print('\nIT READS AS THE SHOP WINDOW, NOT AS AN ADMIN');
is('the anon key is used', /apikey: SB_ANON/.test(SRC), true);
is('the service key is NOT used for the catalogue', (function(){
  var a = SRC.indexOf('async function sbRows'), b = SRC.indexOf('async function knowledge');
  return /SUPABASE_SERVICE_KEY/.test(SRC.slice(a, b));
})(), false);

print('\nIT IS CACHED, SO A CHAT DOES NOT HAMMER THE DATABASE');
is('there is a cache', /let catalogueText = null, catalogueAt = 0;/.test(SRC), true);
is('with a five-minute life', /CATALOGUE_TTL_MS = 5 \* 60 \* 1000/.test(SRC), true);
is('the cache is checked before fetching',
   /if \(catalogueText && Date\.now\(\) - catalogueAt < CATALOGUE_TTL_MS\) return catalogueText;/.test(SRC), true);
is('the five tables are read in parallel, not one by one',
   /await Promise\.all\(\[[\s\S]{0,600}sbRows\('product_types/.test(SRC), true);

print('\nTHE PROMPT IS STILL ASSEMBLED, AND STILL HAS HER VOICE');
is('the head is separate from the catalogue', /const PROMPT_HEAD = `/.test(SRC), true);
is('the tail is separate too', /const PROMPT_TAIL = `/.test(SRC), true);
is('her voice is in the fixed part', /HOW AMY TALKS/.test(SRC.slice(SRC.indexOf('const PROMPT_HEAD'), SRC.indexOf('const PROMPT_TAIL'))), true);
is('the request uses the assembled prompt', /system: await systemPrompt\(\)/.test(SRC), true);
is('the old fixed SYSTEM_PROMPT is gone', /system: SYSTEM_PROMPT/.test(SRC), false);
is('she is still told never to invent prices', /Never invent prices/.test(SRC), true);

print('\nMUTATION: A SNAPSHOT MUST NOT PASS AS A LIVE READ');
var FROZEN = SRC.replace('system: await systemPrompt()', 'system: KNOWLEDGE_FALLBACK');
is('wiring the fallback back in is caught', /system: await systemPrompt\(\)/.test(FROZEN), false);
// And the generators must actually depend on their input.
var half = F.sizes(C.sizes.slice(0, 3));
is('dropping sizes from the data drops them from the text',
   half.indexOf('A0') >= 0, false);
is('the text genuinely comes from the rows', half.length < sizes.length, true);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
