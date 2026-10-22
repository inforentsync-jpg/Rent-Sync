import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { setDevOwnerPassword } from "@/lib/dev-store";
import { hashPassword } from "@/lib/password";
import { getAdminSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Super-admin sign-in is required." }, { status: 401 });
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
      { error: "A valid owner mobile number and new password are required." },
      { status: 400 },
    );
  }

  const mobileNumber = body.mobileNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(mobileNumber)) {
    return NextResponse.json({ error: "Enter a valid owner mobile number." }, { status: 400 });
  }
  if (body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(body.password);
    if (!shouldUseDatabase()) {
      const updated = await setDevOwnerPassword(mobileNumber, passwordHash);
      if (!updated) {
        return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
      }
    } else {
      await prisma.propertyOwner.update({
        where: { mobileNumber },
        data: { passwordHash },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }
    console.error("Unable to reset owner password.", error);
    return NextResponse.json({ error: "Unable to reset the owner password." }, { status: 503 });
  }
}
