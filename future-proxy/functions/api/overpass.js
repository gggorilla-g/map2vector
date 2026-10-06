// Overpass proxy: browser -> /api/osm (same origin) -> Overpass mirrors (server side, hedged)
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
  const probe = request.headers.get("X-M2V-Probe") === "1";
  const perTimeout = probe ? 8000 : 50000;   // per-mirror wait
  const stagger = probe ? 2500 : 8000;       // start the next mirror if no answer yet
  const errs = [];
  const ctls = [];
  return await new Promise(resolve => {
    let done = false, next = 0, pending = 0, timer = null;
    const finish = r => { if (done) return; done = true; clearTimeout(timer); ctls.forEach(c => c.abort()); resolve(r); };
    const startNext = () => {
      if (done || next >= MIRRORS.length) return;
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
            headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-M2V-Server": name(m), "X-M2V-Ms": String(Date.now() - t0) }
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

export async function onRequestGet() {
  return json({ ok: true, mirrors: MIRRORS.map(name), hedged: true }, 200);
}
