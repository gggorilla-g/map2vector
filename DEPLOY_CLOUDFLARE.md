# Cloudflare Pages にGit連携で公開（次フェーズが楽な構成）

このフォルダの中身が「サイトのルート」です（`index.html` が直下）。ターミナルは不要、全部ブラウザでできます。

## 1. GitHubにプライベートリポジトリを作る
1. github.com にログイン →「New repository」。
2. 名前（例 `map2vector`）、**Private** を選択 → Create。
3. `Add file →「Upload files」` で、このフォルダの中身を**丸ごと**アップ（`index.html` などが**リポジトリ直下**に来るように）。`future-proxy/` はそのまま置いておいてOK（まだ動きません）。
   - ※ 未難読化の開発ソース（`template-osm.html` 等）は上げないこと（`.gitignore` 済み）。

## 2. Cloudflare Pages に連携
1. dash.cloudflare.com →「Workers & Pages」→「Create」→「Pages」→ **「Connect to Git」**。
2. さっきのGitHubリポジトリを選ぶ。
3. ビルド設定は**空でOK**（静的サイト）:
   - Framework preset: **None**
   - Build command: **（空）**
   - Build output directory: **`/`**（ルート）
4. 「Save and Deploy」→ `◯◯◯.pages.dev` が発行されて公開完了。
5. 以後は **GitHubにpush（またはWebで編集）するだけで自動デプロイ**されます。

## 3. 独自ドメイン（任意）
Pagesプロジェクト →「Custom domains」から追加（無料）。取ったら `index.html`／`robots.txt`／`sitemap.xml` の `YOUR-DOMAIN` を置換。

---

## 次フェーズ：データ取得を自前化（プロキシ／キャッシュ）
アクセスが増えると公開OSMサーバーは必ず制限されます。そのとき **同じPagesプロジェクトの中だけで** 対策できるのがこの構成の利点です。

1. `future-proxy/functions` フォルダを、**リポジトリのルートに移動**（＝ルート直下に `functions/api/overpass.js` が来る）してpush。
   - これだけで `https://あなたのサイト/api/overpass` が有効化されます（Cloudflare Pages Functions）。
2. アプリ側（`index.html` 内のJS）で、Overpassの取得先を公開ミラーから **`/api/overpass`** に変更（1〜数行）。同一範囲の再取得がCloudflareのエッジキャッシュに載り、公開サーバーへの負荷とレート制限が激減します。
3. 有料ジオコーディング等のAPIキーは、Pagesの **Settings → Environment variables（Secret）** に入れて、Function内で `context.env.KEY` で読む（ソースに書かない＝コピーされても使えない）。
4. 地名検索（Nominatim）も同様に `functions/api/geocode.js` を足せば、まるごと自前の裏側に隠せます。

> つまり「静的サイト → 裏にサーバー処理を足す」が、リポジトリにファイルを1個増やすだけで完了します。別インフラも移行も不要。ここが後々いちばん楽になるポイントです。

（`future-proxy/functions/api/overpass.js` は雛形済み。`UPSTREAM` や User-Agent の連絡先だけ直して使ってください。）
