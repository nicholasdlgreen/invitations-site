// What the studio uploads when the customer presses "Love it", and in what
// order.
//
// Measured on the live site on 3 October: the click took about 14 seconds and
// 12 of those were uploading. The cause was that the flattened JPEG went up
// whole AND again inside the press PDF — buildAiPrintPdf embeds it with
// embedJpg, which does not re-encode, so the two files were the same pixels.
// The real files in the bucket showed it plainly: 0.79MB of artwork beside
// 0.82MB of PDF.
//
// Now the press PDF is built first and the standalone copy is a screen-sized
// reference for the links in admin and the customer's account. These checks
// hold that arrangement in place, because the two ways of getting it wrong are
// both silent: uploading the full file again just costs seconds, and uploading
// ONLY a small file would send 1400px to the press.

var SRC = read('design-studio-ai-create.html');

var pass = 0, fail = 0;
function is(label, got, want){
  var ok = String(got) === String(want);
  ok ? pass++ : fail++;
  print((ok ? '  ok   ' : '  FAIL ') + label + (ok ? '' : '   got ' + got + ', want ' + want));
}
function has(label, re){ is(label, re.test(SRC), true); }

// The handler, so an assertion cannot pass by matching something elsewhere in
// a 100KB file. Everything below is checked inside this slice only.
var start = SRC.indexOf("document.getElementById('ds-love').addEventListener");
is('the Love it handler was found', start > -1, true);
var HANDLER = SRC.slice(start, start + 7000);

print('\nTHE PRESS FILE IS BUILT BEFORE ANYTHING IS SENT');
var buildAt   = HANDLER.indexOf('buildAiPrintPdf(pressFacesFor(');
var pressPut  = HANDLER.indexOf('putArtwork(pdfName');
is('buildAiPrintPdf appears in the handler', buildAt > -1, true);
is('the press upload appears in the handler', pressPut > -1, true);
// What else needs uploading is not known until the PDF exists, so the build
// comes first. Note this cannot be measured against the FIRST putArtwork( in
// the text: uploadFullResFallback is defined above the chain and contains one,
// so a textual "first upload" is a definition, not something that ran.
is('the press PDF is built before it is uploaded', buildAt < pressPut, true);
// The guarantee that actually saves the seconds: the full-resolution print
// image is sent in one place only, the fallback. Anywhere else and we are back
// to uploading the same pixels twice.
var fullSends = (HANDLER.match(/dataUrlToBlob\(printImage\)/g) || []);
is('the full-resolution image is sent from exactly one place', fullSends.length, 1);
var fbStart = HANDLER.indexOf('var uploadFullResFallback');
var fbEnd   = HANDLER.indexOf('// 1. build the press-ready PDF FIRST');
is('and that place is the fallback',
   fbStart > -1 && fbEnd > fbStart
   && HANDLER.slice(fbStart, fbEnd).indexOf('dataUrlToBlob(printImage)') > -1, true);

print('\nTHE PRINT FILE KEEPS ITS QUALITY');
// Foreverprint is a printing company; the press file is never softened to save
// seconds. Counted rather than matched: the first version of this check sliced
// from flattenToPrintFile to flattenInsideToPrintFile, but the INSIDE one is
// defined first, so the slice ran backwards, tested an empty string and could
// never fail. Lowering a print encode passed it. Counting cannot do that —
// drop a 0.95 and the number changes.
function countOf(q){
  return (SRC.match(new RegExp("toDataURL\\('image/jpeg',\\s*" + q.replace('.', '\\.') + "\\)", 'g')) || []).length;
}
var allJpeg = (SRC.match(/toDataURL\('image\/jpeg',\s*[0-9.]+\)/g) || []);
is('three print encodes, all at 0.95', countOf('0.95'), 3);
is('one grid thumbnail, at 0.8', countOf('0.8'), 1);
is('one screen reference copy, at 0.85', countOf('0.85'), 1);
// If a new encode appears, this fails and someone has to say which it is and
// at what quality, rather than it arriving unnoticed.
is('and no other JPEG encode exists', allJpeg.length, 5);

print('\nTHE REFERENCE COPY IS A REFERENCE, NOT A PRINT FILE');
has('makeReferenceCopy exists', /function makeReferenceCopy\(fullDataUrl, cb\)/);
var REF = SRC.slice(SRC.indexOf('function makeReferenceCopy'), SRC.indexOf('function makeReferenceCopy') + 900);
is('it scales the long edge down', /LONG\s*=\s*1400/.test(REF), true);
is('it never scales UP a smaller design', /Math\.min\(1,\s*LONG/.test(REF), true);
is('it encodes for screen, not press', /toDataURL\('image\/jpeg', 0\.85\)/.test(REF), true);
is('the grid thumbnail is untouched at 400px', /var tw = 400/.test(SRC), true);

print('\nA REFERENCE COPY IS ONLY SAFE ONCE A PRESS FILE EXISTS');
// If the small copy were the only artwork on the order, print-prep would run on
// it and the press would be sent 1400px.
var refUploadAt = HANDLER.indexOf('makeReferenceCopy(printImage');
var printUrlAt  = HANDLER.indexOf('var printUrl =');
is('the reference copy is made after printUrl is known', printUrlAt > -1 && printUrlAt < refUploadAt, true);
is('the reference upload is named so it can be told apart', /artworkFileName\('ref-ai', 'jpg'\)/.test(HANDLER), true);

print('\nWITHOUT A PRESS FILE THE FULL-RESOLUTION JPEG STILL GOES UP');
has('a fallback exists', /var uploadFullResFallback = function\(\)/);
is('the fallback sends the full print image, not the reference',
   /uploadFullResFallback[\s\S]{0,400}dataUrlToBlob\(printImage\)/.test(SRC), true);
is('the fallback keeps the ai-design name', /uploadFullResFallback[\s\S]{0,300}artworkFileName\('ai-design', 'jpg'\)/.test(SRC), true);
// Three ways to end up without a press file, and all three must fall back:
// it never built, it built but would not store, or the request threw.
var calls = HANDLER.match(/uploadFullResFallback\(\)/g) || [];
is('every path without a press file falls back (3 of them)', calls.length, 3);
is('the no-build path falls back',
   /if \(!built\) \{[\s\S]{0,260}uploadFullResFallback\(\)/.test(HANDLER), true);
is('the failed-upload path falls back',
   /if \(!pr\.ok\) \{[\s\S]{0,300}uploadFullResFallback\(\)/.test(HANDLER), true);

print('\nTHE HANDOFF STILL CARRIES EVERYTHING THE ORDER NEEDS');
has('the reference copy is what artworkUrl becomes', /artworkUrl: res\.artworkUrl/);
has('the press PDF is what printArtworkUrl becomes', /printArtworkUrl: res\.printUrl/);
has('the foil layer is still carried', /foilLayerUrl: res\.foilLayerUrl \|\| null/);

print('\n' + pass + ' passed, ' + fail + ' failed');
