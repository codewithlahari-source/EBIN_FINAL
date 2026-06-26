/**
 * public/admin-app.js — EcoTrack admin dashboard logic.
 * Removed Firebase — uses JWT auth + backend API polling.
 *
 * Inline onclick="..." handlers in admin.html require globals on window.
 */
import { apiFetch, isLoggedIn, logout, googleSignIn, checkExistingSession } from './auth.js';

/* ════════════════════════════════════════════════
   STATE CACHE — populated from backend, read sync by render code
   ════════════════════════════════════════════════ */
const cache = { users: [], drops: [], coupons: [], assigned: [] };

const DATA = {
  fillLevel: 0, temp: 28, binState: 0,
  cycleDrops: 0, cyclePeak: 0, cycleAlerts: 0,
  collections: 0, cycleStart: Date.now(), collLog: []
};

const TIERS = {
  bronze: { label:'Bronze', min:1, max:2,  pts:10, emoji:'🥉', color:'#cd7f32', cls:'tier-bronze' },
  silver: { label:'Silver', min:3, max:5,  pts:25, emoji:'🥈', color:'#9e9e9e', cls:'tier-silver' },
  gold:   { label:'Gold',   min:6, max:10, pts:60, emoji:'🥇', color:'var(--amber)', cls:'tier-gold' }
};

let alerts = [];

/* sync getters used by render code */
function getUsers()    { return cache.users; }
function getDropLog()  { return cache.drops; }
function getCoupons()  { return cache.coupons; }
function getAssigned() { return cache.assigned; }

/* ════════════════════════════════════════════════
   BACKEND FETCH
   ════════════════════════════════════════════════ */
async function refreshUsers()    { try { const r = await apiFetch('/api/admin/users');    cache.users    = r.users    || []; } catch (e) { console.warn(e.message); } }
async function refreshDrops()    { try { const r = await apiFetch('/api/admin/drops');    cache.drops    = r.drops    || []; } catch (e) { console.warn(e.message); } }
async function refreshCoupons()  { try { const r = await apiFetch('/api/admin/coupons');  cache.coupons  = r.coupons  || []; } catch (e) { console.warn(e.message); } }
async function refreshAssigned() { try { const r = await apiFetch('/api/admin/assigned'); cache.assigned = r.assigned || []; } catch (e) { console.warn(e.message); } }
async function refreshBins() {
  try {
    const r = await apiFetch('/api/admin/bins');
    const first = (r.bins || [])[0] || { fillPercent: 0, deposits: 0, batteries: 0, binId: 'BIN-01', lastAt: 0 };
    DATA.fillLevel = first.fillPercent;
    DATA.cycleDrops = first.deposits;
    DATA.cyclePeak = Math.max(DATA.cyclePeak, first.fillPercent);
    DATA.currentBinId = first.binId;
    DATA.lastSensorAt = first.lastAt || 0;
    updateBin(first.fillPercent);
    const ls = $('lastTs');
    if (ls) ls.textContent = first.lastAt
      ? 'Last read: ' + new Date(first.lastAt).toLocaleString()
      : 'Last read: never';
  } catch (e) { console.warn(e.message); }
}

async function refreshAll() {
  await Promise.all([refreshUsers(), refreshDrops(), refreshCoupons(), refreshAssigned(), refreshBins()]);
}

