# SubscBox — サブスク管理アプリ

契約中のサブスク・定期支払いを一元管理する PWA です。  
ブラウザの localStorage にデータを保存します（ログイン・サーバー不要）。

## 機能

- サブスクの追加・編集・解約・削除
- 月額換算合計・年間換算・1日あたりの自動計算
- 次回請求日・残り日数・進捗バーの表示
- カレンダーで請求日を可視化
- Chart.js による支出推移・カテゴリ別グラフ
- ルールベースの「サブスク健康診断」
- 起動時リマインドバナー通知
- 外貨対応（JPY / USD / EUR / TRY / NGN / INR）
- ライト / ダーク / 自動テーマ
- JSON エクスポート
- PWA（ホーム画面追加・オフライン動作）

## GitHub Pages へのデプロイ

```bash
# 1. GitHubで新規リポジトリを作成（例: subscbox、Public）

# 2. ローカルで初期化してプッシュ
git init
git add .
git commit -m "init: subscbox web app"
git branch -M main
git remote add origin https://github.com/<user>/subscbox.git
git push -u origin main
```

3. GitHub → リポジトリ → **Settings → Pages**
   - Source: **Deploy from a branch** → Branch: `main` / フォルダ: `/ (root)` → Save

4. 数十秒後に `https://<user>.github.io/subscbox/` で公開

5. iPhone なら Safari で開いて「ホーム画面に追加」で PWA として利用可能

> **注意**: Service Worker のキャッシュを更新したい場合は `sw.js` の `CACHE` 定数のバージョン番号を上げてください。

## ローカル確認

ES Modules は `file://` プロトコルでは動作しません。ローカルサーバーが必要です:

```bash
# Node.js がある場合
npx serve .

# Python がある場合
python -m http.server 8000

# VS Code の Live Server 拡張機能を使う場合
# → index.html を右クリック → "Open with Live Server"
```

## 技術スタック

| 領域 | 採用 |
|------|------|
| 言語 | HTML5 + CSS3 + Vanilla JS (ES Modules) |
| データ | localStorage |
| グラフ | Chart.js 4 (CDN) |
| 日付 | Day.js 1 (CDN) |
| PWA | manifest.json + Service Worker |
| ホスティング | GitHub Pages |

外部依存は CDN の Chart.js と Day.js のみ。ビルドツール不要。

## データについて

- すべてのデータはブラウザの localStorage に保存されます
- サーバーへの送信は一切ありません
- 端末を変更するとデータは引き継がれません（設定 → JSONエクスポートでバックアップ可）

---

*SubscBox v1.0.0*
