// album-save.js — Save / Load helper for the album builder pages.
//
// Provides:
//   window.invAlbumSave.init(config)
//     -> sets up the Save button, modal, and ?design=xxx loading
//   window.invAlbumSave.save()
//     -> manually triggers the save flow
//
// Config object:
//   {
//     productType: 'wedding-album' | 'invitation' | ...,
//     getDesignId:   () => string,            // unique ID for the design
//     getDesignData: () => object,            // current full design state
//     getMetadata:   () => { title, subtitle, thumbnail_url? },
//     onLoaded:      (data) => void           // called when ?design=xxx loaded
//   }
//
// Requires window.invAuth (from auth.js) to be present.

(function () {
  let config = null;
  let isInitialised = false;
  const STATE_KEY = 'album_builder_state';

  // ===== Modal HTML & styles =====

  const MODAL_HTML = `
    <div class="invsave-backdrop" id="invsaveBackdrop">
      <div class="invsave-modal" id="invsaveModal">
        <button class="invsave-close" id="invsaveClose" aria-label="Close">✕</button>

        <!-- Initial state: enter email -->
        <div class="invsave-state invsave-state-form active" data-state="form">
          <p class="invsave-eyebrow">Save your work</p>
          <h2>Come back to it <em>any time</em></h2>
          <p class="invsave-lede">Enter your email and we'll send a one-click sign-in link. Your design will be saved to your account automatically.</p>
          <form id="invsaveForm" autocomplete="on">
            <label class="invsave-field-label" for="invsaveEmail">Email address</label>
            <input class="invsave-field-input" type="email" id="invsaveEmail" required placeholder="you@example.com" autocomplete="email">
            <div class="invsave-error" id="invsaveError"></div>
            <button type="submit" class="invsave-submit" id="invsaveSubmit">
              <span class="invsave-label">Save &amp; Send Link</span>
              <span class="invsave-spinner"></span>
            </button>
          </form>
          <p class="invsave-footnote">No password required. We'll never share your email.</p>
        </div>

        <!-- Sent state: link is in inbox -->
        <div class="invsave-state invsave-state-sent" data-state="sent">
          <div class="invsave-icon">✓</div>
          <h2>Check your inbox</h2>
          <p class="invsave-lede">We've sent a one-click sign-in link to:</p>
          <p class="invsave-email" id="invsaveEmailDisplay">—</p>
          <p class="invsave-fineprint">Click the link in the email and your design will be saved automatically. You can come back any time at <strong>foreverprint.com/saved-designs</strong>.</p>
          <button class="invsave-submit invsave-btn-secondary" id="invsaveDone">Close</button>
        </div>

        <!-- Saved state: signed-in user, just saved -->
        <div class="invsave-state invsave-state-saved" data-state="saved">
          <div class="invsave-icon">✓</div>
          <h2>Saved</h2>
          <p class="invsave-lede">Your design has been saved to your account. You can pick it up any time from <strong>My Saved Designs</strong>.</p>
          <button class="invsave-submit invsave-btn-secondary" id="invsaveSavedClose">Continue Designing</button>
        </div>

      </div>
    </div>

    <div class="invsave-toast" id="invsaveToast">Saved</div>
  `;

  const MODAL_CSS = `
    .invsave-backdrop {
      position: fixed; inset: 0;
      background: rgba(61,46,36,0.55);
      backdrop-filter: blur(4px);
      z-index: 500;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: invsaveBackdropIn 0.25s ease;
    }
    .invsave-backdrop.open { display: flex; }

    @keyframes invsaveBackdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .invsave-modal {
      background: #FAF7F2;
      max-width: 480px; width: 100%;
      padding: 56px 48px;
      position: relative;
      box-shadow: 0 30px 80px -20px rgba(61,46,36,0.4);
      animation: invsaveModalIn 0.35s ease;
    }

    .invsave-modal::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: #B8976A;
    }

    @keyframes invsaveModalIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .invsave-close {
      position: absolute;
      top: 20px; right: 20px;
      background: none; border: none;
      width: 36px; height: 36px;
      font-size: 16px;
      color: #B0A098;
      cursor: pointer;
      transition: color 0.2s ease;
    }
    .invsave-close:hover { color: #6B4F3A; }

    .invsave-state { display: none; text-align: center; }
    .invsave-state.active { display: block; }

    .invsave-eyebrow {
      font-family: 'Jost', sans-serif;
      font-size: 11px;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: #9B7F56;
      margin-bottom: 18px;
    }

    .invsave-modal h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      font-weight: 400;
      color: #3D2E24;
      line-height: 1.15;
      margin-bottom: 18px;
    }
    .invsave-modal h2 em {
      font-style: italic;
      color: #9B7F56;
    }

    .invsave-lede {
      font-family: 'Jost', sans-serif;
      font-weight: 300;
      font-size: 14px;
      color: #6B5A4D;
      line-height: 1.7;
      margin-bottom: 28px;
    }

    .invsave-field-label {
      display: block;
      text-align: left;
      font-family: 'Jost', sans-serif;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #6B5A4D;
      margin-bottom: 8px;
    }

    .invsave-field-input {
      width: 100%;
      background: #F4EFE6;
      border: 1px solid transparent;
      padding: 16px 18px;
      font-family: 'Jost', sans-serif;
      font-size: 15px;
      font-weight: 300;
      color: #3D2E24;
      transition: all 0.2s ease;
      margin-bottom: 4px;
    }
    .invsave-field-input:focus {
      outline: none;
      background: #FAF7F2;
      border-color: #B8976A;
    }

    .invsave-error {
      text-align: left;
      font-size: 12px;
      color: #C94A3A;
      min-height: 20px;
      margin-bottom: 16px;
      padding-top: 4px;
    }

    .invsave-submit {
      width: 100%;
      padding: 18px 32px;
      background: #3D2E24;
      color: #FAF7F2;
      font-family: 'Jost', sans-serif;
      font-size: 12px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      border: 1px solid #3D2E24;
      cursor: pointer;
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    .invsave-submit:hover:not([disabled]) {
      background: #9B7F56;
      border-color: #9B7F56;
    }
    .invsave-submit[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .invsave-btn-secondary {
      background: transparent;
      color: #3D2E24;
    }
    .invsave-btn-secondary:hover:not([disabled]) {
      background: #3D2E24;
      color: #FAF7F2;
    }

    .invsave-spinner {
      width: 14px; height: 14px;
      border: 1.5px solid #FAF7F2;
      border-top-color: transparent;
      border-radius: 50%;
      display: none;
      animation: invsaveSpin 0.7s linear infinite;
    }
    .invsave-submit.loading .invsave-spinner { display: inline-block; }
    .invsave-submit.loading .invsave-label { opacity: 0.7; }

    @keyframes invsaveSpin { to { transform: rotate(360deg); } }

    .invsave-footnote {
      font-family: 'Jost', sans-serif;
      font-size: 11px;
      color: #B0A098;
      margin-top: 20px;
      letter-spacing: 0.04em;
    }

    .invsave-icon {
      width: 64px; height: 64px;
      margin: 0 auto 24px;
      border: 1px solid #B8976A;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9B7F56;
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      font-size: 28px;
    }

    .invsave-email {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      color: #9B7F56;
      font-size: 18px;
      margin: 8px 0 24px;
    }

    .invsave-fineprint {
      font-family: 'Jost', sans-serif;
      font-size: 12px;
      color: #6B5A4D;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .invsave-fineprint strong {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      color: #9B7F56;
      font-weight: 400;
      font-size: 13px;
    }

    /* Toast for "Saved" confirmation */
    .invsave-toast {
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #3D2E24;
      color: #FAF7F2;
      padding: 14px 28px;
      font-family: 'Jost', sans-serif;
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      opacity: 0;
      transition: all 0.35s ease;
      z-index: 999;
      pointer-events: none;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);
    }
    .invsave-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* The Save button, used in the stepper bar */
    .invsave-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Jost', sans-serif;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #9B7F56;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: color 0.2s ease;
      white-space: nowrap;
    }
    .invsave-btn:hover { color: #3D2E24; }
    .invsave-btn .invsave-btn-icon {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      font-size: 14px;
      letter-spacing: 0;
    }
    .invsave-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .invsave-btn.saving { color: #B0A098; }

    @media (max-width: 560px) {
      .invsave-modal { padding: 48px 28px; }
      .invsave-modal h2 { font-size: 26px; }
    }
  `;

  // ===== Helpers =====

  function injectModal() {
    if (document.getElementById('invsaveBackdrop')) return;
    const style = document.createElement('style');
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap);

    // Close handlers
    document.getElementById('invsaveClose').addEventListener('click', closeModal);
    document.getElementById('invsaveDone').addEventListener('click', closeModal);
    document.getElementById('invsaveSavedClose').addEventListener('click', closeModal);
    document.getElementById('invsaveBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'invsaveBackdrop') closeModal();
    });

    // Form submit
    document.getElementById('invsaveForm').addEventListener('submit', handleFormSubmit);
  }

  function showState(name) {
    document.querySelectorAll('.invsave-state').forEach(el => {
      el.classList.toggle('active', el.dataset.state === name);
    });
  }

  function openModal(state = 'form') {
    showState(state);
    if (state === 'form') {
      document.getElementById('invsaveError').textContent = '';
      const submit = document.getElementById('invsaveSubmit');
      submit.classList.remove('loading');
      submit.disabled = false;
    }
    document.getElementById('invsaveBackdrop').classList.add('open');
    if (state === 'form') {
      setTimeout(() => document.getElementById('invsaveEmail').focus(), 50);
    }
  }

  function closeModal() {
    document.getElementById('invsaveBackdrop').classList.remove('open');
  }

  function showToast(msg) {
    const toast = document.getElementById('invsaveToast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ===== Save flow =====

  async function save() {
    if (!config) {
      console.error('[invAlbumSave] init not called');
      return;
    }

    // Make sure auth is initialised
    if (window.invAuth && window.invAuth.init) {
      await window.invAuth.init();
    }

    const designId = config.getDesignId();
    const designData = config.getDesignData();
    const metadata = config.getMetadata ? config.getMetadata() : {};

    if (!designId || !designData) {
      console.error('[invAlbumSave] Missing designId or designData');
      return;
    }

    // Logged in: save directly
    if (window.invAuth && window.invAuth.isLoggedIn()) {
      const btn = document.getElementById(config.saveButtonId || 'saveBtn');
      if (btn) { btn.classList.add('saving'); btn.disabled = true; }

      const { error } = await window.invAuth.saveDesign(
        config.productType, designId, designData, metadata
      );

      if (btn) { btn.classList.remove('saving'); btn.disabled = false; }

      if (error) {
        console.error('Save failed:', error);
        showToast('Save failed — please try again');
        return;
      }
      showToast('Saved');
      return;
    }

    // Not logged in: open modal to capture email
    openModal('form');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('invsaveEmail').value.trim();
    if (!email) return;

    const submit = document.getElementById('invsaveSubmit');
    const errEl = document.getElementById('invsaveError');
    errEl.textContent = '';
    submit.classList.add('loading');
    submit.disabled = true;

    // Queue the current state as a pending save (will fire when user logs in)
    const designId = config.getDesignId();
    const designData = config.getDesignData();
    const metadata = config.getMetadata ? config.getMetadata() : {};

    if (window.invAuth && window.invAuth.queuePendingSave) {
      window.invAuth.queuePendingSave(config.productType, designId, designData, metadata);
    }

    // Build redirect URL: come back to this page with the design loaded.
    // We need to ensure ?design=xxx is on the URL so the page reloads the design.
    const url = new URL(window.location.href);
    url.searchParams.set('design', designId);
    const redirectTo = url.toString();

    if (!window.invAuth || !window.invAuth.signInWithMagicLink) {
      errEl.textContent = 'Auth not loaded — please refresh and try again.';
      submit.classList.remove('loading');
      submit.disabled = false;
      return;
    }

    const { error } = await window.invAuth.signInWithMagicLink(email, redirectTo);

    submit.classList.remove('loading');
    submit.disabled = false;

    if (error) {
      errEl.textContent = error.message || 'Could not send the link. Please try again.';
      return;
    }

    document.getElementById('invsaveEmailDisplay').textContent = email;
    showState('sent');
  }

  // ===== Load from ?design=xxx =====

  async function tryLoadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const designId = params.get('design');
    if (!designId) return null;

    if (window.invAuth && window.invAuth.init) {
      await window.invAuth.init();
    }
    if (!window.invAuth || !window.invAuth.isLoggedIn()) return null;

    const { data, error } = await window.invAuth.loadDesign(designId);
    if (error || !data) {
      console.warn('[invAlbumSave] Could not load design:', error);
      return null;
    }

    // Write design_data into the page's expected localStorage slot
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(data.design_data));
    } catch (e) {
      console.warn('[invAlbumSave] Could not write state:', e);
    }

    if (config && typeof config.onLoaded === 'function') {
      try { config.onLoaded(data); } catch (e) { console.error(e); }
    }

    return data;
  }

  // ===== Auth state changes — show "Saved!" toast after login if pending save fired =====

  function bindPendingSaveFlush() {
    if (!window.invAuth || !window.invAuth.onChange) return;

    window.invAuth.onChange(async (user) => {
      if (!user) return;
      // After a fresh login, flush any pending saves and toast on success
      if (window.invAuth.flushPendingSave) {
        const flushed = await window.invAuth.flushPendingSave();
        if (flushed) {
          showToast('Your design has been saved');
        }
      }
    });
  }

  // ===== Public API =====

  window.invAlbumSave = {
    init: async function (cfg) {
      config = cfg;
      if (!isInitialised) {
        injectModal();
        bindPendingSaveFlush();
        isInitialised = true;
      }

      // Bind save button if specified (or look for default ID 'saveBtn')
      const btnId = (cfg && cfg.saveButtonId) || 'saveBtn';
      const btn = document.getElementById(btnId);
      if (btn && !btn.dataset.invsaveBound) {
        btn.dataset.invsaveBound = '1';
        btn.addEventListener('click', save);
      }

      // Try loading from URL
      return await tryLoadFromUrl();
    },

    save: save,
    open: () => openModal('form'),
    close: closeModal,
    toast: showToast
  };
})();