/* ════════════════════════════════════════════════
   AUTH — JWT-based + Google sign-in
   ════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);

function showLogin() { $('loginWrap').style.display = 'flex'; $('dash').style.display = 'none'; }
function showDash()  { $('loginWrap').style.display = 'none'; $('dash').style.display = 'block'; }

function rewriteLoginForm() {
  // Replace username/password fields with a single Google sign-in button.
  const wrap = $('loginWrap');
  if (!wrap) return;
  wrap.querySelectorAll('.lf').forEach((row) => row.style.display = 'none');
  const hint = wrap.querySelector('.l-hint');
  if (hint) hint.innerHTML = 'Sign in with your Google account';
  const btn = wrap.querySelector('.l-btn');
  if (btn) { btn.textContent = '🔑 Sign in with Google →'; btn.onclick = doLogin; }
}

async function doLogin() {
  googleSignIn((user, err) => {
    if (err) {
      showError(err.message || 'Sign-in failed');
      return;
    }
    if (user) {
      tryAdmin();
    }
  });
}

function showError(msg) {
  const el = $('lerr');
  if (!el) return;
  el.textContent = msg; el.style.display = 'block';
}
function clearError() { const el = $('lerr'); if (el) el.style.display = 'none'; }

async function tryAdmin() {
  try {
    await apiFetch('/api/admin/check');
    startDashboard();
    return true;
  } catch (err) {
    showError(err.message || 'Auth failed — not an admin');
    return false;
  }
}

function doLogout() { logout(); }
window.logout = doLogout;

/* ════════════════════════════════════════════════
   INIT (called after admin verified)
   ════════════════════════════════════════════════ */
async function startDashboard() {
  clearError();
  showDash();
  set('b-temp', '—');     // no real temperature feed yet
  set('b-dist', '—');     // no real distance feed yet
  await refreshAll();
  renderCoupons();
  renderAssigned();
  loadFromStorage();
  logRealSensorEvents();
  setInterval(async () => {
    await refreshAll();
    loadFromStorage();
    logRealSensorEvents();
  }, 8000);
  window.addEventListener('resize', drawDropChart);
  setTimeout(drawDropChart, 80);
}

function loadFromStorage() {
  renderUsers(); renderDrops();
  updateOverview(); updateTierCounts();
  drawDropChart(); updateCounts();
}
window.loadFromStorage = loadFromStorage;

/* ════════════════════════════════════════════════
   OVERVIEW / COUNTS  (verbatim logic, safe DOM)
   ════════════════════════════════════════════════ */
function updateOverview() {
  const users = getUsers(); const drops = getDropLog();
  const totalPts = users.reduce((s, u) => s + (u.pts || 0), 0);
  const alertCount = alerts.length;
  set('ov-fill',  DATA.fillLevel + '%');
  set('ov-users', users.length);
  set('ov-drops', drops.length);
  set('ov-pts',   totalPts);
  set('ov-alerts', alertCount);
  set('dropCountLbl', drops.length + ' entries');
}
function updateCounts() {
  const users = getUsers(), drops = getDropLog(), assigned = getAssigned(), coupons = getCoupons();
  set('userCt',     users.length);
  set('dropCt',     drops.length);
  set('couponCt',   coupons.length);
  set('assignedCt', assigned.length);
  set('userCountLbl',     users.length    + ' users');
  set('couponCountLbl',   coupons.length  + ' coupons');
  set('assignedCountLbl', assigned.length + ' assigned');
}
function set(id, v) { const el = $(id); if (el) el.textContent = v; }

/* ════════════════════════════════════════════════
   DROP CHART
   ════════════════════════════════════════════════ */
function drawDropChart() {
  const canvas = $('dropChart');
  const empty  = $('chartEmpty');
  if (!canvas) return;
  const drops = getDropLog();
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = canvas.offsetHeight;
  ctx.clearRect(0, 0, w, h);
  if (!drops.length) { if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';

  const now = Date.now();
  const buckets = new Array(7).fill(0);
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
  }
  drops.forEach((d) => {
    if (!d.time) return;
    const days = Math.floor((now - new Date(d.time).getTime()) / 86400000);
    if (days >= 0 && days < 7) buckets[6 - days] += 1;
  });
  const max = Math.max(1, ...buckets);
  const pad = 28;
  const bw  = (w - pad * 2) / buckets.length;
  ctx.font = '10px monospace';
  ctx.fillStyle = '#9aa';
  ctx.fillText('Drops · last 7 days', pad, 14);
  buckets.forEach((v, i) => {
    const x  = pad + i * bw + 6;
    const bh = (v / max) * (h - pad * 2);
    const y  = h - pad - bh;
    ctx.fillStyle = 'rgba(34,197,94,.85)';
    ctx.fillRect(x, y, bw - 12, bh);
    ctx.fillStyle = '#9aa';
    ctx.fillText(v, x + (bw - 12) / 2 - 4, y - 4);
    ctx.fillText(labels[i], x, h - pad + 14);
  });
}

