import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://rentsync-theta.vercel.app",
]);

const corsOptions = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-rent-sync-client",
};

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const isLocalOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?::\d+)?$/i.test(origin);
  const isAllowedOrigin = allowedOrigins.has(origin) || isLocalOrigin;
  const headers = new Headers(corsOptions);
  headers.set("Vary", "Origin");

  if (isAllowedOrigin && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of headers) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
