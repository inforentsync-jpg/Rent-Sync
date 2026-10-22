import { NextResponse } from "next/server";
import { getDevTenantMobile } from "@/lib/dev-store";
import { prisma } from "@/lib/database";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

type LoginBody = {
  mobileNumber: string;
  method: "otp" | "password";
  otp?: string;
  password?: string;
};

export async function POST(request: Request) {
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
    !("method" in body) ||
    (body.method !== "otp" && body.method !== "password") ||
    ("otp" in body && body.otp !== undefined && typeof body.otp !== "string") ||
    ("password" in body && body.password !== undefined && typeof body.password !== "string")
  ) {
    return NextResponse.json(
      { error: "Mobile number and a valid sign-in method are required." },
      { status: 400 },
    );
  }
  const loginBody = body as LoginBody;
  const mobileNumber = loginBody.mobileNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }
  if (loginBody.method === "password") {
    if (!loginBody.password || loginBody.password.length > 128) {
      return NextResponse.json({ error: "Enter your password." }, { status: 400 });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "OTP sign-in is unavailable until a real OTP provider is configured." },
        { status: 503 },
      );
    }
    if (loginBody.otp !== "1234") {
      return NextResponse.json({ error: "Incorrect development OTP. Use 1234." }, { status: 401 });
    }
  }

  try {
    const tenant = process.env.NODE_ENV !== "production"
      ? await getDevTenantMobile(mobileNumber)
      : await prisma.tenant.findUnique({
          where: { mobileNumber },
          select: { id: true, passwordHash: true },
        });
    if (!tenant) {
      return NextResponse.json(
        { error: "This mobile is not registered as a tenant. Ask the property owner to add you." },
        { status: 404 },
      );
    }
    if (
      loginBody.method === "password" &&
      !(await verifyPassword(
        loginBody.password!,
        "passwordHash" in tenant ? tenant.passwordHash ?? null : null,
      ))
    ) {
      return NextResponse.json({ error: "Incorrect mobile number or password." }, { status: 401 });
    }
  } catch (error) {
    console.error("Unable to find tenant for mobile login.", error);
    return NextResponse.json({ error: "Unable to verify tenant account." }, { status: 503 });
  }

  let token: string;
  try {
    token = createSessionToken(mobileNumber, "TENANT");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session setup failed." },
      { status: 503 },
    );
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