/* ════════════════════════════════════════════════
   USERS  (verbatim render)
   ════════════════════════════════════════════════ */
function getTier(user) {
  const d = user.drops || 0;
  if (d >= 6 && d <= 10) return 'gold';
  if (d >= 3 && d <= 5)  return 'silver';
  if (d >= 1 && d <= 2)  return 'bronze';
  return null;
}

function renderUsers() {
  const q = ($('userSearch')?.value || '').toLowerCase();
  const all = getUsers();
  const list = all.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
  const el = $('usersGrid');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:24px;grid-column:1/-1;text-align:center">' +
      (all.length ? 'No results.' : 'No users registered yet.') + '</div>';
    return;
  }
  const sorted = [...list].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const assigned = getAssigned();
  el.innerHTML = sorted.map((u, i) => {
    const tier = getTier(u);
    const tierCfg = tier ? TIERS[tier] : null;
    const hasAsg = assigned.some((a) => a.userId === u.id);
    const tierBadge = tierCfg
      ? `<span style="position:absolute;top:10px;right:10px;font-family:var(--mono);font-size:9px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:2px 7px;color:${tierCfg.color}">${tierCfg.emoji} ${tierCfg.label}</span>`
      : '';
    return `
    <div class="user-card">
      ${tierBadge}
      <div class="uc-top">
        <div class="uc-avatar" style="background:${['#1e4d2b','#2d5a20','#1a3a4a','#3a1a4a','#4a2a1a'][i % 5]}">${(u.fname || u.name || '?')[0].toUpperCase()}</div>
        <div>
          <div class="uc-name">${u.name || u.fname || '?'}</div>
          <div class="uc-phone">${u.dept || ''} · ${u.year || ''}</div>
        </div>
      </div>
      <div class="uc-stats">
        <div class="ucs"><div class="ucs-val" style="color:var(--amber)">${u.pts || 0}</div><div class="ucs-lbl">pts</div></div>
        <div class="ucs"><div class="ucs-val">${u.drops || 0}</div><div class="ucs-lbl">drops</div></div>
        <div class="ucs"><div class="ucs-val" style="color:var(--teal)">${u.grams || 0}g</div><div class="ucs-lbl">e-waste</div></div>
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--bd)">
        ${tier
          ? `<button class="btn btn-p" onclick="openAssignModal('${u.id}')" style="width:100%;justify-content:center;font-size:10px;padding:7px">🎁 ${hasAsg ? 'Re-assign' : 'Assign'} Coupon</button>`
          : '<div style="font-family:var(--mono);font-size:10px;color:var(--mu);text-align:center">Not yet eligible</div>'}
      </div>
    </div>`;
  }).join('');
}
window.renderUsers = renderUsers;

function updateTierCounts() {
  const users = getUsers();
  set('bronzeUsers', users.filter((u) => getTier(u) === 'bronze').length);
  set('silverUsers', users.filter((u) => getTier(u) === 'silver').length);
  set('goldUsers',   users.filter((u) => getTier(u) === 'gold').length);
}

/* ════════════════════════════════════════════════
   DROPS
   ════════════════════════════════════════════════ */
function renderDrops() {
  const drops = getDropLog();
  const el = $('dropList');
  if (!el) return;
  if (!drops.length) {
    el.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:16px 0;text-align:center">No drops yet.</div>';
    return;
  }
  el.innerHTML = drops.map((d) => {
    const t = d.time ? new Date(d.time).toLocaleTimeString('en-IN', { hour12: false }) : '—';
    return `<div class="drop-row">
      <div class="dr-code">${d.code}</div>
      <div><div style="font-size:13px;font-weight:700;color:#fff">${d.name || 'Unknown'}</div><div class="dr-meta">${d.dept || ''} · ${t}</div></div>
      <div class="dr-g">${d.grams || 0}g</div>
      <div class="dr-pts">+${d.pts} pts</div>
    </div>`;
  }).join('');
}

