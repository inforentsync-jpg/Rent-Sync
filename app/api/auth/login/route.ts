import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeIndianMobile(value: string) {
  const mobile = normalizeMobile(value);
  return mobile.length === 12 && mobile.startsWith("91") ? mobile.slice(2) : mobile;
}

export async function POST(request: Request) {
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { error: "Super-admin sign-in is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("mobileNumber" in body) ||
    typeof body.mobileNumber !== "string" ||
    !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "A valid mobile number and password are required." },
      { status: 400 },
    );
  }

  const mobileNumber = normalizeIndianMobile(body.mobileNumber);
  const configuredAdminNumber = normalizeIndianMobile(
    process.env.SUPER_ADMIN_MOBILE_NUMBER ?? "919567048809",
  );
  if (!/^\d{10}$/.test(mobileNumber) || mobileNumber !== configuredAdminNumber) {
    return NextResponse.json(
      { error: "This mobile number is not authorized for super-admin access." },
      { status: 403 },
    );
  }

  const providedPasswordHash = createHash("sha256").update(body.password).digest();
  const configuredPasswordHash = createHash("sha256").update(adminPassword).digest();
  if (!timingSafeEqual(providedPasswordHash, configuredPasswordHash)) {
    return NextResponse.json(
      { error: "Incorrect mobile number or password." },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = createSessionToken(`91${mobileNumber}`);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session setup failed." },
      { status: 503 },
    );
  }

  const result = NextResponse.json({ success: true });
  result.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return result;
}
