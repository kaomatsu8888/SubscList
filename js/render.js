// js/render.js — All view renderers
import {
  getState, addSubscription, updateSubscription, deleteSubscription,
  cancelSubscription, restoreSubscription, addPaymentMethod,
  deletePaymentMethod, updateSettings, upsertSnapshot, saveDiagnosis,
  exportJSON, importData, validateImport, clearData, saveRates,
} from './store.js';
import {
  nextBillingDate, daysUntilNext, getBillingProgress, monthlyEquiv,
  totalMonthly, getBillingOccurrences, calendarMonthTotal, topCosts,
  billingsSoFar, totalPaidSoFar,
} from './billing.js';
import {
  fmtAmount, fmtMonthly, fmtMonthlyFull, fmtCycle, fmtDate, fmtDateShort,
  fmtDaysLeft, fmtYearMonth, fmtPct, fmtDiff, escHtml,
  currentYearMonth, prevYearMonth, CURRENCY_SYMBOLS, CYCLE_LABELS, todayStr,
} from './format.js';
import { CURRENCIES, fetchRates, ratesAreStale } from './currency.js';
import { runDiagnosis } from './diagnosis.js';

// ── Module-level view state ──
let homeState = { segment: 'all', sort: 'billing' };
let calState  = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let analyticsState = { period: 6 };
let diagState = { phase: 'start', index: 0, answers: [], saved: false };
// Holds prefilled values for a "duplicate" — consumed once by the next new-sub form
let pendingDuplicate = null;
let _charts = {};

// ── Helpers ──
function go(hash) {
  window.dispatchEvent(new CustomEvent('app:go', { detail: { hash } }));
}

function showToast(msg) { window.showToast?.(msg); }

// Compact "time ago" for FX freshness (e.g. "3時間前", "2日前")
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  return `${Math.floor(hrs / 24)}日前`;
}

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

