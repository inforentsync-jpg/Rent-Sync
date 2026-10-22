import { NextResponse } from "next/server";
import { getDevOwner, getDevOwnerPasswordHash } from "@/lib/dev-store";
import { prisma } from "@/lib/database";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

type LoginInput = {
  mobileNumber: string;
  method: "otp" | "password";
  otp?: string;
  password?: string;
};

function isLoginInput(value: unknown): value is LoginInput {
  if (value === null || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.mobileNumber === "string" &&
    (body.method === "otp" || body.method === "password") &&
    (body.otp === undefined || typeof body.otp === "string") &&
    (body.password === undefined || typeof body.password === "string")
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isLoginInput(body)) {
    return NextResponse.json(
      { error: "Mobile number and a valid sign-in method are required." },
      { status: 400 },
    );
  }

  const mobileNumber = body.mobileNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }
  if (body.method === "otp") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "OTP sign-in is unavailable until a real OTP provider is configured." },
        { status: 503 },
      );
    }
    if (body.otp !== "1234") {
      return NextResponse.json({ error: "Incorrect development OTP. Use 1234." }, { status: 401 });
    }
  } else if (!body.password || body.password.length > 128) {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  try {
    const owner =
      process.env.NODE_ENV !== "production"
        ? await (async () => {
            const devOwner = await getDevOwner(mobileNumber);
            if (!devOwner) return null;
            const passwordHash =
              body.method === "password"
                ? await getDevOwnerPasswordHash(mobileNumber)
                : null;
            return { passwordHash };
          })()
        : await prisma.propertyOwner.findUnique({
            where: { mobileNumber },
            select: { passwordHash: true },
          });

    if (!owner) {
      return NextResponse.json({ error: "No owner account was found for this mobile number." }, { status: 404 });
    }
    if (
      body.method === "password" &&
      !(await verifyPassword(body.password!, owner.passwordHash))
    ) {
      return NextResponse.json({ error: "Incorrect mobile number or password." }, { status: 401 });
    }
  } catch (error) {
    console.error("Unable to verify owner sign-in.", error);
    return NextResponse.json({ error: "Unable to verify your account." }, { status: 503 });
  }

  try {
    const token = createSessionToken(mobileNumber, "OWNER");
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Session setup failed." },
      { status: 503 },
    );
  }
}
