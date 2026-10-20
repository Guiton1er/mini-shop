// public/app.js
// Front vanilla JS, sans dépendance. Stocke le jeton en localStorage
// (ce choix a lui-même des implications de sécurité : à discuter en cours).

const state = {
  token: localStorage.getItem('minishop_token') || null,
  user: JSON.parse(localStorage.getItem('minishop_user') || 'null'),
  cart: [], // [{ productId, qty }]
  products: [],
};

const THUMB_COLORS = ['#0e7490', '#b45309', '#7c3aed', '#be123c', '#15803d', '#1d4ed8'];
function thumbColor(id) { return THUMB_COLORS[id % THUMB_COLORS.length]; }
function initials(name) { return name.trim().slice(0, 1).toUpperCase(); }
function euros(n) { return Number(n).toFixed(2).replace('.', ',') + ' €'; }

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

// ---------- Navigation entre les "pages" ----------
function navigate(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById('accountDropdown').classList.remove('open');
  if (view === 'cart') renderCart();
  if (view === 'account') loadProfile();
  if (view === 'orders') loadOrders();
  if (view === 'admin') loadAdminOrders();
  window.scrollTo(0, 0);
}
document.querySelectorAll('[data-nav]').forEach((el) => {
  el.addEventListener('click', () => navigate(el.dataset.nav));
});

// ---------- Session / en-tête de compte ----------
function renderSession() {
  const loggedIn = Boolean(state.user);
  document.getElementById('navLoginLink').classList.toggle('hidden', loggedIn);
  document.getElementById('accountMenu').classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    document.getElementById('accountMenuName').textContent = state.user.name || state.user.email;
    document.getElementById('adminMenuLink').classList.toggle('hidden', state.user.role !== 'admin');
  }
}
document.getElementById('accountMenuToggle').addEventListener('click', () => {
  document.getElementById('accountDropdown').classList.toggle('open');
});
document.getElementById('btnLogout').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  localStorage.removeItem('minishop_token');
  localStorage.removeItem('minishop_user');
  renderSession();
  navigate('catalogue');
});

function alertBox(targetId, type, message) {
  document.getElementById(targetId).innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}
function clearAlert(targetId) {
  document.getElementById(targetId).innerHTML = '';
}

// ---------- Catalogue ----------
async function loadProducts() {
  const res = await fetch('/api/products');
  state.products = await res.json();
  const grid = document.getElementById('productGrid');
  grid.innerHTML = state.products
    .map(
      (p) => `
      <div class="product-card">
        <div class="product-thumb" style="background:${thumbColor(p.id)}" data-open="${p.id}">${productIcon(p.id)}</div>
        <div class="product-body">
          <div class="product-name" data-open="${p.id}" style="cursor:pointer">${p.name}</div>
          <div class="product-price">${euros(p.price)}</div>
          <div class="product-stock">${p.stock > 0 ? p.stock + ' en stock' : 'Rupture de stock'}</div>
          <button class="btn-primary" data-add="${p.id}">Ajouter au panier</button>
        </div>
      </div>`
    )
    .join('');
  grid.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.add)));
  });
  grid.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => viewProduct(Number(el.dataset.open)));
  });
}
loadProducts();

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('searchQ').value;
  window.open(`/products?q=${encodeURIComponent(q)}`, '_blank');
});

// ---------- Panier ----------
function updateCartBadge() {
  const count = state.cart.reduce((n, item) => n + item.qty, 0);
  const badge = document.getElementById('cartBadge');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function addToCart(productId) {
  const existing = state.cart.find((i) => i.productId === productId);
  if (existing) existing.qty += 1;
  else state.cart.push({ productId, qty: 1 });
  updateCartBadge();
}

function renderCart() {
  const byId = Object.fromEntries(state.products.map((p) => [p.id, p]));
  const linesEl = document.getElementById('cartLines');
  if (state.cart.length === 0) {
    linesEl.innerHTML = '<p class="muted">Votre panier est vide. <a data-nav="catalogue" style="color:var(--teal);cursor:pointer">Voir le catalogue</a></p>';
    document.getElementById('cartTotal').textContent = euros(0);
    state.cartTotal = 0;
    document.querySelectorAll('[data-nav="catalogue"]').forEach((el) => el.addEventListener('click', () => navigate('catalogue')));
    return;
  }
  let total = 0;
  linesEl.innerHTML = state.cart
    .map((item, idx) => {
      const p = byId[item.productId];
      if (!p) return '';
      const lineTotal = p.price * item.qty;
      total += lineTotal;
      return `
        <div class="cart-line">
          <div class="thumb-mini" style="background:${thumbColor(p.id)}">${productIcon(p.id)}</div>
          <div class="name">${p.name}</div>
          <div class="qty-control">
            <button data-qty="-1" data-idx="${idx}">−</button>
            <span>${item.qty}</span>
            <button data-qty="1" data-idx="${idx}">+</button>
          </div>
          <div class="line-total">${euros(lineTotal)}</div>
        </div>`;
    })
    .join('');
  document.getElementById('cartTotal').textContent = euros(total);
  state.cartTotal = total;
  linesEl.querySelectorAll('[data-qty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      state.cart[idx].qty += Number(btn.dataset.qty);
      if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
      updateCartBadge();
      renderCart();
    });
  });
}

