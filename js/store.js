// js/store.js — localStorage CRUD, JSON export

const KEY = 'subscbox:v1';

const DEFAULTS = {
  schemaVersion: 1,
  subscriptions: [],
  paymentMethods: [],
  categories: [
    { id: 'cat-video',     name: '動画',      color: '#E5484D', icon: '🎬' },
    { id: 'cat-music',     name: '音楽',      color: '#3B82F6', icon: '🎵' },
    { id: 'cat-ai',        name: 'AI・ツール', color: '#8B5CF6', icon: '🤖' },
    { id: 'cat-fitness',   name: 'フィットネス', color: '#16A34A', icon: '💪' },
    { id: 'cat-insurance', name: '保険',      color: '#F59E0B', icon: '🛡️' },
    { id: 'cat-telecom',   name: '通信',      color: '#06B6D4', icon: '📡' },
    { id: 'cat-other',     name: 'その他',    color: '#9A9A9A', icon: '📦' },
  ],
  groups: [{ id: 'grp-main', name: 'メイン' }],
  exchangeRates: [],
  monthlySnapshots: [],
  diagnosisHistory: [],
  settings: {
    theme: 'auto',
    defaultCurrency: 'JPY',
    showBillingProgress: true,
    showMonthlyConversion: true,
    notifyEnabled: true,
    notifyTimingDays: [3, 0],
    notifyTime: '09:00',
    reConfirmDialogs: true,
  },
};

let _state = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _state = mergeWithDefaults(DEFAULTS, parsed);
    } else {
      _state = deepCopy(DEFAULTS);
    }
  } catch {
    _state = deepCopy(DEFAULTS);
  }
  return _state;
}

export function getState() {
  if (!_state) load();
  return _state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn('SubscBox: save failed', e);
  }
}

// ── Subscriptions ──
export function addSubscription(fields) {
  const state = getState();
  const now = new Date().toISOString();
  const maxOrder = state.subscriptions.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1);
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  state.subscriptions.push({
    id, status: 'active', sortOrder: maxOrder + 1,
    memo: '', url: '', notifyOverrideDays: null,
    cancelledAt: null, lastUsedAt: null,
    createdAt: now, updatedAt: now,
    ...fields,
  });
  save();
  return id;
}

export function updateSubscription(id, updates) {
  const state = getState();
  const idx = state.subscriptions.findIndex(s => s.id === id);
  if (idx === -1) return;
  state.subscriptions[idx] = {
    ...state.subscriptions[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  save();
}

export function deleteSubscription(id) {
  const state = getState();
  state.subscriptions = state.subscriptions.filter(s => s.id !== id);
  save();
}

export function cancelSubscription(id) {
  updateSubscription(id, { status: 'cancelled', cancelledAt: new Date().toISOString() });
}

export function restoreSubscription(id) {
  updateSubscription(id, { status: 'active', cancelledAt: null });
}

// ── Payment Methods ──
export function addPaymentMethod(fields) {
  const state = getState();
  const id = `pm-${Date.now()}`;
  state.paymentMethods.push({ id, ...fields });
  save();
  return id;
}

export function updatePaymentMethod(id, updates) {
  const state = getState();
  const idx = state.paymentMethods.findIndex(p => p.id === id);
  if (idx === -1) return;
  state.paymentMethods[idx] = { ...state.paymentMethods[idx], ...updates };
  save();
}

export function deletePaymentMethod(id) {
  const state = getState();
  state.paymentMethods = state.paymentMethods.filter(p => p.id !== id);
  // Detach from subscriptions
  state.subscriptions.forEach(s => {
    if (s.paymentMethodId === id) s.paymentMethodId = null;
  });
  save();
}

// ── Settings ──
export function updateSettings(updates) {
  const state = getState();
  Object.assign(state.settings, updates);
  save();
}

// ── Exchange Rates ──
export function saveRates(rates) {
  const state = getState();
  state.exchangeRates = rates;
  save();
}

// ── Monthly Snapshot ──
export function upsertSnapshot(yearMonth, total) {
  const state = getState();
  const idx = state.monthlySnapshots.findIndex(s => s.yearMonth === yearMonth);
  if (idx >= 0) {
    state.monthlySnapshots[idx].normalizedMonthlyTotal = total;
  } else {
    state.monthlySnapshots.push({ yearMonth, normalizedMonthlyTotal: total });
  }
  save();
}

// ── Diagnosis History ──
export function saveDiagnosis(result) {
  const state = getState();
  const entry = {
    id: `diag-${Date.now()}`,
    runAt: new Date().toISOString(),
    score: result.score,
    resultJson: JSON.stringify(result),
  };
  state.diagnosisHistory.unshift(entry);
  if (state.diagnosisHistory.length > 20) {
    state.diagnosisHistory = state.diagnosisHistory.slice(0, 20);
  }
  save();
  return entry;
}

// ── JSON Import ──
export function importData(parsed) {
  const newState = mergeWithDefaults(DEFAULTS, parsed);
  localStorage.setItem(KEY, JSON.stringify(newState));
}

// ── JSON Export ──
export function exportJSON() {
  const state = getState();
  const json = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `subscbox-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers ──
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeWithDefaults(defaults, data) {
  const result = deepCopy(defaults);
  if (!data || typeof data !== 'object') return result;

  // Arrays: take from data
  for (const key of ['subscriptions', 'paymentMethods', 'exchangeRates',
      'monthlySnapshots', 'diagnosisHistory']) {
    if (Array.isArray(data[key])) result[key] = data[key];
  }
  // Categories: prefer data if non-empty (user might have customized)
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    result.categories = data.categories;
  }
  if (Array.isArray(data.groups) && data.groups.length > 0) {
    result.groups = data.groups;
  }
  // Settings: merge
  if (data.settings && typeof data.settings === 'object') {
    result.settings = { ...result.settings, ...data.settings };
  }
  if (data.schemaVersion) result.schemaVersion = data.schemaVersion;

  return result;
}
