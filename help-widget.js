// Help widget behaviour (the "?" button, bottom right).
//
// This code used to live in a <script> inside footer.html. That never ran:
// every page injects the footer with innerHTML, and scripts inserted that way
// are not executed by the browser — so the button existed, hwToggle did not,
// and clicking it did nothing at all. The same trap bit the cart earlier.
//
// Loading it as a real file fixes it. The functions are attached to window
// because the injected markup calls them from inline onclick attributes.

var hwHistory=[],hwOpen=false;
function hwToggle(){hwOpen=!hwOpen;document.getElementById('hw-panel').classList.toggle('open',hwOpen);if(hwOpen)setTimeout(()=>document.getElementById('hw-input').focus(),300);}
function hwPrompt(t){
  // "Where is my order?" is a job, not a question — Amy can actually look it
  // up, so it starts the tracking flow instead of being sent off for an
  // answer she cannot give.
  if(/where is my order/i.test(t)){hwAddMsg('user',t);hwStartTracking();return;}
  if(/set(ting)? up my artwork|artwork/i.test(t)){hwAddMsg('user',t);hwStartArtwork();return;}
  document.getElementById('hw-input').value=t;hwSend();
}
function hwAddMsg(role,text,contact){var msgs=document.getElementById('hw-messages'),div=document.createElement('div');div.className='hw-msg '+role;var s=role==='bot'?'':'You',cb=contact&&role==='bot'?'<br><button class="hw-contact-btn" onclick="hwShowContact()">✉ Contact the team</button>':'';div.innerHTML=(s?'<div class="hw-sender">'+s+'</div>':'')+'<div class="hw-bubble">'+text.replace(/\n/g,'<br>')+cb+'</div>';msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;}
function hwShowTyping(){var msgs=document.getElementById('hw-messages'),div=document.createElement('div');div.id='hw-typing-indicator';div.className='hw-msg bot';div.innerHTML='<div class="hw-sender">Amy</div><div class="hw-typing"><div class="hw-dot"></div><div class="hw-dot"></div><div class="hw-dot"></div></div>';msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;}
function hwRemoveTyping(){var el=document.getElementById('hw-typing-indicator');if(el)el.remove();}

// ── ORDER TRACKING FLOW ──────────────────────────────────────────────
// "Where is my order?" used to be sent to Amy as plain text, and she has no
// way to look anything up — so the best she could do was suggest emailing a
// human. She now collects the order number and email and asks the server,
// which is the same guarded lookup the tracking page uses: both must match,
// and a wrong email gives the same answer as a missing order so this cannot
// be used to discover which orders exist.
var hwFlow = null;   // null | {step:'order'|'email', orderNumber, email}

function hwStartTracking(){
  hwFlow = { step: 'order' };
  hwAddMsg('bot', "Of course. What's your order number? It starts INV- and it's in your confirmation email.");
  hwAddPromptRow([{ label: "I don't have it", fn: 'hwTrackingGiveUp()' }]);
  hwFocusInput('e.g. INV-2026-4153');
}

