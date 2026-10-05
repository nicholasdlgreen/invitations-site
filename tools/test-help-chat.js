// Amy: what she knows, and whether we would find out if she broke again.
//
// On 5 October 2026 the help assistant returned HTTP 500 to every free-text
// question, and had done since it was built. ANTHROPIC_API_KEY was never set
// in Netlify, so the call to Anthropic was rejected and the function threw.
// Nicholas found it by using his own website. Nothing in the codebase could
// have told us, because nothing was recorded.
//
// Two separate failures, and both are covered here:
//   1. She could not answer at all.      -> logging, so silence is visible.
//   2. What she knew had drifted.        -> the facts, checked against the DB.
//
// The second was the quieter one. Her knowledge was a snapshot written into
// the function months ago: four of fifteen sizes, "up to A1" when we sell A0,
// no paper named, and not one word about what delivery costs — which is the
// exact question that prompted this.

var SRC    = read('netlify/functions/help-chat.js');
var WIDGET = read('help-widget.js');
var PRIV   = read('privacy.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

// Cut the system prompt out, so "does Amy know X" is asked of Amy's knowledge
// and not of a comment elsewhere in the file that happens to mention X.
var PROMPT = (function(){
  var a = SRC.indexOf('const SYSTEM_PROMPT = `');
  var b = SRC.indexOf('`;', a);
  return SRC.slice(a, b);
})();

print('\nSHE KNOWS WHAT WE ACTUALLY SELL');
is('the system prompt was found', PROMPT.length > 1500, true);
// Every size live in print_sizes on 5 October.
['A6','A5','DL','Square','Square 210','A4','A3','Place card','A2','A1','A0']
  .forEach(function(s){ is('knows the size ' + s, PROMPT.indexOf(s) >= 0, true); });
is('no longer claims A1 is the largest', /up to A1/.test(PROMPT), false);
is('says landscape costs the same', /[Pp]ortrait and landscape cost the same/.test(PROMPT), true);

print('\nSHE CAN NAME THE PAPER');
['Silk','Uncoated','Tintoretto','Nettuno','Acquerello','Sirio Pearl','Recycled','Cartonboard','Ice White','Foamex']
  .forEach(function(s){ is('knows ' + s, PROMPT.indexOf(s) >= 0, true); });
is('knows heavier paper is not dearer',
   /[Ww]eight does not change the price/.test(PROMPT), true);

print('\nSHE CAN ANSWER THE QUESTION THAT STARTED THIS');
is('knows standard delivery is free', /Standard is FREE/.test(PROMPT), true);
is('knows Express is 20% with a GBP 20 minimum',
   /Express is 2 working days and costs 20% of the order value with a £20 minimum/.test(PROMPT), true);
is('knows next day is 40% with a GBP 40 minimum',
   /40% with a £40 minimum/.test(PROMPT), true);
is('knows the exact cost is shown before paying',
   /shown before they pay/.test(PROMPT), true);

print('\nSHE DOES NOT OFFER WHAT WE CANNOT MAKE');
is('told we do not sell wax seals', /do NOT offer wax seals/.test(PROMPT), true);
['ribbon','vellum','spot UV'].forEach(function(s){
  is('told we do not sell ' + s, new RegExp(s, 'i').test(PROMPT), true); });
is('all eight foils are named',
   ['gold','silver','copper','rose gold','red','blue','green','holographic']
     .every(function(c){ return PROMPT.toLowerCase().indexOf(c) >= 0; }), true);
is('still forbidden from inventing prices', /Never invent prices/.test(SRC), true);
is('still forbidden from promising a proof', /Never promise a printed proof/.test(SRC), true);
is('still tells people plainly that she is not human',
   /Never claim to be human/.test(SRC), true);

print('\nSHE ADMITS THE PAGE OUTRANKS HER');
is('deferring to the product page is in the prompt',
   // \s+ because the sentence wraps across a line in the template literal.
   /the product\s+page is right and you are out of date/.test(PROMPT), true);

print('\nIF SHE BREAKS AGAIN, WE WILL KNOW');
is('a logger exists', /async function logTurn/.test(SRC), true);
is('the success path logs', /ok: true/.test(SRC), true);
is('THE FAILURE PATH LOGS', /ok: false/.test(SRC), true);
// The whole point. A logger that only runs on success would have been silent
// through the entire outage it exists to catch.
var CATCH = SRC.slice(SRC.indexOf('} catch (err) {'));
is('the log call is inside the catch block', /await logTurn\(/.test(CATCH), true);
is('the error message is recorded', /error: String\(err/.test(CATCH), true);
is('logging never throws on its own', /catch \(e\) \{\s*console\.warn\('\[help-chat\] could not write the log/.test(SRC), true);
is('it writes with the service key, not the anon key',
   /SUPABASE_SERVICE_KEY/.test(SRC.slice(SRC.indexOf('async function logTurn'),
                                         SRC.indexOf('function lastQuestion'))), true);
is('how long the customer waited is recorded', /ms: Date\.now\(\) - started/.test(SRC), true);
is('the timer starts before the try', /const started = Date\.now\(\);[\s\S]{0,200}try \{/.test(SRC), true);

print('\nTHE QUESTION LOGGED IS THE ONE THEY ASKED');
function lastQuestion(messages) {
  if (!Array.isArray(messages)) return null;
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user') {
      return String(messages[i].content || '').slice(0, 4000);
    }
  }
  return null;
}
is('picks the last user message, not the first',
   lastQuestion([{role:'user',content:'first'},{role:'assistant',content:'hi'},
                 {role:'user',content:'second'}]), 'second');
is('ignores the assistant turns',
   lastQuestion([{role:'user',content:'q'},{role:'assistant',content:'a'}]), 'q');
is('survives a malformed body', lastQuestion(null), null);
is('survives an empty conversation', lastQuestion([]), null);
is('long questions are truncated, not dropped',
   lastQuestion([{role:'user',content:new Array(9000).join('x')}]).length, 4000);

print('\nTURNS ARE GROUPED INTO CONVERSATIONS');
is('the widget makes a session id', /var hwSession=/.test(WIDGET), true);
is('and sends it', /sessionId:hwSession/.test(WIDGET), true);
is('the function reads it', /body\.sessionId/.test(SRC), true);
is('and caps its length', /slice\(0, 64\)/.test(SRC), true);

print('\nWE SAY THAT WE KEEP THE MESSAGES');
is('the privacy policy mentions the help assistant',
   /help assistant on our website, we keep a record/.test(PRIV), true);
is('and says why', /check it is working and improve the answers/.test(PRIV), true);
is('and warns against sensitive information',
   /do not enter payment details/.test(PRIV), true);

print('\nMUTATION: THE OLD VERSION MUST FAIL THIS TEST');
var OLD = PROMPT.replace(/Standard is FREE/g, 'Standard delivery');
is('a prompt silent on delivery cost is caught', /Standard is FREE/.test(OLD), false);
var NOLOG = SRC.replace(/await logTurn\(\{[\s\S]*?\}\);/g, '');
is('a function that logs nothing is caught', /await logTurn\(/.test(NOLOG), false);
// And a logger wired only into the success path must not pass.
var HAPPYONLY = SRC.slice(0, SRC.indexOf('} catch (err) {'));
is('the catch-block check cannot be satisfied by the success path alone',
   /ok: false/.test(HAPPYONLY), false);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
