// auth.js — Shared auth + save helper for the Invitations site.
//
// Loaded on every page (via the shared header). Exposes a single global
// `window.invAuth` with methods every page can use:
//
//   invAuth.getUser()              -> current user object or null
//   invAuth.isLoggedIn()           -> true/false
//   invAuth.onChange(cb)           -> subscribe to auth state changes
//   invAuth.signInWithMagicLink(email, redirectTo) -> { error? }
//   invAuth.signOut()              -> redirects to home on success
//   invAuth.toggleAuthDropdown(e)  -> opens/closes the header dropdown
//
//   invAuth.saveDesign(productType, designId, designData, metadata)
//   invAuth.loadDesign(designId)
//   invAuth.listSavedDesigns()
//   invAuth.deleteDesign(designId)
//
//   invAuth.queuePendingSave(productType, designId, designData, metadata)
//   invAuth.flushPendingSave()
//
// Requires the Supabase JS SDK to be loaded BEFORE this file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="/auth.js"></script>

(function () {
  const SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
  // Same publishable key the album builder uses. Safe to expose; security
  // comes from Row Level Security policies in Supabase.
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Y3B6bXVta3lqZHlpYm13bHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTY2MzYsImV4cCI6MjA4OTg5MjYzNn0.JBOAoMdotrbxmL3M4nFhdJ6yQWX45YbgtDCgMtJktSE';

  const PENDING_SAVE_KEY = 'inv_pending_save';

  let sb = null;
  let currentUser = null;
  let initPromise = null;
  const listeners = [];

  function notifyListeners() {
    listeners.forEach((cb) => {
      try { cb(currentUser); } catch (e) { console.error('Auth listener error:', e); }
    });
  }

  function init() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (!window.supabase) {
        console.warn('[invAuth] Supabase SDK not loaded — auth disabled');
        return;
      }
      if (SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE' || !SUPABASE_ANON_KEY) {
        console.warn('[invAuth] Supabase publishable key not configured — auth disabled');
        return;
      }

      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true   // crucial for magic link callback handling
        }
      });

      // Hydrate current session
      const { data: { session } } = await sb.auth.getSession();
      currentUser = session ? session.user : null;

      // Listen for future auth state changes
      sb.auth.onAuthStateChange((_event, session) => {
        currentUser = session ? session.user : null;
        notifyListeners();
        if (currentUser) {
          flushPendingSave().catch((e) => console.warn('[invAuth] pending save flush failed:', e));
        }
      });

      notifyListeners();
    })();

    return initPromise;
  }

  // ===== Public auth API =====

  async function signInWithMagicLink(email, redirectTo) {
    if (!sb) await init();
    if (!sb) return { error: new Error('Auth not configured') };

    const target = redirectTo || (window.location.origin + '/login.html');
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: target }
    });
    return { error };
  }

  async function signOut() {
    if (!sb) await init();
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = '/';
  }

  function getUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser; }

  function onChange(cb) {
    listeners.push(cb);
    queueMicrotask(() => { try { cb(currentUser); } catch (e) {} });
    return () => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  // ===== Designs =====

  async function saveDesign(productType, designId, designData, metadata) {
    if (!sb) await init();
    if (!sb) return { error: new Error('Auth not configured') };
    if (!currentUser) return { error: new Error('Not logged in') };

    const row = {
      id: designId,
      user_id: currentUser.id,
      product_type: productType,
      design_data: designData,
      metadata: metadata || {},
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from('saved_designs')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    return { data, error };
  }

  async function loadDesign(designId) {
    if (!sb) await init();
    if (!sb) return { error: new Error('Auth not configured') };
    if (!currentUser) return { error: new Error('Not logged in') };

    const { data, error } = await sb
      .from('saved_designs')
      .select('*')
      .eq('id', designId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    return { data, error };
  }

  async function listSavedDesigns() {
    if (!sb) await init();
    if (!sb) return { data: [], error: new Error('Auth not configured') };
    if (!currentUser) return { data: [], error: new Error('Not logged in') };

    const { data, error } = await sb
      .from('saved_designs')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('updated_at', { ascending: false });

    return { data: data || [], error };
  }

  async function deleteDesign(designId) {
    if (!sb) await init();
    if (!sb) return { error: new Error('Auth not configured') };
    if (!currentUser) return { error: new Error('Not logged in') };

    const { error } = await sb
      .from('saved_designs')
      .delete()
      .eq('id', designId)
      .eq('user_id', currentUser.id);

    return { error };
  }

  // ===== Pending save (queued before login, flushed after) =====

  function queuePendingSave(productType, designId, designData, metadata) {
    try {
      localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({
        productType, designId, designData, metadata, queuedAt: Date.now()
      }));
    } catch (e) { console.warn('[invAuth] queuePendingSave failed:', e); }
  }

  async function flushPendingSave() {
    let pending;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_SAVE_KEY) || 'null');
    } catch (e) { pending = null; }

    if (!pending) return null;
    if (!currentUser) return null;

    if (pending.queuedAt && Date.now() - pending.queuedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PENDING_SAVE_KEY);
      return null;
    }

    const { error } = await saveDesign(
      pending.productType,
      pending.designId,
      pending.designData,
      pending.metadata
    );

    if (!error) {
      localStorage.removeItem(PENDING_SAVE_KEY);
      return pending;
    }
    return null;
  }

  // ===== Header auth nav binding =====
  // The shared header (header.html) gets fetched and injected into pages via
  // innerHTML, which means any <script> tags inside it never execute. So we
  // bind the auth UI from here, watching the DOM for the elements to appear.

  let headerBound = false;
  let dropdownClickHandler = null;

  function bindHeaderAuthNav() {
    const signedOut = document.getElementById('authSignedOut');
    const signedIn  = document.getElementById('authSignedIn');
    if (!signedOut || !signedIn || headerBound) return false;

    headerBound = true;

    // Update visual state to match current user
    const refresh = () => {
      const so = document.getElementById('authSignedOut');
      const si = document.getElementById('authSignedIn');
      const av = document.getElementById('authAvatar');
      const em = document.getElementById('authDropdownEmail');
      if (!so || !si) return;

      if (currentUser) {
        so.classList.remove('active');
        si.classList.add('active');
        if (av) {
          const letter = (currentUser.email || '?').trim().charAt(0).toUpperCase();
          av.textContent = letter || '·';
        }
        if (em) em.textContent = currentUser.email || '—';
      } else {
        so.classList.add('active');
        si.classList.remove('active');
      }
    };

    onChange(refresh);

    // Outside-click handler to close dropdown
    if (!dropdownClickHandler) {
      dropdownClickHandler = (e) => {
        const dropdown = document.getElementById('authDropdown');
        const trigger = document.getElementById('authTrigger');
        if (!dropdown || !trigger) return;
        if (dropdown.contains(e.target) || trigger.contains(e.target)) return;
        dropdown.classList.remove('open');
        trigger.classList.remove('open');
      };
      document.addEventListener('click', dropdownClickHandler);
    }

    return true;
  }

  function toggleAuthDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('authDropdown');
    const trigger = document.getElementById('authTrigger');
    if (!dropdown || !trigger) return;
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    trigger.classList.toggle('open', !isOpen);
  }

  // Watch for the header to be injected into the page
  function watchForHeader() {
    if (bindHeaderAuthNav()) return;

    const observer = new MutationObserver(() => {
      if (bindHeaderAuthNav()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop watching after 10s as a safety
    setTimeout(() => observer.disconnect(), 10000);
  }

  // ===== Public API =====

  window.invAuth = {
    init,
    getUser,
    isLoggedIn,
    onChange,
    signInWithMagicLink,
    signOut,
    saveDesign,
    loadDesign,
    listSavedDesigns,
    deleteDesign,
    queuePendingSave,
    flushPendingSave,
    toggleAuthDropdown
  };

  // Auto-init and watch for the header to appear
  init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForHeader);
  } else {
    watchForHeader();
  }
})();
