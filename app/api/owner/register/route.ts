import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { createDevOwner } from "@/lib/dev-store";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

type RegistrationBody = {
  fullName: string;
  mobileNumber: string;
  password: string;
};

function isRegistrationBody(value: unknown): value is RegistrationBody {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.mobileNumber === "string" &&
    typeof record.password === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isRegistrationBody(body)) {
    return NextResponse.json(
      { error: "Owner name, mobile number and password are required." },
      { status: 400 },
    );
  }

  const fullName = body.fullName.trim();
  const mobileNumber = body.mobileNumber.replace(/\D/g, "");
  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json(
      { error: "Enter your full name (2 to 120 characters)." },
      { status: 400 },
    );
  }
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json(
      { error: "Enter a valid mobile number with country code." },
      { status: 400 },
    );
  }
  if (body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(body.password);
  try {
    if (!shouldUseDatabase()) {
      const owner = await createDevOwner(fullName, mobileNumber, passwordHash);
      if (!owner) {
        return NextResponse.json(
          { error: "An owner account already exists for this mobile number." },
          { status: 409 },
        );
      }
    } else {
      await prisma.propertyOwner.create({
        data: { fullName, mobileNumber, passwordHash },
      });
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An owner account already exists for this mobile number." },
        { status: 409 },
      );
    }
    console.error("Unable to register property owner.", error);
    return NextResponse.json(
      { error: "Unable to save your owner account. Check the database connection and migrations." },
      { status: 503 },
    );
  }

  let token: string;
  try {
    token = createSessionToken(mobileNumber, "OWNER");
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
