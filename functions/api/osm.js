// Overpass proxy: browser -> /api/osm (same origin) -> Overpass mirrors (server side, hedged, max 2 in flight)
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];
const name = u => /lz4\.overpass-api\.de/.test(u) ? "lz4" : /z\.overpass-api\.de/.test(u) ? "z" : /overpass-api\.de/.test(u) ? "de" : /kumi/.test(u) ? "kumi" : /coffee/.test(u) ? "coffee" : u;
const json = (obj, status, extra) => new Response(JSON.stringify(obj), {
  status,
  headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, extra || {})
});

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (!/^data=/.test(body) || body.length > 20000) return json({ error: "bad request" }, 400);
  const probe = request.headers.get("X-M2V-Probe") === "1";
  const perTimeout = probe ? 8000 : 25000;   // per-mirror wait
  const stagger = probe ? 2500 : 8000;       // start the next mirror if no answer yet
  const budget = probe ? 14000 : 55000;      // hard cap for the whole request
  const maxInFlight = 2;                     // Overpass allows ~2 slots per IP
  const errs = [];
  const ctls = [];
  const t00 = Date.now();
  return await new Promise(resolve => {
    let done = false, next = 0, pending = 0, timer = null;
    const finish = r => { if (done) return; done = true; clearTimeout(timer); clearTimeout(hard); ctls.forEach(c => c.abort()); resolve(r); };
    const hard = setTimeout(() => finish(json({ error: (errs.concat(["budget " + Math.round(budget / 1000) + "s exceeded (" + pending + " pending)"])).join(" / ") }, 502)), budget);
    const startNext = () => {
      if (done || next >= MIRRORS.length || pending >= maxInFlight) return;
      const m = MIRRORS[next++];
      const ctl = new AbortController(); ctls.push(ctl);
      const to = setTimeout(() => ctl.abort(), perTimeout);
      const t0 = Date.now();
      pending++;
      fetch(m, {
        method: "POST", body, signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Map2Vector/1.0 (+https://map2vector.pages.dev)" }
      }).then(async r => {
        clearTimeout(to);
        const txt = await r.text();
        if (r.ok && /^\s*\{/.test(txt)) {
          return finish(new Response(txt, {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-M2V-Server": name(m), "X-M2V-Ms": String(Date.now() - t0), "X-M2V-Total": String(Date.now() - t00) }
          }));
        }
        const remark = (txt.match(/<p><strong[^>]*>Error<\/strong>:\s*([^<]{0,160})/) || txt.match(/"remark":\s*"([^"]{0,160})/) || [])[1];
        throw new Error("HTTP " + r.status + (remark ? " (" + remark.trim() + ")" : ""));
      }).catch(e => {
        clearTimeout(to);
        if (done) return;
        errs.push(name(m) + ": " + (e && e.name === "AbortError" ? "timeout " + Math.round(perTimeout / 1000) + "s" : (e && e.message) || String(e)));
        pending--;
        if (next < MIRRORS.length) { clearTimeout(timer); startNext(); schedule(); }
        else if (pending === 0) finish(json({ error: errs.join(" / ") }, 502));
      });
    };
    const schedule = () => { if (!done && next < MIRRORS.length) timer = setTimeout(() => { startNext(); schedule(); }, stagger); };
    startNext();
    schedule();
  });
}

export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  if (u.searchParams.get("diag") !== "1") return json({ ok: true, mirrors: MIRRORS.map(name), hedged: true }, 200);
  const q = "data=" + encodeURIComponent("[out:json][timeout:5];node(1);out;");
  const res = await Promise.all(MIRRORS.map(async m => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const t0 = Date.now();
    try {
      const r = await fetch(m, { method: "POST", body: q, signal: ctl.signal, headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Map2Vector/1.0 (+https://map2vector.pages.dev)" } });
      const txt = await r.text();
      return { mirror: name(m), ok: r.ok && /^\s*\{/.test(txt), status: r.status, ms: Date.now() - t0 };
    } catch (e) {
      return { mirror: name(m), ok: false, err: e && e.name === "AbortError" ? "timeout 6s" : String(e && e.message || e), ms: Date.now() - t0 };
    } finally { clearTimeout(t); }
  }));
  let deStatus = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch("https://overpass-api.de/api/status", { signal: ctl.signal, headers: { "User-Agent": "Map2Vector/1.0 (+https://map2vector.pages.dev)" } });
    clearTimeout(t);
    deStatus = (await r.text()).split("\n").slice(0, 8).join("\n");
  } catch (e) { deStatus = "unavailable: " + String(e && e.message || e); }
  return json({ checkedAt: new Date().toISOString(), from: "cloudflare", mirrors: res, deStatusFromCloudflare: deStatus }, 200);
}
