import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getDevOwner, updateDevOwnerProfile } from "@/lib/dev-store";
import { hashPassword } from "@/lib/password";
import { getOwnerSession } from "@/lib/session";

type ProfileInput = {
  fullName: string;
  email: string;
  password?: string;
};

function isProfileInput(value: unknown): value is ProfileInput {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.email === "string" &&
    (record.password === undefined || typeof record.password === "string")
  );
}

function profileResponse(
  owner: {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  createdAt: Date | string;
  },
  passwordConfigured: boolean,
) {
  return NextResponse.json(
    {
      profile: {
        id: owner.id,
        fullName: owner.fullName,
        mobileNumber: owner.mobileNumber,
        email: owner.email,
        createdAt:
          owner.createdAt instanceof Date
            ? owner.createdAt.toISOString()
            : owner.createdAt,
        passwordConfigured,
      },
      testOtp: process.env.NODE_ENV === "production" ? null : "1234",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  try {
    const owner =
      process.env.NODE_ENV !== "production"
        ? await getDevOwner(session.mobileNumber)
        : await prisma.propertyOwner.findUnique({
            where: { mobileNumber: session.mobileNumber },
            select: {
              id: true,
              fullName: true,
              mobileNumber: true,
              email: true,
              passwordHash: true,
              createdAt: true,
            },
          });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }
    return profileResponse(
      { ...owner, email: owner.email ?? null },
      Boolean("passwordHash" in owner && owner.passwordHash),
    );
  } catch (error) {
    console.error("Unable to load owner profile.", error);
    return NextResponse.json({ error: "Unable to load your profile." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isProfileInput(body)) {
    return NextResponse.json(
      { error: "Profile name and email are required." },
      { status: 400 },
    );
  }

  const fullName = body.fullName.trim();
  const email = body.email.trim().toLowerCase();
  const password = body.password ?? "";
  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json(
      { error: "Enter your full name (2 to 120 characters)." },
      { status: 400 },
    );
  }
  if (email.length > 254 || (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password && (password.length < 8 || password.length > 128)) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = password ? await hashPassword(password) : undefined;
    const owner =
      process.env.NODE_ENV !== "production"
        ? await updateDevOwnerProfile(
            session.mobileNumber,
            fullName,
            email || null,
            passwordHash,
          )
        : await (async () => {
            const currentOwner = await prisma.propertyOwner.findUnique({
              where: { mobileNumber: session.mobileNumber },
              select: { id: true },
            });
            if (!currentOwner) return null;
            return prisma.propertyOwner.update({
              where: { id: currentOwner.id },
              data: {
                fullName,
                email: email || null,
                ...(passwordHash ? { passwordHash } : {}),
              },
              select: {
                id: true,
                fullName: true,
                mobileNumber: true,
                email: true,
                createdAt: true,
                passwordHash: true,
              },
            });
          })();

    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }
    return profileResponse(
      { ...owner, email: owner.email ?? null },
      Boolean("passwordHash" in owner && owner.passwordHash),
    );
  } catch (error) {
    console.error("Unable to update owner profile.", error);
    return NextResponse.json({ error: "Unable to save your profile." }, { status: 503 });
  }
}
