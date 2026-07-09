/**
 * westend-tool — Worker mit Static Assets + API-Proxy (v2.5.0, 09.07.2026)
 * ============================================================================
 * Ersetzt das bisherige reine Assets-Setup: zusätzlich ein main-Script, das
 *   /api/*  → an den Payment-Worker proxied (X-API-Key serverseitig injiziert)
 *   sonst   → Static Assets ausliefert (env.ASSETS.fetch)
 *
 * Sicherheit: Die Tool-Domain (booking-hotelwestend.de) liegt hinter CF Access
 * (Policy „Hotelteam"). Dieser Worker IST der Origin hinter Access → CF Access
 * injiziert Cf-Access-Authenticated-User-Email direkt in den Request. Der
 * PAYMENT_WORKER_API_KEY liegt NUR als Worker-Secret hier, NIE im Browser.
 *
 * Env nötig: ASSETS (Binding), PAYMENT_WORKER_BASE, PAYMENT_WORKER_API_KEY.
 */

// Staff-Identity fürs Audit (X-Staff-Email). NICHT sicherheitskritisch — der
// Payment-Worker gated auf den API-Key, nicht auf diese Mail. Best-effort:
// im Worker-Kontext hinter CF Access ist der Header i.d.R. direkt vorhanden;
// Cookie-Fallback über /cdn-cgi/access/get-identity nur, falls nicht.
async function getAccessIdentity(request) {
  const direct = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (direct) return direct;
  try {
    const u = new URL(request.url);
    u.pathname = "/cdn-cgi/access/get-identity";
    u.search = "";
    const res = await fetch(u.toString(), { headers: { Cookie: request.headers.get("Cookie") || "" } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /api/* → Payment-Worker-Proxy ────────────────────────────────
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      // v2.5.0 Hardening: /api NUR mit CF-Access-Kontext. Die geschützte Custom
      // Domain injiziert Cf-Access-Jwt-Assertion in jeden Origin-Request. Fehlt der
      // Header (Aufruf außerhalb von Access), KEIN Key-Injection → 403.
      // Gast-Pfade /pay + /confirm laufen als Static Assets am /api-Zweig vorbei und
      // brauchen den Header NICHT (kommen per Access-Bypass ohne JWT).
      if (!request.headers.get("Cf-Access-Jwt-Assertion")) {
        return new Response(JSON.stringify({ error: "Forbidden: kein CF-Access-Kontext" }),
          { status: 403, headers: { "Content-Type": "application/json" } });
      }
      const base = env.PAYMENT_WORKER_BASE;
      if (!base) {
        return new Response(JSON.stringify({ error: "PAYMENT_WORKER_BASE nicht gesetzt" }),
          { status: 500, headers: { "Content-Type": "application/json" } });
      }
      // /api-Präfix entfernen → echte Payment-Worker-Route
      const targetPath = url.pathname.replace(/^\/api/, "") || "/";
      const targetUrl = `${base}${targetPath}${url.search}`;

      const headers = new Headers(request.headers);
      headers.delete("host");
      if (env.PAYMENT_WORKER_API_KEY) headers.set("X-API-Key", env.PAYMENT_WORKER_API_KEY);
      const email = await getAccessIdentity(request);
      if (email) headers.set("X-Staff-Email", email);

      const init = { method: request.method, headers, redirect: "manual" };
      if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

      try {
        return await fetch(targetUrl, init);
      } catch (err) {
        return new Response(JSON.stringify({ error: "Proxy-Fehler beim Aufruf des Payment-Workers", details: err.message }),
          { status: 502, headers: { "Content-Type": "application/json" } });
      }
    }

    // ── alles andere → Static Assets (inkl. /pay → pay.html via html_handling) ──
    return env.ASSETS.fetch(request);
  },
};
