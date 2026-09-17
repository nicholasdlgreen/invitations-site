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
function hwPrompt(t){document.getElementById('hw-input').value=t;hwSend();}
function hwAddMsg(role,text,contact){var msgs=document.getElementById('hw-messages'),div=document.createElement('div');div.className='hw-msg '+role;var s=role==='bot'?'':'You',cb=contact&&role==='bot'?'<br><button class="hw-contact-btn" onclick="hwShowContact()">✉ Contact the team</button>':'';div.innerHTML=(s?'<div class="hw-sender">'+s+'</div>':'')+'<div class="hw-bubble">'+text.replace(/\n/g,'<br>')+cb+'</div>';msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;}
function hwShowTyping(){var msgs=document.getElementById('hw-messages'),div=document.createElement('div');div.id='hw-typing-indicator';div.className='hw-msg bot';div.innerHTML='<div class="hw-sender">Amy</div><div class="hw-typing"><div class="hw-dot"></div><div class="hw-dot"></div><div class="hw-dot"></div></div>';msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;}
function hwRemoveTyping(){var el=document.getElementById('hw-typing-indicator');if(el)el.remove();}
async function hwSend(){var input=document.getElementById('hw-input'),text=input.value.trim();if(!text)return;input.value='';input.disabled=true;document.getElementById('hw-send').disabled=true;hwAddMsg('user',text);hwHistory.push({role:'user',content:text});hwShowTyping();try{var res=await fetch('/.netlify/functions/help-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hwHistory})}),data=await res.json();hwRemoveTyping();var reply=data.text||'Sorry — I could not get through just then. Please email hello@foreverprint.com and a real person will pick it up.';hwHistory.push({role:'assistant',content:reply});hwAddMsg('bot',reply,/contact|problem|issue|wrong|damaged|missing|refund/i.test(text+reply));}catch(e){hwRemoveTyping();hwAddMsg('bot','Sorry, I\'m having trouble connecting. Please email hello@foreverprint.com',false);}input.disabled=false;document.getElementById('hw-send').disabled=false;input.focus();}
function hwShowContact(){document.getElementById('hw-contact-form').style.display='block';document.getElementById('hw-input-area').style.display='none';}
function hwHideContact(){document.getElementById('hw-contact-form').style.display='none';document.getElementById('hw-input-area').style.display='flex';}
function hwSubmitContact(){var name=document.getElementById('hw-cf-name').value.trim(),email=document.getElementById('hw-cf-email').value.trim(),order=document.getElementById('hw-cf-order').value.trim(),msg=document.getElementById('hw-cf-msg').value.trim();if(!name||!email||!msg){alert('Please fill in your name, email and message.');return;}window.location.href='mailto:hello@foreverprint.com?subject='+encodeURIComponent('Customer Enquiry'+(order?' — Order '+order:''))+'&body='+encodeURIComponent('Name: '+name+'\nEmail: '+email+(order?'\nOrder: '+order:'')+'\n\n'+msg);hwHideContact();hwAddMsg('bot','Your email client should have opened — we\'ll get back to you within one working day.',false);}
