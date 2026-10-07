// Counting the consent choice, without tracking the person who made it.
//
// We do not know what share of visitors accept, and it decides whether a
// Google remarketing audience can ever reach its 100-user minimum and how much
// of our own analytics we are seeing. The count has to be anonymous: someone
// who declines is telling us not to track them.
//
// Two things this pins, because both are easy to break by accident:
//   * the row carries ONLY the choice — no session, no id, nothing joinable
//   * it is written on a CLICK, never when a decision is restored from the
//     cookie, or every returning visitor inflates the number
var SRC = readFile('analytics.js');

var passed = 0, failed = 0;
function ok(name, cond){
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}

var fn = SRC.slice(SRC.indexOf('function recordChoice'),
                   SRC.indexOf('function recordChoice') + 1100);

print('IT RECORDS THE CHOICE AND NOTHING ELSE');
ok('recordChoice exists',                  /function recordChoice\(/.test(SRC));
ok('it posts to consent_log',              /rest\/v1\/consent_log/.test(fn));
ok('the body carries only the choice',     /JSON\.stringify\(\{ choice: choice \}\)/.test(fn));
['session', 'sessionId', 'navigator.userAgent', 'document.referrer', 'location.href', 'email', 'user_id']
  .forEach(function (bad) {
    ok('no ' + bad + ' in the payload', fn.indexOf(bad) === -1);
  });

print('\nIT CANNOT BREAK THE PAGE');
ok('the fetch has a catch',                /\.catch\(function \(\) \{\}\)/.test(fn));
ok('and the whole thing is wrapped',       /try \{[\s\S]*\} catch \(e\) \{\}/.test(fn));
ok('it uses keepalive, so a click that navigates still counts',
   /keepalive: true/.test(fn));

print('\nONE DECISION, ONE ROW');
var grant = SRC.slice(SRC.indexOf('function grantConsent'), SRC.indexOf('function denyConsent'));
ok('granting records only when NOT silent',
   /if \(!silent\) \{ recordChoice\('granted'\)/.test(grant));
ok('so restoring from the cookie does not count again',
   grant.indexOf("recordChoice('granted')") > grant.indexOf('if (!silent)'));
var deny = SRC.slice(SRC.indexOf('function denyConsent'), SRC.indexOf('function denyConsent') + 600);
ok('declining records too',                /recordChoice\('denied'\)/.test(deny));

print('\nMUTATION: EACH FAULT COMING BACK MUST FAIL');
function mutates(name, src){
  var old = SRC, before = failed;
  SRC = src;
  var f = SRC.slice(SRC.indexOf('function recordChoice'), SRC.indexOf('function recordChoice') + 1100);
  var g = SRC.slice(SRC.indexOf('function grantConsent'), SRC.indexOf('function denyConsent'));
  var caught = !( /function recordChoice\(/.test(SRC)
               && /JSON\.stringify\(\{ choice: choice \}\)/.test(f)
               && f.indexOf('sessionId') === -1
               && /if \(!silent\) \{ recordChoice\('granted'\)/.test(g) );
  SRC = old; failed = before;
  if (caught) { passed++; print('  ok   ' + name + ' is caught'); }
  else        { failed++; print('  FAIL ' + name + ' SLIPPED THROUGH'); }
}
mutates('an identifier being added to the payload',
        SRC.replace('JSON.stringify({ choice: choice })',
                    'JSON.stringify({ choice: choice, sessionId: sid })'));
mutates('counting on every page view instead of on the click',
        SRC.replace("if (!silent) { recordChoice('granted');", "recordChoice('granted'); if (!silent) {"));
mutates('the recorder being removed',
        SRC.replace('function recordChoice', 'function recordChoiceDisabled'));

print('\n' + passed + ' passed, ' + failed + ' failed');
