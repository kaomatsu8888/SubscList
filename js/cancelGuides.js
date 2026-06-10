// js/cancelGuides.js — Built-in cancellation guides for major services.
// Matched automatically against the subscription name (case-insensitive,
// also matches Japanese aliases). Steps are general guidance and may change;
// each guide links to the official cancel/account page when possible.

const GUIDES = [
  {
    id: 'netflix',
    match: ['netflix', 'ネットフリックス'],
    label: 'Netflix',
    steps: [
      'ブラウザで Netflix にログイン',
      '「アカウント」→「メンバーシップのキャンセル」',
      '画面の案内に従って解約を確定',
    ],
    url: 'https://www.netflix.com/cancelplan',
  },
  {
    id: 'spotify',
    match: ['spotify', 'スポティファイ'],
    label: 'Spotify',
    steps: [
      'ブラウザで Spotify のアカウントページにログイン',
      '「アカウント概要」→「プランを変更する」',
      '「Spotify Free」または「プランをキャンセル」を選択',
    ],
    url: 'https://www.spotify.com/account/subscription/',
  },
  {
    id: 'amazon-prime',
    match: ['amazon prime', 'amazonプライム', 'アマゾンプライム', 'プライム会員', 'prime'],
    label: 'Amazon プライム',
    steps: [
      'Amazon にログイン',
      '「アカウントサービス」→「プライム会員情報の管理」',
      '「会員資格を終了する」から解約',
    ],
    url: 'https://www.amazon.co.jp/gp/primecentral',
  },
  {
    id: 'youtube-premium',
    match: ['youtube premium', 'youtube', 'ユーチューブ'],
    label: 'YouTube Premium',
    steps: [
      'ブラウザで YouTube にログイン',
      '右上のアイコン →「購入とメンバーシップ」',
      'YouTube Premium →「無効にする」→「解約」',
    ],
    url: 'https://www.youtube.com/paid_memberships',
  },
  {
    id: 'disney-plus',
    match: ['disney+', 'disney plus', 'ディズニープラス', 'ディズニー+'],
    label: 'Disney+',
    steps: [
      'Disney+ にログイン',
      'プロフィールアイコン →「アカウント」',
      '「サブスクリプション」から「解約する」',
    ],
    url: 'https://www.disneyplus.com/account/subscription',
  },
  {
    id: 'apple',
    match: ['apple', 'icloud', 'apple music', 'apple tv', 'arcade', 'アップル', 'アイクラウド'],
    label: 'Apple（App内課金・iCloud等）',
    steps: [
      'iPhone/iPad: 「設定」→ 自分の名前 →「サブスクリプション」',
      'Mac: App Store →「アカウント」→「アカウント設定」→「管理」',
      '対象を選び「サブスクリプションをキャンセル」',
    ],
    url: 'https://apps.apple.com/account/subscriptions',
  },
  {
    id: 'chatgpt',
    match: ['chatgpt', 'chat gpt', 'openai', 'gpt'],
    label: 'ChatGPT Plus',
    steps: [
      'ChatGPT にログイン',
      '左下のアカウント名 →「My Plan」または「Settings」',
      '「Manage subscription」→「Cancel plan」',
    ],
    url: 'https://chatgpt.com/',
  },
  {
    id: 'unext',
    match: ['u-next', 'unext', 'ユーネクスト', 'ユーネクスト'],
    label: 'U-NEXT',
    steps: [
      'U-NEXT にログイン（ブラウザ推奨）',
      'メニュー →「アカウント・契約」→「契約内容の確認・変更」',
      '対象のプランを「解約」',
    ],
    url: 'https://www.unext.jp/',
  },
  {
    id: 'dazn',
    match: ['dazn', 'ダゾーン'],
    label: 'DAZN',
    steps: [
      'DAZN にログイン',
      '「マイ・アカウント」→「プラン」',
      '「退会する」から手続き',
    ],
    url: 'https://www.dazn.com/account',
  },
  {
    id: 'hulu',
    match: ['hulu', 'フールー'],
    label: 'Hulu',
    steps: [
      'Hulu にログイン',
      'アカウントページ →「契約を解除する」',
      '画面の案内に従って解約を確定',
    ],
    url: 'https://www.hulu.jp/account',
  },
];

// Find a guide whose keywords appear in the subscription name.
// Returns the guide object or null. Longer keywords win to reduce
// false matches (e.g. "amazon prime" before a bare "prime").
export function findCancelGuide(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const g of GUIDES) {
    for (const kw of g.match) {
      if (n.includes(kw.toLowerCase()) && kw.length > bestLen) {
        best = g;
        bestLen = kw.length;
      }
    }
  }
  return best;
}