function showConfirm({ title, body, confirmLabel, onConfirm, danger = true }) {
  const el = document.createElement('div');
  el.className = 'dialog-overlay';
  el.innerHTML = `
    <div class="dialog-sheet">
      <div class="dialog-title">${escHtml(title)}</div>
      <div class="dialog-body">${escHtml(body)}</div>
      <div class="dialog-actions">
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="dlg-ok">${escHtml(confirmLabel)}</button>
        <button class="btn btn-secondary" id="dlg-cancel">キャンセル</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#dlg-ok').addEventListener('click', () => { onConfirm(); el.remove(); });
  el.querySelector('#dlg-cancel').addEventListener('click', () => el.remove());
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

const ICON_PRESETS = ['📦','🤖','💬','🎬','🎵','💪','🛡️','📡','🚗','🏍️','☁️',
  '💕','📱','🎮','📚','🛒','🏥','✈️','🏠','💼','🎓','🔑','🎭','🎯','🌐','💡'];

const BACK_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const CHEVRON_SVG = `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// ── Route dispatcher ──
export function renderRoute(hash, match) {
  if (/^#\/$/.test(hash))                      return renderHome();
  if (/^#\/calendar$/.test(hash))              return renderCalendar();
  if (/^#\/analytics$/.test(hash))             return renderAnalytics();
  if (/^#\/diagnosis$/.test(hash))             return renderDiagnosis();
  if (/^#\/settings$/.test(hash))              return renderSettings();
  if (/^#\/sub\/new$/.test(hash))              return renderSubForm(null);
  if (/^#\/sub\/[^/]+\/edit$/.test(hash))      return renderSubForm(match[1]);
  if (/^#\/sub\/[^/]+$/.test(hash))            return renderSubDetail(match[1]);
  if (/^#\/payment-methods$/.test(hash))       return renderPaymentMethods();
  if (/^#\/cancelled$/.test(hash))             return renderCancelled();
  return { html: '<div class="page"><p class="text-sub">ページが見つかりません</p></div>' };
}

// ═══════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════
function renderSubItem(sub, rates, defaultCurrency, showProgress, showConversion, categories) {
  const days    = daysUntilNext(sub);
  const prog    = getBillingProgress(sub);
  const monthly = monthlyEquiv(sub, rates, defaultCurrency);
  const cat     = categories.find(c => c.id === sub.categoryId);
  const metaStr = `${cat ? cat.name : 'その他'} · 次回 ${fmtDateShort(nextBillingDate(sub))}`;

  const progressHtml = showProgress ? `
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.round(prog * 100)}%"></div>
    </div>` : '';

  const convHtml = (showConversion && sub.billingCycle !== 'monthly')
    ? `<div class="sub-monthly">≈ ${fmtMonthly(monthly, defaultCurrency)}/月</div>` : '';

  return `
    <div class="sub-item" data-sub-id="${sub.id}">
      <div class="sub-icon" style="background:${sub.color ? sub.color + '22' : 'var(--card)'}">${escHtml(sub.icon) || '📦'}</div>
      <div class="sub-body">
        <div class="sub-name">${escHtml(sub.name)}</div>
        <div class="sub-meta">${escHtml(metaStr)}</div>
        ${progressHtml}
      </div>
      <div class="sub-right">
        <div class="sub-amount">${fmtAmount(sub.amount, sub.currency)}${fmtCycle(sub.billingCycle, sub.customIntervalDays)}</div>
        ${convHtml}
        <div class="sub-days">${fmtDaysLeft(days)}</div>
      </div>
    </div>`;
}

function renderHome() {
  const state = getState();
  const { subscriptions, exchangeRates: rates, settings, categories } = state;
  const { defaultCurrency, showBillingProgress, showMonthlyConversion } = settings;
  const active = subscriptions.filter(s => s.status === 'active');

  const allCnt  = active.length;
  const moCnt   = active.filter(s => s.billingCycle === 'monthly').length;
  const yrCnt   = active.filter(s => s.billingCycle === 'yearly').length;

  // Only surface the FX refresh control when at least one sub is in a
  // currency other than the default (otherwise rates are irrelevant).
  const hasForeign = active.some(s => s.currency !== defaultCurrency);
  const fxStale = ratesAreStale(rates);
  const lastFetched = rates.reduce(
    (latest, r) => (r.fetchedAt && (!latest || r.fetchedAt > latest) ? r.fetchedAt : latest),
    null
  );
  const fxStatus = !lastFetched ? '為替レート未取得'
    : fxStale ? `為替: ${timeAgo(lastFetched)}・更新を推奨`
    : `為替: ${timeAgo(lastFetched)}`;

  let filtered = active;
  if (homeState.segment === 'monthly') filtered = active.filter(s => s.billingCycle === 'monthly');
  if (homeState.segment === 'yearly')  filtered = active.filter(s => s.billingCycle === 'yearly');

  // Hero figures follow the active segment
  const heroMonthly = totalMonthly(filtered, rates, defaultCurrency);
  const heroCount   = filtered.length;
  const heroLabel   = homeState.segment === 'monthly' ? '今月の月額サブスク支払い'
    : homeState.segment === 'yearly' ? '年額サブスクの月額換算'
    : '今月のサブスク合計支払い';

  const sorted = [...filtered].sort((a, b) => {
    if (homeState.sort === 'billing')   return daysUntilNext(a) - daysUntilNext(b);
    if (homeState.sort === 'expensive') return monthlyEquiv(b, rates, defaultCurrency) - monthlyEquiv(a, rates, defaultCurrency);
    if (homeState.sort === 'cheap')     return monthlyEquiv(a, rates, defaultCurrency) - monthlyEquiv(b, rates, defaultCurrency);
    if (homeState.sort === 'name')      return a.name.localeCompare(b.name, 'ja');
    if (homeState.sort === 'custom')    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    return 0;
  });

  const seg = (key, label, n) =>
    `<button class="segment-btn ${homeState.segment === key ? 'active' : ''}" data-seg="${key}">${escHtml(label)} <span class="segment-badge">${n}</span></button>`;

  const chip = (key, label) =>
    `<button class="chip ${homeState.sort === key ? 'active' : ''}" data-sort="${key}">${escHtml(label)}</button>`;

  const listHtml = sorted.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📦</div><p class="empty-title">サブスクがありません</p><p class="empty-desc">「＋」ボタンから追加してください</p></div>`
    : sorted.map(s => renderSubItem(s, rates, defaultCurrency, showBillingProgress, showMonthlyConversion, categories)
        + (homeState.sort === 'custom' ? `<div class="custom-sort-btns" data-sid="${s.id}" style="display:flex;gap:4px;padding:2px 0 8px 56px">
            <button class="btn btn-secondary btn-sm" data-move="up" style="width:36px;padding:4px">↑</button>
            <button class="btn btn-secondary btn-sm" data-move="down" style="width:36px;padding:4px">↓</button>
          </div>` : '')).join('');

  const html = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">メイン</h1>
        ${hasForeign ? `
        <button id="refresh-rates" class="fx-refresh ${fxStale ? 'is-stale' : ''}" aria-label="為替レートを更新">
          <span class="fx-refresh-icon">↻</span>
          <span class="fx-refresh-text">${escHtml(fxStatus)}</span>
        </button>` : ''}
      </div>

      <div class="hero-card">
        <div class="hero-label">${heroLabel}</div>
        <div class="hero-amount font-num">${fmtMonthly(heroMonthly, defaultCurrency)}</div>
        <div class="hero-sub">
          <span>年間換算 ${fmtMonthly(heroMonthly * 12, defaultCurrency)}</span>
          <span>契約数 ${heroCount}件</span>
        </div>
      </div>

      <div class="segment mt-12" id="seg-ctrl">
        ${seg('all', 'すべて', allCnt)}
        ${seg('monthly', '月額', moCnt)}
        ${seg('yearly', '年額', yrCnt)}
      </div>

      <div class="chips mt-12" id="sort-chips">
        ${chip('billing', '請求日')}
        ${chip('expensive', '高い順')}
        ${chip('cheap', '安い順')}
        ${chip('name', '名前順')}
        ${chip('custom', 'カスタム')}
      </div>

      <div class="mt-12" id="sub-list">${listHtml}</div>
    </div>`;

  return {
    html,
    afterRender() {
      // Segment
      document.getElementById('seg-ctrl').addEventListener('click', e => {
        const btn = e.target.closest('[data-seg]');
        if (!btn) return;
        homeState.segment = btn.dataset.seg;
        go('#/');
      });
      // Sort chips
      document.getElementById('sort-chips').addEventListener('click', e => {
        const btn = e.target.closest('[data-sort]');
        if (!btn) return;
        homeState.sort = btn.dataset.sort;
        go('#/');
      });
      // Sub item click
      document.getElementById('sub-list').addEventListener('click', e => {
        const item = e.target.closest('[data-sub-id]');
        if (!item) return;
        // Don't navigate if custom sort button was clicked
        if (e.target.closest('.custom-sort-btns')) return;
        location.hash = `#/sub/${item.dataset.subId}`;
      });
      // Custom sort buttons
      document.querySelectorAll('.custom-sort-btns').forEach(wrap => {
        wrap.addEventListener('click', e => {
          const btn = e.target.closest('[data-move]');
          if (!btn) return;
          const dir = btn.dataset.move;
          const sid = wrap.dataset.sid;
          const state = getState();
          const subs = state.subscriptions.filter(s => s.status === 'active')
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const idx = subs.findIndex(s => s.id === sid);
          const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= subs.length) return;
          const tmp = subs[idx].sortOrder;
          updateSubscription(subs[idx].id, { sortOrder: subs[swapIdx].sortOrder });
          updateSubscription(subs[swapIdx].id, { sortOrder: tmp });
          go('#/');
        });
      });
      // Refresh rates (only present when there are foreign-currency subs)
      document.getElementById('refresh-rates')?.addEventListener('click', async () => {
        showToast('為替レートを取得中…');
        try {
          const fresh = await fetchRates();
          saveRates(fresh);
          showToast('為替レートを更新しました');
          go('#/');
        } catch (e) {
          showToast(e.message || '取得失敗。前回値を使用します');
        }
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// CALENDAR
// ═══════════════════════════════════════════════════════════
function renderCalendar() {
  const state = getState();
  const { subscriptions, exchangeRates: rates, settings } = state;
  const { defaultCurrency } = settings;
  const active = subscriptions.filter(s => s.status === 'active');
  const { year, month } = calState;

  const todayD    = dayjs();
  const todayStr_ = todayD.format('YYYY-MM-DD');
  const firstDay  = dayjs(new Date(year, month - 1, 1));
  const daysInMo  = firstDay.daysInMonth();
  const startDow  = firstDay.day(); // 0=Sun

  // Build day → subs map
  const dayMap = {};
  for (const sub of active) {
    for (const d of getBillingOccurrences(sub, year, month)) {
      dayMap[d] = dayMap[d] ?? [];
      dayMap[d].push(sub);
    }
  }

  // Calendar grid cells
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ num: null, date: null });
  for (let d = 1; d <= daysInMo; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ num: d, date, dow: (startDow + d - 1) % 7 });
  }

  const gridHtml = cells.map(c => {
    if (!c.num) return '<div class="cal-cell other-month"><div class="cal-day-num"></div></div>';
    const isToday = c.date === todayStr_;
    const isSun = c.dow === 0, isSat = c.dow === 6;
    const subs = dayMap[c.date] ?? [];
    const icons = subs.slice(0, 3).map(s => `<span class="cal-ev-icon">${escHtml(s.icon) || '📦'}</span>`).join('');
    return `
      <div class="cal-cell${isToday ? ' today' : ''}${isSun ? ' is-sun' : ''}${isSat ? ' is-sat' : ''}" data-date="${c.date}">
        <div class="cal-day-num">${c.num}</div>
        <div class="cal-cell-icons">${icons}</div>
      </div>`;
  }).join('');

  // Monthly total & billing list
  const monthTotal = calendarMonthTotal(active, year, month, rates, defaultCurrency);
  const billingList = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, subs]) => subs.map(sub => {
      return `
        <div class="sub-item" data-sub-id="${sub.id}" style="padding:10px 0">
          <div class="sub-icon" style="background:${sub.color ? sub.color + '22' : 'var(--card)'}">${escHtml(sub.icon) || '📦'}</div>
          <div class="sub-body">
            <div class="sub-name">${escHtml(sub.name)}</div>
            <div class="sub-meta">${fmtDateShort(date)}</div>
          </div>
          <div class="sub-right">
            <div class="sub-amount">${fmtAmount(sub.amount, sub.currency)}</div>
          </div>
          ${CHEVRON_SVG}
        </div>`;
    }).join('')).join('');

  const html = `
    <div class="page">
      <div class="cal-nav">
        <button class="cal-nav-btn" id="cal-prev">‹</button>
        <span class="cal-title">${year}年${month}月</span>
        <button class="cal-nav-btn" id="cal-next">›</button>
      </div>
      <div class="cal-weekdays">
        <span class="wd-sun">日</span><span>月</span><span>火</span><span>水</span>
        <span>木</span><span>金</span><span class="wd-sat">土</span>
      </div>
      <div class="cal-grid">${gridHtml}</div>

      <div class="card mt-16">
        <div class="row-between mb-8">
          <span class="font-semibold">${month}月の支払い予定（${Object.values(dayMap).flat().length}件）</span>
          <span class="font-bold font-num">${fmtMonthly(monthTotal, defaultCurrency)}</span>
        </div>
        ${billingList || '<p class="text-sub text-sm">この月に請求はありません</p>'}
      </div>
    </div>`;

  return {
    html,
    afterRender() {
      document.getElementById('cal-prev').addEventListener('click', () => {
        if (calState.month === 1) { calState.year--; calState.month = 12; }
        else calState.month--;
        go('#/calendar');
      });
      document.getElementById('cal-next').addEventListener('click', () => {
        if (calState.month === 12) { calState.year++; calState.month = 1; }
        else calState.month++;
        go('#/calendar');
      });
      document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
          const subs = dayMap[cell.dataset.date];
          if (subs?.length) {
            const listEl = document.querySelector('.card .sub-item');
            listEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
      document.querySelectorAll('[data-sub-id]').forEach(el => {
        el.addEventListener('click', () => { location.hash = `#/sub/${el.dataset.subId}`; });
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════
function renderAnalytics() {
  const state = getState();
  const { subscriptions, exchangeRates: rates, settings, monthlySnapshots, categories } = state;
  const { defaultCurrency } = settings;

  const monthly  = totalMonthly(subscriptions, rates, defaultCurrency);
  const today    = new Date();
  const daysInMo = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const ym       = currentYearMonth();
  const prevYm   = prevYearMonth(ym);
  const prevSnap = monthlySnapshots.find(s => s.yearMonth === prevYm);
  const prevMo   = prevSnap?.normalizedMonthlyTotal ?? 0;
  const diff     = monthly - prevMo;
  const diffPct  = prevMo > 0 ? diff / prevMo * 100 : 0;
  const active   = subscriptions.filter(s => s.status === 'active');
  const top3     = topCosts(subscriptions, rates, defaultCurrency, 3);

  const diffClass = diff >= 0 ? 'text-up' : 'text-down';
  const diffSign  = diff >= 0 ? '▲' : '▼';

  // Top cost list
  const topHtml = top3.length === 0
    ? '<p class="text-sub text-sm">データがありません</p>'
    : top3.map((s, i) => `
        <div class="rank-item" data-sub-id="${s.id}">
          <div class="rank-num">${i + 1}</div>
          <div class="sub-icon" style="background:${s.color ? s.color + '22' : 'var(--card)'};min-width:36px;height:36px;font-size:18px;">${escHtml(s.icon) || '📦'}</div>
          <div class="rank-info">
            <div class="rank-name">${escHtml(s.name)}</div>
            <div class="rank-cycle">${fmtAmount(s.amount, s.currency)}${fmtCycle(s.billingCycle, s.customIntervalDays)}</div>
          </div>
          <div class="rank-amount">${fmtMonthly(s._monthly, defaultCurrency)}<span class="text-sub text-xs">/月</span></div>
        </div>`).join('');

  const periodBtn = (n) =>
    `<button class="chip ${analyticsState.period === n ? 'active' : ''}" data-period="${n}">${n}ヶ月</button>`;

  // Category data
  const catData = {};
  for (const sub of active) {
    const cat = categories.find(c => c.id === sub.categoryId);
    const key = cat?.name ?? 'その他';
    catData[key] = (catData[key] ?? 0) + monthlyEquiv(sub, rates, defaultCurrency);
  }

  const html = `
    <div class="page">
      <div class="page-header"><h1 class="page-title">分析</h1></div>

      <div class="analytics-top-card">
        <div class="analytics-total-label">今月の支出合計（月額換算）</div>
        <div class="analytics-total font-num">${fmtMonthly(monthly, defaultCurrency)}</div>
        ${prevMo > 0
          ? `<div class="analytics-diff ${diffClass}">${diffSign} ${fmtDiff(diff, defaultCurrency)} (${fmtPct(diffPct)}) <span class="text-sub" style="font-weight:400">前月比</span></div>`
          : `<div class="analytics-diff text-sub" style="font-size:12px">前月の比較データがまだありません</div>`}
        <div class="analytics-meta">
          <span>年間換算 ${fmtMonthly(monthly * 12, defaultCurrency)}</span>
          <span>1日あたり ${fmtMonthly(monthly / daysInMo, defaultCurrency)}</span>
          <span>契約数 ${active.length}件</span>
        </div>
      </div>

      ${top3.length > 0 ? `
      <div class="card mt-12">
        <div class="font-semibold mb-8">コストが高いサブスク</div>
        ${topHtml}
      </div>` : ''}

      <div class="card mt-12">
        <div class="row-between mb-8">
          <span class="font-semibold">支出の推移</span>
          <div class="chart-toggle">
            ${periodBtn(6)}${periodBtn(12)}${periodBtn(24)}
          </div>
        </div>
        <div class="chart-container"><canvas id="trend-chart"></canvas></div>
      </div>

      <div class="card mt-12">
        <div class="font-semibold mb-8">カテゴリ別内訳</div>
        <div class="chart-container" style="height:180px"><canvas id="cat-chart"></canvas></div>
      </div>
    </div>`;

  return {
    html,
    afterRender() {
      // Period toggle
      document.querySelectorAll('[data-period]').forEach(btn => {
        btn.addEventListener('click', () => {
          analyticsState.period = Number(btn.dataset.period);
          go('#/analytics');
        });
      });
      // Top cost click
      document.querySelectorAll('[data-sub-id]').forEach(el => {
        el.addEventListener('click', () => { location.hash = `#/sub/${el.dataset.subId}`; });
      });

      // ── Trend Chart ──
      destroyChart('trend');
      const trendCtx = document.getElementById('trend-chart')?.getContext('2d');
      if (trendCtx) {
        const n = analyticsState.period;
        const labels = [], values = [];
        for (let i = n - 1; i >= 0; i--) {
          const d = dayjs().subtract(i, 'month');
          const ym2 = d.format('YYYY-MM');
          labels.push(`${d.month() + 1}月`);
          const snap = monthlySnapshots.find(s => s.yearMonth === ym2);
          values.push(snap ? Math.round(snap.normalizedMonthlyTotal) : (i === 0 ? Math.round(monthly) : 0));
        }
        _charts['trend'] = new Chart(trendCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              data: values,
              backgroundColor: 'rgba(59,130,246,0.7)',
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                ticks: { callback: v => `¥${v.toLocaleString()}` },
                grid: { color: 'rgba(128,128,128,0.1)' },
              },
              x: { grid: { display: false } },
            },
          },
        });
      }

      // ── Category Chart ──
      destroyChart('cat');
      const catCtx = document.getElementById('cat-chart')?.getContext('2d');
      if (catCtx && Object.keys(catData).length > 0) {
        const catLabels = Object.keys(catData);
        const catValues = catLabels.map(k => Math.round(catData[k]));
        // Prefer each category's own color; fall back to a palette so the
        // doughnut stays distinct even with many categories.
        const palette = ['#E5484D','#3B82F6','#EC4899','#F97316','#10B981','#8B5CF6',
          '#6366F1','#F59E0B','#16A34A','#D946EF','#FBBF24','#06B6D4','#9A9A9A'];
        const catColors = catLabels.map((name, i) => {
          const cat = categories.find(c => c.name === name);
          return cat?.color ?? palette[i % palette.length];
        });
        _charts['cat'] = new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: catLabels,
            datasets: [{
              data: catValues,
              backgroundColor: catColors.slice(0, catLabels.length),
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } },
            },
          },
        });
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════
// DIAGNOSIS
// ═══════════════════════════════════════════════════════════
function renderDiagnosis() {
  const state = getState();
  const diagHistory = state.diagnosisHistory;
  const activeSubs = state.subscriptions.filter(s => s.status === 'active');

  // ── Result phase ──
  if (diagState.phase === 'result') {
    const baseResult = runDiagnosis(state);
    // Augment with quiz answers: flag subs user said they don't use
    const extraIssues = diagState.answers
      .filter(a => a.freq === 'none')
      .filter(a => !baseResult.issues.some(i => i.type === 'unused' && i.sub?.id === a.subId))
      .map(a => {
        const sub = state.subscriptions.find(s => s.id === a.subId);
        return sub ? {
          type: 'unused', severity: 'danger',
          title: `未使用: ${sub.name}`,
          desc: '先月ほとんど使っていないと回答しました',
          suggest: '利用していない場合は解約を検討しましょう',
          sub,
        } : null;
      }).filter(Boolean);

    const finalResult = {
      ...baseResult,
      score: Math.max(0, baseResult.score - extraIssues.length * 8),
      issues: [...baseResult.issues, ...extraIssues],
    };
    // Save once per completed quiz run — re-rendering the result
    // (back/forward, refresh) must not duplicate history entries.
    if (!diagState.saved) {
      saveDiagnosis(finalResult);
      diagState.saved = true;
    }

    const { score, issues } = finalResult;
    const rr = 54, circ = 2 * Math.PI * rr;
    const filled = (score / 100) * circ;
    const scoreColor = score >= 80 ? '#16A34A' : score >= 60 ? '#F59E0B' : '#E5484D';
    const scoreLabel = score >= 80 ? '優秀' : score >= 60 ? '普通' : '要改善';

    const issueHtml = issues.length === 0
      ? '<p class="text-sub text-sm text-center mt-16">問題は見つかりませんでした 🎉</p>'
      : issues.map(i => `
          <div class="diag-item">
            <div class="diag-item-title">${escHtml(i.title)}</div>
            <div class="diag-item-desc">${escHtml(i.desc)}</div>
            <div class="diag-item-suggest">💡 ${escHtml(i.suggest)}</div>
          </div>`).join('');

    const html = `
      <div class="page">
        <div class="page-header">
          <h1 class="page-title">診断結果</h1>
          <button class="btn-ghost text-sub" id="restart-diag" style="font-size:13px">再診断</button>
        </div>
        <div class="card">
          <div class="score-ring-wrap">
            <div class="score-ring">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle class="score-ring-bg" cx="60" cy="60" r="${rr}"/>
                <circle class="score-ring-fill" cx="60" cy="60" r="${rr}"
                  stroke="${scoreColor}"
                  stroke-dasharray="${filled.toFixed(2)} ${circ.toFixed(2)}"
                  stroke-dashoffset="0"/>
              </svg>
              <div class="score-text">
                <span class="score-num" style="color:${scoreColor}">${score}</span>
                <span class="score-label">${scoreLabel}</span>
              </div>
            </div>
            <div class="text-sub text-sm">${issues.length}件の指摘</div>
          </div>
          ${issueHtml}
        </div>
      </div>`;

    return {
      html,
      afterRender() {
        document.getElementById('restart-diag').addEventListener('click', () => {
          diagState = { phase: 'start', index: 0, answers: [], saved: false };
          go('#/diagnosis');
        });
      },
    };
  }

  // ── Quiz phase ──
  if (diagState.phase === 'quiz' && activeSubs.length > 0) {
    const idx = diagState.index;
    const total = activeSubs.length;
    const sub = activeSubs[idx];

    const html = `
      <div class="diag-quiz-outer">
        <div class="diag-quiz-header">
          <div class="row-between">
            <span class="font-semibold" style="font-size:17px">サブスク診断</span>
            <span class="text-sub text-sm" id="quiz-counter">${idx + 1} / ${total}</span>
          </div>
          <div class="diag-quiz-progress">
            <div class="diag-quiz-progress-fill" id="quiz-progress-fill" style="width:${Math.round(idx / total * 100)}%"></div>
          </div>
        </div>

        <div class="quiz-card-area">
          <div class="quiz-card-bg"></div>
          <div class="quiz-card" id="quiz-card">
            <div class="quiz-card-icon" style="background:${sub.color ? sub.color + '22' : 'var(--card)'}">${escHtml(sub.icon) || '📦'}</div>
            <div class="quiz-card-name">${escHtml(sub.name)}</div>
            <div class="quiz-card-price">${fmtAmount(sub.amount, sub.currency)}${fmtCycle(sub.billingCycle, sub.customIntervalDays)}</div>
            <div class="quiz-card-question">先月どのくらい使った？</div>
          </div>
        </div>

        <div class="quiz-btns">
          <button class="quiz-btn quiz-btn-none" data-freq="none">
            <span class="quiz-btn-emoji">👎</span>使ってない
          </button>
          <button class="quiz-btn quiz-btn-sometimes" data-freq="sometimes">
            <span class="quiz-btn-emoji">🤔</span>まあまあ
          </button>
          <button class="quiz-btn quiz-btn-often" data-freq="often">
            <span class="quiz-btn-emoji">👍</span>よく使った
          </button>
        </div>
      </div>`;

    return {
      html,
      afterRender() {
        document.querySelectorAll('.quiz-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.querySelectorAll('.quiz-btn').forEach(b => { b.disabled = true; });

            const freq = btn.dataset.freq;
            diagState.answers.push({ subId: activeSubs[diagState.index].id, freq });

            const card = document.getElementById('quiz-card');
            if (!card) return;

            // Slide current card out to left
            card.style.transform = 'translateX(-120%)';
            card.style.opacity = '0';

            setTimeout(() => {
              const nextIdx = diagState.index + 1;
              if (nextIdx >= activeSubs.length) {
                diagState.phase = 'result';
                go('#/diagnosis');
                return;
              }

              diagState.index = nextIdx;
              const nextSub = activeSubs[nextIdx];

              // Update card content
              const iconEl = card.querySelector('.quiz-card-icon');
              iconEl.style.background = nextSub.color ? nextSub.color + '22' : 'var(--card)';
              iconEl.textContent = nextSub.icon || '📦';
              card.querySelector('.quiz-card-name').textContent = nextSub.name;
              card.querySelector('.quiz-card-price').textContent =
                `${fmtAmount(nextSub.amount, nextSub.currency)}${fmtCycle(nextSub.billingCycle, nextSub.customIntervalDays)}`;

              // Update counter and progress bar
              const counter = document.getElementById('quiz-counter');
              if (counter) counter.textContent = `${nextIdx + 1} / ${activeSubs.length}`;
              const fill = document.getElementById('quiz-progress-fill');
              if (fill) fill.style.width = `${Math.round(nextIdx / activeSubs.length * 100)}%`;

              // Instantly position off-screen right (no transition), then slide in
              card.style.transition = 'none';
              card.style.transform = 'translateX(120%)';
              card.style.opacity = '0';
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  card.style.transition = '';
                  card.style.transform = '';
                  card.style.opacity = '';
                  document.querySelectorAll('.quiz-btn').forEach(b => { b.disabled = false; });
                });
              });
            }, 260);
          });
        });
      },
    };
  }

  // ── Start phase ──
  const histHtml = diagHistory.length === 0 ? '' : `
    <div class="card mt-16">
      <div class="font-semibold mb-8">過去の診断履歴</div>
      ${diagHistory.slice(0, 5).map(h => {
        const r = JSON.parse(h.resultJson ?? '{}');
        const d = new Date(h.runAt);
        return `
          <div class="diag-item" style="border-bottom:1px solid var(--border)">
            <div class="row-between">
              <span class="font-semibold">${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}</span>
              <span class="font-bold" style="font-size:20px">${h.score}点</span>
            </div>
            <div class="text-sub text-sm mt-4">${r.issues?.length ?? 0}件の指摘</div>
          </div>`;
      }).join('')}
    </div>`;

  const html = `
    <div class="page">
      <div class="page-header"><h1 class="page-title">診断</h1></div>
      <div class="card text-center" style="padding:24px 16px">
        <div style="font-size:52px;margin-bottom:12px">🛡️</div>
        <div class="font-semibold" style="font-size:17px">サブスク健康診断</div>
        <p class="text-sub text-sm mt-8">登録中のサブスク${activeSubs.length}件を1件ずつ確認して<br>スコアを算出します。</p>
        <button class="btn btn-primary mt-16" id="start-diag"
          ${activeSubs.length > 0 ? '' : 'disabled'}
          style="${activeSubs.length > 0 ? '' : 'opacity:.4'}">
          診断を開始する（${activeSubs.length}件）
        </button>
      </div>
      ${histHtml}
    </div>`;

  return {
    html,
    afterRender() {
      document.getElementById('start-diag')?.addEventListener('click', () => {
        diagState = { phase: 'quiz', index: 0, answers: [], saved: false };
        go('#/diagnosis');
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
function toggle(id, checked) {
  return `<label class="toggle" for="${id}">
    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
    <span class="toggle-track"></span>
    <span class="toggle-thumb"></span>
  </label>`;
}

function renderSettings() {
  const state   = getState();
  const { settings, paymentMethods, subscriptions } = state;
  const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length;
  const timingChips = [0, 1, 3, 5, 7].map(n =>
    `<button class="chip ${settings.notifyTimingDays.includes(n) ? 'active' : ''}" data-timing="${n}">
      ${n === 0 ? '当日' : `${n}日前`}
    </button>`).join('');

  const currencyOpts = CURRENCIES.map(c =>
    `<option value="${c.code}" ${settings.defaultCurrency === c.code ? 'selected' : ''}>${c.code} — ${c.name}</option>`
  ).join('');

  const pmOpts = paymentMethods.map(p =>
    `<div class="settings-row"><span class="settings-row-icon">${escHtml(p.icon) || '💳'}</span>
      <span class="settings-row-label">${escHtml(p.name)}</span>
      <button class="btn-ghost text-sub" data-delete-pm="${p.id}">削除</button>
    </div>`).join('');

  const themeOpts = ['auto', 'light', 'dark'];
  const themeLabels = { auto: '自動', light: 'ライト', dark: 'ダーク' };

  const html = `
    <div class="page">
      <div class="page-header"><h1 class="page-title">設定</h1></div>

      <div class="settings-section">
        <div class="settings-section-title">外観</div>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">🎨</span>
            <span class="settings-row-label">テーマ</span>
            <select class="form-select" id="set-theme" style="width:auto;padding:6px 30px 6px 10px;font-size:13px">
              ${themeOpts.map(v => `<option value="${v}" ${settings.theme === v ? 'selected' : ''}>${themeLabels[v]}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">表示</div>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">📊</span>
            <span class="settings-row-label">請求日プログレスバー</span>
            ${toggle('set-progress', settings.showBillingProgress)}
          </div>
          <div class="settings-row">
            <span class="settings-row-icon">¥</span>
            <span class="settings-row-label">月額換算（円）を表示</span>
            ${toggle('set-monthly', settings.showMonthlyConversion)}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">通知</div>
        <p class="text-sub text-xs mb-8" style="padding:0 4px">ブラウザの仕様上、アプリを開いた時にお知らせします</p>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">🔔</span>
            <span class="settings-row-label">通知</span>
            ${toggle('set-notify', settings.notifyEnabled)}
          </div>
          <div class="settings-row" style="flex-wrap:wrap;gap:8px">
            <span class="settings-row-label" style="width:100%">通知タイミング</span>
            <div class="chips" id="timing-chips">${timingChips}</div>
          </div>
          <div class="settings-row">
            <span class="settings-row-label">通知時刻（参考）</span>
            <input type="time" id="set-notify-time" value="${settings.notifyTime ?? '09:00'}"
              style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:4px 8px;font-size:13px;color:var(--text)">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">通貨</div>
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">💱</span>
            <span class="settings-row-label">デフォルト通貨</span>
            <select class="form-select" id="set-currency" style="width:auto;padding:6px 30px 6px 10px;font-size:13px">${currencyOpts}</select>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">支払い方法</div>
        <div class="settings-list">
          ${pmOpts}
          <div class="settings-row clickable" id="add-pm-row">
            <span class="settings-row-icon">➕</span>
            <span class="settings-row-label">支払い方法を追加</span>
            ${CHEVRON_SVG}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">サブスク管理</div>
        <div class="settings-list">
          <div class="settings-row clickable" id="go-cancelled">
            <span class="settings-row-icon">🗂️</span>
            <span class="settings-row-label">解約済みサブスク</span>
            <span class="settings-row-value">${cancelledCount}件</span>
            ${CHEVRON_SVG}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">データ</div>
        <div class="settings-list">
          <div class="settings-row clickable" id="btn-export">
            <span class="settings-row-icon">📤</span>
            <span class="settings-row-label">JSONエクスポート</span>
            ${CHEVRON_SVG}
          </div>
          <div class="settings-row clickable" id="btn-import">
            <span class="settings-row-icon">📥</span>
            <span class="settings-row-label">JSONインポート</span>
            ${CHEVRON_SVG}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">アプリ情報</div>
        <div class="settings-list">
          <div class="settings-row"><span class="settings-row-icon">ℹ️</span><span class="settings-row-label">バージョン</span><span class="settings-row-value">1.0.0</span></div>
          <div class="settings-row"><span class="settings-row-icon">📱</span><span class="settings-row-label">アプリ名</span><span class="settings-row-value">SubscBox</span></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">危険な操作</div>
        <div class="settings-list">
          <div class="settings-row clickable" id="btn-clear-data">
            <span class="settings-row-icon">🗑️</span>
            <span class="settings-row-label" style="color:var(--up)">すべてのデータを削除</span>
            ${CHEVRON_SVG}
          </div>
        </div>
      </div>

      <p class="text-sub text-xs text-center mt-16" style="padding-bottom:8px">SubscBox v1.0.0 — データは端末内に保存されます</p>
    </div>`;

  return {
    html,
    afterRender() {
      // Theme
      document.getElementById('set-theme').addEventListener('change', e => {
        const theme = e.target.value;
        updateSettings({ theme });
        document.documentElement.dataset.theme = theme;
      });
      // Toggles
      document.getElementById('set-progress').addEventListener('change', e =>
        updateSettings({ showBillingProgress: e.target.checked }));
      document.getElementById('set-monthly').addEventListener('change', e =>
        updateSettings({ showMonthlyConversion: e.target.checked }));
      document.getElementById('set-notify').addEventListener('change', e =>
        updateSettings({ notifyEnabled: e.target.checked }));
      // Notify time
      document.getElementById('set-notify-time').addEventListener('change', e =>
        updateSettings({ notifyTime: e.target.value }));
      // Currency
      document.getElementById('set-currency').addEventListener('change', e =>
        updateSettings({ defaultCurrency: e.target.value }));
      // Timing chips
      document.getElementById('timing-chips').addEventListener('click', e => {
        const btn = e.target.closest('[data-timing]');
        if (!btn) return;
        const n = Number(btn.dataset.timing);
        const cur = [...(getState().settings.notifyTimingDays ?? [])];
        const idx = cur.indexOf(n);
        if (idx >= 0) cur.splice(idx, 1); else cur.push(n);
        updateSettings({ notifyTimingDays: cur.sort((a, b) => a - b) });
        btn.classList.toggle('active', !btn.classList.contains('active'));
      });
      // Delete payment methods
      document.querySelectorAll('[data-delete-pm]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.deletePm;
          showConfirm({
            title: '支払い方法を削除',
            body: 'この支払い方法を削除しますか？',
            confirmLabel: '削除',
            onConfirm: () => { deletePaymentMethod(id); go('#/settings'); },
          });
        });
      });
      // Add payment method
      document.getElementById('add-pm-row').addEventListener('click', () => {
        showAddPaymentMethod();
      });
      // Go to cancelled
      document.getElementById('go-cancelled').addEventListener('click', () => {
        location.hash = '#/cancelled';
      });
      // Export
      document.getElementById('btn-export').addEventListener('click', () => {
        exportJSON();
        showToast('エクスポートしました');
      });
      // Import
      document.getElementById('btn-import').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file) return;
          let parsed;
          try {
            parsed = JSON.parse(await file.text());
          } catch {
            showToast('JSONの読み込みに失敗しました');
            return;
          }
          const check = validateImport(parsed);
          if (!check.ok) {
            showToast(check.error);
            return;
          }
          const subCount = parsed.subscriptions.length;
          const activeCount = parsed.subscriptions.filter(s => s.status === 'active').length;
          showConfirm({
            title: 'データをインポート',
            body: `サブスク${subCount}件（有効${activeCount}件）のデータが含まれています。現在のすべてのデータが上書きされます。続けますか？`,
            confirmLabel: 'インポートする',
            danger: false,
            onConfirm: () => {
              importData(parsed);
              showToast('インポートしました');
              setTimeout(() => location.reload(), 800);
            },
          });
        });
        input.click();
      });
      // Clear all data
      document.getElementById('btn-clear-data').addEventListener('click', () => {
        showConfirm({
          title: 'すべてのデータを削除',
          body: 'サブスク・設定・履歴など、アプリのすべてのデータが完全に削除されます。この操作は取り消せません。本当によろしいですか？',
          confirmLabel: '削除する',
          danger: true,
          onConfirm: () => {
            clearData();
            showToast('データを削除しました');
            setTimeout(() => location.reload(), 800);
          },
        });
      });
    },
  };
}

function showAddPaymentMethod() {
  const el = document.createElement('div');
  el.className = 'dialog-overlay';
  el.innerHTML = `
    <div class="dialog-sheet">
      <div class="dialog-title">支払い方法を追加</div>
      <div class="form-group">
        <label class="form-label">名前（例: メインカード、楽天カード）</label>
        <input type="text" class="form-input" id="pm-name" placeholder="カード名">
      </div>
      <div class="form-group">
        <label class="form-label">種類</label>
        <select class="form-select" id="pm-type">
          <option value="credit">クレジットカード</option>
          <option value="debit">デビットカード</option>
          <option value="bank">銀行口座</option>
          <option value="other">その他</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">メンバー / 名義</label>
        <input type="text" class="form-input" id="pm-member" placeholder="自分 / 家族名など">
      </div>
      <div class="dialog-actions">
        <button class="btn btn-primary" id="pm-save">追加</button>
        <button class="btn btn-secondary" id="pm-cancel">キャンセル</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#pm-save').addEventListener('click', () => {
    const name = el.querySelector('#pm-name').value.trim();
    if (!name) { showToast('名前を入力してください'); return; }
    addPaymentMethod({
      name,
      type: el.querySelector('#pm-type').value,
      member: el.querySelector('#pm-member').value.trim(),
      icon: '💳', color: '#9A9A9A',
    });
    el.remove();
    go('#/settings');
    showToast('追加しました');
  });
  el.querySelector('#pm-cancel').addEventListener('click', () => el.remove());
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// ═══════════════════════════════════════════════════════════
// SUB FORM (ADD / EDIT)
// ═══════════════════════════════════════════════════════════
function renderSubForm(id) {
  const state = getState();
  const { categories, paymentMethods, settings } = state;
  const existing = id ? state.subscriptions.find(s => s.id === id) : null;
  // A duplicate is a "new" form (no id) seeded with another sub's values
  const dup = (!id && pendingDuplicate) ? pendingDuplicate : null;
  pendingDuplicate = null;
  const s = existing ?? dup ?? {
    name: '', icon: '📦', color: '#3B82F6',
    amount: '', currency: settings.defaultCurrency ?? 'JPY',
    billingCycle: 'monthly', customIntervalDays: 30,
    firstBillingDate: todayStr(), categoryId: 'cat-other',
    paymentMethodId: null, memo: '', url: '',
  };

  const iconHtml = ICON_PRESETS.map(ic =>
    `<button class="emoji-option ${s.icon === ic ? 'selected' : ''}" data-icon="${ic}">${ic}</button>`
  ).join('');

  const catOpts = categories.map(c =>
    `<option value="${c.id}" ${s.categoryId === c.id ? 'selected' : ''}>${c.icon} ${escHtml(c.name)}</option>`
  ).join('');

  const pmOpts = `<option value="">なし</option>` + paymentMethods.map(p =>
    `<option value="${p.id}" ${s.paymentMethodId === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');

  const currOpts = CURRENCIES.map(c =>
    `<option value="${c.code}" ${s.currency === c.code ? 'selected' : ''}>${c.code}</option>`
  ).join('');

  const html = `
    <div>
      <div class="subpage-header">
        <button class="back-btn" id="back-btn">${BACK_SVG}戻る</button>
        <span class="subpage-title">${id ? '編集' : '追加'}</span>
        <span></span>
      </div>
      <div class="form-body">

        <div class="form-group">
          <label class="form-label">サービス名 <span style="color:var(--up)">*</span></label>
          <input type="text" id="f-name" class="form-input" placeholder="例: Netflix" value="${escHtml(s.name)}" maxlength="40">
        </div>

        <div class="form-group">
          <label class="form-label">アイコン</label>
          <div class="emoji-picker-row" id="icon-picker">${iconHtml}</div>
        </div>

        <div class="form-group">
          <label class="form-label">金額 <span style="color:var(--up)">*</span></label>
          <div class="row" style="gap:8px">
            <select class="form-select" id="f-currency" style="width:90px;flex-shrink:0">${currOpts}</select>
            <input type="number" id="f-amount" class="form-input" placeholder="0" value="${s.amount}"
              min="0" step="any" style="flex:1">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">課金周期</label>
          <div class="segment" id="f-cycle-seg">
            <button class="segment-btn ${s.billingCycle === 'monthly' ? 'active' : ''}" data-cycle="monthly">月額</button>
            <button class="segment-btn ${s.billingCycle === 'yearly' ? 'active' : ''}" data-cycle="yearly">年額</button>
            <button class="segment-btn ${s.billingCycle === 'custom' ? 'active' : ''}" data-cycle="custom">カスタム</button>
          </div>
          <div id="f-custom-wrap" class="${s.billingCycle === 'custom' ? '' : 'hidden'}" style="margin-top:8px">
            <input type="number" id="f-custom-days" class="form-input" placeholder="日数"
              value="${s.customIntervalDays ?? 30}" min="1" max="3650">
            <div class="form-hint">N日ごとに請求されます</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">初回請求日</label>
          <div class="row" style="gap:8px">
            <input type="date" id="f-date" class="form-input" value="${s.firstBillingDate ?? todayStr()}" style="flex:1">
            <button type="button" class="btn btn-secondary" id="f-date-today" style="width:auto;flex-shrink:0;padding:0 16px">今日</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">カテゴリ</label>
          <select class="form-select" id="f-category">${catOpts}</select>
        </div>

        ${paymentMethods.length > 0 ? `
        <div class="form-group">
          <label class="form-label">支払い方法</label>
          <select class="form-select" id="f-payment">${pmOpts}</select>
        </div>` : ''}

        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea id="f-memo" class="form-input" rows="2" placeholder="メモ（任意）"
            style="resize:vertical">${escHtml(s.memo ?? '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">URL</label>
          <input type="url" id="f-url" class="form-input" placeholder="https://..." value="${escHtml(s.url ?? '')}">
        </div>

        <button class="btn btn-primary mt-16" id="f-save">${id ? '保存' : 'サブスクを追加'}</button>
        ${id ? `
          <button class="btn btn-secondary mt-8" id="f-cancel-sub">解約済みにする</button>
          <button class="btn btn-danger mt-8" id="f-delete">削除</button>
        ` : ''}

      </div>
    </div>`;

  let currentIcon  = s.icon;
  let currentCycle = s.billingCycle;

  return {
    html,
    afterRender() {
      document.getElementById('back-btn').addEventListener('click', () => {
        if (history.length > 1) history.back(); else location.hash = '#/';
      });

      // Icon picker
      document.getElementById('icon-picker').addEventListener('click', e => {
        const btn = e.target.closest('[data-icon]');
        if (!btn) return;
        currentIcon = btn.dataset.icon;
        document.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });

      // "Today" shortcut for the first-billing date
      document.getElementById('f-date-today').addEventListener('click', () => {
        document.getElementById('f-date').value = todayStr();
      });

      // Cycle segment
      document.getElementById('f-cycle-seg').addEventListener('click', e => {
        const btn = e.target.closest('[data-cycle]');
        if (!btn) return;
        currentCycle = btn.dataset.cycle;
        document.querySelectorAll('#f-cycle-seg .segment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('f-custom-wrap').classList.toggle('hidden', currentCycle !== 'custom');
      });

      // Save
      document.getElementById('f-save').addEventListener('click', () => {
        const name = document.getElementById('f-name').value.trim();
        const amountRaw = document.getElementById('f-amount').value;
        const amount = parseFloat(amountRaw);

        if (!name) { showToast('サービス名を入力してください'); return; }
        if (!amountRaw || isNaN(amount) || amount < 0) { showToast('金額を正しく入力してください'); return; }

        const categoryId = document.getElementById('f-category').value;
        // Icon background follows the chosen category's color
        const cat = getState().categories.find(c => c.id === categoryId);

        const fields = {
          name,
          icon: currentIcon,
          color: cat?.color ?? '#9A9A9A',
          amount,
          currency: document.getElementById('f-currency').value,
          billingCycle: currentCycle,
          customIntervalDays: currentCycle === 'custom' ? Number(document.getElementById('f-custom-days').value) : null,
          firstBillingDate: document.getElementById('f-date').value || todayStr(),
          categoryId,
          paymentMethodId: document.getElementById('f-payment')?.value || s.paymentMethodId || null,
          memo: document.getElementById('f-memo').value.trim(),
          url: document.getElementById('f-url').value.trim(),
        };

        if (id) {
          updateSubscription(id, fields);
          showToast('保存しました');
          location.hash = '#/';
        } else {
          addSubscription(fields);
          showToast('追加しました');
          location.hash = '#/';
        }
      });

      // Cancel subscription
      document.getElementById('f-cancel-sub')?.addEventListener('click', () => {
        showConfirm({
          title: '解約済みにする',
          body: `「${getState().subscriptions.find(s => s.id === id)?.name}」を解約済みにしますか？`,
          confirmLabel: '解約済みにする',
          onConfirm: () => { cancelSubscription(id); showToast('解約済みにしました'); location.hash = '#/'; },
        });
      });

      // Delete
      document.getElementById('f-delete')?.addEventListener('click', () => {
        showConfirm({
          title: '削除',
          body: '履歴ごと完全に削除され、復元できません。再開予定なら「解約済み」が便利です。',
          confirmLabel: '削除する',
          onConfirm: () => { deleteSubscription(id); showToast('削除しました'); location.hash = '#/'; },
        });
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// SUB DETAIL
// ═══════════════════════════════════════════════════════════
function renderSubDetail(id) {
  const state = getState();
  const sub = state.subscriptions.find(s => s.id === id);

  if (!sub) {
    return { html: `<div class="page"><div class="subpage-header"><button class="back-btn" id="back-btn">${BACK_SVG}戻る</button><span class="subpage-title">詳細</span><span></span></div><div class="empty-state"><p class="empty-title">見つかりません</p></div></div>`,
      afterRender() { document.getElementById('back-btn')?.addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/'; }); }
    };
  }

  const { exchangeRates: rates, settings, categories } = state;
  const { defaultCurrency } = settings;
  const monthly = monthlyEquiv(sub, rates, defaultCurrency);
  const yearly  = monthly * 12;
  const days    = daysUntilNext(sub);
  const prog    = getBillingProgress(sub);
  const nextD   = nextBillingDate(sub);
  const cat     = categories.find(c => c.id === sub.categoryId);
  const pm      = state.paymentMethods.find(p => p.id === sub.paymentMethodId);

  const cycleLabel = sub.billingCycle === 'monthly' ? '月次'
    : sub.billingCycle === 'yearly' ? '年次'
    : `${sub.customIntervalDays ?? '?'}日ごと`;

  // Elapsed time since contract start + cumulative spend
  const startD     = dayjs(sub.firstBillingDate).startOf('day');
  const elapsedDays = Math.max(0, dayjs().startOf('day').diff(startD, 'day'));
  const elapsedMonths = Math.max(0, dayjs().startOf('day').diff(startD, 'month'));
  const elapsedLabel = elapsedDays < 31
    ? `${elapsedDays}日`
    : elapsedMonths < 12
      ? `${elapsedMonths}ヶ月`
      : `${Math.floor(elapsedMonths / 12)}年${elapsedMonths % 12 > 0 ? (elapsedMonths % 12) + 'ヶ月' : ''}`;
  const billCount  = billingsSoFar(sub);
  const paidTotal  = totalPaidSoFar(sub);

  const hasCancelInfo = sub.url || sub.memo;

  const html = `
    <div>
      <div class="subpage-header">
        <button class="back-btn" id="back-btn">${BACK_SVG}戻る</button>
        <span class="subpage-title">${escHtml(sub.name)}</span>
        <a href="#/sub/${id}/edit" class="subpage-action">編集</a>
      </div>
      <div class="p-16">

        <!-- Icon + category -->
        <div class="text-center mt-8 mb-4">
          <div class="detail-icon" style="background:${sub.color ? sub.color + '22' : 'var(--card)'}">${escHtml(sub.icon) || '📦'}</div>
          <div class="text-sub text-sm mt-4">
            ${cat ? escHtml(cat.name) : '—'}
            ${sub.status === 'cancelled' ? '<span class="detail-status-badge">解約済み</span>' : ''}
          </div>
        </div>

        <!-- Billing amount card -->
        <div class="card mt-12">
          <div class="detail-inforow" style="margin-bottom:4px">
            <span class="text-sub text-sm">請求額</span>
            <span class="text-sub text-sm" style="white-space:nowrap">${fmtDaysLeft(days)}</span>
          </div>
          <div class="detail-amount" style="text-align:left">${fmtAmount(sub.amount, sub.currency)}</div>
          <div class="detail-cycle" style="text-align:left;margin-top:2px">${cycleLabel}</div>
          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr">
            <div>
              <div class="text-sub text-xs">月額換算</div>
              <div class="font-semibold font-num" style="font-size:16px;margin-top:3px">${fmtMonthly(monthly, defaultCurrency)}</div>
            </div>
            <div>
              <div class="text-sub text-xs">年額換算</div>
              <div class="font-semibold font-num" style="font-size:16px;margin-top:3px">${fmtMonthly(yearly, defaultCurrency)}</div>
            </div>
          </div>
        </div>

        <!-- Info card: billing dates + URL + memo + payment -->
        <div class="card mt-12">
          <div class="detail-inforow">
            <span class="text-sub text-sm">次回請求日</span>
            <span class="font-semibold" style="white-space:nowrap">${fmtDate(nextD)}</span>
          </div>
          <div class="progress-bar mt-8">
            <div class="progress-fill" style="width:${Math.round(prog * 100)}%"></div>
          </div>
          <div class="text-sub text-xs mt-4">${fmtDaysLeft(days)}</div>

          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow">
            <span class="text-sub text-sm">契約開始日</span>
            <span class="font-semibold" style="white-space:nowrap">${fmtDate(sub.firstBillingDate)}</span>
          </div>

          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow">
            <span class="text-sub text-sm">利用期間</span>
            <span class="font-semibold" style="white-space:nowrap">${billCount > 0 ? elapsedLabel : 'まだ請求なし'}</span>
          </div>

          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow">
            <span class="text-sub text-sm">これまでの支払額</span>
            <span class="font-semibold font-num" style="white-space:nowrap">${fmtAmount(paidTotal, sub.currency)}<span class="text-sub" style="font-weight:400;font-size:11px"> ・${billCount}回</span></span>
          </div>

          ${sub.url ? `
          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow" style="align-items:flex-start">
            <span class="text-sub text-sm" style="flex-shrink:0">サービスURL</span>
            <a href="${escHtml(sub.url)}" target="_blank" rel="noopener noreferrer"
               style="color:var(--progress);font-size:13px;word-break:break-all;text-align:right">${escHtml(sub.url)}</a>
          </div>` : ''}

          ${sub.memo ? `
          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow" style="align-items:flex-start">
            <span class="text-sub text-sm" style="flex-shrink:0">メモ</span>
            <span style="font-size:13px;text-align:right;word-break:break-word;min-width:0;flex:1">${escHtml(sub.memo)}</span>
          </div>` : ''}

          ${pm ? `
          <div style="border-top:1px solid var(--border);margin:12px 0"></div>
          <div class="detail-inforow">
            <span class="text-sub text-sm">支払い方法</span>
            <span class="font-semibold text-sm" style="white-space:nowrap">${escHtml(pm.name)}</span>
          </div>` : ''}
        </div>

        ${hasCancelInfo ? `
        <div class="detail-section-label">解約について</div>
        <div class="card">
          ${sub.memo ? `<p class="text-sm" style="line-height:1.65;${sub.url ? 'margin-bottom:12px' : ''}">${escHtml(sub.memo)}</p>` : ''}
          ${sub.url ? `<a href="${escHtml(sub.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="display:flex">解約ページを開く</a>` : ''}
        </div>` : ''}

        ${sub.status === 'cancelled'
          ? `<button class="btn btn-primary mt-24" id="detail-restore">このサブスクを再開する</button>`
          : ''}
        <button class="btn btn-secondary ${sub.status === 'cancelled' ? 'mt-8' : 'mt-24'}" id="detail-duplicate">このサブスクを複製</button>
        ${sub.status === 'active' ? `<button class="btn detail-cancel-btn mt-8" id="detail-cancel">このサブスクを解約</button>` : ''}
        <button class="btn btn-danger mt-8" id="detail-delete">削除</button>
        <div style="height:8px"></div>

      </div>
    </div>`;

  return {
    html,
    afterRender() {
      document.getElementById('back-btn').addEventListener('click', () => {
        location.hash = '#/';
      });
      document.getElementById('detail-restore')?.addEventListener('click', () => {
        restoreSubscription(id);
        showToast('再開しました');
        location.hash = '#/';
      });
      document.getElementById('detail-duplicate').addEventListener('click', () => {
        // Seed a new-sub form with this sub's values (excluding identity/status)
        pendingDuplicate = {
          name: `${sub.name} のコピー`,
          icon: sub.icon, color: sub.color,
          amount: sub.amount, currency: sub.currency,
          billingCycle: sub.billingCycle, customIntervalDays: sub.customIntervalDays,
          firstBillingDate: sub.firstBillingDate,
          categoryId: sub.categoryId, paymentMethodId: sub.paymentMethodId,
          memo: sub.memo ?? '', url: sub.url ?? '',
        };
        location.hash = '#/sub/new';
      });
      document.getElementById('detail-cancel')?.addEventListener('click', () => {
        showConfirm({
          title: '解約済みにする',
          body: `「${sub.name}」を解約済みにしますか？`,
          confirmLabel: '解約済みにする',
          onConfirm: () => { cancelSubscription(id); showToast('解約済みにしました'); location.hash = '#/'; },
        });
      });
      document.getElementById('detail-delete').addEventListener('click', () => {
        showConfirm({
          title: '削除',
          body: '履歴ごと完全に削除され、復元できません。再開予定なら「解約済み」が便利です。',
          confirmLabel: '削除する',
          onConfirm: () => { deleteSubscription(id); showToast('削除しました'); location.hash = '#/'; },
        });
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// PAYMENT METHODS
// ═══════════════════════════════════════════════════════════
function renderPaymentMethods() {
  const { paymentMethods } = getState();
  const listHtml = paymentMethods.length === 0
    ? '<p class="text-sub text-sm text-center mt-16">支払い方法がまだありません</p>'
    : paymentMethods.map(p => `
        <div class="settings-row">
          <span class="settings-row-icon">${escHtml(p.icon) || '💳'}</span>
          <div style="flex:1">
            <div class="settings-row-label">${escHtml(p.name)}</div>
            ${p.member ? `<div class="text-sub text-xs">${escHtml(p.member)}</div>` : ''}
          </div>
          <button class="btn btn-ghost text-up btn-sm" data-delete-pm="${p.id}">削除</button>
        </div>`).join('');

  const html = `
    <div>
      <div class="subpage-header">
        <button class="back-btn" id="back-btn">${BACK_SVG}戻る</button>
        <span class="subpage-title">支払い方法</span>
        <span></span>
      </div>
      <div class="p-16">
        <div class="settings-list">${listHtml}</div>
        <button class="btn btn-secondary mt-16" id="add-pm">支払い方法を追加</button>
      </div>
    </div>`;

  return {
    html,
    afterRender() {
      document.getElementById('back-btn').addEventListener('click', () => {
        if (history.length > 1) history.back(); else location.hash = '#/settings';
      });
      document.getElementById('add-pm').addEventListener('click', () => showAddPaymentMethod());
      document.querySelectorAll('[data-delete-pm]').forEach(btn => {
        btn.addEventListener('click', () => {
          showConfirm({
            title: '支払い方法を削除',
            body: 'この支払い方法を削除しますか？',
            confirmLabel: '削除',
            onConfirm: () => { deletePaymentMethod(btn.dataset.deletePm); go('#/payment-methods'); showToast('削除しました'); },
          });
        });
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════
// CANCELLED
// ═══════════════════════════════════════════════════════════
function renderCancelled() {
  const state = getState();
  const cancelled = state.subscriptions.filter(s => s.status === 'cancelled');

  const listHtml = cancelled.length === 0
    ? `<div class="empty-state"><div class="empty-icon">🗂️</div><p class="empty-title">解約済みサブスクはありません</p></div>`
    : cancelled.map(sub => `
        <div class="sub-item" style="cursor:default">
          <div class="sub-icon" style="background:${sub.color ?? 'var(--card)'}22;opacity:.6">${escHtml(sub.icon) || '📦'}</div>
          <div class="sub-body">
            <div class="sub-name" style="opacity:.7">${escHtml(sub.name)}</div>
            <div class="sub-meta">${sub.cancelledAt ? `解約: ${fmtDateShort(sub.cancelledAt.slice(0,10))}` : '解約済み'}</div>
          </div>
          <div class="sub-right">
            <div class="sub-amount" style="opacity:.7">${fmtAmount(sub.amount, sub.currency)}</div>
            <button class="btn btn-secondary btn-sm mt-4" data-restore="${sub.id}">復元</button>
          </div>
        </div>`).join('');

  const html = `
    <div>
      <div class="subpage-header">
        <button class="back-btn" id="back-btn">${BACK_SVG}戻る</button>
        <span class="subpage-title">解約済み (${cancelled.length}件)</span>
        <span></span>
      </div>
      <div class="p-16">${listHtml}</div>
    </div>`;

  return {
    html,
    afterRender() {
      document.getElementById('back-btn').addEventListener('click', () => {
        if (history.length > 1) history.back(); else location.hash = '#/settings';
      });
      document.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', () => {
          restoreSubscription(btn.dataset.restore);
          showToast('復元しました');
          go('#/cancelled');
        });
      });
    },
  };
}
