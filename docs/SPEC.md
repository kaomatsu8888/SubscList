# サブスク管理アプリ 仕様書（Claude Code 用 / Web版）

> 添付スクショのレイアウトを参考にしたサブスク管理アプリを、**ビルド不要のピュア HTML/CSS/JavaScript**
> で実装し、**GitHub Pages** に公開するための指示書です。`docs/SPEC.md` などに置き、Claude Code に
> 「このSPECを読んで、フェーズ順に実装して」と渡してください。
> 各フェーズ完了ごとにブラウザで開いて動く状態を保ち、こちらの確認を挟んでから次へ進むこと。
>
> ⚠️ **課金・Pro/無料の区分は一切実装しない。全機能を常に利用可能にする。**

---

## 0. プロダクト概要

- 仮称: **SubscBox**（自由に変更可）
- 目的: 契約中のサブスク／定期支払いを一元管理し、合計コスト・次回請求日・支出推移を可視化する
- 形態: **Web アプリ（PWA対応）**。ブラウザで動作、ホーム画面に追加して擬似アプリ化も可
- データ: **ブラウザの localStorage に保存・端末内完結**（ログイン・サーバー不要）
- 言語: 日本語
- 画面構成: 下部5タブ = **ホーム / カレンダー / 分析 / 診断 / 設定**
- 公開: **GitHub Pages**（無料・HTTPS・push即反映）

---

## 1. 技術スタック（確定）

| 領域 | 採用 | 備考 |
|------|------|------|
| 言語 | **HTML5 + CSS3 + Vanilla JavaScript (ES Modules)** | ビルド/バンドラなし。`<script type="module">` |
| データ保存 | **localStorage**（JSON） | このデータ量なら容量に余裕（5MB枠） |
| グラフ | **Chart.js**（CDN） | 分析タブの棒/折れ線/ドーナツ |
| 日付計算 | **Day.js**（CDN, 任意） | 月末丸め・うるう年を安全に処理 |
| PWA | `manifest.json` ＋ Service Worker | オフライン動作・ホーム画面追加 |
| ホスティング | **GitHub Pages** | `main` ブランチ root を公開 |

**外部依存は Chart.js と Day.js の CDN 2本のみ**（どちらもビルド不要）。
状態管理が辛くなったら **Alpine.js**（CDN）を後付け可（任意）。最初は素のJSで始める。

> ⚠️ GitHub Pages は `https://<user>.github.io/<repo>/` のサブパス配信になる。
> **全パスを相対パス（`./` 始まり）で書くこと**（asset / SW scope / manifest start_url）。`/` 始まりは404になる。

---

## 2. デザインガイド

スクショは「ミニマル・モノクロ基調」。CSS変数で `:root` に定義（`css/style.css`）。

**カラー（ライト）**
```
--bg: #FFFFFF;          --card: #F4F4F2;
--text: #111111;        --text-sub: #9A9A9A;
--accent: #1C1C1C;      /* 選択チップ/主要ボタン/ヒーローカード */
--progress: #3B82F6;
--up: #E5484D;          /* 前月比プラス（赤） */
--down: #16A34A;        /* 前月比マイナス（緑） */
```
**ダーク**（`[data-theme="dark"]` で上書き）: `--bg:#000; --card:#1C1C1C; --text:#FFF;` …
**自動**: `prefers-color-scheme` に追従。ライト/ダーク/自動を設定で切替。

**タイポ**: `font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;`
大見出し（「設定」「¥20,819」）は太字・特大。金額は `font-variant-numeric: tabular-nums;` で桁揃え。

**コンポーネント**
- カード: 角丸 16〜20px、薄ボーダー or 弱シャドウ、余白広め
- セグメント（すべて/月額/年額）: 薄トラックに白の選択ピル
- チップ（請求日/高い順…）: 選択=黒背景・白文字、非選択=薄グレー
- 進捗バー: 細い1本ライン
- FAB: 右下固定（`position: fixed`）の黒丸＋「＋」
- 下部タブバー: `position: fixed; bottom: 0;` の5アイコン

**通貨表記**: `¥1,400`（3桁カンマ）/ 外貨 `$20.00`。月額換算 `≈ ¥1,000/月`。

---

## 3. 画面仕様（スクショ準拠）

`index.html` 内に5つの `<section>`（各タブ）＋詳細/フォーム用コンテナを持ち、ハッシュルーティング（§11）で表示切替。

