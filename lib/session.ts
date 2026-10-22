import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE = "rent_sync_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  mobileNumber: string;
  role: "SUPER_ADMIN" | "OWNER" | "TENANT";
  expiresAt: number;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createSessionToken(
  mobileNumber: string,
  role: SessionPayload["role"] = "SUPER_ADMIN",
) {
  const payload: SessionPayload = {
    mobileNumber,
    role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || token.length > 2048) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      (payload.role !== "SUPER_ADMIN" &&
        payload.role !== "OWNER" &&
        payload.role !== "TENANT") ||
      typeof payload.mobileNumber !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const session = await getSession();
  return session?.role === "SUPER_ADMIN" ? session : null;
}

export async function getOwnerSession() {
  const session = await getSession();
  return session?.role === "OWNER" ? session : null;
}

export async function getTenantSession() {
  const session = await getSession();
  return session?.role === "TENANT" ? session : null;
}

async function getSession() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const authorization = requestHeaders.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return verifySessionToken(bearerToken ?? cookieStore.get(SESSION_COOKIE)?.value);
}
