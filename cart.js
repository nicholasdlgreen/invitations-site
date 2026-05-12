// cart.js — Shared basket state + drawer UI for the foreverprint site.
//
// Loaded as a separate <script src> tag (NOT inline in header.html) so its
// functions are reliably available regardless of how the header HTML is
// injected. The header is fetched + injected via innerHTML/outerHTML, which
// means any <script> blocks inside the fetched HTML never execute. Putting
// these functions in a real script file fixes that.
//
// Functions exposed globally (used directly by inline onclick handlers and
// by other page scripts):
//
//   cart                — array of basket items
//   saveCart()          — persist to localStorage
//   updateCartBadge()   — refresh the count badge in the header
//   removeCartItem(i)   — remove item at index i
//   openCart()          — open the basket drawer
//   closeCart()         — close the basket drawer
//   showToast(msg)      — flash a brief toast message
//   renderCartDrawer()  — re-render drawer contents

(function () {
  // Hydrate cart from localStorage
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('inv_cart') || '[]'); } catch (e) { cart = []; }

  function saveCart() {
    localStorage.setItem('inv_cart', JSON.stringify(cart));
  }

  function updateCartBadge() {
    document.querySelectorAll('#cartCount').forEach((el) => {
      el.textContent = cart.length;
    });
  }

  function removeCartItem(i) {
    cart.splice(i, 1);
    saveCart();
    updateCartBadge();
    renderCartDrawer();
  }

  function openCart() {
    renderCartDrawer();
    const bg = document.getElementById('cartBg');
    const drawer = document.getElementById('cartDrawer');
    if (bg) bg.classList.add('open');
    if (drawer) drawer.classList.add('open');
  }

  function closeCart() {
    const bg = document.getElementById('cartBg');
    const drawer = document.getElementById('cartDrawer');
    if (bg) bg.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  function renderCartDrawer() {
    const scroll = document.getElementById('cartScroll');
    const foot = document.getElementById('cartFoot');
    if (!scroll || !foot) return;

    if (!cart.length) {
      scroll.innerHTML =
        '<div class="cart-empty">' +
        '<div style="font-size:40px;margin-bottom:16px;">✦</div>' +
        '<p style="font-size:13px;color:var(--pale);">Your basket is empty</p>' +
        '</div>';
      foot.style.display = 'none';
      return;
    }

    scroll.innerHTML = cart
      .map((item, i) =>
        '<div class="cart-item">' +
          '<div class="cart-item-img">' + (item.icon || '✦') + '</div>' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-name serif">' + item.name + '</div>' +
            '<div class="cart-item-meta">' + (item.size ? item.size + ' · ' : '') + item.qty + ' invitations · ' + (item.paper || 'Smooth White') + '</div>' +
            '<div class="cart-item-price">£' + item.total.toFixed(2) + '</div>' +
          '</div>' +
          '<button class="cart-remove" onclick="removeCartItem(' + i + ')">✕</button>' +
        '</div>'
      )
      .join('');

    const sub = cart.reduce((s, i) => s + i.total, 0);
    document.getElementById('cartNet').textContent = '£' + (sub / 1.2).toFixed(2);
    document.getElementById('cartVat').textContent = '£' + (sub - sub / 1.2).toFixed(2);
    document.getElementById('cartTotal').textContent = '£' + sub.toFixed(2);
    foot.style.display = 'block';
  }

  // goToCheckout — called by the basket drawer's "Continue to Checkout" button.
  // If we're already on upload-and-print, just open the checkout modal directly
  // (no navigation, preserves any design-mode context). Otherwise navigate to
  // /upload-and-print.html with ?action=checkout so it auto-opens on arrival.
  function goToCheckout() {
    if (cart.length === 0) {
      showToast('Your basket is empty');
      return;
    }
    const onUploadAndPrint = window.location.pathname.includes('upload-and-print');
    if (onUploadAndPrint && typeof window.openCheckout === 'function') {
      closeCart();
      window.openCheckout();
      return;
    }
    // Navigate to upload-and-print and trigger the checkout modal on arrival.
    // Preserve source=design-studio if we're currently in that flow.
    const currentParams = new URLSearchParams(window.location.search);
    const navParams = new URLSearchParams();
    const source = currentParams.get('source');
    if (source) navParams.set('source', source);
    navParams.set('action', 'checkout');
    window.location.href = '/upload-and-print.html?' + navParams.toString();
  }

  // Expose globally so inline onclick handlers (and other page scripts) can call them
  window.cart = cart;
  window.saveCart = saveCart;
  window.updateCartBadge = updateCartBadge;
  window.removeCartItem = removeCartItem;
  window.openCart = openCart;
  window.closeCart = closeCart;
  window.showToast = showToast;
  window.renderCartDrawer = renderCartDrawer;
  window.goToCheckout = goToCheckout;

  // If the header is already in the DOM when this script loads, refresh the badge.
  // If not, the page's own header-loader will call updateCartBadge() after injection.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }
})();
