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
  const SUPABASE_ANON_KEY = 'sb_publishable_-9PtQ9cNyzpuR3XithsFgQ_vTYQbbmt';

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
          // Best-effort flush of any pending save that was queued before login
          flushPendingSave().catch((e) => console.warn('[invAuth] pending save flush failed:', e));
        }
      });

      notifyListeners();
    })();

    return initPromise;
  }

  // ===== Public API =====

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
    // Fire once with whatever we know now (even null) so the page can render
    // its initial state without waiting.
    queueMicrotask(() => { try { cb(currentUser); } catch (e) {} });
    return () => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  // ----- Designs -----

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

  // ----- Pending save (used when user clicks Save before being logged in) -----

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

    // Drop pending saves older than 24 hours
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

  // ===== Bind public API =====

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
    flushPendingSave
  };

  // Auto-init as soon as the script loads
  init();
})();
