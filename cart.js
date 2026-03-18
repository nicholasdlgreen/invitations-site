// ============================================================
//  INVITATIONS — SHARED CART
//  Loaded on every page. Persists cart in sessionStorage.
// ============================================================

let cart = JSON.parse(sessionStorage.getItem('inv_cart') || '[]');

function saveCart()   { sessionStorage.setItem('inv_cart', JSON.stringify(cart)); }
function updateCartBadge() {
  document.querySelectorAll('#cartCount,.cart-count').forEach(el => el.textContent = cart.length);
}

function addToCart(item) {
  cart.push(item);
  saveCart();
  updateCartBadge();
}

function removeCartItem(i) {
  cart.splice(i, 1);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function openCart() {
  renderCartDrawer();
  document.getElementById('cartBg')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
}

function closeCart() {
  document.getElementById('cartBg')?.classList.remove('open');
  document.getElementById('cartDrawer')?.classList.remove('open');
}

function renderCartDrawer() {
  const scroll = document.getElementById('cartScroll');
  const foot   = document.getElementById('cartFoot');
  if (!scroll) return;
  if (!cart.length) {
    scroll.innerHTML = `<div class="cart-empty">
      <div style="font-size:40px;margin-bottom:16px;">✦</div>
      <p style="font-size:13px;color:var(--pale);">Your basket is empty</p>
      <a href="shop.html" style="font-size:12px;color:var(--gold);margin-top:12px;display:block;">Browse collections →</a>
    </div>`;
    if (foot) foot.style.display = 'none';
    return;
  }
  scroll.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-img" style="background:${item.bg||'var(--cream)'};color:${item.tc||'var(--text)'};">${item.icon||'✦'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name serif">${item.name}</div>
        <div class="cart-item-meta">${item.qty} invitations · ${item.paper||'Smooth White'}</div>
        <div class="cart-item-price">£${item.total.toFixed(2)}</div>
      </div>
      <button class="cart-remove" onclick="removeCartItem(${i})">✕</button>
    </div>`).join('');
  const sub = cart.reduce((s, i) => s + i.total, 0);
  const vat = sub - sub / 1.2;
  if (document.getElementById('cartNet'))   document.getElementById('cartNet').textContent   = '£' + (sub/1.2).toFixed(2);
  if (document.getElementById('cartVat'))   document.getElementById('cartVat').textContent   = '£' + vat.toFixed(2);
  if (document.getElementById('cartTotal')) document.getElementById('cartTotal').textContent = '£' + sub.toFixed(2);
  if (foot) foot.style.display = 'block';
}

// Init badge on page load
updateCartBadge();