### 3.1 ホーム（`#/`）
- 上部ラベル「メイン」（グループ名。複数グループ切替は v1 任意）
- **ヒーローカード（黒背景）**: 「今月のサブスク合計支払い」＋ⓘ、大きく `¥20,819`（=月額換算合計, §5）、右上に為替更新ボタン（§6）、下段 `年間換算 ¥249,829` / `契約数 10件`、「タップで TOP コストを表示」でTOPコスト表示にトグル（任意）
- **セグメント**: `すべて N` / `月額 N` / `年額 N`（件数バッジ）
- **ソートチップ**: `請求日`(既定) / `高い順` / `安い順` / `名前順` / `カスタム`（カスタム=ドラッグ並べ替え、`sortOrder`保存。HTML5 drag&drop か上下ボタンで可）
- **契約中のサービス一覧**: 各行 = アイコン(絵文字 or 📦) / 名前 / 金額＋周期(`/月` `/年` `/カスタム`) / 請求日プログレスバー(設定でON/OFF) / 右下「あと N 日」。クリックで詳細
- **FAB（＋）** → 追加フォーム

### 3.2 カレンダー（`#/calendar`）
- 月ナビ `< 2026年6月 >`、週ヘッダ `日 月 火 水 木 金 土`（日=赤 / 土=青）
- 月グリッド: 支払いがある日にサービスアイコンを小さく表示、今日は黒丸で強調
- 下に「N月の支払い予定（X件）」カード: 「N月の合計 ¥12,077」（=その月に**実際に請求される**金額の合計, §5）＋ 行（`日付 / アイコン / 名前 / 金額 / シェブロン`、クリックで詳細）
- ⚠️ ヒーローの「月額換算合計」とは**別概念**。年払い等はその月に請求が来なければ含めない

### 3.3 分析（`#/analytics`）
- 上部カード: 「今月の支出合計 ¥20,819」(=月額換算合計) / 「前月比 +¥12,211 (+142%)」(増=赤・減=緑, §5) / 下段 `年間換算 ¥249,829` `1日あたり ¥694` `契約数 10件`
- **コストが高いサブスク**（TOP3, 月額換算で降順）: 行 = アイコン / 名前 / 元の金額・周期 / 右に `¥X,XXX /月換算`
- **支出の推移**: `6ヶ月 / 12ヶ月 / 24ヶ月` トグル → Chart.js 棒/折れ線（常時表示）
- **カテゴリ別内訳**: Chart.js ドーナツ or 横棒（常時表示）

### 3.4 診断（`#/diagnosis`）
- サブスク健康診断（ルールベース, §8）。**回数制限なし・いつでも実行可**
- 実行ボタン → 結果（スコア＋指摘＋提案）。過去結果は履歴として閲覧可（任意）
- ※スクショの「Proで無制限に診断」CTA・回数制限の文言は実装しない

### 3.5 設定（`#/settings`、縦スクロール1枚）
1. **テーマ**: 外観 `ライト / ダーク / 自動`（`data-theme` 切替＋localStorage保存）
2. **表示**: 請求日プログレスバー（トグル） / 月額換算（円）を表示（トグル, 年額・外貨の下に `≈ ¥1,000/月`）
3. **通知**: 通知（トグル） / 通知タイミング（チップ `3日前` `当日`、×削除＋日数入力＋「追加」） / 通知時刻 既定`09:00`（§9で挙動を限定）
4. **通貨**: デフォルト通貨 `JPY / USD / EUR / TRY / NGN / INR`
5. **支払い方法**: 「支払い方法を管理」→ 別ビュー（カード／家族メンバーごとに登録。**記録用であり決済機能ではない**）
6. **サブスク管理**: 解約済みサブスク（件数）→ 別ビュー（アーカイブ/復元） / 確認ダイアログを再表示（削除・解約時の確認を再有効化）
7. **データ**: JSONエクスポート（ファイルDL or 共有） / JSONインポート（「v1.1で対応予定」＝非活性）
8. **アプリ情報**: バージョン / アプリについて / ご意見・ご要望 / 商標について
9. フッター: アプリ名＋クレジット

> ⚠️ スクショの「プラン / Proにアップグレード」セクション・`PRO` バッジは**実装しない**。

### 3.6 追加・編集フォーム（`#/sub/new`, `#/sub/:id/edit`）
- 名前(必須) / アイコン(絵文字 or 画像) / カラー / 金額(必須・数値) / 通貨(既定=デフォルト通貨)
- 課金周期 `月額 / 年額 / カスタム`（カスタムは「N日ごと」）/ 初回請求日 / カテゴリ / 支払い方法 / グループ / メモ / URL / 個別通知上書き(任意)
- 保存 / 削除 / 解約（→解約済みへアーカイブ、合計から除外）

