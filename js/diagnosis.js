// js/diagnosis.js — Rule-based subscription health check (no usage limits)
import { monthlyEquiv, daysUntilNext } from './billing.js';

export function runDiagnosis(state) {
  const { subscriptions, exchangeRates: rates, settings, categories } = state;
  const { defaultCurrency } = settings;
  const active = subscriptions.filter(s => s.status === 'active');

  if (active.length === 0) {
    return { score: 100, issues: [], topSuggestions: [], total: 0, activeCount: 0 };
  }

  const total = active.reduce((sum, s) => sum + monthlyEquiv(s, rates, defaultCurrency), 0);
  const issues = [];
  let deduct = 0;

  // ── Rule 1: High cost (≥ ¥5,000/月換算) ──
  for (const sub of active) {
    const m = monthlyEquiv(sub, rates, defaultCurrency);
    if (m >= 5000) {
      deduct += 5;
      issues.push({
        type: 'high-cost',
        severity: 'warning',
        title: `高額: ${sub.name}`,
        desc: `月額換算 ¥${Math.round(m).toLocaleString('ja-JP')} のサブスクです`,
        suggest: '本当に活用しているか見直してみましょう',
        sub,
      });
    }
  }

  // ── Rule 2: Foreign currency ratio > 30% ──
  const foreignTotal = active
    .filter(s => s.currency !== defaultCurrency)
    .reduce((sum, s) => sum + monthlyEquiv(s, rates, defaultCurrency), 0);
  if (total > 0 && foreignTotal / total > 0.3) {
    deduct += 10;
    issues.push({
      type: 'fx-risk',
      severity: 'warning',
      title: '外貨比率が高い',
      desc: `外貨サブスクが月額合計の ${Math.round(foreignTotal / total * 100)}% を占めています`,
      suggest: '円安時に支出が増えるリスクがあります',
    });
  }

  // ── Rule 3: Duplicate category (2件以上) ──
  const catMap = {};
  for (const sub of active) {
    if (sub.categoryId) {
      catMap[sub.categoryId] = (catMap[sub.categoryId] ?? 0) + 1;
    }
  }
  for (const [catId, count] of Object.entries(catMap)) {
    if (count >= 2) {
      const catName = categories.find(c => c.id === catId)?.name ?? 'カテゴリ不明';
      deduct += 8;
      issues.push({
        type: 'duplicate-category',
        severity: 'info',
        title: `「${catName}」が ${count} 件`,
        desc: '同じカテゴリのサブスクが複数あります',
        suggest: '類似サービスを統合すると節約できるかもしれません',
      });
    }
  }

  // ── Rule 4: Long unused (lastUsedAt ≥ 60 days ago) ──
  const now = Date.now();
  for (const sub of active) {
    if (!sub.lastUsedAt) continue;
    const days = Math.floor((now - new Date(sub.lastUsedAt).getTime()) / 86400000);
    if (days >= 60) {
      deduct += 10;
      issues.push({
        type: 'unused',
        severity: 'danger',
        title: `長期未利用: ${sub.name}`,
        desc: `最終利用から ${days} 日が経過しています`,
        suggest: '利用していない場合は解約を検討しましょう',
        sub,
      });
    }
  }

  // ── Rule 5: Upcoming high-cost or yearly billing within 7 days ──
  for (const sub of active) {
    const days = daysUntilNext(sub);
    const m = monthlyEquiv(sub, rates, defaultCurrency);
    if (days <= 7 && (sub.billingCycle === 'yearly' || m >= 3000)) {
      issues.push({
        type: 'upcoming',
        severity: 'info',
        title: `まもなく請求: ${sub.name}`,
        desc: `${days === 0 ? '本日' : `${days}日後`}に請求があります`,
        suggest: '不要であれば今のうちに解約できます',
        sub,
      });
    }
  }

  const score = Math.max(0, 100 - deduct);
  const topSuggestions = issues.filter(i => i.severity !== 'info').slice(0, 3);

  return { score, issues, topSuggestions, total, activeCount: active.length };
}