function clearDrops() {
  toast('Drop log is read-only (verified deposits from backend).');
}
window.clearDrops = clearDrops;

/* ════════════════════════════════════════════════
   COUPONS — CRUD via API
   ════════════════════════════════════════════════ */
function openAddCouponForm() {
  const f = $('addCouponForm');
  if (!f) return;
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  f.scrollIntoView({ behavior: 'smooth' });
}
window.openAddCouponForm = openAddCouponForm;

function previewNewCouponImg(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = (e) => {
    const prev = $('nc-img-preview');
    if (prev) { prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`; prev.dataset.img = e.target.result; }
  };
  r.readAsDataURL(file);
}
window.previewNewCouponImg = previewNewCouponImg;

async function addCoupon() {
  const title  = $('nc-title')?.value.trim();
  const tier   = $('nc-tier')?.value;
  const code   = ($('nc-code')?.value || '').trim().toUpperCase();
  const desc   = $('nc-desc')?.value.trim() || '';
  const expiry = $('nc-expiry')?.value || '';
  const imgDataUrl = $('nc-img-preview')?.dataset.img || '';
  if (!title) return toast('Title is required');
  if (!tier)  return toast('Pick a tier');
  try {
    await apiFetch('/api/admin/coupons', {
      method: 'POST', body: JSON.stringify({ title, tier, code, desc, expiry, imgDataUrl })
    });
    await refreshCoupons();
    renderCoupons(); updateCounts();
    addAlert('reward','🎁','Coupon Added',`"${title}" added to ${TIERS[tier]?.label || tier} tier`);
    if ($('nc-title'))  $('nc-title').value = '';
    if ($('nc-code'))   $('nc-code').value = '';
    if ($('nc-desc'))   $('nc-desc').value = '';
    if ($('nc-expiry')) $('nc-expiry').value = '';
    if ($('nc-img-preview')) { $('nc-img-preview').innerHTML = '🎫'; delete $('nc-img-preview').dataset.img; }
    toast('Coupon saved');
  } catch (err) { toast(err.message || 'Failed to save coupon'); }
}
window.addCoupon = addCoupon;

function renderCoupons() {
  const coupons  = getCoupons();
  const assigned = getAssigned();
  const wrap = $('couponsByTier');
  if (!wrap) return;
  if (!coupons.length) {
    wrap.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:24px;text-align:center">No coupons yet. Click "Add Coupon" above.</div>';
    return;
  }
  const byTier = { bronze: [], silver: [], gold: [] };
  coupons.forEach((c) => { (byTier[c.tier] = byTier[c.tier] || []).push(c); });
  let html = '';
  ['bronze','silver','gold'].forEach((tier) => {
    if (!byTier[tier]?.length) return;
    const t = TIERS[tier];
    html += `<div style="margin-bottom:18px"><div style="font-family:var(--mono);font-size:12px;color:${t.color};margin-bottom:8px;font-weight:700">${t.emoji} ${t.label.toUpperCase()} TIER (${byTier[tier].length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">`;
    byTier[tier].forEach((c) => {
      const used = assigned.filter((a) => a.couponId === c.id).length;
      html += `
        <div class="coupon-card" style="background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:10px">
          ${c.imgDataUrl ? `<img src="${c.imgDataUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px">` : '<div style="height:90px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border-radius:6px;margin-bottom:8px;font-size:30px">🎫</div>'}
          <div style="font-size:13px;font-weight:700;color:#fff">${c.title}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--mu);margin:4px 0">${c.desc || ''}</div>
          <div style="display:flex;align-items:center;gap:6px;margin:6px 0">
            <input id="cup-${c.id}" value="${c.code || ''}" style="flex:1;padding:4px 6px;background:#000;border:1px solid var(--bd);color:var(--green);border-radius:4px;font-family:var(--mono);font-size:10px;text-transform:uppercase" placeholder="CODE">
            <button class="btn btn-s" onclick="updateCouponCode('${c.id}')" style="padding:4px 8px;font-size:10px">Save</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:10px;color:var(--mu);margin-top:4px">
            <span>${used} used</span><span>${c.expiry || ''}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <label class="btn btn-s" style="flex:1;text-align:center;font-size:10px;padding:5px;cursor:pointer">
              📷 Image<input type="file" accept="image/*" onchange="updateCouponImg('${c.id}', this)" style="display:none">
            </label>
            <button class="btn btn-s" onclick="deleteCoupon('${c.id}')" style="padding:5px 8px;font-size:10px;color:var(--red)">🗑</button>
          </div>
        </div>`;
    });
    html += '</div></div>';
  });
  wrap.innerHTML = html;
}
window.renderCoupons = renderCoupons;

async function updateCouponImg(id, input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async (e) => {
    try {
      await apiFetch(`/api/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ imgDataUrl: e.target.result }) });
      await refreshCoupons(); renderCoupons(); toast('Image updated');
    } catch (err) { toast(err.message); }
  };
  r.readAsDataURL(file);
}
window.updateCouponImg = updateCouponImg;

async function updateCouponCode(id) {
  const input = $('cup-' + id);
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) return toast('Enter a coupon code first');
  try {
    await apiFetch(`/api/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ code }) });
    await refreshCoupons(); renderCoupons(); toast('Code updated: ' + code);
  } catch (err) { toast(err.message); }
}
window.updateCouponCode = updateCouponCode;

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon?')) return;
  try {
    await apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
    await refreshCoupons(); renderCoupons(); updateCounts(); toast('Coupon deleted');
  } catch (err) { toast(err.message); }
}
window.deleteCoupon = deleteCoupon;

