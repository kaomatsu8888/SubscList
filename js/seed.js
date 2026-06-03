// js/seed.js — Initial sample data (injected on first launch)
import { getState, save } from './store.js';

const NOW = new Date().toISOString();

const SEED_SUBS = [
  {
    id: 'seed-1', name: 'Claude Pro', icon: '🤖', color: '#8B5CF6',
    amount: 20, currency: 'USD', billingCycle: 'monthly',
    firstBillingDate: '2024-01-01', categoryId: 'cat-ai',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 0,
  },
  {
    id: 'seed-2', name: 'ChatGPT Plus', icon: '💬', color: '#10B981',
    amount: 3000, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2024-03-15', categoryId: 'cat-ai',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 1,
  },
  {
    id: 'seed-3', name: 'エニタイム フィットネス', icon: '💪', color: '#F59E0B',
    amount: 7700, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2023-06-01', categoryId: 'cat-fitness',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 2,
  },
  {
    id: 'seed-4', name: 'pairs', icon: '💕', color: '#E5484D',
    amount: 3980, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2024-08-10', categoryId: 'cat-other',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 3,
  },
  {
    id: 'seed-5', name: 'Netflix', icon: '🎬', color: '#E5484D',
    amount: 1490, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2023-01-20', categoryId: 'cat-video',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 4,
  },
  {
    id: 'seed-6', name: 'Spotify', icon: '🎵', color: '#16A34A',
    amount: 980, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2023-04-05', categoryId: 'cat-music',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 5,
  },
  {
    id: 'seed-7', name: 'Amazon Prime', icon: '📦', color: '#F59E0B',
    amount: 5900, currency: 'JPY', billingCycle: 'yearly',
    firstBillingDate: '2023-07-15', categoryId: 'cat-other',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 6,
  },
  {
    id: 'seed-8', name: '自動車保険 チューリッヒ', icon: '🚗', color: '#3B82F6',
    amount: 42000, currency: 'JPY', billingCycle: 'yearly',
    firstBillingDate: '2024-01-10', categoryId: 'cat-insurance',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 7,
  },
  {
    id: 'seed-9', name: 'バイク保険', icon: '🏍️', color: '#06B6D4',
    amount: 18000, currency: 'JPY', billingCycle: 'yearly',
    firstBillingDate: '2024-04-01', categoryId: 'cat-insurance',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 8,
  },
  {
    id: 'seed-10', name: 'iCloud+', icon: '☁️', color: '#3B82F6',
    amount: 130, currency: 'JPY', billingCycle: 'monthly',
    firstBillingDate: '2023-09-01', categoryId: 'cat-telecom',
    paymentMethodId: null, groupId: 'grp-main',
    status: 'active', sortOrder: 9,
  },
];

export function seedIfEmpty() {
  const state = getState();
  if (state.subscriptions.length > 0) return;

  state.subscriptions = SEED_SUBS.map(s => ({
    ...s,
    memo: '', url: '', notifyOverrideDays: null,
    cancelledAt: null, lastUsedAt: null,
    createdAt: NOW, updatedAt: NOW,
  }));
  save();
}
