// Saving a design must not carry the picture.
//
// Seven people clicked Save and nothing was ever stored, by two routes at
// once. design_data.image held the generated artwork as a base64 data URL and
// metadata.thumbnail_url held the same thing again; base64 adds about a third,
// and this project's artwork averages 1.9MB with a 7.5MB worst case. Signed
// out, queuePendingSave writes that to localStorage, whose quota is about 5MB,
// so it threw and was swallowed by a console.warn — the customer made an
// account, came back, and the design had gone. Signed in, it was a
// multi-megabyte insert.
//
// The fix is one line of principle: store a LINK to our own bucket. This pins
// it, because the base64 version looked perfectly reasonable in review.
var SRC  = readFile('design-studio-ai-create.html');
var AUTH = readFile('auth.js');
var RET  = readFile('netlify/functions/artwork-retention.js');

var passed = 0, failed = 0;
function ok(name, cond){
  if (cond) { passed++; print('  ok   ' + name); }
  else      { failed++; print('  FAIL ' + name); }
}

print('THE IMAGE IS STORED, NOT CARRIED');
ok('persistDesignImage exists',            /function persistDesignImage\(/.test(SRC));
ok('it uploads to our artwork bucket',     /storage\/v1\/object\/artwork\//.test(SRC.slice(
     SRC.indexOf('function persistDesignImage('), SRC.indexOf('function persistDesignImage(') + 900)));
ok('and returns a public URL',             /storage\/v1\/object\/public\/artwork\//.test(SRC.slice(
     SRC.indexOf('function persistDesignImage('), SRC.indexOf('function persistDesignImage(') + 900)));
ok('a value that is already a URL passes straight through',
   /slice\(0, 5\) !== 'data:'/.test(SRC));

print('\nBOTH ROUTES GET THE SMALL VERSION');
var handler = SRC.slice(SRC.indexOf("getElementById('ds-save')"),
                        SRC.indexOf("function showSavePrompt"));
var atPersist = handler.indexOf('persistDesignImage');
var atLogin   = handler.indexOf('isLoggedIn()');
var atQueue   = handler.indexOf('queuePendingSave');
ok('the swap happens before the signed-in save',  atPersist > -1 && atPersist < atLogin);
ok('and before the queued save',                  atPersist > -1 && atPersist < atQueue);
ok('the thumbnail is set from it too, not from the data URL',
   /meta\.thumbnail_url = state\.image;/.test(handler));

print('\nTHE QUEUED COPY STILL GOES TO localStorage, WHICH IS WHY SIZE MATTERS');
ok('queuePendingSave writes to localStorage', /localStorage\.setItem\(PENDING_SAVE_KEY/.test(AUTH));
ok('and swallows its own failure, so it must not be allowed to fail',
   /catch \(e\) \{ console\.warn\('\[invAuth\] queuePendingSave failed/.test(AUTH));

print('\nAND THE SWEEP KNOWS A SAVED DESIGN CLAIMS ITS IMAGE');
ok('retention reads saved_designs',        /saved_designs\?select=design_data,metadata/.test(RET));
ok('and refuses to sweep if it cannot',    /refusing to sweep/.test(RET));

print('\nMUTATION: EACH FAULT COMING BACK MUST FAIL');
function mutates(name, src, auth, ret){
  var oS = SRC, oA = AUTH, oR = RET, before = failed;
  if (src)  SRC  = src;
  if (auth) AUTH = auth;
  if (ret)  RET  = ret;
  // re-run only the checks that read the mutated source
  var h = SRC.slice(SRC.indexOf("getElementById('ds-save')"), SRC.indexOf("function showSavePrompt"));
  var p = h.indexOf('persistDesignImage'), l = h.indexOf('isLoggedIn()'), q = h.indexOf('queuePendingSave');
  var caught = !( /function persistDesignImage\(/.test(SRC)
               && p > -1 && p < l && p < q
               && /meta\.thumbnail_url = state\.image;/.test(h)
               && /saved_designs\?select=design_data,metadata/.test(RET) );
  SRC = oS; AUTH = oA; RET = oR; failed = before;
  if (caught) { passed++; print('  ok   ' + name + ' is caught'); }
  else        { failed++; print('  FAIL ' + name + ' SLIPPED THROUGH'); }
}
mutates('the upload being removed',
        SRC.replace('state.image = await persistDesignImage(state.image);', ''));
mutates('the swap sliding below the signed-in branch',
        SRC.replace('      state.image = await persistDesignImage(state.image);\n      meta.thumbnail_url = state.image;\n\n', '')
           .replace("        var res = await window.invAuth.saveDesign",
                    "        state.image = await persistDesignImage(state.image);\n        meta.thumbnail_url = state.image;\n        var res = await window.invAuth.saveDesign"));
mutates('the thumbnail going back to the data URL',
        SRC.replace('meta.thumbnail_url = state.image;', 'meta.thumbnail_url = bgDataUrl;'));
mutates('the sweep forgetting saved designs', null, null,
        RET.replace('saved_designs?select=design_data,metadata', 'saved_designs?select=id'));

print('\n' + passed + ' passed, ' + failed + ' failed');
