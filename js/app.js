// js/app.js — Entry point: bootstrap, router, theme, SW registration

import { load, getState, upsertSnapshot } from './store.js';
import { seedIfEmpty }                     from './seed.js';
import { totalMonthly }                    from './billing.js';
import { currentYearMonth }                from './format.js';
import { getReminders, showReminderBanner, tryWebPush } from './notify.js';
import { renderRoute }                     from './render.js';

// ── Day.js locale + plugins ──
if (typeof dayjs !== 'undefined') {
  dayjs.locale('ja');
  if (window.dayjs_plugin_isSameOrBefore) dayjs.extend(window.dayjs_plugin_isSameOrBefore);
  if (window.dayjs_plugin_isSameOrAfter)  dayjs.extend(window.dayjs_plugin_isSameOrAfter);
}

// ── Theme ──
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme ?? 'auto';
}

// ── Router ──
const TAB_ROUTES = {
  '#/':                 'home',
  '#/calendar':         'calendar',
  '#/analytics':        'analytics',
  '#/diagnosis':        'diagnosis',
  '#/settings':         'settings',
  '#/payment-methods':  'settings',
  '#/cancelled':        'settings',
};

const FAB_ROUTES = new Set(['#/']);

function navigate(hash) {
  hash = hash || location.hash || '#/';
  // Normalise empty hash
  if (!hash || hash === '#') hash = '#/';

  const app = document.getElementById('app');
  const fab = document.getElementById('fab-add');

  // Extract match groups for parameterised routes
  let match = null;
  const editMatch   = hash.match(/^#\/sub\/([^/]+)\/edit$/);
  const detailMatch = hash.match(/^#\/sub\/([^/]+)$/);
  if (editMatch)   match = editMatch;
  else if (detailMatch) match = detailMatch;

  let result;
  try {
    result = renderRoute(hash, match);
  } catch (err) {
    console.error('render error', err);
    result = { html: `<div class="page"><p class="text-sub">エラーが発生しました</p><pre style="font-size:11px;overflow:auto">${err.message}</pre></div>` };
  }

  app.innerHTML = typeof result === 'string' ? result : result.html;
  app.scrollTop = 0;

  // afterRender (event listeners, charts, etc.)
  if (result.afterRender) {
    requestAnimationFrame(() => { try { result.afterRender(); } catch (e) { console.warn('afterRender error', e); } });
  }

  // Tab bar active
  const activeTab = TAB_ROUTES[hash] ??
    (editMatch ? 'home' : detailMatch ? 'home' : null);
  document.querySelectorAll('.tab-item').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === activeTab)
  );

  // FAB visibility
  fab.classList.toggle('hidden', !FAB_ROUTES.has(hash));
}

// ── Handle same-route re-render event (fired from render.js) ──
window.addEventListener('app:go', e => {
  const target = e.detail?.hash || location.hash || '#/';
  if (target !== location.hash) {
    location.hash = target;
  } else {
    navigate(target);
  }
});

// ── FAB ──
document.getElementById('fab-add').addEventListener('click', () => {
  location.hash = '#/sub/new';
});

// ── Toast (global helper) ──
window.showToast = function(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3100);
};

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ── Bootstrap ──
(function init() {
  // 1. Load + seed
  const state = load();
  seedIfEmpty();

  // 2. Apply saved theme immediately (before first render)
  applyTheme(state.settings.theme);

  // 3. Upsert monthly snapshot
  const ym = currentYearMonth();
  const total = totalMonthly(getState().subscriptions, getState().exchangeRates, getState().settings.defaultCurrency);
  upsertSnapshot(ym, total);

  // 4. Wire router
  window.addEventListener('hashchange', () => navigate(location.hash));
  if (!location.hash || location.hash === '#') {
    location.hash = '#/';
  } else {
    navigate(location.hash);
  }

  // 5. Startup reminder banner (after first render)
  requestAnimationFrame(() => {
    const fresh = getState();
    const reminders = getReminders(fresh);
    showReminderBanner(reminders);
    if (fresh.settings.notifyEnabled) tryWebPush(fresh).catch(() => {});
  });
})();
