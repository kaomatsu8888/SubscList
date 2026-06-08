// js/store.js — localStorage CRUD, JSON export

export const KEY = 'subscbox:v1';

const DEFAULTS = {
  schemaVersion: 1,
  subscriptions: [],
  paymentMethods: [],
  categories: [
    { id: 'cat-video',     name: '動画',        color: '#E5484D', icon: '🎬' },
    { id: 'cat-music',     name: '音楽',        color: '#3B82F6', icon: '🎵' },
    { id: 'cat-game',      name: 'ゲーム',      color: '#EC4899', icon: '🎮' },
    { id: 'cat-reading',   name: '読書・雑誌',   color: '#F97316', icon: '📚' },
    { id: 'cat-learning',  name: '学習・教育',   color: '#10B981', icon: '🎓' },
    { id: 'cat-ai',        name: 'AI・ツール',  color: '#8B5CF6', icon: '🤖' },
    { id: 'cat-cloud',     name: 'クラウド・保存', color: '#6366F1', icon: '☁️' },
    { id: 'cat-shopping',  name: 'ショッピング',  color: '#F59E0B', icon: '🛒' },
    { id: 'cat-fitness',   name: 'フィットネス',  color: '#16A34A', icon: '💪' },
    { id: 'cat-beauty',    name: '美容・健康',   color: '#D946EF', icon: '💄' },
    { id: 'cat-insurance', name: '保険',        color: '#FBBF24', icon: '🛡️' },
    { id: 'cat-telecom',   name: '通信',        color: '#06B6D4', icon: '📡' },
    { id: 'cat-other',     name: 'その他',      color: '#9A9A9A', icon: '📦' },
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
      // Persist migrations (e.g. newly added default categories) so the
      // saved data stays in sync without waiting for the next write.
      if ((parsed.categories?.length ?? 0) !== _state.categories.length) {
        save();
      }
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
// Returns { ok: true } on success, or { ok: false, error } if the file
// doesn't look like a valid SubscBox export.
export function validateImport(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'ファイルの形式が正しくありません' };
  }
  if (!Array.isArray(parsed.subscriptions)) {
    return { ok: false, error: 'SubscBoxのデータファイルではありません' };
  }
  // Each subscription must have the fields the UI relies on.
  const bad = parsed.subscriptions.find(s =>
    !s || typeof s !== 'object' ||
    typeof s.name !== 'string' ||
    typeof s.amount !== 'number' || isNaN(s.amount) ||
    typeof s.billingCycle !== 'string' ||
    typeof s.firstBillingDate !== 'string'
  );
  if (bad) {
    return { ok: false, error: 'データが破損しているため読み込めません' };
  }
  return { ok: true };
}

export function importData(parsed) {
  const newState = mergeWithDefaults(DEFAULTS, parsed);
  localStorage.setItem(KEY, JSON.stringify(newState));
  _state = newState;
  return newState;
}

// ── Clear all data ──
export function clearData() {
  localStorage.removeItem(KEY);
  _state = deepCopy(DEFAULTS);
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
  // Categories: keep the user's list (they may have customized names/colors),
  // but add any default categories the saved data is missing (migration for
  // existing users when new defaults are introduced). "その他" stays last.
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    const userCats = data.categories;
    const userIds = new Set(userCats.map(c => c && c.id));
    const missing = defaults.categories.filter(c => !userIds.has(c.id));
    const merged = [...userCats, ...deepCopy(missing)];
    const otherIdx = merged.findIndex(c => c && c.id === 'cat-other');
    if (otherIdx >= 0) {
      const [other] = merged.splice(otherIdx, 1);
      merged.push(other);
    }
    result.categories = merged;
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