document.getElementById('btnCheckout').addEventListener('click', async () => {
  clearAlert('checkoutAlert');
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ items: state.cart, total: state.cartTotal || 0 }),
  });
  const data = await res.json();
  if (!res.ok) {
    alertBox('checkoutAlert', 'error', data.error || 'Impossible de finaliser la commande.');
    return;
  }
  document.getElementById('confirmDetails').textContent =
    `Commande #${data.orderId} confirmée pour un montant de ${euros(data.total)}.`;
  state.cart = [];
  updateCartBadge();
  navigate('confirm');
});

// ---------- Connexion / inscription ----------
document.getElementById('btnRegister').addEventListener('click', async () => {
  clearAlert('registerAlert');
  const body = {
    email: document.getElementById('regEmail').value,
    name: document.getElementById('regName').value,
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value,
  };
  const res = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    alertBox('registerAlert', 'error', data.error || 'Inscription impossible.');
    return;
  }
  applySession(data);
  navigate('catalogue');
});

document.getElementById('btnLogin').addEventListener('click', async () => {
  clearAlert('loginAlert');
  const body = {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value,
  };
  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    alertBox('loginAlert', 'error', data.error || 'Connexion impossible.');
    return;
  }
  applySession(data);
  navigate('catalogue');
});

function applySession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('minishop_token', state.token);
  localStorage.setItem('minishop_user', JSON.stringify(state.user));
  renderSession();
}

// ---------- Mon compte ----------
async function loadProfile() {
  clearAlert('profileAlert');
  const res = await fetch('/api/profile', { headers: authHeaders() });
  const data = await res.json();
  if (data && !data.error) {
    document.getElementById('profEmail').value = data.email || '';
    document.getElementById('profName').value = data.name || '';
    document.getElementById('profPhone').value = data.phone || '';
  }
}

document.getElementById('btnSaveProfile').addEventListener('click', async () => {
  clearAlert('profileAlert');
  const body = {
    name: document.getElementById('profName').value,
    phone: document.getElementById('profPhone').value,
  };
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.ok) alertBox('profileAlert', 'success', 'Profil mis à jour.');
  else alertBox('profileAlert', 'error', 'Mise à jour impossible.');
});

// ---------- Mes commandes / factures ----------
async function loadOrders() {
  document.getElementById('invoiceDetailCard').style.display = 'none';
  const res = await fetch('/api/invoices', { headers: authHeaders() });
  const data = await res.json();
  const list = document.getElementById('ordersList');
  if (!Array.isArray(data) || data.length === 0) {
    list.innerHTML = '<p class="muted">Aucune commande pour le moment.</p>';
    return;
  }
  list.innerHTML = data
    .map(
      (inv) => `
      <div class="order-row">
        <div class="meta"><b>Commande #${inv.order_id}</b> — ${euros(inv.amount)}</div>
        <span class="order-status">Payée</span>
        <div class="actions">
          <a data-view-invoice="${inv.id}">Voir le détail</a>
          <a data-download="${inv.file_name}">Télécharger</a>
        </div>
      </div>`
    )
    .join('');
  list.querySelectorAll('[data-view-invoice]').forEach((a) => {
    a.addEventListener('click', () => viewInvoice(a.dataset.viewInvoice));
  });
  list.querySelectorAll('[data-download]').forEach((a) => {
    a.addEventListener('click', () => downloadInvoice(a.dataset.download));
  });
}

async function viewInvoice(id) {
  const res = await fetch(`/api/invoices/${id}`, { headers: authHeaders() });
  const data = await res.json();
  const card = document.getElementById('invoiceDetailCard');
  const el = document.getElementById('invoiceDetail');
  if (!res.ok) {
    el.innerHTML = `<div class="alert alert-error">${data.error || 'Facture introuvable.'}</div>`;
  } else {
    el.innerHTML = `
      <p><b>Facture #${data.id}</b></p>
      <p>Commande #${data.order_id} — ${euros(data.amount)}</p>
      <p class="muted">Fichier : ${data.file_name}</p>
      <details class="raw"><summary>Voir la réponse brute de l'API</summary><pre>${JSON.stringify(data, null, 2)}</pre></details>
    `;
  }
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth' });
}

