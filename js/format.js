// js/format.js — Formatting utilities (no side effects)

export const CURRENCY_SYMBOLS = {
  JPY: '¥', USD: '$', EUR: '€', TRY: '₺', NGN: '₦', INR: '₹',
};

export const CYCLE_LABELS = {
  monthly: '月額', yearly: '年額', custom: 'カスタム',
};

export function fmtAmount(amount, currency = 'JPY') {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  if (currency === 'JPY') {
    return `${sym}${Math.round(amount).toLocaleString('ja-JP')}`;
  }
  return `${sym}${Number(amount).toFixed(2)}`;
}

export function fmtMonthly(amount, currency = 'JPY') {
  const sym = CURRENCY_SYMBOLS[currency] ?? '¥';
  return `${sym}${Math.round(Math.abs(amount)).toLocaleString('ja-JP')}`;
}

export function fmtMonthlyFull(amount, currency = 'JPY') {
  const sym = CURRENCY_SYMBOLS[currency] ?? '¥';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${sym}${Math.round(Math.abs(amount)).toLocaleString('ja-JP')}`;
}

export function fmtCycle(billingCycle, customIntervalDays) {
  if (billingCycle === 'monthly') return '/月';
  if (billingCycle === 'yearly') return '/年';
  if (billingCycle === 'custom') return `/${customIntervalDays ?? '?'}日ごと`;
  return '';
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

export function fmtDateShort(dateStr) {
  if (!dateStr) return '—';
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

export function fmtDaysLeft(days) {
  if (days === 0) return '今日';
  if (days === 1) return '明日';
  if (days < 0) return `${Math.abs(days)}日超過`;
  return `あと${days}日`;
}

export function fmtYearMonth(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${y}年${parseInt(m)}月`;
}

export function fmtPct(val) {
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

export function fmtDiff(val, currency = 'JPY') {
  const sym = CURRENCY_SYMBOLS[currency] ?? '¥';
  const sign = val >= 0 ? '+' : '-';
  return `${sign}${sym}${Math.round(Math.abs(val)).toLocaleString('ja-JP')}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function prevYearMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

// Generate a short unique ID
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