### 3.7 詳細（`#/sub/:id`）
- アイコン・名前・金額・周期・次回請求日・進捗バー / 月額換算・年額換算 / 支払い履歴 / 編集・解約・削除

---

## 4. データモデル（localStorage / JSON）

localStorage キー: `subscbox:v1`。値は単一JSONオブジェクト。

```js
{
  schemaVersion: 1,
  subscriptions: [{
    id, name, icon, color,
    amount,                       // 元通貨での金額
    currency,                     // 'JPY'|'USD'|'EUR'|'TRY'|'NGN'|'INR'
    billingCycle,                 // 'monthly'|'yearly'|'custom'
    customIntervalDays,           // customのとき必須(例:93)
    firstBillingDate,             // 'YYYY-MM-DD'（アンカー）
    categoryId, paymentMethodId, groupId,
    memo, url,
    notifyOverrideDays,           // number[] | null（nullなら全体設定に従う）
    status,                       // 'active'|'cancelled'
    cancelledAt,
    sortOrder,
    lastUsedAt,                   // 診断用（任意）
    createdAt, updatedAt
  }],
  paymentMethods: [{ id, name, type, member, last4, color, icon }], // 記録用
  categories:     [{ id, name, color, icon }],   // 既定: 動画/音楽/AI・ツール/フィットネス/保険/通信/その他
  groups:         [{ id, name }],                 // 既定 'メイン'
  exchangeRates:  [{ currency, rateToJpy, fetchedAt }],
  monthlySnapshots: [{ yearMonth, normalizedMonthlyTotal }], // 前月比・推移用
  diagnosisHistory: [{ id, runAt, score, resultJson }],      // 履歴表示用
  settings: {
    theme,                    // 'light'|'dark'|'auto'
    defaultCurrency,
    showBillingProgress,
    showMonthlyConversion,
    notifyEnabled,
    notifyTimingDays,         // [3, 0]（0=当日）
    notifyTime,               // 'HH:mm'
    reConfirmDialogs
  }
}
```

`js/store.js` に `load()` / `save()` / `getState()` / 各コレクションのCRUDヘルパを実装。
**シードデータ**（`js/seed.js`）: 初回起動（キー無し）時にスクショ相当のサンプルを投入（Claude Pro / chat GPT GO / エニタイム フィットネス / pairs / 自動車保険チューリッヒ / バイク保険 等）。空でも全画面が動くこと。

---

## 5. 集計ロジック（重要 / `js/billing.js`）

すべて「デフォルト通貨」へ換算してから計算。

**月額換算（per サブスク）**
```
amountJpy = amount × rate(currency → default)
monthly  : monthlyEquiv = amountJpy
yearly   : monthlyEquiv = amountJpy / 12
custom(D): monthlyEquiv = amountJpy × (365.25 / 12) / D
```
**ホーム/分析の指標**
```
月額換算合計 M = Σ monthlyEquiv(status=active)
年間換算 = M × 12
1日あたり = M / (当月の日数)
契約数 = active 件数
前月比 = M − M(前月スナップショット)、% = 差 / 前月 × 100   // 増=赤,減=緑
```
**カレンダー「N月の合計」**（ホーム合計とは別物）
```
その月に到来する請求オカレンスの amountJpy を合計。年払い等は当月に請求が来なければ含めない。
```
**次回請求日・進捗**
```
monthly : firstBillingDate に +1ヶ月 を today を超えるまで（月末丸め 1/31→2末）
yearly  : +1年 / custom : +D日
daysLeft = next − today
cycleLen = monthly:当該月日数 / yearly:365 / custom:D
progress = (cycleLen − daysLeft) / cycleLen   // 0..1
```
**TOPコスト**: active を monthlyEquiv 降順 上位3件。
**月次スナップショット**: 起動時に当月の M を `monthlySnapshots` に upsert。

---

## 6. 通貨・為替（オフライン方針 / `js/currency.js`）
- 既定レートを**コードに埋め込み**（オフラインでも換算可能）
- 任意でオンライン時に無料FX API（例 `open.er-api.com`）から取得し localStorage にキャッシュ。**取得失敗時は既定/前回値で継続**
- 設定/詳細で手動レート上書き可
- ホームの為替更新ボタン = レート再取得トリガー（取得中→成功/失敗トースト）

---

## 7. 課金について（実装しない）
- 課金・アプリ内購入・Pro/無料区分は設けない。全機能を常時利用可能
- 「Proにアップグレード」「PRO」「Proで無制限に診断」等の表記・UI・導線は作らない