// A row of buttons underneath the last message.
function hwAddPromptRow(buttons){
  var msgs = document.getElementById('hw-messages');
  var wrap = document.createElement('div');
  wrap.className = 'hw-msg bot';
  wrap.innerHTML = '<div class="hw-bubble" style="background:none;padding:0;"><div class="hw-prompts">' +
    buttons.map(function(b){ return '<button class="hw-prompt" onclick="' + b.fn + '">' + b.label + '</button>'; }).join('') +
    '</div></div>';
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function hwFocusInput(placeholder){
  var input = document.getElementById('hw-input');
  if (!input) return;
  if (placeholder) input.placeholder = placeholder;
  input.focus();
}

function hwTrackingGiveUp(){
  hwFlow = null;
  hwFocusInput('Ask us anything...');
  hwAddMsg('bot', "No trouble at all. Leave your details and the team will look it up for you.");
  hwShowContact();
}

function hwStatusWords(status, tracking){
  switch (String(status || '').toLowerCase()) {
    case 'pending':   return 'Payment not completed yet — if you think that is wrong, do tell us.';
    case 'new':       return 'Received and paid for. It joins the print queue next.';
    case 'proof':
    case 'printing':  return 'With our press now.';
    case 'dispatched':return tracking ? 'On its way to you.' : 'Dispatched and on its way.';
    case 'delivered': return 'Delivered. I hope they look lovely.';
    case 'cancelled': return 'This order was cancelled.';
    default:          return 'In progress.';
  }
}

async function hwLookupOrder(){
  hwShowTyping();
  try {
    var res = await fetch('/.netlify/functions/track-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: hwFlow.orderNumber, email: hwFlow.email })
    });
    var data = await res.json();
    hwRemoveTyping();

    if (!res.ok) {
      hwFlow = null;
      hwFocusInput('Ask us anything...');
      hwAddMsg('bot', (res.status === 429)
        ? "That's a few tries now — give it a couple of minutes and I'll look again."
        : "I can't find an order with those details. The number and email both need to match your confirmation email. Shall I pass this to the team?");
      if (res.status !== 429) hwAddPromptRow([{ label: 'Yes please', fn: 'hwShowContact()' }]);
      return;
    }

    var placed = data.createdAt
      ? new Date(data.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
      : '';
    var item = (data.items && data.items[0]) || {};
    var lines = [
      data.orderNumber + (placed ? ' — placed ' + placed : ''),
      [item.qty ? item.qty + ' ×' : '', item.size || '', data.paper ? 'on ' + data.paper : ''].filter(Boolean).join(' '),
      hwStatusWords(data.status, data.tracking)
    ].filter(Boolean);
    if (data.tracking) lines.push('Tracking: ' + data.tracking);

    hwAddMsg('bot', lines.join('\n'));
    hwFlow = null;
    hwFocusInput('Ask us anything...');
    hwAddPromptRow([
      { label: 'See full tracking', fn: "window.location.href='/track-order'" },
      { label: 'Something else',    fn: 'hwAskAnything()' }
    ]);
  } catch (e) {
    hwRemoveTyping();
    hwFlow = null;
    hwFocusInput('Ask us anything...');
    hwAddMsg('bot', "I could not reach our order system just then. Try again in a moment, or leave your details and the team will help.", true);
  }
}

function hwAskAnything(){
  hwFlow = null;
  hwFocusInput('Ask us anything...');
  hwAddMsg('bot', 'What else can I help with?');
}

// ── ARTWORK HELP FLOW ────────────────────────────────────────────────
// The same questions come up before every upload, and generic advice is
// useless for them: what people need is the millimetre figure for the size
// they are actually ordering. Where Amy can know that — on the order page,
// where a size has been chosen — she gives the real number rather than an
// explanation of bleed.
var HW_BLEED_MM = 3;

function hwStartArtwork(){
  hwFlow = null;
  hwAddMsg('bot', 'Happy to help you get the file right. What would be most useful?');
  hwAddPromptRow([
    { label: 'What size should my file be?', fn: 'hwArtworkSize()' },
    { label: "What's bleed?",                fn: 'hwArtworkBleed()' },
    { label: 'Which file types can I send?', fn: 'hwArtworkFormats()' },
    { label: 'My file was flagged',          fn: 'hwArtworkFlagged()' }
  ]);
}

// The size chosen on the order page, when we are on it.
function hwChosenSize(){
  try {
    if (typeof selectedSize === 'undefined' || !selectedSize) return null;
    if (typeof SIZE_SPECS === 'undefined' || !SIZE_SPECS[selectedSize]) return null;
    var spec = SIZE_SPECS[selectedSize];
    return { name: spec.label || selectedSize, w: spec.mmW, h: spec.mmH };
  } catch (e) { return null; }
}

async function hwArtworkSize(){
  hwAddMsg('user', 'What size should my file be?');
  var chosen = hwChosenSize();
  if (chosen) {
    var bw = chosen.w + HW_BLEED_MM * 2, bh = chosen.h + HW_BLEED_MM * 2;
    hwAddMsg('bot',
      'You have chosen ' + chosen.name + ', which finishes at ' + chosen.w + ' × ' + chosen.h + 'mm.\n\n' +
      'Ideally send it ' + bw + ' × ' + bh + 'mm — that is your design plus ' + HW_BLEED_MM + 'mm of bleed on every edge.\n\n' +
      'If you only have it at ' + chosen.w + ' × ' + chosen.h + 'mm, send it anyway: we extend the edges to make the bleed, and add the crop marks ourselves.');
    hwArtworkFollowUp();
    return;
  }
  // Not on the order page, or no size chosen yet — quote the common ones.
  hwShowTyping();
  var sizes = await hwFetchSizes();
  hwRemoveTyping();
  if (!sizes.length) {
    hwAddMsg('bot', 'Pick your size on the order page and I will give you the exact millimetres. As a rule: your finished size plus ' + HW_BLEED_MM + 'mm of bleed on each edge.');
  } else {
    hwAddMsg('bot',
      'Send your artwork at the finished size plus ' + HW_BLEED_MM + 'mm of bleed on every edge. For our usual sizes that means:\n\n' +
      sizes.slice(0, 5).map(function(z){
        return '• ' + z.name + ' — finishes ' + z.w + ' × ' + z.h + 'mm, supply ' + (z.w + HW_BLEED_MM*2) + ' × ' + (z.h + HW_BLEED_MM*2) + 'mm';
      }).join('\n') +
      '\n\nNo bleed on your file? Send it anyway — we extend the edges for you.');
  }
  hwArtworkFollowUp();
}

async function hwFetchSizes(){
  try {
    var cfg = window.__SUPABASE_CONFIG;
    if (!cfg) return [];
    var res = await fetch(cfg.url + '/rest/v1/print_sizes?active=eq.true&select=name,width_mm,height_mm&order=display_order&limit=8', {
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }
    });
    if (!res.ok) return [];
    return (await res.json()).map(function(r){
      return { name: r.name, w: Math.round(r.width_mm), h: Math.round(r.height_mm) };
    }).filter(function(z){ return z.w && z.h; });
  } catch (e) { return []; }
}

