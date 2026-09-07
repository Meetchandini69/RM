// The browser always uses /api on the Pages origin. Only this server-side
// function knows the Railway URL and shared proxy secret.
export async function onRequest({ request, env }) {
  const jsonError = (message, status) =>
    new Response(JSON.stringify({ message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  let api;
  try {
    api = new URL(env.API_ORIGIN);
    if (
      api.protocol !== "https:" ||
      api.username ||
      api.password ||
      api.pathname !== "/" ||
      api.search ||
      api.hash ||
      (env.API_PROXY_SECRET?.length || 0) < 32
    )
      throw new Error();
  } catch {
    return jsonError("API connection is not configured.", 503);
  }

  const incoming = new URL(request.url);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== incoming.origin)
      return jsonError("Request origin is not allowed.", 403);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site")
      return jsonError("Cross-site requests are not allowed.", 403);
  }
  api.pathname = incoming.pathname;
  api.search = incoming.search;
  const headers = new Headers(request.headers);
  headers.delete("Host");
  headers.delete("X-Forwarded-For");
  headers.delete("Forwarded");
  headers.set("X-API-Proxy-Secret", env.API_PROXY_SECRET);
  headers.set(
    "X-Client-IP",
    request.headers.get("CF-Connecting-IP") || "unknown",
  );
  try {
    const upstream = await fetch(api, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    const response = new Response(upstream.body, upstream);
    response.headers.set("Cache-Control", "no-store");
    response.headers.delete("Access-Control-Allow-Origin");
    response.headers.delete("Access-Control-Allow-Credentials");
    return response;
  } catch {
    return jsonError(
      "The API is temporarily unavailable. Please try again.",
      502,
    );
  }
}
