import { NextResponse } from "next/server";
import { getDevTenantMobile } from "@/lib/dev-store";
import { prisma } from "@/lib/database";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const runtimeEnvironment: string = process.env.NODE_ENV;
  if (runtimeEnvironment === "production") {
    return NextResponse.json(
      { error: "Test OTP login is disabled in production." },
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
    !("otp" in body) ||
    typeof body.otp !== "string"
  ) {
    return NextResponse.json({ error: "Mobile number and OTP are required." }, { status: 400 });
  }
  const mobileNumber = body.mobileNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }
  if (body.otp !== "1234") {
    return NextResponse.json({ error: "Incorrect test OTP. Use 1234." }, { status: 401 });
  }

  try {
    const tenant = process.env.NODE_ENV !== "production"
      ? await getDevTenantMobile(mobileNumber)
      : await prisma.tenant.findUnique({ where: { mobileNumber }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json(
        { error: "This mobile is not registered as a tenant. Ask the property owner to add you." },
        { status: 404 },
      );
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