function hwArtworkBleed(){
  hwAddMsg('user', "What's bleed?");
  hwAddMsg('bot',
    'Bleed is a little extra design past the edge of the finished card — ' + HW_BLEED_MM + 'mm on each side.\n\n' +
    'Printing is done on a large sheet and then trimmed, and trimming moves a fraction. Without bleed, that fraction shows as a thin white line along one edge. With it, the colour runs right off the card.\n\n' +
    'It matters if your design reaches the edge. If everything sits comfortably inside a white border, it makes no difference at all.\n\n' +
    'And if your file has no bleed, send it as it is — we extend the edges to create it.');
  hwArtworkFollowUp();
}

function hwArtworkFormats(){
  hwAddMsg('user', 'Which file types can I send?');
  hwAddMsg('bot',
    'PDF is best, and AI, InDesign or EPS are just as welcome.\n\n' +
    'JPG, PNG and TIFF are fine too — just make sure the image is big enough. We print at 300 dots per inch, so an A5 card wants roughly 1750 × 2480 pixels. We check this when you upload and tell you if it is short.\n\n' +
    'Up to 100MB, and either RGB or CMYK — our press handles the conversion.');
  hwArtworkFollowUp();
}

function hwArtworkFlagged(){
  hwAddMsg('user', 'My file was flagged');
  hwAddMsg('bot',
    'Our checks are fussy on purpose, and not every warning needs fixing:\n\n' +
    '• Wrong page size — worth fixing. It means the design would be scaled or cropped to fit.\n' +
    '• Below 300 DPI — the image is small for the size ordered. A little under is usually fine; a long way under looks soft on paper.\n' +
    '• No bleed — safe to ignore. We extend the edges for you.\n' +
    '• We could not preview it — some AI and InDesign files cannot be shown in a browser. Our studio checks those by hand.\n\n' +
    'You can carry on regardless — nothing stops your order. If you would rather someone looked first, leave your details and we will.');
  hwArtworkFollowUp(true);
}

