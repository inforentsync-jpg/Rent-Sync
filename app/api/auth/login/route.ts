import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

function normalizeMobile(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: Request) {
  const runtimeEnvironment: string = process.env.NODE_ENV;
  if (runtimeEnvironment === "production") {
    return NextResponse.json(
      { error: "Admin sign-in is disabled until production OTP is configured." },
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

  const mobileNumber = normalizeMobile(body.mobileNumber);
  const configuredAdminNumber = normalizeMobile(
    process.env.SUPER_ADMIN_MOBILE_NUMBER ?? "919567048809",
  );
  if (!/^\d{7,15}$/.test(mobileNumber) || mobileNumber !== configuredAdminNumber) {
    return NextResponse.json(
      { error: "This mobile number is not authorized for super-admin access." },
      { status: 403 },
    );
  }

  if (body.password !== "1234") {
    return NextResponse.json(
      { error: "Incorrect test password." },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = createSessionToken(mobileNumber);
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