/* ════════════════════════════════════════════════
   ASSIGN MODAL
   ════════════════════════════════════════════════ */
let assignTarget = null;
let assignSelected = null;

function openAssignModal(userId) {
  const user = getUsers().find((u) => u.id === userId);
  if (!user) return;
  const tier = getTier(user);
  if (!tier) return toast('User not yet eligible for rewards');

  assignTarget = user; assignSelected = null;

  $('modalUserInfo').innerHTML = `
    <div class="modal-avatar">${(user.fname || user.name || '?')[0].toUpperCase()}</div>
    <div>
      <div class="modal-uname">${user.name || user.fname}</div>
      <div class="modal-umeta">${user.dept || ''} · ${user.drops || 0} drops</div>
    </div>
    <div class="modal-pts-badge">${TIERS[tier].emoji} ${TIERS[tier].label} · ${user.pts || 0} pts</div>`;

  const tierOrder = ['bronze', 'silver', 'gold'];
  const eligTiers = tierOrder.slice(0, tierOrder.indexOf(tier) + 1);
  const coupons   = getCoupons().filter((c) => eligTiers.includes(c.tier));
  const assigned  = getAssigned();

  const grid = $('modalCouponGrid');
  if (!coupons.length) {
    grid.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:16px;grid-column:1/-1;text-align:center">No coupons available for this tier.<br>Add coupons in the Rewards tab.</div>';
  } else {
    grid.innerHTML = coupons.map((c) => {
      const already = assigned.some((a) => a.couponId === c.id && a.userId === userId);
      const t = TIERS[c.tier];
      return `
        <div class="modal-coupon-opt ${already ? 'disabled' : ''}" id="mco-${c.id}" onclick="${already ? '' : `selectCoupon('${c.id}')`}" title="${already ? 'Already assigned to this user' : ''}">
          <div class="mco-img">${c.imgDataUrl ? `<img src="${c.imgDataUrl}">` : '🎫'}</div>
          <div class="mco-title">${c.title}</div>
          <div class="mco-pts">${t?.emoji || ''} ${t?.label || c.tier}</div>
          <div class="mco-code">${c.code || 'No code'}</div>
          ${already ? '<div style="font-family:var(--mono);font-size:9px;color:var(--mu);margin-top:3px">✓ Assigned</div>' : ''}
        </div>`;
    }).join('');
  }
  $('modalAssignBtn').disabled = true;
  $('assignModal').classList.add('open');
}
window.openAssignModal = openAssignModal;

