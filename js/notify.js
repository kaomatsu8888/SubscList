// js/notify.js — Startup reminder banner + optional Web Push
import { daysUntilNext } from './billing.js';
import { fmtAmount, fmtDaysLeft, escHtml } from './format.js';

// Returns subscriptions matching the notify timing
export function getReminders(state) {
  const { subscriptions, settings } = state;
  if (!settings.notifyEnabled) return [];
  const timingDays = settings.notifyTimingDays ?? [3, 0];
  return subscriptions
    .filter(s => s.status === 'active')
    .map(s => ({ sub: s, days: daysUntilNext(s) }))
    .filter(({ days }) => timingDays.includes(days))
    .sort((a, b) => a.days - b.days);
}

// Render and attach the banner to #notify-banner
export function showReminderBanner(reminders) {
  const banner = document.getElementById('notify-banner');
  if (!banner) return;

  if (reminders.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  const todayItems  = reminders.filter(r => r.days === 0);
  const soonItems   = reminders.filter(r => r.days > 0);

  const parts = [];
  if (todayItems.length > 0) {
    const names = todayItems
      .map(r => `${r.sub.icon} ${escHtml(r.sub.name)} (${fmtAmount(r.sub.amount, r.sub.currency)})`)
      .join('・');
    parts.push(`🔔 本日請求: ${names}`);
  }
  if (soonItems.length > 0) {
    const names = soonItems
      .map(r => `${r.sub.icon} ${escHtml(r.sub.name)} (${fmtDaysLeft(r.days)})`)
      .join('・');
    parts.push(`⏰ まもなく請求: ${names}`);
  }

  banner.innerHTML = `
    <button class="notify-close" id="notify-close" aria-label="閉じる">×</button>
    ${parts.join('<br>')}
  `;
  banner.classList.remove('hidden');

  document.getElementById('notify-close')?.addEventListener('click', () => {
    banner.classList.add('hidden');
  });
}

// Request Web Push permission & fire notification for today's billings
export async function tryWebPush(state) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;

  const todayItems = getReminders(state).filter(r => r.days === 0);
  if (todayItems.length === 0) return;

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }

  const names = todayItems.map(r => `${r.sub.icon} ${r.sub.name}`).join('、');
  new Notification('SubscBox — 本日の請求', {
    body: `本日請求: ${names}`,
    icon: './assets/icon-192.png',
  });
}
