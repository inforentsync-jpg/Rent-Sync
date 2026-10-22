import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { upsertDevOwner } from "@/lib/dev-store";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

type RegistrationBody = {
  fullName: string;
  mobileNumber: string;
  otp: string;
};

function isRegistrationBody(value: unknown): value is RegistrationBody {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.mobileNumber === "string" &&
    typeof record.otp === "string"
  );
}

export async function POST(request: Request) {
  const runtimeEnvironment: string = process.env.NODE_ENV;
  if (runtimeEnvironment === "production") {
    return NextResponse.json(
      { error: "Owner OTP registration is not enabled in production yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isRegistrationBody(body)) {
    return NextResponse.json(
      { error: "Owner name, mobile number and OTP are required." },
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
  if (body.otp !== "1234") {
    return NextResponse.json(
      { error: "Incorrect development OTP. Use 1234 for local testing." },
      { status: 401 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      await upsertDevOwner(fullName, mobileNumber);
    } catch (error) {
      console.error("Unable to register local property owner.", error);
      return NextResponse.json(
        { error: "Unable to save your local owner account." },
        { status: 503 },
      );
    }
  } else {
    try {
      await prisma.propertyOwner.upsert({
        where: { mobileNumber },
        update: { fullName },
        create: { fullName, mobileNumber },
      });
    } catch (error) {
      console.error("Unable to register property owner.", error);
      return NextResponse.json(
        { error: "Unable to save your owner account. Check the database connection and migrations." },
        { status: 503 },
      );
    }
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