function selectCoupon(id) {
  document.querySelectorAll('.modal-coupon-opt').forEach((el) => el.classList.remove('selected'));
  const el = $('mco-' + id);
  if (el && !el.classList.contains('disabled')) {
    el.classList.add('selected');
    assignSelected = id;
    $('modalAssignBtn').disabled = false;
  }
}
window.selectCoupon = selectCoupon;

function closeModal() {
  $('assignModal').classList.remove('open');
  assignTarget = null; assignSelected = null;
}
window.closeModal = closeModal;

async function confirmAssign() {
  if (!assignTarget || !assignSelected) return;
  const coupon = getCoupons().find((c) => c.id === assignSelected);
  if (!coupon) return;
  const payload = {
    couponId:    coupon.id,
    userId:      assignTarget.id,
    userName:    assignTarget.name || assignTarget.fname,
    userDept:    assignTarget.dept || '',
    couponTitle: coupon.title,
    couponCode:  coupon.code,
    tier:        coupon.tier,
    imgDataUrl:  coupon.imgDataUrl
  };
  try {
    await apiFetch('/api/admin/assigned', { method: 'POST', body: JSON.stringify(payload) });
    await refreshAssigned();
    addAlert('reward', '🎁', 'Reward Assigned',
      `"${coupon.title}" (${coupon.code || '—'}) → ${assignTarget.name || assignTarget.fname}`);
    closeModal();
    renderAssigned(); renderUsers(); updateCounts();
    toast(`✓ ${coupon.title} assigned to ${assignTarget.name || assignTarget.fname}`);
  } catch (err) { toast(err.message); }
}
window.confirmAssign = confirmAssign;

/* ════════════════════════════════════════════════
   ASSIGNED LIST
   ════════════════════════════════════════════════ */
