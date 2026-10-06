#!/usr/bin/env python3
"""The Contact Us page, and the route into it from Amy.
Run:  python3 tools/test-contact-page.py

The footer carried a "Contact Us" link that went nowhere, and Amy's contact
button was a mailto: link — on a phone, where most visitors have no mail client
wired up, it opened nothing and sent nothing while appearing to have worked.
Both now land on a real page that posts to Netlify Forms, which records every
submission as well as emailing it.

Two things here were found by running the page in a browser, not by reading it:

1. The form had no `novalidate`, and the email field is type="email". The
   browser's own constraint validation fired first and swallowed the submit
   event, so our styled messages never ran and the visitor got Chrome's grey
   bubble instead. Worse, errors shown by an earlier submit went stale, because
   the handler that clears them was never reached. Verified fixed in the
   browser: with a bad email and everything else filled, exactly one error
   shows and the submit handler runs.

2. The prefill reads the query string. It is assigned with .value and never as
   markup — a crafted link is otherwise a way to put HTML into the page.

Reworked on 6 October after review. The page promised a reply "within one
working day" — a service level we have not agreed — in five places, including
the confirmation, which is read by someone who has just handed us a problem and
would then start counting. All five are gone. The heading was a welcome, which
reads badly to anyone whose order is late or wrong; it is now an offer. The
prompt text inside the fields went the way the checkout's did on 5 October.

The subject row is real radios, not styled spans, so it is reachable by keyboard
and announced as a group. Nothing is preselected on purpose: a default of "an
order I have placed" would be answered for everyone it is wrong for.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passed = failed = 0
def is_(label, got, want=True):
    global passed, failed
    ok = got == want
    if ok: passed += 1
    else:  failed += 1
    print(('  ok   ' if ok else '  FAIL ') + label +
          ('' if ok else '   got %r, want %r' % (got, want)))

contact  = io.open(os.path.join(ROOT, 'contact.html'), encoding='utf-8').read()
footer   = io.open(os.path.join(ROOT, 'footer.html'), encoding='utf-8').read()
widget   = io.open(os.path.join(ROOT, 'help-widget.js'), encoding='utf-8').read()
redirect = io.open(os.path.join(ROOT, '_redirects'), encoding='utf-8').read()

print('\nTHE FOOTER LINK GOES SOMEWHERE')
is_('Contact Us points at /contact', '<a href="/contact">Contact Us</a>' in footer)
# The /contact -> /contact.html rewrite was removed on 6 October: Netlify
# serves a clean url from the matching file on its own, and the rewrite made
# contact.html a rewrite target, which blocked redirecting it to the clean url.
is_('and /contact.html sends people to /contact', bool(
    re.search(r'^/contact\.html\s+/contact\s+301!', redirect, re.M)))
is_('rather than a rewrite that would pin the .html address', not bool(
    re.search(r'^/contact\s+/contact\.html\s+200', redirect, re.M)))

print('\nNO PROMISE WE CANNOT KEEP, ANYWHERE')
# Comments stripped first: the file explains the promise it removed.
visible = re.sub(r'<!--.*?-->', '', contact, flags=re.S)
visible = re.sub(r'//[^\n]*', '', visible)
is_('no response time in the page text', 'working day' not in visible)
is_('nor in the search description',
    'working day' not in re.search(r'<meta name="description"[^>]*>', contact).group(0))
is_('nor in the two social descriptions',
    [m for m in re.findall(r'<meta (?:property="og:description"|name="twitter:description")[^>]*>', contact)
     if 'working day' in m], [])
is_('and not in the confirmation, which is read by someone counting',
    'We will reply by email to the address you gave us.' in contact)

print('\nTHE HEADING OFFERS HELP RATHER THAN WELCOMING')
is_('the heading is an offer', '<h1 class="ct-h1">How can we help?</h1>' in contact)
is_('the old welcome is gone', 'would love to hear' not in visible)
is_('no line under it', re.search(r'class="ct-lead"', contact) is None)
is_('and its style went with it, rather than lying around unused',
    re.search(r'^\.ct-lead\{', contact, re.M) is None)
is_('same for the eyebrow above it',
    'class="ct-tag"' not in contact and re.search(r'^\.ct-tag\{', contact, re.M) is None)

print('\nTHE WAY ROUND THE FORM IS THE EMAIL ADDRESS, AND ONLY THAT')
alt = re.search(r'<div class="ct-alt">(.*?)</div>', contact, re.S).group(1)
is_('the email address is still offered', 'hello@foreverprint.com' in alt)
is_('and nothing else is', 'Amy' not in alt)

is_('nor does the confirmation after sending', 'Amy' not in
    re.search(r"ct-done-p\">(.*?)</div>", contact, re.S).group(1))

print('\nBOTH WAYS TO REACH US ARE OFFERED ON THE HELP PAGE')
help_pg = io.open(os.path.join(ROOT, 'help-support.html'), encoding='utf-8').read()
is_('Amy is still offered', 'Chat with Amy' in help_pg)
is_('and so is the contact page', '<a class="hs-chat-btn hs-chat-btn-out" href="/contact">' in help_pg)
is_('they sit together and wrap on a narrow screen',
    '.hs-chat-actions{display:flex' in help_pg and 'flex-wrap:wrap' in help_pg)
# The band is var(--text) #3D2E24. Gold on it is 4.75:1 — the outlined button
# passes AA where a gold FILL would not, so the outline is the right choice
# here as well as the quieter one.
is_('the outlined button is the secondary of the two',
    'hs-chat-btn-out{background:transparent' in help_pg)

print('\nNO PROMPT TEXT INSIDE ANY FIELD')
# Scoped to the form. Since the build inlines footer.html, the file also
# contains Amy's widget, whose own fields legitimately use placeholders.
form_only = re.search(r'<form id="ctForm".*?</form>', visible, re.S).group(0)
is_('no placeholders in the contact form', re.findall(r'placeholder=', form_only), [])
is_('the order format moved beside the label, in the optional grey',
    '(optional, like INV-2026-0000)' in contact)
is_('the message field no longer repeats the heading',
    '<label class="ct-label" for="ctMessage">Your message</label>' in contact)

print('\nTHE SUBJECT ROW')
topics = re.findall(r'<input type="radio" name="topic" value="([^"]+)"', contact)
is_('three choices', len(topics), 3)
is_('  an order', 'An order I have placed' in topics)
is_('  a question before ordering', 'A question before I order' in topics)
is_('  something else', 'Something else' in topics)
is_('nothing is preselected', 'checked' not in
    ''.join(re.findall(r'<input type="radio" name="topic"[^>]*>', contact)))
is_('real radios, so the keyboard reaches them', 'type="radio"' in contact)
is_('announced as a group', 'role="radiogroup"' in contact)
is_('and the group has a name', 'aria-labelledby="ctTopicLabel"' in contact
    and 'id="ctTopicLabel"' in contact)
is_('the radio is moved off, not display:none, which would lose focus',
    '.ct-chip input{position:absolute;opacity:0' in contact)
is_('focus is visible on the chip', '.ct-chip:focus-within' in contact)
is_('the choice travels with the submission', 'topic: topic' in contact)
is_('and is empty rather than guessed when nobody picked one',
    "var topic = picked ? picked.value : '';" in contact)

print('\nOUR VALIDATION IS THE ONLY VALIDATION')
form = re.search(r'<form id="ctForm"[^>]*>', contact).group(0)
is_('the form is novalidate', 'novalidate' in form)
is_('so the browser cannot swallow the submit event',
    'type="email"' in contact and 'novalidate' in form)
is_('every field is re-checked on each submit, clearing stale errors',
    len(re.findall(r"showErr\('ct\w+', 'ct\w+Err', ", contact)), 3)

print('\nNETLIFY WILL ACTUALLY RECEIVE IT')
is_('the form is declared to Netlify', 'data-netlify="true"' in form)
is_('it is named, so submissions are filed', 'name="contact"' in form)
is_('the hidden form-name travels with the fetch', "'form-name': 'contact'" in contact)
is_('a honeypot is declared', 'netlify-honeypot="bot-field"' in form)
is_('and the honeypot field exists', 'name="bot-field"' in contact)
is_('the honeypot is hidden from people', 'style="display:none;"' in contact)

print('\nA FAILED SEND DOES NOT LOOK LIKE A SENT ONE')
is_('a non-ok response is treated as a failure', "if (!r.ok) throw" in contact)
is_('the button comes back', "btn.disabled = false" in contact)
is_('and says so, with a way round it', 'hello@foreverprint.com' in contact)

print('\nWHAT AMY HANDS OVER')
# Strip comments first: this file documents the mailto: it replaced, and an
# earlier version of this test failed on its own explanation.
widget_code = re.sub(r'//[^\n]*', '', widget)
is_('no mailto: left in the widget code', 'mailto:' not in widget_code)
is_('she sends them to the page', "window.location.href='/contact'" in widget)
for f in ('name', 'email', 'order', 'message'):
    is_('  carrying %s' % f, "q.set('%s'" % f in widget)

print('\nTHERE IS NOW ONLY ONE COPY OF THE WIDGET')
# There used to be two: help-widget.js and an inlined fork in
# design-studio-ai-create.html, which kept the mailto: and the reply-time
# promise after the shared file was fixed. The fork was removed on 6 October.
# This still searches rather than naming files, so a new fork would be found.
owners = [(f, t) for f, t in
          [(f, io.open(os.path.join(ROOT, f), encoding='utf-8', errors='ignore').read())
           for f in ['help-widget.js'] +
                    [os.path.relpath(os.path.join(dp, fn), ROOT)
                     for dp, dn, fns in os.walk(ROOT)
                     if '.git' not in dp and 'scratch' not in dp
                     for fn in fns if fn.endswith('.html')]]
          if 'function hwSubmitContact' in t]
is_('exactly one file defines it', len(owners), 1)
is_('and it is the shared one', [f for f, _ in owners], ['help-widget.js'])
print('       (%s)' % ', '.join(f for f, _ in owners))
for f, t in owners:
    code = re.sub(r'//[^\n]*', '', t)
    # Slice from the DEFINITION, not the first mention: these files call
    # hwSubmitContact from an onclick before they define it, and slicing on the
    # name alone read the wrong stretch and passed with the bug present.
    body = code[code.index('function hwSubmitContact'):][:900]
    is_('  %s: no mailto:' % f, 'mailto:' not in body)
    is_('  %s: sends them to /contact' % f, "window.location.href='/contact'" in t)
    is_('  %s: promises no reply time' % f, 'working day' not in code)

print('\nTHE PREFILL CANNOT BE USED TO INJECT MARKUP')
is_('values are assigned, never written as HTML',
    re.search(r'field\(pair\[1\]\)\.value = v\.slice', contact) is not None)
is_('no innerHTML is fed from the query string',
    re.search(r'innerHTML\s*=\s*[^;]*q\.get', contact) is None)
is_('and the address bar is cleaned afterwards', 'history.replaceState' in contact)

print('\nMUTATION: THE BUGS COMING BACK MUST FAIL')
is_('a form without novalidate is caught',
    'novalidate' in '<form id="ctForm" name="contact" method="POST" data-netlify="true">', False)
is_('a mailto: widget is caught',
    'mailto:' not in re.sub(r'//[^\n]*', '', 'x.href="mailto:hello@foreverprint.com"'), False)
is_('but a comment mentioning it is not',
    'mailto:' not in re.sub(r'//[^\n]*', '', '// was a mailto: link'), True)
is_('a preselected topic is caught',
    'checked' not in '<input type="radio" name="topic" value="x" checked>', False)
is_('a returning placeholder is caught',
    re.findall(r'placeholder=', '<input placeholder="First and last name">') == [], False)
is_('markup-writing prefill is caught',
    re.search(r'innerHTML\s*=\s*[^;]*q\.get', 'el.innerHTML = q.get("name")') is None, False)

print('\n%d passed, %d failed\n' % (passed, failed))
sys.exit(1 if failed else 0)
