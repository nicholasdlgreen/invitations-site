// The brief the design studio sends, built from the six boxes.
//
// Run:  /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc \
//         tools/test-studio-brief.js
//
// buildBrief is CUT OUT OF design-studio-ai-create.html at run time and the
// templates are cut out of the generated migration, so this tests the two
// things that actually ship. A hand-copy of either would pass while the page
// printed "{medium}" at a customer.

var SRC = readFile('design-studio-ai-create.html');
var SQL = readFile('tools/sql/studio_vocab_20260929.sql');

function grab(name){
  var i = SRC.indexOf('\n  function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name + ' in the page');
  i += 1;
  var j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++){
    var c = SRC[k];
    if (c === '/' && SRC[k+1] === '/'){ k = SRC.indexOf('\n', k); continue; }
    if (c === "'" || c === '"' || c === '`'){
      var q = c;
      for (k++; k < SRC.length; k++){
        if (SRC[k] === '\\') { k++; continue; }
        if (SRC[k] === q) break;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (!depth) break; }
  }
  return SRC.slice(i, k + 1);
}

// ── the page's own globals, just enough of them ──────────
var sel = {}, CONFIG_BASE_PROMPT = null, CONFIG_PRODUCT_NOUN = 'wedding invitation';
var document = { getElementById: function(){ return null; } };
eval(grab('buildBrief'));

// ── every template and every chip, read out of the migration ──
// The migration stores the vocabulary once per theme and joins it onto the
// products that share it, so the test has to do the same join — otherwise it
// would only ever check eight of the twenty-two products.
var TEMPLATES = {}, VOCAB = {}, MAP = {}, EXTRA = {};
SQL.split('\n').forEach(function(line){
  var m = line.match(/^update studio_config set base_prompt = '(.*)' where product_slug = '(.+?)';$/);
  if (m) TEMPLATES[m[2]] = m[1].replace(/''/g, "'");
  var v = line.match(/^  \('([a-z]+)', '(\w+)', '(.*?)', '(.*?)', (?:'#[0-9A-Fa-f]{6}'|null)::text, (\d+)\),?$/);
  if (v){
    var th = v[1], cat = v[2], phrase = v[4].replace(/''/g, "'");
    (VOCAB[th] = VOCAB[th] || {});
    (VOCAB[th][cat] = VOCAB[th][cat] || []).push(phrase);
  }
  var p = line.match(/^  \('([a-z-]+)', '([a-z]+)'\),?$/);
  if (p) MAP[p[1]] = p[2];
  var e = line.match(/^  \('christening-invitations', 'motif', '(.*?)', '(.*?)', null, \d+, true, false\)[,;]$/);
  if (e) (EXTRA['christening-invitations'] = EXTRA['christening-invitations'] || []).push(e[2].replace(/''/g, "'"));
});
var CHIPS = {};
Object.keys(MAP).forEach(function(slug){
  var src = VOCAB[MAP[slug]] || {}, out = {};
  Object.keys(src).forEach(function(cat){ out[cat] = src[cat].slice(); });
  if (EXTRA[slug]) out.motif = (out.motif || []).concat(EXTRA[slug]);
  CHIPS[slug] = out;
});

var pass = 0, fail = 0, shown = [];
function ok(label, cond, detail){
  cond ? pass++ : fail++;
  if (!cond) print('  FAIL ' + label + (detail ? '\n        ' + detail : ''));
}
function clear(){ sel = { pair:[], colour:[], medium:[], era:[], layout:[], motif:[], mood:[], audience:[] }; }

function briefFor(slug){
  CONFIG_BASE_PROMPT = TEMPLATES[slug];
  return buildBrief();
}

// Faults the old vocabulary shipped: a noun phrase where an adjective belongs,
// a slot with no joining word, and a placeholder that never got filled.
function check(slug, label, s){
  ok(slug + ' / ' + label + ': no leftover placeholder', !/\{\w+\}/.test(s), s);
  ok(slug + ' / ' + label + ': no doubled comma', !/,\s*,/.test(s), s);
  ok(slug + ' / ' + label + ': no comma before a full stop', !/,\s*\./.test(s), s);
  ok(slug + ' / ' + label + ': no doubled space', !/ {2}/.test(s), s);
  ok(slug + ' / ' + label + ': no space before punctuation', !/\s[,.]/.test(s), s);
  ok(slug + ' / ' + label + ': starts A or An correctly',
     /^An? \S/.test(s) && !/^A [aeiou]/.test(s), s);
  ok(slug + ' / ' + label + ': still forbids lettering',
     s.indexOf('no lettering or words in the image') > -1, s);
  ok(slug + ' / ' + label + ': never asks for type',
     !/typograph|type-led|lettering in|bold type/i.test(s.split('A decorative')[0]), s);
}

var slugs = Object.keys(TEMPLATES).sort();
ok('every product has a template', slugs.length === 22, slugs.length + ' templates');
ok('every product is mapped to a theme', Object.keys(MAP).length === 22, Object.keys(MAP).length + ' mapped');
ok('eight themes carry a vocabulary', Object.keys(VOCAB).length === 8, Object.keys(VOCAB).length + ' themes');
slugs.forEach(function(slug){
  var c = CHIPS[slug] || {};
  ['pair','colour','medium','era','layout','motif','mood'].forEach(function(cat){
    ok(slug + ' has a ' + cat + ' box', (c[cat] || []).length > 0, cat + ' is empty');
  });
});
ok('the christening keeps its own four motifs',
   (CHIPS['christening-invitations'].motif.length - CHIPS['new-arrival-cards'].motif.length) === 4,
   'christening has ' + CHIPS['christening-invitations'].motif.length);

// The product-to-theme map is the one thing a grammar check cannot see: a menu
// card pointed at the everyday vocabulary still produces a perfect sentence,
// about fruit. So each product is checked against its own noun, which comes
// from studio_config and not from the map.
print('\nEach product gets the vocabulary its own name calls for');
var SIGNATURE = [
  [/wedding|engagement|save-the-date/i, 'trailing eucalyptus'],
  [/christmas/i,                        'a Christmas tree'],
  [/birthday|party/i,                   'balloons'],
  [/baby|christening/i,                 'a teddy bear'],
  [/moving|new home/i,                  'a house'],
  [/graduation/i,                       'a mortar board'],
  [/thank you/i,                        'a tied posy'],
  [/greeting/i,                         'a cat']
];
Object.keys(TEMPLATES).sort().forEach(function(slug){
  var noun = (TEMPLATES[slug].match(/^A \{lead\} (.+?) design\{audience\}/) || [])[1] || '';
  var want = null;
  for (var i = 0; i < SIGNATURE.length; i++){
    if (SIGNATURE[i][0].test(noun)){ want = SIGNATURE[i][1]; break; }
  }
  ok(slug + ': its noun matches a theme', !!want, 'no rule for "' + noun + '"');
  if (!want) return;
  ok(slug + ': carries "' + want + '"',
     ((CHIPS[slug] || {}).motif || []).indexOf(want) > -1,
     'a ' + noun + ' was given the ' + MAP[slug] + ' vocabulary');
});

print('\nOne brief per product, everything chosen');
slugs.forEach(function(slug){
  clear();
  var c = CHIPS[slug] || {};
  sel.colour   = (c.colour || []).slice(0, 2);
  sel.medium   = (c.medium || []).slice(0, 1);
  sel.era      = (c.era    || []).slice(0, 1);
  sel.layout   = (c.layout || []).slice(0, 1);
  sel.motif    = (c.motif  || []).slice(0, 2);
  sel.mood     = (c.mood   || []).slice(0, 1);
  sel.audience = (c.audience || []).slice(0, 1);
  var s = briefFor(slug);
  check(slug, 'full', s);
  shown.push('  ' + slug + '\n    ' + s.split(' A decorative')[0]);
});

print('\nNothing chosen at all');
slugs.forEach(function(slug){
  clear();
  var s = briefFor(slug);
  check(slug, 'empty', s);
  ok(slug + ' / empty: falls back to elegant', / elegant /.test(s), s);
});

print('\nOne box only, each box in turn');
['colour','medium','era','layout','motif','mood','audience'].forEach(function(cat){
  slugs.forEach(function(slug){
    var c = CHIPS[slug] || {};
    if (!(c[cat] || []).length) return;
    clear();
    sel[cat] = c[cat].slice(0, 1);
    check(slug, 'only ' + cat, briefFor(slug));
  });
});

print('\nEvery chip in every box, one at a time');
slugs.forEach(function(slug){
  var c = CHIPS[slug] || {};
  Object.keys(c).forEach(function(cat){
    if (cat === 'pair') return;
    c[cat].forEach(function(ph){
      clear(); sel[cat] = [ph];
      check(slug, cat + ' = ' + ph, briefFor(slug));
    });
  });
});

print('\nThe lists read as English, not as a comma dump');
clear();
sel.colour = ['sage green','cream','gold'];
sel.motif  = ['trailing eucalyptus','blush roses'];
var s = briefFor('wedding-invitations');
ok('three colours use "and" before the last',
   s.indexOf('in sage green, cream and gold') > -1, s);
ok('two motifs use "and"',
   s.indexOf('with trailing eucalyptus and blush roses') > -1, s);
clear(); sel.colour = ['sage green'];
ok('one colour has no stray "and"',
   briefFor('wedding-invitations').indexOf('in sage green.') > -1, briefFor('wedding-invitations'));

print('\nMood and era share the opening, separated by a comma');
clear(); sel.mood = ['warm and romantic']; sel.era = ['art deco'];
ok('mood then era',
   briefFor('wedding-invitations').indexOf('A warm and romantic, art deco wedding invitation') === 0,
   briefFor('wedding-invitations'));

print('\nWho it is for lands before the comma, on the two products that have it');
clear(); sel.audience = ['for a milestone birthday']; sel.medium = ['in layered cut paper'];
ok('birthday-invitations places the audience',
   briefFor('birthday-invitations').indexOf('birthday party invitation design for a milestone birthday,') > -1,
   briefFor('birthday-invitations'));
ok('a wedding invitation has no audience box',
   !(CHIPS['wedding-invitations'] || {}).audience, 'wedding has audience chips');

print('\nPalette pairs name colours the palette actually has');
slugs.forEach(function(slug){
  var c = CHIPS[slug] || {};
  var have = {}; (c.colour || []).forEach(function(x){ have[x] = 1; });
  (c.pair || []).forEach(function(p){
    p.split('|').forEach(function(n){
      ok(slug + ': pair colour "' + n + '" is in the palette', have[n] === 1, p);
    });
  });
});

print('\nNothing promises a finish we sell, or a photograph');
slugs.forEach(function(slug){
  var c = CHIPS[slug] || {};
  Object.keys(c).forEach(function(cat){
    c[cat].forEach(function(ph){
      ok(slug + ': "' + ph + '" does not sell foil', !/foil/i.test(ph), ph);
      ok(slug + ': "' + ph + '" does not promise a photo', !/photograph|photo /i.test(ph), ph);
      ok(slug + ': "' + ph + '" does not ask for lettering', !/typograph|type-led/i.test(ph), ph);
    });
  });
});

print('\nA sample of what goes to the model\n');
shown.slice(0, 22).forEach(function(l){ print(l); });

print('\n' + pass + ' passed, ' + fail + ' failed\n');