---

## 8. 診断ロジック（ルールベース / `js/diagnosis.js`）
active サブスクを評価し、スコア（100点開始・減点式）＋指摘＋提案を返す。
- 高額: monthlyEquiv ≥ ¥5,000 → 見直し候補
- 外貨比率: 外貨サブスクの月額換算が総額の30%超 → 為替リスク注意
- カテゴリ重複: 同一カテゴリ2件以上（例:AIツール複数）→ 統合提案
- 長期未利用: `lastUsedAt` 60日以上前 → 解約検討（任意フィールド前提）
- 直近更新: 7日以内に高額/年払い請求 → 事前アラート
- 出力: `score`, `topSuggestions[]`（最大3件）
- **回数制限なし**。`diagnosisHistory` は履歴表示用に保存するのみ

---

## 9. 通知（Webの制約を前提に割り切る / `js/notify.js`）

ブラウザでは「未来予約のスケジュール通知」は基本不可。以下の二段構えにする。

**① アプリ内リマインド（主・必須）**
- **アプリを開いたとき**に、`notifyTimingDays` に該当する（=次回請求まで日数が一致する）サブスクを集計し、ホーム上部にバナー/トーストで表示
- 例: 「3日後に請求: Claude Pro（$20.00）/ 当日: chat GPT GO（¥1,400）」
- 完全オフライン・権限不要で確実に動く。サブスク管理は週1〜月1で開く想定なのでこれで実用十分

**② Web Push（任意・ベストエフォート）**
- `Notification` 権限を要求し、PWAとして開いている間に「今日が請求日」のものがあれば `new Notification(...)` を出す
- iOS Safari は **ホーム画面に追加したPWA（16.4+）** のみ Web Push 可。スケジュール通知ではないため、ローカル完結では「開いている時だけ」が限界
- ⚠️ 通知設定UIにはその旨を1行注記（「ブラウザの仕様上、アプリを開いた時にお知らせします」）

---

## 10. JSON エクスポート / インポート（`js/store.js`）
- **エクスポート**: localStorage の全データを JSON 文字列化し、Blob → `<a download>` でファイル保存（or `navigator.share`）。`schemaVersion` を含める
- **インポート**: v1 は「v1.1で対応予定」表示の**非活性**ボタン。スキーマだけ将来用に固定

---

## 11. ルーティング & ディレクトリ構成

**ハッシュルーティング**（`hashchange` で `#app` に該当ビューを描画、タブバーのactive更新）
```
#/                 ホーム
#/calendar         カレンダー
#/analytics        分析
#/diagnosis        診断
#/settings         設定
#/sub/new          追加フォーム
#/sub/:id          詳細
#/sub/:id/edit     編集
#/payment-methods  支払い方法管理
#/cancelled        解約済み
```

```
subscbox/
├─ index.html          # 5タブのsection＋#app＋下部タブバー＋FAB
├─ css/
│  └─ style.css        # CSS変数(ライト/ダーク)・全コンポーネント
├─ js/
│  ├─ app.js           # エントリ:初期化, ルーター, SW登録, 起動時リマインド
│  ├─ store.js         # localStorage I/O・CRUD・JSONエクスポート
│  ├─ seed.js          # 初期サンプルデータ
│  ├─ billing.js       # 月額換算・次回請求日・進捗・各種合計
│  ├─ currency.js      # 為替レート(既定＋取得＋手動)
│  ├─ diagnosis.js     # 診断ルール
│  ├─ render.js        # 各画面の描画関数(renderHome等)
│  ├─ notify.js        # 起動時リマインド＋(任意)Web Push
│  └─ format.js        # 金額/日付フォーマット
├─ assets/
│  ├─ icon-192.png
│  └─ icon-512.png
├─ manifest.json       # PWA(相対パス)
├─ sw.js               # Service Worker(アプリシェルをキャッシュ)
└─ README.md
```

> JSは `<script type="module" src="./js/app.js">` の1本だけ読み込み、app.js から各モジュールを `import`。
> Chart.js / Day.js は `index.html` で CDN `<script>` 読み込み（グローバル参照）。

---

## 12. PWA