async function downloadInvoice(fileName) {
  const res = await fetch(`/download?name=${encodeURIComponent(fileName)}`, { headers: authHeaders() });
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Administration ----------
async function loadAdminOrders() {
  const res = await fetch('/api/admin/orders', { headers: authHeaders() });
  const data = await res.json();
  const el = document.getElementById('adminOrdersList');
  if (!Array.isArray(data)) {
    el.innerHTML = `<div class="alert alert-error">${(data && data.error) || 'Accès refusé.'}</div>`;
    return;
  }
  el.innerHTML = data
    .map(
      (o) => `
      <div class="order-row">
        <div class="meta"><b>#${o.id}</b> — ${o.email}</div>
        <div class="meta">${euros(o.total)}</div>
        <span class="order-status">${o.status}</span>
      </div>`
    )
    .join('');
}

// ---------- Initialisation ----------
renderSession();
updateCartBadge();

// ---------- Icônes produits (illustrations simples, pas de dépendance image) ----------
const PRODUCT_ICONS = {
  1: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 26 V22 C8 13 15 7 24 7 C33 7 40 13 40 22 V26" />
        <rect x="5" y="26" width="9" height="14" rx="3" />
        <rect x="34" y="26" width="9" height="14" rx="3" />
      </svg>`,
  2: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="14" width="38" height="22" rx="4" />
        <line x1="12" y1="21" x2="12" y2="21" /><line x1="18" y1="21" x2="18" y2="21" /><line x1="24" y1="21" x2="24" y2="21" /><line x1="30" y1="21" x2="30" y2="21" /><line x1="36" y1="21" x2="36" y2="21" />
        <line x1="12" y1="27" x2="12" y2="27" /><line x1="18" y1="27" x2="18" y2="27" /><line x1="24" y1="27" x2="24" y2="27" /><line x1="30" y1="27" x2="30" y2="27" /><line x1="36" y1="27" x2="36" y2="27" />
        <line x1="16" y1="32" x2="32" y2="32" />
      </svg>`,
  3: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="15" y="6" width="18" height="36" rx="9" />
        <line x1="24" y1="6" x2="24" y2="18" />
        <line x1="24" y1="11" x2="24" y2="15" />
      </svg>`,
  4: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="24" cy="24" r="13" />
        <circle cx="24" cy="24" r="5" />
        <path d="M14 13 L9 8 M34 13 L39 8" />
      </svg>`,
  5: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 38 L18 16 H30 L42 38 Z" />
        <line x1="6" y1="38" x2="42" y2="38" />
        <rect x="16" y="7" width="16" height="11" rx="1.5" />
      </svg>`,
};
function productIcon(id) {
  return PRODUCT_ICONS[id] || `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="8" y="8" width="32" height="32" rx="4"/></svg>`;
}

// ---------- Fiche produit ----------
async function viewProduct(id) {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) { navigate('catalogue'); return; }
  const p = await res.json();
  document.getElementById('productDetail').innerHTML = `
    <div class="crumbs"><a data-nav="catalogue">← Retour au catalogue</a></div>
    <div class="product-detail">
      <div class="product-detail-thumb" style="background:${thumbColor(p.id)}">${productIcon(p.id)}</div>
      <div class="product-detail-body">
        <h1 class="page-title" style="margin-bottom:.3rem">${p.name}</h1>
        <div class="product-price" style="font-size:1.3rem">${euros(p.price)}</div>
        <p class="muted" style="margin-top:.2rem">${p.stock > 0 ? p.stock + ' en stock' : 'Rupture de stock'}</p>
        <p style="margin-top:1rem;line-height:1.5">${p.description || ''}</p>
        <div class="qty-control" style="margin-top:1.4rem">
          <button id="detailQtyMinus">−</button>
          <span id="detailQty">1</span>
          <button id="detailQtyPlus">+</button>
        </div>
        <button class="btn-primary" style="margin-top:1rem" id="detailAddToCart">Ajouter au panier</button>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });
  let qty = 1;
  document.getElementById('detailQtyMinus').addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    document.getElementById('detailQty').textContent = qty;
  });
  document.getElementById('detailQtyPlus').addEventListener('click', () => {
    qty += 1;
    document.getElementById('detailQty').textContent = qty;
  });
  document.getElementById('detailAddToCart').addEventListener('click', () => {
    for (let i = 0; i < qty; i++) addToCart(p.id);
  });
  navigate('product');
}
