// The checkout form should look empty when it is empty.
//
// Nicholas: "when you go to check out ... far too heavy in terms of type — it
// looks like it is already filled in." He was right, and the cause was two
// things compounding.
//
// The page had NO ::placeholder rule at all, so Chrome's default applied:
// #757575, which is 4.61:1 on white — above the 4.5:1 threshold for readable
// BODY TEXT — at the same 15px and the same weight as text you type. And the
// placeholders held realistic data: "Charlotte Thornton", "12 Rose Lane",
// "SW1A 1AA". A plausible name over a plausible address, at reading weight,
// is indistinguishable from a saved address being offered back.
//
// Making a placeholder this faint is only safe because every field has its own
// visible label, so the placeholder carries nothing the customer needs. That
// is what the label assertions below protect: if the labels ever go, the
// faint placeholders become an accessibility problem rather than a tidy one.

var SRC = read('upload-and-print.html');
var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}

print('\nTHE PLACEHOLDER READS AS A HINT, NOT AS AN ANSWER');
is('there is a ::placeholder rule at all',
   /\.co-input::placeholder\{color:var\(--pale\);opacity:1;\}/.test(SRC), true);
// opacity:1 matters — Firefox dims placeholders by default, which would stack
// on top of an already pale colour and leave it close to invisible.
is('opacity is pinned, so Firefox does not dim it twice',
   /::placeholder\{[^}]*opacity:1/.test(SRC), true);
is('it uses the palette, not a grey', /::placeholder\{color:var\(--pale\)/.test(SRC), true);

print('\nNO FIELD IS PRE-FILLED WITH SOMETHING THAT LOOKS REAL');
['Charlotte Thornton', 'charlotte@example.com', '12 Rose Lane', 'SW1A 1AA', '+44 7700 000000']
  .forEach(function (s) { is('no "' + s + '"', SRC.indexOf(s) >= 0, false); });
// A hint describes the shape of the answer; it is not an example of one.
['First and last name', 'House number and street', 'UK postcode', 'For delivery updates']
  .forEach(function (s) { is('hint present: "' + s + '"', SRC.indexOf(s) >= 0, true); });
is('no placeholder merely repeats its own label',
   /id="coCity" placeholder="Town or city"/.test(SRC), false);

print('\nEVERY FIELD STILL HAS A VISIBLE LABEL, WHICH IS WHY THE ABOVE IS SAFE');
var IDS = ['coName','coEmail','coPhone','coAddr1','coAddr2','coCity','coPostcode','coNotes'];
IDS.forEach(function (id) {
  is(id + ' has a label bound to it',
     new RegExp('<label class="co-label" for="' + id + '"').test(SRC), true);
});

print('\nTHE LABELS ARE NO LONGER THE HEAVIEST TYPE ON THE PAGE');
var LAB = SRC.slice(SRC.indexOf('.co-label{'), SRC.indexOf('}', SRC.indexOf('.co-label{')) + 1);
is('no uppercase transform', /text-transform:uppercase/.test(LAB), false);
is('no letter-spacing', /letter-spacing/.test(LAB), false);
is('still the small size and the soft tone',
   /font-size:var\(--text-xs\)/.test(LAB) && /color:var\(--soft\)/.test(LAB), true);
is('no label carries an asterisk', /co-label[^>]*>[^<]*\*/.test(SRC), false);
is('optional fields say so instead',
   (SRC.match(/\(optional\)/g) || []).length >= 3, true);

print('\nVALIDATION IS UNTOUCHED — IT NEVER READ THE ASTERISKS');
is('the required list is still the five fields',
   /\['coName','coEmail','coAddr1','coCity','coPostcode'\]/.test(SRC), true);
is('and nothing reads a label to decide required',
   /co-label[\s\S]{0,40}required/.test(SRC), false);

print('\nMUTATION: THE OLD FORM MUST FAIL THIS TEST');
var OLD = SRC.replace('.co-input::placeholder{color:var(--pale);opacity:1;}', '');
is('a form with no placeholder rule is caught',
   /\.co-input::placeholder\{color:var\(--pale\)/.test(OLD), false);
var SHOUTY = LAB.replace('font-size:', 'text-transform:uppercase;font-size:');
is('uppercase labels coming back are caught', /text-transform:uppercase/.test(SHOUTY), true);

print('\n' + pass + ' passed, ' + fail + ' failed\n');
