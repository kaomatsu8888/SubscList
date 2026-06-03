// js/billing.js — Next billing date, monthly equiv, progress, calendar totals
// Uses the global `dayjs` loaded via CDN

import { getRate } from './currency.js';

// ── Advance by billing cycle ──
function advance(d, sub) {
  if (sub.billingCycle === 'monthly') return d.add(1, 'month');
  if (sub.billingCycle === 'yearly')  return d.add(1, 'year');
  return d.add(sub.customIntervalDays || 30, 'day');
}

// ── Next billing date (strictly after today) ──
export function nextBillingDate(sub) {
  const today = dayjs().startOf('day');
  let d = dayjs(sub.firstBillingDate).startOf('day');

  // Jump forward to near today (performance)
  if (sub.billingCycle === 'monthly') {
    const diff = today.diff(d, 'month');
    if (diff > 0) d = d.add(diff, 'month');
  } else if (sub.billingCycle === 'yearly') {
    const diff = today.diff(d, 'year');
    if (diff > 0) d = d.add(diff, 'year');
  } else {
    const interval = sub.customIntervalDays || 30;
    const diff = today.diff(d, 'day');
    if (diff > interval) d = d.add(Math.floor(diff / interval) * interval, 'day');
  }

  // Advance until strictly after today
  for (let i = 0; i < 30; i++) {
    if (d.isAfter(today)) break;
    d = advance(d, sub);
  }
  return d.format('YYYY-MM-DD');
}

// ── Days until next billing ──
export function daysUntilNext(sub) {
  return dayjs(nextBillingDate(sub)).startOf('day').diff(dayjs().startOf('day'), 'day');
}

// ── Billing progress 0..1 ──
export function getBillingProgress(sub) {
  const today = dayjs().startOf('day');
  const next  = dayjs(nextBillingDate(sub)).startOf('day');
  const daysLeft = next.diff(today, 'day');

  let cycleLen;
  if (sub.billingCycle === 'monthly')  cycleLen = next.daysInMonth();
  else if (sub.billingCycle === 'yearly') cycleLen = 365;
  else cycleLen = sub.customIntervalDays || 30;

  return Math.max(0, Math.min(1, (cycleLen - daysLeft) / cycleLen));
}

// ── Monthly equivalent in defaultCurrency ──
export function monthlyEquiv(sub, storedRates = [], defaultCurrency = 'JPY') {
  const rateFrom = getRate(sub.currency,   storedRates);
  const rateTo   = getRate(defaultCurrency, storedRates);
  const inDefault = sub.amount * rateFrom / rateTo;

  if (sub.billingCycle === 'monthly') return inDefault;
  if (sub.billingCycle === 'yearly')  return inDefault / 12;
  const days = sub.customIntervalDays || 30;
  return inDefault * (365.25 / 12) / days;
}

// ── Sum monthly equiv for active subs ──
export function totalMonthly(subs, storedRates = [], defaultCurrency = 'JPY') {
  return subs
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + monthlyEquiv(s, storedRates, defaultCurrency), 0);
}

// ── Billing occurrences within a calendar month ──
export function getBillingOccurrences(sub, year, month) {
  const start = dayjs(new Date(year, month - 1, 1));
  const end   = start.endOf('month');
  let d = dayjs(sub.firstBillingDate);

  // Jump forward (performance)
  if (sub.billingCycle === 'monthly') {
    const diff = start.diff(d, 'month');
    if (diff > 1) d = d.add(diff - 1, 'month');
  } else if (sub.billingCycle === 'yearly') {
    const diff = start.diff(d, 'year');
    if (diff > 1) d = d.add(diff - 1, 'year');
  } else {
    const interval = sub.customIntervalDays || 30;
    const diff = start.diff(d, 'day');
    if (diff > interval * 2) d = d.add(Math.floor(diff / interval - 1) * interval, 'day');
  }

  const results = [];
  for (let i = 0; i < 60; i++) {
    if (d.isAfter(end)) break;
    if (!d.isBefore(start)) {
      if (d.year() === year && d.month() + 1 === month) {
        results.push(d.format('YYYY-MM-DD'));
      }
    }
    const prev = d;
    d = advance(d, sub);
    if (!d.isAfter(prev)) break; // guard against infinite loop
  }
  return results;
}

// ── Calendar month total (actual billing amounts, not monthly equiv) ──
export function calendarMonthTotal(subs, year, month, storedRates = [], defaultCurrency = 'JPY') {
  return subs
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      const occs = getBillingOccurrences(s, year, month);
      const rate = getRate(s.currency, storedRates) / getRate(defaultCurrency, storedRates);
      return sum + occs.length * s.amount * rate;
    }, 0);
}

// ── TOP N by monthly equiv ──
export function topCosts(subs, storedRates = [], defaultCurrency = 'JPY', n = 3) {
  return subs
    .filter(s => s.status === 'active')
    .map(s => ({ ...s, _monthly: monthlyEquiv(s, storedRates, defaultCurrency) }))
    .sort((a, b) => b._monthly - a._monthly)
    .slice(0, n);
}
