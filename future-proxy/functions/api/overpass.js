// Cloudflare Pages Function — Overpass 取得のキャッシュ用プロキシ（次フェーズ用の雛形）
// 有効化: この "functions" フォルダ（repo/future-proxy/functions）をリポジトリのルートに移動して push するだけ。
//   → /api/overpass が使えるようになります。
// アプリ側: 取得先を公開Overpassミラーから "/api/overpass" に変えると、
//   同一範囲の再取得がCloudflareのエッジキャッシュに載り、公開サーバーへの負荷とレート制限を大幅に減らせます。
// 秘匿情報（有料APIキー等）は Pages の環境変数(Settings→Environment variables)に入れて context.env で読みます。

const UPSTREAM = "https://overpass-api.de/api/interpreter"; // 必要なら自前/有料Overpassに変更
const TTL = 86400; // 秒。地物データは日次程度のキャッシュで十分

export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.text(); // "data=<query>"
  const key = new Request("https://m2v-cache/overpass?" + await sha1(body), { method: "GET" });
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return withCORS(hit);

  const res = await fetch(UPSTREAM, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Map2Vector/1.0 (+https://YOUR-DOMAIN; contact: YOUR-EMAIL)",
    },
  });
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", `public, max-age=${TTL}`);
  if (res.ok) context.waitUntil(cache.put(key, out.clone()));
  return withCORS(out);
}

export function onRequestOptions() {
  return withCORS(new Response(null, { status: 204 }));
}

function withCORS(r) {
  const h = new Headers(r.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(r.body, { status: r.status, headers: h });
}

async function sha1(s) {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
