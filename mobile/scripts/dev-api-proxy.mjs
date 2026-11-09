import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const upstream = new URL(
  process.env.RENT_SYNC_API_UPSTREAM || "https://rentsync-theta.vercel.app",
);
const port = Number(process.env.RENT_SYNC_API_PROXY_PORT || 3001);
const localResetUpstream = new URL(
  process.env.RENT_SYNC_LOCAL_RESET_UPSTREAM || "http://127.0.0.1:3000",
);
const allowedOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?::\d+)?$/i;

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-rent-sync-client",
    Vary: "Origin",
  };
  if (origin && allowedOrigin.test(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

const server = createServer((incoming, outgoing) => {
  const origin = incoming.headers.origin || "";
  const headers = corsHeaders(origin);

  if (incoming.method === "OPTIONS") {
    outgoing.writeHead(204, headers);
    outgoing.end();
    return;
  }

  if (!["GET", "POST", "PATCH", "DELETE"].includes(incoming.method || "")) {
    outgoing.writeHead(405, { ...headers, "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  const forwardedHeaders = {};
  for (const name of ["accept", "authorization", "content-type", "x-rent-sync-client"]) {
    const value = incoming.headers[name];
    if (value) forwardedHeaders[name] = value;
  }

  const isTenantResetRequest =
    incoming.method === "POST" &&
    /^\/api\/owner\/tenants\/[^/]+\/reset-details(?:\?.*)?$/.test(incoming.url || "");
  const target = new URL(incoming.url || "/", isTenantResetRequest ? localResetUpstream : upstream);
  const sendRequest = target.protocol === "https:" ? httpsRequest : httpRequest;
  const request = sendRequest(
    target,
    {
      method: incoming.method,
      headers: forwardedHeaders,
    },
    (response) => {
      const responseHeaders = { ...response.headers };
      delete responseHeaders["access-control-allow-origin"];
      delete responseHeaders["access-control-allow-methods"];
      delete responseHeaders["access-control-allow-headers"];
      delete responseHeaders["access-control-allow-credentials"];
      delete responseHeaders["access-control-expose-headers"];
      delete responseHeaders["access-control-max-age"];
      delete responseHeaders.vary;
      outgoing.writeHead(response.statusCode || 502, { ...responseHeaders, ...headers });
      response.pipe(outgoing);
    },
  );

  request.on("error", (error) => {
    console.error("Unable to reach the configured Rent-Sync API.", error);
    if (!outgoing.headersSent) {
      outgoing.writeHead(502, { ...headers, "Content-Type": "application/json" });
    }
    outgoing.end(JSON.stringify({ error: "Unable to reach the configured Rent-Sync API." }));
  });

  incoming.pipe(request);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Rent-Sync API proxy listening at http://localhost:${port}`);
  console.log(`Forwarding API requests to ${upstream.origin}`);
  console.log(`Routing tenant reset requests to ${localResetUpstream.origin}`);
});
