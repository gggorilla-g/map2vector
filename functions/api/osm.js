// Overpass proxy: browser -> /api/osm (same origin) -> Overpass mirrors (server side)
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
const name = u => /overpass-api\.de/.test(u) ? "de" : /kumi/.test(u) ? "kumi" : /coffee/.test(u) ? "coffee" : u;
const json = (obj, status, extra) => new Response(JSON.stringify(obj), {
  status,
  headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {})
});

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (!/^data=/.test(body) || body.length > 20000) return json({ error: "bad request" }, 400);
  const errs = [];
  for (const m of MIRRORS) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 50000);
    const t0 = Date.now();
    try {
      const r = await fetch(m, {
        method: "POST",
        body,
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Map2Vector/1.0 (+https://map2vector.pages.dev)"
        }
      });
      clearTimeout(t);
      const txt = await r.text();
      if (r.ok && /^\s*\{/.test(txt)) {
        return new Response(txt, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-M2V-Server": name(m),
            "X-M2V-Ms": String(Date.now() - t0)
          }
        });
      }
      const remark = (txt.match(/<p><strong[^>]*>Error<\/strong>:\s*([^<]{0,160})/) || txt.match(/"remark":\s*"([^"]{0,160})/) || [])[1];
      errs.push(name(m) + ": HTTP " + r.status + (remark ? " (" + remark.trim() + ")" : ""));
    } catch (e) {
      clearTimeout(t);
      errs.push(name(m) + ": " + (e && e.name === "AbortError" ? "timeout 50s" : (e && e.message) || String(e)));
    }
  }
  return json({ error: errs.join(" / ") }, 502);
}

export async function onRequestGet() {
  return json({ ok: true, mirrors: MIRRORS.map(name) }, 200);
}