**manifest.json（相対パス必須）**
```json
{
  "name": "SubscBox",
  "short_name": "SubscBox",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#1C1C1C",
  "icons": [
    { "src": "./assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "./assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
**sw.js**: インストール時にアプリシェル（`./`, `./index.html`, `./css/style.css`, `./js/*.js`, アイコン）をキャッシュ。fetch はキャッシュ優先（オフライン動作）。デプロイ更新を反映するため `CACHE_VERSION` 定数を用意し、更新時に古いキャッシュを削除。
**登録**: `app.js` で `navigator.serviceWorker.register('./sw.js')`（スコープ相対）。
`index.html` の `<head>` に `<link rel="manifest" href="./manifest.json">` と `theme-color` メタ。

---

## 13. GitHub Pages デプロイ手順（README にも転記）

1. GitHubで新規リポジトリ作成（例: `subscbox`、Public）
2. ローカルでファイル一式を配置し:
   ```
   git init
   git add .
   git commit -m "init: subscbox web app"
   git branch -M main
   git remote add origin https://github.com/<user>/subscbox.git
   git push -u origin main
   ```
3. GitHub → リポジトリ → **Settings → Pages**
   - **Source: Deploy from a branch** → Branch: `main` / フォルダ: `/ (root)` → Save
4. 数十秒後、`https://<user>.github.io/subscbox/` で公開（URLはPages画面に表示）
5. iPhoneでそのURLを Safari で開く → 共有 → **「ホーム画面に追加」** で擬似アプリ化（PWA）
6. 更新は `git push` するだけ（SWの `CACHE_VERSION` を上げると確実に反映）

> ⚠️ サブパス配信なので、HTML/CSS/JS/manifest/SW のパスは**すべて相対（`./`）**。`/css/...` のような絶対パスは404。
> 任意: GitHub Actions ではなく「ブランチ公開」で十分。独自ドメインは Pages の Custom domain で後付け可。

---

## 14. 実装フェーズ（この順で。各フェーズ末でブラウザで動く状態に）

- **Phase 0 — 基盤**: `index.html` 骨組み（5 section＋#app＋下部タブバー＋FAB）、`style.css` のトークン/レイアウト、`app.js` のハッシュルーター、空ビュー表示
- **Phase 1 — データ層**: `store.js`(localStorage CRUD)、`seed.js`(初期投入)、追加/編集フォーム、詳細ビュー
- **Phase 2 — ホーム**: ヒーローカード、セグメント、ソートチップ、一覧、進捗バー、FAB導線
- **Phase 3 — カレンダー**: 月グリッド、当日強調、日別アイコン、月の支払い予定＆合計
- **Phase 4 — 通貨＆設定**: `currency.js`(為替換算)、月額換算表示、設定画面一式（テーマ切替/表示/通貨/支払い方法/サブスク管理）
- **Phase 5 — 通知**: 起動時リマインド（バナー）、設定連動、(任意)Web Push
- **Phase 6 — 分析**: 合計・前月比・1日あたり・TOPコスト・Chart.js 推移/カテゴリ別、月次スナップショット
- **Phase 7 — 診断**: ルールベース診断、スコア表示（回数制限なし）、履歴
- **Phase 8 — PWA & デプロイ**: manifest / sw.js / SW登録、JSONエクスポート、解約済み画面、空状態、README にデプロイ手順、相対パス最終確認

---

## 15. 受け入れ基準・エッジケース
- 空データでも全画面がクラッシュせず空状態を表示（「まだサブスクがありません」等）
- 月末請求の繰り上げ（1/31→2末）・うるう年を正しく処理
- 為替レート未取得でも既定値で換算が動く（オフライン完結）
- カスタム周期（N日ごと）の次回請求日・月額換算が正しい
- 使用中の支払い方法/カテゴリ削除時の扱い（紐付け解除 or 警告）
- 金額は3桁カンマ＋等幅数字で桁ズレしない
- 前月比マイナスは緑＋下向き、プラスは赤＋上向き
- リロードしてもデータが保持される（localStorage）/ 初回はシード投入
- **全パスが相対**で GitHub Pages のサブパスでも動く
- Service Worker 登録後もオフラインで起動できる
- 課金・購入導線がどこにも存在しないこと

---

## 16. 命名・備考
- 通貨記号: JPY=¥, USD=$, EUR=€, TRY=₺, NGN=₦, INR=₹
- 既定カテゴリ: 動画 / 音楽 / AI・ツール / フィットネス / 保険 / 通信 / その他
- 既定通知タイミング: `3日前` ＋ `当日`、既定時刻 `09:00`
- タブアイコン: ホーム / カレンダー / 分析(棒グラフ) / 診断(✳) / 設定(歯車)。SVGインライン or 絵文字でよい

---

*以上。まず Phase 0 から着手し、各フェーズ完了時にブラウザで開いて動く状態を提示してください。*
