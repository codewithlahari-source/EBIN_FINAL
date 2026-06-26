/**
 * public/app.js - Dashboard
 * Replaces Firebase with JWT-based auth + polling.
 */
import { apiFetch, isLoggedIn, getUser, logout } from './auth.js';

const $ = (id) => document.getElementById(id);
const toast = (msg, type = 'info') => {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => (el.className = 'toast'), 3000);
};

/* Theme */
const themeToggle = $('themeToggle');
const applyTheme = (t) => {
  document.documentElement.setAttribute('data-theme', t);
  themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
};
applyTheme(localStorage.getItem('theme') || 'light');
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
});

let currentPoints = 0;
let activePending = null; // {code, batteryCount}
let rewardsCache = [];

const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
};

const statusBadge = (s) => {
  if (s === 'verified') return '<span class="badge ok">✓ Verified</span>';
  if (s === 'pending')  return '<span class="badge warn">⏳ Pending</span>';
  if (s === 'expired')  return '<span class="badge muted">Expired</span>';
  if (s === 'rejected') return '<span class="badge danger">Rejected</span>';
  return `<span class="badge muted">${s}</span>`;
};

/* ---------- Render ---------- */
function renderHistory(deposits) {
  const tbody = $('historyBody');
  if (!deposits.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted center">No deposits yet. Drop your first batteries! ♻️</td></tr>';
    $('latestCode').textContent = '—';
    $('latestStatus').textContent = 'Submit a deposit to generate a code';
    $('simulateBtn').classList.add('hidden');
    activePending = null;
    return;
  }

  tbody.innerHTML = deposits.map((d) => `
    <tr>
      <td>${fmtDate(d.timestamp)}</td>
      <td>${d.batteryCount}</td>
      <td>${d.status === 'verified' ? `+${d.pointsEarned}` : `<span class="muted">${d.expectedPoints || 0}*</span>`}</td>
      <td class="code-cell">${d.generatedCode}</td>
      <td>${statusBadge(d.status || (d.active ? 'pending' : 'expired'))}</td>
    </tr>
  `).join('');

  const pending = deposits.find((d) => d.status === 'pending');
  if (pending) {
    activePending = { code: pending.generatedCode, batteryCount: pending.batteryCount };
    $('latestCode').textContent = pending.generatedCode;
    $('latestStatus').innerHTML = `⏳ Awaiting bin verification · expects ${pending.batteryCount} batteries`;
    $('simulateBtn').classList.remove('hidden');
    $('latestCard').classList.add('pulse');
  } else {
    activePending = null;
    $('latestCode').textContent = deposits[0].generatedCode;
    $('latestStatus').innerHTML = statusBadge(deposits[0].status);
    $('simulateBtn').classList.add('hidden');
    $('latestCard').classList.remove('pulse');
  }
}

function renderRewards() {
  const grid = $('rewardsGrid');
  if (!rewardsCache.length) {
    grid.innerHTML = '<p class="muted">No rewards available yet — check back soon while admins add coupons!</p>';
    return;
  }
  grid.innerHTML = rewardsCache.map((r) => {
    const affordable = currentPoints >= r.cost;
    return `
      <div class="reward ${affordable ? 'affordable' : 'locked'}">
        ${r.imgDataUrl
          ? `<img src="${r.imgDataUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin-bottom:6px;">`
          : `<div class="reward-icon">${r.icon}</div>`}
        <div class="reward-name">${r.name}</div>
        <div class="reward-desc muted small">${r.desc}</div>
        <div class="reward-cost">${r.cost} pts</div>
        <button class="btn ${affordable ? 'btn-primary' : 'btn-ghost'} btn-block btn-sm"
          data-reward="${r.id}" ${affordable ? '' : 'disabled'}>
          ${affordable ? 'Redeem' : `Need ${r.cost - currentPoints} more`}
        </button>
      </div>`;
  }).join('');

  grid.querySelectorAll('button[data-reward]').forEach((btn) => {
    btn.addEventListener('click', () => redeemReward(btn.dataset.reward));
  });
}

function updateProgress() {
  const next = rewardsCache.find((r) => r.cost > currentPoints);
  const bar = $('progressBar');
  if (!next) {
    $('nextRewardHint').textContent = '🌟 All rewards unlocked!';
    bar.style.width = '100%';
    return;
  }
  $('nextRewardHint').textContent = `Next: ${next.icon} ${next.name} at ${next.cost} pts`;
  const prev = [...rewardsCache].reverse().find((r) => r.cost <= currentPoints);
  const lo = prev ? prev.cost : 0;
  const pct = Math.min(100, ((currentPoints - lo) / (next.cost - lo)) * 100);
  bar.style.width = pct + '%';
}

