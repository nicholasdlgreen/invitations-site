// What the customer is told, when they sign up and when they order.
//
// Two gaps, both found on 3 October by reading the sequence end to end rather
// than by anything failing:
//
//   - the order confirmation listed the product, size, paper and quantity, and
//     nothing else. Someone who paid GBP 22 for gold foil, chose folded over
//     flat, or added envelopes was told none of it, on the one document that is
//     their record of what they bought.
//   - the welcome email could only ever reach someone who had ORDERED. A
//     contacts row was created at checkout and nowhere else, so a customer who
//     registered and ticked "keep me in touch" had their consent filed in
//     `profiles`, which the email system never reads, and heard nothing.

var SRC  = read('netlify/functions/stripe-webhook.js');
var WEL  = read('netlify/functions/send-welcome.js');
var AUTH = read('auth.js');
var UP   = read('upload-and-print.html');

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function grab(src, name){
  var a = src.indexOf('function ' + name + '(');
  if (a < 0) return '';
  var i = src.indexOf('{', a), d = 0, e = -1;
  for (var j = i; j < src.length; j++){
    if (src[j] === '{') d++; else if (src[j] === '}'){ d--; if (!d){ e = j + 1; break; } } }
  return src.slice(a, e);
}

// ── the confirmation, driven for real ───────────────────────────────────
var console = { log:function(){}, warn:function(){}, error:function(){} };
eval(grab(SRC, 'esc'));
eval(grab(SRC, 'orderLineDetails'));

function detailsFor(basis, extra){
  var line = { name:'Wedding Invitations', qty:100, total:89.6, basis:basis };
  for (var k in (extra||{})) line[k] = extra[k];
  var out = {};
  orderLineDetails(line).forEach(function(p){ out[p[0]] = p[1]; });
  return out;
}

print('\nEVERYTHING THEY CHOSE IS ON THE CONFIRMATION');
var full = detailsFor({
  size:'A5', orientation:'portrait', fold:'folded', printedSides:'double',
  paperName:'Silk', weight:{name:'Classic',gsm:300,unit:'gsm'},
  finishes:{ Foiling:'Gold', Lamination:'Soft Touch', Corners:'Rounded' },
  envelopeName:'Brilliant White' });
is('the size, with which way up',      full['Size'],       'A5 portrait');
is('flat or folded',                   full['Format'],     'Folded card');
is('which faces are printed',          full['Printed'],    'Outside and inside');
is('the paper AND its weight',         full['Paper'],      'Silk &middot; Classic 300gsm');
is('the foil colour',                  full['Foiling'],    'Gold');
is('the lamination — a SECOND finish', full['Lamination'], 'Soft Touch');
is('the corners — and a THIRD',        full['Corners'],    'Rounded');
is('the envelope colour, not its id',  full['Envelopes'],  'Brilliant White');

print('\nAND NOTHING THEY DID NOT');
var plain = detailsFor({
  size:'A6', orientation:'portrait', fold:'flat', printedSides:'single',
  paperName:'Uncoated', weight:{name:'Light',gsm:250,unit:'gsm'},
  finishes:{ Foiling:'None', Lamination:'none' }, envelopeName:null });
is('a finish set to None is left out',       plain['Foiling']   === undefined, true);
is('and one set to lowercase none as well',  plain['Lamination'] === undefined, true);
is('no envelopes means no envelope line',    plain['Envelopes'] === undefined, true);
is('a flat card says so',                    plain['Format'],   'Flat card');
is('one printed side says so',               plain['Printed'],  'One side');

print('\nOLDER ORDERS STILL READ');
// basis carried no weight or envelope name before 3 October; the paper label is
// the only place those existed, so it is the fallback rather than nothing.
// The label is passed through as it was written — the structured path builds
// its own separator, this one already has one.
var old = detailsFor({ size:'A5', fold:'flat', paperName:null }, { paper:'Silk \u00b7 Classic 300gsm' });
is('falls back to the paper label', old['Paper'], 'Silk \u00b7 Classic 300gsm');
is('and escapes it, in case the label carries markup',
   detailsFor({ paperName:null }, { paper:'Silk & <b>Gold</b>' })['Paper'],
   'Silk &amp; &lt;b&gt;Gold&lt;/b&gt;');
var bare = detailsFor({});
is('an order with no basis at all does not throw', typeof bare, 'object');

print('\nTHE DETAIL IS RECORDED IN THE FIRST PLACE');
// orderLineDetails can only show what the basket wrote down
is('the basket records the weight',        /weight: \(function\(\)\{/.test(UP), true);
is('the basket records the envelope name', /envelopeName: \(envelopesEnabled && selectedEnvColour\)/.test(UP), true);

print('\nTHE WELCOME EMAIL CAN REACH SOMEONE WHO ONLY SIGNED UP');
is('there is a send-welcome function',      /exports\.handler = async \(event\)/.test(WEL), true);
is('it is driven by the user\'s own token', /\/auth\/v1\/user/.test(WEL), true);
is('it believes Supabase, not the request', /userFromToken\(token\)/.test(WEL), true);
is('it refuses an unconfirmed address',
   /!user\.email_confirmed_at && !user\.confirmed_at/.test(WEL), true);
is('it creates a contact from the signup',  /upsert_contact_from_signup/.test(WEL), true);
is('it does NOT use the order upsert',      /upsert_contact_from_order/.test(WEL), false);
is('it still claims before sending',        /claim_welcome_email/.test(WEL), true);
is('and hands the claim back if sending fails',
   /releasing the claim[\s\S]{0,400}welcome_sent_at: null/.test(WEL), true);
is('it sends the SAME template, not a copy',
   /require\('\.\/stripe-webhook\.js'\)/.test(WEL), true);
is('which stripe-webhook exports',          /exports\.buildWelcomeHtml = buildWelcomeHtml;/.test(SRC), true);

print('\nIT IS ASKED FOR AT THE RIGHT MOMENT');
is('auth.js has the hook',             /function maybeSendWelcome\(session\)/.test(AUTH), true);
is('only on a real sign-in',           /event === 'SIGNED_IN'\) maybeSendWelcome\(session\)/.test(AUTH), true);
is('not on every page load',           /INITIAL_SESSION/.test(AUTH.replace(/\/\/[^\n]*/g,'')), false);
is('it sends the access token',        /Authorization: 'Bearer ' \+ session\.access_token/.test(AUTH), true);
is('it cannot break signing in',       /\.catch\(function \(e\) \{ console\.warn\('\[invAuth\] welcome check failed/.test(AUTH), true);

print('\nTHE FOOTER NO LONGER CLAIMS THEY ORDERED');
is('it does not say "when you ordered"', /keep in touch when you ordered/.test(SRC), false);
is('it still says why they are getting it', /because you asked us to keep in touch\./.test(SRC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