function renderAssigned() {
  const list = getAssigned();
  const el = $('assignedList');
  if (!el) return;
  set('assignedCountLbl', list.length + ' assigned');
  set('assignedCt', list.length);
  if (!list.length) {
    el.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:16px 0;text-align:center">No coupons assigned yet.</div>';
    return;
  }
  el.innerHTML = list.map((a) => {
    const t = TIERS[a.tier] || { emoji: '🎫', label: a.tier, color: '#fff' };
    const dt = a.assignedAt ? new Date(a.assignedAt).toLocaleString('en-IN', { hour12: false, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    return `
      <div class="assigned-row">
        <div class="ar-img">${a.imgDataUrl ? `<img src="${a.imgDataUrl}">` : '<span style="font-size:20px">🎫</span>'}</div>
        <div>
          <div class="ar-title">${a.couponTitle}</div>
          <div class="ar-meta">${t.emoji} ${t.label} · ${a.userName} · ${a.userDept || ''}</div>
          <div class="ar-meta">${dt}</div>
        </div>
        <div class="ar-code">${a.couponCode || '—'}</div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════
   ALERTS
   ════════════════════════════════════════════════ */
function addAlert(type, icon, ch, msg) {
  const t = new Date().toLocaleTimeString('en-IN', { hour12: false });
  alerts.unshift({ type, icon, ch, msg, time: t });
  DATA.cycleAlerts++;
  renderAlerts();
  set('alertCt', alerts.filter((a) => a.type === 'full' || a.type === 'hazard').length);
  set('alertCountSub', alerts.length + ' alerts');
}
function renderAlerts() {
  const el = $('smsList');
  if (!el) return;
  if (!alerts.length) { el.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--mu);padding:20px;text-align:center">No alerts yet.</div>'; return; }
  el.innerHTML = alerts.slice(0, 40).map((a) => `
    <div class="sms-item ${a.type}">
      <div class="si-icon">${a.icon}</div>
      <div class="si-body">
        <div class="si-hdr"><span class="si-ch">${a.ch}</span><span class="badge ${a.type}">${a.type}</span><span class="si-t">${a.time}</span></div>
        <div class="si-msg">${a.msg}</div>
      </div>
    </div>`).join('');
}
function clearAlerts() {
  alerts = []; DATA.cycleAlerts = 0;
  renderAlerts();
  set('alertCt', 0); set('alertCountSub', '0 alerts');
}
window.clearAlerts = clearAlerts;

/* ════════════════════════════════════════════════
   BIN SIMULATION (kept for visuals)
   ════════════════════════════════════════════════ */
function simDrop() {
  DATA.fillLevel = Math.min(100, DATA.fillLevel + Math.floor(Math.random() * 10) + 5);
  DATA.cycleDrops++;
  DATA.cyclePeak = Math.max(DATA.cyclePeak, DATA.fillLevel);
  updateBin(DATA.fillLevel);
  updateOverview(); drawDropChart();
  serialLog('DROP detected · Fill: ' + DATA.fillLevel + '%');
  if (DATA.fillLevel >= 80) setTimeout(simFull, 800);
}
window.simDrop = simDrop;

function simFull() {
  addAlert('full', '🚨', 'Bin Full', 'BIN-001 reached ' + DATA.fillLevel + '% — collection needed');
  serialLog('🚨 BIN FULL!');
}
window.simFull = simFull;

function simFill(pct) {
  DATA.fillLevel = pct; updateBin(pct); updateOverview();
  serialLog('Fill set to ' + pct + '%');
}
window.simFill = simFill;

async function simCollect() {
  const binId = DATA.currentBinId || 'BIN-01';
  if (DATA.fillLevel < 5) return toast('Bin already empty');
  if (!confirm(`Mark ${binId} as emptied (pickup complete)?`)) return;
  try {
    await apiFetch(`/api/admin/bins/${binId}/empty`, { method: 'POST', body: JSON.stringify({}) });
    serialLog(`🚛 ${binId} pickup recorded — fill reset`);
    DATA.collections = (DATA.collections || 0) + 1;
    const kg = parseFloat((DATA.cycleDrops * .35).toFixed(2));
    DATA.collLog.unshift({
      id: DATA.collections, date: new Date().toLocaleString('en-IN', { hour12: false }),
      peak: DATA.cyclePeak, drops: DATA.cycleDrops, kg, alerts: DATA.cycleAlerts
    });
    appendColl(DATA.collLog[0]);
    addAlert('ok', '✅', 'Collection Complete', `${binId} emptied · ~${kg}kg recovered`);
    DATA.cycleDrops = 0; DATA.cyclePeak = 0; DATA.cycleAlerts = 0; DATA.cycleStart = Date.now();
    await refreshBins();
    toast('Bin marked as emptied');
  } catch (err) { toast(err.message); }
}
window.simCollect = simCollect;

function simTemp() {
  DATA.temp = 56;
  set('b-temp', '56.0°C');
  addAlert('hazard', '🔥', 'Temp Hazard', 'BIN-001 temperature 56°C — possible battery hazard!');
  serialLog('🔥 TEMP ALERT: 56°C!');
  setTimeout(() => { DATA.temp = 28; set('b-temp', '28.0°C'); }, 6000);
}
window.simTemp = simTemp;

function updateBin(pct) {
  const fc = pct >= 80 ? 'var(--red)' : pct >= 50 ? 'var(--amber)' : 'var(--green)';
  const fill = $('binFill');
  if (fill) { fill.style.height = pct + '%'; fill.style.background = fc; }
  const bp = $('binPct'); if (bp) { bp.textContent = pct + '%'; bp.style.color = fc; }
  set('b-drops', DATA.cycleDrops);
  set('b-peak',  DATA.cyclePeak + '%');
  set('ov-fill', pct + '%');
  let tagTxt, tagStyle;
  if (pct < 40)      { tagTxt = 'OK';          tagStyle = 'background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.3)'; }
  else if (pct < 75) { tagTxt = 'Half Full';   tagStyle = 'background:rgba(255,183,0,.1);color:var(--amber);border:1px solid rgba(255,183,0,.3)'; }
  else if (pct < 90) { tagTxt = 'Nearly Full'; tagStyle = 'background:rgba(255,183,0,.1);color:var(--amber);border:1px solid rgba(255,183,0,.3)'; }
  else               { tagTxt = 'FULL';        tagStyle = 'background:rgba(255,59,59,.1);color:var(--red);border:1px solid rgba(255,59,59,.3)';
                       const lid = $('binLid'); if (lid) lid.style.transform = 'rotate(-28deg)'; }
  if (pct < 90) { const lid = $('binLid'); if (lid) lid.style.transform = 'none'; }
  const tag = $('binTag'); if (tag) { tag.textContent = tagTxt; tag.style.cssText = tagStyle; }
  set('binStateLabel', tagTxt);
}

function appendColl(c) {
  const tbody = $('collBody');
  if (!tbody) return;
  if (tbody.children[0]?.className?.includes('empty-td')) tbody.innerHTML = '';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="color:var(--mu)">#${c.id}</td>
    <td style="font-family:var(--mono);font-size:11px">${c.date}</td>
    <td style="color:var(--red)">${c.peak}%</td>
    <td style="color:var(--amber)">${c.drops}</td>
    <td style="color:var(--green)">${c.kg}kg</td>
    <td style="color:var(--amber)">${c.alerts}</td>
    <td><span class="badge ok">Done</span></td>`;
  tbody.prepend(tr);
}

/* ════════════════════════════════════════════════
   MISC
   ════════════════════════════════════════════════ */
function serialLog(msg) {
  const s = $('serial'); if (!s) return;
  const t = new Date().toLocaleTimeString('en-IN', { hour12: false });
  s.textContent += `[${t}] ${msg}\n`;
  s.scrollTop = s.scrollHeight;
}

/* Pull real sensor events and render them in the serial monitor */
let _seenSensorIds = new Set();
async function logRealSensorEvents() {
  try {
    const { events } = await apiFetch('/api/admin/sensor-events');
    const fresh = (events || []).filter((e) => !_seenSensorIds.has(e.id)).reverse(); // oldest first
    fresh.forEach((e) => {
      _seenSensorIds.add(e.id);
      const t = e.receivedAt ? new Date(e.receivedAt).toLocaleTimeString('en-IN', { hour12: false }) : ts();
      const line = `[${t}] ${e.binId || '?'} · code=${e.code || '—'} · detected=${e.detectedCount ?? '—'} · device=${e.deviceId || '—'}`;
      const s = $('serial');
      if (s) { s.textContent += line + '\n'; s.scrollTop = s.scrollHeight; }
    });
  } catch (e) { /* ignore */ }
}
function ts() { return new Date().toLocaleTimeString('en-IN', { hour12: false }); }

function toast(msg) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
window.toast = toast;

function go(id) {
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach((b) => b.classList.toggle('active', b.id === 'nav-' + id));
  $('panel-' + id)?.classList.add('active');
  if (id === 'overview' || id === 'drops') { loadFromStorage(); setTimeout(drawDropChart, 40); }
  if (id === 'users')    loadFromStorage();
  if (id === 'rewards')  { renderCoupons(); updateTierCounts(); updateCounts(); }
  if (id === 'assigned') renderAssigned();
}
window.go = go;

function refreshData() {
  refreshAll().then(() => { loadFromStorage(); renderCoupons(); renderAssigned(); toast('Refreshed'); });
}
window.refreshData = refreshData;

/* keep window.doLogin so the form's Enter key still works */
window.doLogin = doLogin;

/* user-search input */
document.addEventListener('DOMContentLoaded', () => {
  rewriteLoginForm();
  const us = $('userSearch');
  if (us) us.addEventListener('input', renderUsers);
});

/* ════════════════════════════════════════════════
   Auth state — gate the dashboard
   ════════════════════════════════════════════════ */
if (!isLoggedIn()) {
  showLogin();
  checkExistingSession((user, err) => {
    if (user) tryAdmin();
  });
} else {
  tryAdmin();
}