function renderRedemptions(items) {
  const tbody = $('redemptionsBody');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted center">No redemptions yet</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((r) => `
    <tr>
      <td>${fmtDate(r.createdAt)}</td>
      <td>${r.rewardName}</td>
      <td>−${r.cost}</td>
      <td class="code-cell">${r.redeemCode}</td>
      <td><span class="badge ok">${r.status}</span></td>
    </tr>
  `).join('');
}

/* ---------- Data Fetching (polling replaces Firestore onSnapshot) ---------- */
async function fetchUserProfile() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    $('userName').textContent = user.name || 'Eco User';
    $('userGreet').textContent = user.name || 'Eco User';
    currentPoints = user.totalPoints || 0;
    $('totalPoints').textContent = currentPoints;
    renderRewards();
    updateProgress();
  } catch (e) {
    console.warn('profile:', e.message);
  }
}

async function fetchDeposits() {
  try {
    const { deposits } = await apiFetch('/api/deposit/history');
    renderHistory(deposits || []);
  } catch (e) {
    console.warn('deposits:', e.message);
  }
}

async function fetchRedemptions() {
  try {
    const { requests } = await apiFetch('/api/rewards/redemptions');
    renderRedemptions(requests || []);
  } catch (e) {
    console.warn('redemptions:', e.message);
  }
}

async function fetchRewards() {
  try {
    const r = await apiFetch('/api/rewards');
    rewardsCache = r.rewards || [];
    renderRewards();
    updateProgress();
  } catch (e) {
    console.warn('rewards:', e.message);
  }
}

async function loadMyCoupons() {
  try {
    const { coupons } = await apiFetch('/api/rewards/my-coupons');
    renderMyCoupons(coupons || []);
  } catch (e) { console.warn('my-coupons:', e.message); }
}

function renderMyCoupons(list) {
  const el = $('myCouponsGrid');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="muted">No coupons yet — keep recycling to unlock rewards!</p>';
    return;
  }
  const tierColor = { gold: '#f59e0b', silver: '#9ca3af', bronze: '#cd7f32' };
  el.innerHTML = list.map((c) => {
    const dt = c.assignedAt ? new Date(c.assignedAt).toLocaleDateString() : '';
    return `
      <div class="reward-card unlocked" style="border-color:${tierColor[c.tier] || 'var(--border)'};">
        ${c.imgDataUrl
          ? `<img src="${c.imgDataUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;">`
          : '<div style="font-size:42px;text-align:center;padding:14px 0;">🎫</div>'}
        <h4>${c.couponTitle || 'Coupon'}</h4>
        <p class="muted small">${c.tier ? c.tier.toUpperCase() + ' tier' : ''} · ${dt}</p>
        <div class="code-pill" style="margin-top:8px;background:var(--surface-2);padding:8px 12px;border-radius:8px;text-align:center;font-family:ui-monospace,monospace;font-weight:700;letter-spacing:1px;">
          ${c.couponCode || 'No code'}
        </div>
      </div>`;
  }).join('');
}

/* ---------- Actions ---------- */
async function redeemReward(rewardId) {
  try {
    const res = await apiFetch('/api/rewards/redeem', {
      method: 'POST', body: JSON.stringify({ rewardId })
    });
    toast(`🎉 Redeemed! Code: ${res.redemption.redeemCode}`, 'success');
    // Refresh data
    fetchUserProfile();
    fetchRedemptions();
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('simulateBtn').addEventListener('click', async () => {
  if (!activePending) return;
  try {
    const res = await fetch('/api/sensor-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        binId: $('binId').value.trim() || 'BIN-01',
        detectedCount: activePending.batteryCount,
        deviceId: 'web-simulator'
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
    toast(`✅ Verified! +${data.pointsCredited} points`, 'success');
    // Refresh data
    fetchUserProfile();
    fetchDeposits();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Pre-fill Bin ID from QR url param ?bin=BIN-01
const urlBin = new URLSearchParams(location.search).get('bin');
if (urlBin) $('binId').value = urlBin;

$('depositForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const spinner = btn.querySelector('.spinner');
  const txt = btn.querySelector('.btn-text');
  const count = Number($('batteryCount').value);
  const binId = $('binId').value.trim() || 'BIN-01';
  if (!count || count <= 0) return toast('Enter a valid count', 'error');

  spinner.classList.remove('hidden');
  txt.classList.add('hidden');
  btn.disabled = true;

  try {
    const res = await apiFetch('/api/deposit', {
      method: 'POST', body: JSON.stringify({ batteryCount: count, binId })
    });
    toast(`Code ${res.deposit.generatedCode} · drop batteries at ${res.deposit.binId}`, 'success');
    $('batteryCount').value = 1;
    // Refresh deposits
    fetchDeposits();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    spinner.classList.add('hidden');
    txt.classList.remove('hidden');
    btn.disabled = false;
  }
});

const claimForm = $('claimForm');
if (claimForm) {
  claimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const spinner = btn.querySelector('.spinner');
    const txt = btn.querySelector('.btn-text');
    const code = $('claimCode').value.trim();
    if (!/^\d{4}$/.test(code)) return toast('Enter the 4-digit code shown on the bin', 'error');

    spinner.classList.remove('hidden');
    txt.classList.add('hidden');
    btn.disabled = true;

    try {
      const res = await apiFetch('/api/claim-drop-code', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      $('claimCode').value = '';
      toast(`✅ Code claimed! +${res.pointsCredited} points`, 'success');
      fetchUserProfile();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      spinner.classList.add('hidden');
      txt.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}

$('refreshBtn').addEventListener('click', () => {
  fetchUserProfile();
  fetchDeposits();
  fetchRedemptions();
  fetchRewards();
  loadMyCoupons();
  toast('Refreshed!', 'info');
});

$('logoutBtn').addEventListener('click', () => {
  logout();
});

/* ---------- Auth gate ---------- */
if (!isLoggedIn()) {
  window.location.href = '/index.html';
} else {
  // Load all data
  fetchUserProfile();
  fetchDeposits();
  fetchRedemptions();
  fetchRewards();
  loadMyCoupons();

  // Poll for updates every 10 seconds
  setInterval(() => {
    fetchUserProfile();
    fetchDeposits();
  }, 10000);

  // Poll rewards & coupons less frequently
  setInterval(() => {
    fetchRewards();
    loadMyCoupons();
  }, 30000);
}
