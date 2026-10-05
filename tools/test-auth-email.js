// Supabase's Send Email Hook — the account emails, sent through Resend.
//
// This is the most consequential function on the site for its size. When the
// hook is enabled Supabase stops sending account email itself and does NOT fall
// back, so a mistake here means nobody can register, confirm an address or
// reset a password. These checks cover the two things that would do it
// silently: the wrong link, and the wrong token on an email change.
//
// What this CANNOT cover: the signature check needs node's crypto, which the
// jsc runner does not have. It is verified live instead, by signing a real
// request with openssl before the hook is switched on — see docs/STATUS.md
// item 54.

var SRC = read('netlify/functions/auth-email.js');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '\n         got  ' + got + '\n         want ' + want));
}
function grab(name){
  var a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('missing ' + name);
  var i = SRC.indexOf('{', a), d = 0, e = -1;
  for (var j = i; j < SRC.length; j++){
    if (SRC[j] === '{') d++; else if (SRC[j] === '}'){ d--; if (!d){ e = j + 1; break; } } }
  return SRC.slice(a, e);
}
eval(grab('esc'));
eval(grab('buildActionUrl'));
eval(grab('buildAuthEmailHtml'));

var SB = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';

print('\nTHE LINK POINTS AT SUPABASE, NOT AT US');
// Built from the site URL instead, every customer gets a 404 and cannot confirm.
var signup = buildActionUrl(SB, {
  email_action_type: 'signup', token_hash: 'abc123',
  redirect_to: 'https://foreverprint.com/login.html?verified=true' });
is('it is the Supabase verify endpoint',
   signup.indexOf(SB + '/auth/v1/verify?') === 0, true);
is('it is NOT on foreverprint.com', /^https:\/\/foreverprint\.com\/auth/.test(signup), false);
is('it carries the token hash', /[?&]token=abc123(&|$)/.test(signup), true);
is('it carries the type',       /[?&]type=signup(&|$)/.test(signup), true);
is('the redirect is encoded, not raw',
   signup.indexOf('redirect_to=https%3A%2F%2Fforeverprint.com%2Flogin.html%3Fverified%3Dtrue') > -1, true);
// a raw redirect_to would end the query string early and lose ?verified=true
is('and the raw form does not appear',
   signup.indexOf('redirect_to=https://foreverprint.com/login.html?verified=true') === -1, true);

print('\nA TRAILING SLASH DOES NOT DOUBLE UP');
is('one slash, not two', buildActionUrl(SB + '/', { email_action_type:'recovery', token_hash:'t' })
   .indexOf(SB + '/auth/v1/verify') === 0, true);

print('\nEVERY FLOW THE SITE USES');
[['signup','/login.html?verified=true'],
 ['recovery','/reset-password.html'],
 ['magiclink','/login.html']].forEach(function(f){
  var u = buildActionUrl(SB, { email_action_type: f[0], token_hash: 'h', redirect_to: 'https://foreverprint.com' + f[1] });
  is(f[0] + ' builds a link', /[?&]type=/.test(u) && /[?&]token=h(&|$)/.test(u), true);
});

print('\nAN EMAIL CHANGE USES THE NEW ADDRESS\'S TOKEN');
// Supabase calls the hook once per address and sends two hashes. Using the old
// one for the new address confirms the wrong address.
var change = buildActionUrl(SB, {
  email_action_type: 'email_change', token_hash: 'OLD', token_hash_new: 'NEW' });
is('it uses token_hash_new', /[?&]token=NEW(&|$)/.test(change), true);
is('and not the old hash',   /[?&]token=OLD(&|$)/.test(change), false);
// but if there is no new hash, the old one is still right
var changeOnly = buildActionUrl(SB, { email_action_type: 'email_change', token_hash: 'ONLY' });
is('falls back to token_hash when there is no new one', /[?&]token=ONLY(&|$)/.test(changeOnly), true);

print('\nNO TOKEN IS A REFUSAL, NOT A BROKEN LINK');
var threw = false;
try { buildActionUrl(SB, { email_action_type: 'signup' }); } catch (e) { threw = true; }
is('a payload with no token hash throws', threw, true);

print('\nEVERY ACTION TYPE HAS SOMETHING TO SAY');
['signup','magiclink','recovery','email_change','invite'].forEach(function(t){
  is(t + ' has its own wording', new RegExp("\\n  " + t + ": \\{").test(SRC), true);
});
is('and anything unknown still sends', /const FALLBACK = \{/.test(SRC), true);

print('\nTHE EMAIL ITSELF');
var html = buildAuthEmailHtml(
  { subject:'s', heading:'Confirm your email address', body:'b', button:'Confirm my email' },
  signup, '123456');
is('it shows the button',          html.indexOf('Confirm my email') > -1, true);
is('the button links to the url',  html.indexOf('href="' + esc(signup) + '"') > -1, true);
is('it offers the link as text too, for clients that strip buttons',
   html.split(esc(signup)).length - 1 >= 2, true);
is('it shows the code when there is one', html.indexOf('123456') > -1, true);
is('and omits that line when there is not',
   buildAuthEmailHtml({heading:'h',body:'b',button:'x'}, signup, null).indexOf('Or enter this code') === -1, true);
is('it is foreverprint, not Supabase', html.indexOf('foreverprint') > -1, true);

print('\nTHE DANGEROUS BITS ARE GUARDED');
// Existence FIRST. Comparing indexOf positions alone passes when the call is
// deleted, because indexOf returns -1 and -1 is before everything — the same
// vacuous-assertion trap the print-quality check fell into earlier today.
// The CALL, not the declaration. "verifySignature(headers, rawBody)" appears in
// both, so searching for it finds the function's own signature and the check
// passes even when the call has been deleted. Matched on the leading
// whitespace-and-no-"function" form instead.
var callMatch = SRC.match(/(?:^|\n)\s+verifySignature\(headers, rawBody\);/);
var sigAt   = callMatch ? SRC.indexOf(callMatch[0]) : -1;
var parseAt = SRC.indexOf('JSON.parse(rawBody)');
is('verifySignature is actually CALLED',  sigAt > -1, true);
is('and the body is parsed',              parseAt > -1, true);
is('the signature is checked before the body is parsed', sigAt > -1 && sigAt < parseAt, true);
is('there is a verifySignature to call',  /function verifySignature\(headers, rawBody\)/.test(SRC), true);
is('a bad signature is a 401', /statusCode: 401[\s\S]{0,120}Invalid signature/.test(SRC), true);
is('replays outside five minutes are refused', /age > 300/.test(SRC), true);
is('the comparison is constant time', /crypto\.timingSafeEqual/.test(SRC), true);
is('the secret prefix is stripped', /replace\(\/\^v1,whsec_\/, ''\)/.test(SRC), true);
is('a base64 body is decoded before signing',
   /event\.isBase64Encoded[\s\S]{0,120}Buffer\.from\(event\.body \|\| '', 'base64'\)/.test(SRC), true);
is('the failure reply does not leak why', /message: 'Could not send the email\. Please try again\.'/.test(SRC), true);

print('\n' + pass + ' passed, ' + fail + ' failed');
