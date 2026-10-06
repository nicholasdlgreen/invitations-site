#!/usr/bin/env python3
"""The paper and finishing sections cannot be skipped by losing a race.

On 27 September the RSVP cards page showed the heading "Our paper stocks" with
nothing underneath it, on all 23 product pages, intermittently. /papers/section.js
and /finishing/section.js are deferred, so they run only after parsing ends;
loadData() is started by an inline script DURING parsing. On a warm connection
the product data came back first and the page asked `if (paperMount &&
window.PaperSection)` while that module did not exist yet. The guard is written
to skip quietly, so it skipped -- no error, nothing in the console. Reload and
it looked fine, which is why it survived.

Measured on the live site: product fetch 54-80ms, papers/section.js ready at
~170ms, finishing/section.js at ~723ms.

The fix is `await domReady()` before the guards, which works ONLY because the
modules are deferred -- the spec guarantees a deferred script has run before
DOMContentLoaded fires and not before it. So this checks both halves: the await
is there and in the right place, AND the scripts are still deferred. Turning
either one of those into `async` or moving the await below a guard puts the bug
straight back, silently.

tools/test-section-race.html is the behavioural half: it fills the parser with
enough work that a 0ms timer fires mid-parse and runs the old and new code side
by side. Open it in a browser. Last run 6 October 2026: old SKIPPED at
readyState "loading", new rendered at "interactive".
"""
import io, re, sys

TEMPLATE = 'product.html'
BUILT    = 'wedding-invitations.html'   # sentinel: one of the 23 generated pages
REPRO    = 'tools/test-section-race.html'
FIXTURE  = 'tools/section-race-module.js'

passed = failed = 0

def check(name, got, want):
    global passed, failed
    if got == want:
        passed += 1; print('  ok   %s' % name)
    else:
        failed += 1; print('  FAIL %s   got %r, want %r' % (name, got, want))

def read(p):
    return io.open(p, encoding='utf-8').read()

def audit(src, label):
    """Every ordering fact that keeps the sections on the page."""
    out = {}
    out['has_domready']  = 'function domReady(){' in src
    await_at             = src.find('await domReady();')
    out['has_await']     = await_at > -1
    paper_at             = src.find('window.PaperSection')
    finish_at            = src.find('window.FinishSection')
    out['paper_guarded']  = await_at > -1 and paper_at  > -1 and await_at < paper_at
    out['finish_guarded'] = await_at > -1 and finish_at > -1 and await_at < finish_at
    # the await only means anything while the modules are deferred
    out['papers_defer']   = bool(re.search(r'<script src="/papers/section\.js" defer></script>', src))
    out['finish_defer']   = bool(re.search(r'<script src="/finishing/section\.js" defer></script>', src))
    out['no_async']       = not re.search(r'<script src="/(papers|finishing)/section\.js"[^>]*\basync\b', src)
    return out

WANT = dict(has_domready=True, has_await=True, paper_guarded=True, finish_guarded=True,
            papers_defer=True, finish_defer=True, no_async=True)

LABELS = {
    'has_domready':   'domReady() is defined',
    'has_await':      'loadData() awaits it',
    'paper_guarded':  'the await comes BEFORE the paper guard',
    'finish_guarded': 'the await comes BEFORE the finishing guard',
    'papers_defer':   '/papers/section.js is still deferred',
    'finish_defer':   '/finishing/section.js is still deferred',
    'no_async':       'neither module was switched to async',
}

def run(tpl, built):
    print('THE TEMPLATE THE 23 PAGES ARE BUILT FROM')
    got = audit(tpl, TEMPLATE)
    for k in WANT:
        check(LABELS[k], got[k], WANT[k])
    print('\nAND A PAGE A VISITOR ACTUALLY GETS')
    gotb = audit(built, BUILT)
    for k in WANT:
        check('%s (%s)' % (LABELS[k], BUILT), gotb[k], WANT[k])

tpl, built = read(TEMPLATE), read(BUILT)
run(tpl, built)

print('\nTHE BEHAVIOURAL REPRODUCTION IS STILL WIRED UP')
repro = read(REPRO)
check('the reproduction loads the stand-in module',
      './section-race-module.js' in repro, True)
check('and loads it deferred, as the real one is',
      'defer src="./section-race-module.js"' in repro, True)
check('the stand-in exists', io.open(FIXTURE, encoding='utf-8').read().strip() != '', True)
check('it is not named test-*.js, which the suite would try to run',
      FIXTURE.split('/')[-1].startswith('test-'), False)

print('\nMUTATION: EACH WAY OF LOSING THE RACE MUST FAIL')
def mutates(name, tpl2, built2=None):
    global passed, failed
    import contextlib, io as _io
    before = failed
    with contextlib.redirect_stdout(_io.StringIO()):
        run(tpl2, built2 if built2 is not None else built)
    caught = failed > before
    failed = before
    if caught:
        passed += 1; print('  ok   %s is caught' % name)
    else:
        failed += 1; print('  FAIL %s SLIPPED THROUGH' % name)

mutates('the await being dropped', tpl.replace('  await domReady();\n', ''))
mutates('the await sliding below the paper guard',
        tpl.replace('  await domReady();\n', '')
           .replace('  renderSizesStrip();', '  await domReady();\n  renderSizesStrip();'))
mutates('papers/section.js switched to async',
        tpl.replace('<script src="/papers/section.js" defer></script>',
                    '<script src="/papers/section.js" async></script>'))
mutates('finishing/section.js switched to async',
        tpl.replace('<script src="/finishing/section.js" defer></script>',
                    '<script src="/finishing/section.js" async></script>'))
mutates('domReady() being deleted', tpl.replace('function domReady(){', 'function domReadyX(){'))
mutates('the built pages drifting from the template', tpl,
        built.replace('  await domReady();\n', ''))

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
