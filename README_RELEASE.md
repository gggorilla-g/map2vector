# Map2Vector — Release bundle / リリース一式

このフォルダをそのまま静的ホスティングに置けば公開できます。公開前に「差し替え箇所」だけ埋めてください。

## 中身
- `index.html` … アプリ本体（単一ファイル。日本語/英語UI、地図ラベル・SVGレイヤー名も日英対応、無料1日5回＋広告枠、規約/プライバシー）
- `terms.html` / `privacy.html` … 利用規約・免責 / プライバシーポリシー（日英併記・AdSense審査用）
- `ogp.png` … SNSシェア用の画像（1200×630）
- `robots.txt` / `sitemap.xml` … SEO
- `ads.txt` … AdSense用（承認後にIDを差し替え）
- `404.html`

## 公開前に差し替える箇所（プレースホルダー）
| 置き換える文字列 | 何に | どのファイル |
|---|---|---|
| `YOUR-DOMAIN` | 公開ドメイン（例 `map2vector.app`） | `index.html`, `robots.txt`, `sitemap.xml` |
| `YOUR-EMAIL` | 問い合わせ先メール | `privacy.html` |
| `pub-XXXXXXXXXXXXXXXX` | AdSense パブリッシャーID | `ads.txt` |
| `ADSENSE_CLIENT` / `ADSENSE_SLOT`（index.html内のJS 2行） | AdSense のID / 広告ユニットID | `index.html` |

> AdSense未設定のうちは広告枠はプレースホルダー表示のまま。IDを入れると実広告が出ます。

## デプロイ（どれか一つ）
- **Cloudflare Pages / Netlify**：このフォルダを丸ごとドラッグ&ドロップ。独自ドメインも無料で割当可。
- **GitHub Pages / Vercel**：このフォルダをそのまま公開。

`index.html` がルートに来るように置けばOKです。

## 公開後にやること
1. Google Search Console にドメイン登録 → `sitemap.xml` を送信。
2. AdSense：サイト審査に出す（プライバシーポリシーページ必須＝`privacy.html` を用意済み）。承認後、上表のIDを差し替え。
3. EU/英国向けに配信するなら Cookie 同意（CMP）を追加。

## ⚠ スケール時の重要注意（必読）
アプリはブラウザから **公開OSMサーバー**（データ取得・地名検索 Nominatim・背景タイル）を直接叩きます。個人利用は問題ありませんが、**アクセスが増えると必ずレート制限・ブロックされます**（特に Nominatim とタイルは重い商用直叩きを規約で禁止）。

伸びてきたら順に：(1) User-Agent/連絡先を明示、(2) 地名検索を有料ジオコーディング or 自前 Nominatim へ、(3) データ取得を自前Overpass or 有料提供へ、(4) キャッシュ用の薄いプロキシ（Cloudflare Workers 等）を挟む。描画はブラウザ内なので原価はほぼゼロ、"データ取得の出口" だけが要対策です。詳細は別途 `LAUNCH.md` を参照。

## メモ
- 無料の1日5回制限はブラウザ内（localStorage）のみの簡易制限で、回避可能です。本当に課金で守るには後日ログイン＋サーバーが必要。
- 地図データは © OpenStreetMap contributors（ODbL）。出力・ページのクレジット表記は残してください。

## コード保護について
- 配布する `index.html` は**アプリJSをminify＋難読化**した状態です（変数・処理が圧縮され、そのままは読みにくい）。難読化は完全な防御ではありません（クライアント側アプリの性質上、丸ごとコピーは技術的には可能）。
- `LICENSE.txt` に proprietary（無断複製・再配布・再ホスティング禁止）を明記し、`terms.html` にも同条項を入れています。技術的抑止＋法的抑止の二段構えです。
- 未難読化の開発用ソース（`map2vector-osm.html` / `template-osm.html`）は**公開ホストに置かない**でください（このzipには含めていません）。
- 本気で守るなら将来、データ取得・キャッシュ（と直角化計算）を自分のサーバー/Cloudflare Workers 裏に移し、APIキーとレート制限で囲うのが最も効きます（＝コピーしてもUIの殻だけになる）。