function hwArtworkFollowUp(offerContact){
  var buttons = [{ label: 'Something else', fn: 'hwStartArtwork()' }];
  if (offerContact) buttons.push({ label: 'Ask the team to check', fn: 'hwShowContact()' });
  if (!/upload-and-print/.test(window.location.pathname)) {
    buttons.unshift({ label: 'Start your order', fn: "window.location.href='/upload-and-print.html'" });
  }
  hwAddPromptRow(buttons);
}

// Returns true when the message was part of a flow and needs no AI reply.
function hwHandleFlow(text){
  if (!hwFlow) return false;

  if (hwFlow.step === 'order') {
    var ref = text.toUpperCase().replace(/\s+/g, '');
    // Accept "4153" or "INV-2026-4153" — people quote the short bit.
    if (/^\d{4}$/.test(ref)) ref = 'INV-' + new Date().getFullYear() + '-' + ref;
    if (!/^INV-\d{4}-\d{3,5}$/.test(ref)) {
      hwAddMsg('bot', "That doesn't look like one of our order numbers — they look like INV-2026-4153. It's at the top of your confirmation email.");
      return true;
    }
    hwFlow.orderNumber = ref;
    hwFlow.step = 'email';
    hwAddMsg('bot', 'Thank you. And the email address you ordered with?');
    hwFocusInput('you@example.com');
    return true;
  }

  if (hwFlow.step === 'email') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
      hwAddMsg('bot', "That doesn't look like an email address — could you check it?");
      return true;
    }
    hwFlow.email = text;
    hwLookupOrder();
    return true;
  }

  return false;
}

async function hwSend(){var input=document.getElementById('hw-input'),text=input.value.trim();if(!text)return;input.value='';hwAddMsg('user',text);
// A flow in progress answers for itself — Amy must not also improvise a reply.
if(hwHandleFlow(text)){return;}
input.disabled=true;document.getElementById('hw-send').disabled=true;hwHistory.push({role:'user',content:text});hwShowTyping();try{var res=await fetch('/.netlify/functions/help-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hwHistory})}),data=await res.json();hwRemoveTyping();var reply=data.text||'Sorry — I could not get through just then. Please email hello@foreverprint.com and a real person will pick it up.';hwHistory.push({role:'assistant',content:reply});hwAddMsg('bot',reply,/contact|problem|issue|wrong|damaged|missing|refund/i.test(text+reply));}catch(e){hwRemoveTyping();hwAddMsg('bot','Sorry, I\'m having trouble connecting. Please email hello@foreverprint.com',false);}input.disabled=false;document.getElementById('hw-send').disabled=false;input.focus();}
function hwShowContact(){document.getElementById('hw-contact-form').style.display='block';document.getElementById('hw-input-area').style.display='none';}
function hwHideContact(){document.getElementById('hw-contact-form').style.display='none';document.getElementById('hw-input-area').style.display='flex';}
function hwSubmitContact(){var name=document.getElementById('hw-cf-name').value.trim(),email=document.getElementById('hw-cf-email').value.trim(),order=document.getElementById('hw-cf-order').value.trim(),msg=document.getElementById('hw-cf-msg').value.trim();if(!name||!email||!msg){alert('Please fill in your name, email and message.');return;}window.location.href='mailto:hello@foreverprint.com?subject='+encodeURIComponent('Customer Enquiry'+(order?' — Order '+order:''))+'&body='+encodeURIComponent('Name: '+name+'\nEmail: '+email+(order?'\nOrder: '+order:'')+'\n\n'+msg);hwHideContact();hwAddMsg('bot','Your email client should have opened — we\'ll get back to you within one working day.',false);}
