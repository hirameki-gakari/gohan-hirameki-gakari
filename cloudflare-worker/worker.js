// Unsplash APIキーをブラウザに渡さないためのプロキシ。
// index.html は Unsplash を直接叩かず、ここ経由でアクセスする。
const ALLOWED_ORIGIN = "https://hirameki-gakari.github.io";
const UNSPLASH_DOWNLOAD_PREFIX = "https://api.unsplash.com/photos/";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/search") {
      const query = url.searchParams.get("query");
      if (!query) {
        return new Response(JSON.stringify({ error: "query is required" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }
      const upstream = new URL("https://api.unsplash.com/search/photos");
      upstream.searchParams.set("query", query);
      upstream.searchParams.set("per_page", "8");
      upstream.searchParams.set("orientation", "landscape");
      upstream.searchParams.set("client_id", env.UNSPLASH_ACCESS_KEY);

      const res = await fetch(upstream.toString());
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/download") {
      // Unsplashのガイドライン準拠のダウンロード計測用ping。
      // 任意URLへの踏み台にされないよう、Unsplashのdownload_locationだけ許可する。
      const location = url.searchParams.get("location");
      if (!location || !location.startsWith(UNSPLASH_DOWNLOAD_PREFIX)) {
        return new Response(JSON.stringify({ error: "invalid location" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }
      const sep = location.indexOf("?") === -1 ? "?" : "&";
      const upstream = location + sep + "client_id=" + encodeURIComponent(env.UNSPLASH_ACCESS_KEY);
      const res = await fetch(upstream);
      return new Response(null, { status: res.status, headers });
    }

    return new Response("Not found", { status: 404, headers });
  }
};
