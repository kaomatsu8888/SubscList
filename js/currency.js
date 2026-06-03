// js/currency.js — Exchange rates (offline-first, optional fetch)

// Baked-in fallback rates: JPY per 1 unit of each currency (~2025)
const FALLBACK = {
  JPY: 1,
  USD: 155,
  EUR: 165,
  TRY: 4.7,
  NGN: 0.098,
  INR: 1.85,
};

export const CURRENCIES = [
  { code: 'JPY', name: '日本円',          symbol: '¥'  },
  { code: 'USD', name: '米ドル',          symbol: '$'  },
  { code: 'EUR', name: 'ユーロ',          symbol: '€'  },
  { code: 'TRY', name: 'トルコリラ',      symbol: '₺'  },
  { code: 'NGN', name: 'ナイジェリアナイラ', symbol: '₦'  },
  { code: 'INR', name: 'インドルピー',     symbol: '₹'  },
];

// JPY per 1 unit of `currency`, using stored rates with fallback
export function getRate(currency, storedRates = []) {
  const stored = storedRates.find(r => r.currency === currency);
  return stored ? stored.rateToJpy : (FALLBACK[currency] ?? 1);
}

// Convert `amount` in `from` currency to `to` currency
export function convertAmount(amount, from, to, storedRates = []) {
  if (from === to) return amount;
  const jpy = amount * getRate(from, storedRates);
  return jpy / getRate(to, storedRates);
}

// Fetch fresh rates from open.er-api.com (best-effort)
export async function fetchRates() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== 'success') throw new Error('bad result');

    const currencies = ['USD', 'EUR', 'TRY', 'NGN', 'INR'];
    const now = new Date().toISOString();
    // data.rates[c] = how many units of c per 1 JPY → invert to get JPY per 1 unit
    return currencies.map(c => ({
      currency: c,
      rateToJpy: data.rates[c] ? 1 / data.rates[c] : FALLBACK[c],
      fetchedAt: now,
    }));
  } catch (e) {
    clearTimeout(timer);
    throw new Error('レート取得に失敗しました: ' + e.message);
  }
}

// True if oldest stored rate is over 6 hours old (or missing)
export function ratesAreStale(storedRates) {
  if (!storedRates?.length) return true;
  const oldest = storedRates.reduce(
    (min, r) => (r.fetchedAt < min ? r.fetchedAt : min),
    storedRates[0].fetchedAt
  );
  return Date.now() - new Date(oldest).getTime() > 6 * 60 * 60 * 1000;
}

export function getFallback() {
  return { ...FALLBACK };
}
