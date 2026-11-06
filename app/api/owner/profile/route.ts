import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getDevOwner, updateDevOwnerProfile } from "@/lib/dev-store";
import { hashPassword } from "@/lib/password";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";
import { formatPartyAddress, PARTY_ADDRESS_LIMITS } from "@/lib/party-address";

type ProfileInput = {
  fullName: string;
  email: string;
  aadhaarNumber?: string;
  fullAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  fatherName?: string;
  password?: string;
};

function isProfileInput(value: unknown): value is ProfileInput {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.fullName === "string" &&
    typeof record.email === "string" &&
    (record.aadhaarNumber === undefined || typeof record.aadhaarNumber === "string") &&
    (record.fullAddress === undefined || typeof record.fullAddress === "string") &&
    (record.addressLine1 === undefined || typeof record.addressLine1 === "string") &&
    (record.addressLine2 === undefined || typeof record.addressLine2 === "string") &&
    (record.district === undefined || typeof record.district === "string") &&
    (record.state === undefined || typeof record.state === "string") &&
    (record.city === undefined || typeof record.city === "string") &&
    (record.postalCode === undefined || typeof record.postalCode === "string") &&
    (record.fatherName === undefined || typeof record.fatherName === "string") &&
    (record.password === undefined || typeof record.password === "string")
  );
}

function profileResponse(
  owner: {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  aadhaarNumber?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  fatherName?: string | null;
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
        aadhaarNumber: owner.aadhaarNumber ?? null,
        fullAddress: owner.fullAddress ?? null,
        addressLine1: owner.addressLine1 ?? null,
        addressLine2: owner.addressLine2 ?? null,
        district: owner.district ?? null,
        state: owner.state ?? null,
        city: owner.city ?? null,
        postalCode: owner.postalCode ?? null,
        fatherName: owner.fatherName ?? null,
        createdAt:
          owner.createdAt instanceof Date
            ? owner.createdAt.toISOString()
            : owner.createdAt,
        passwordConfigured,
      },
      testOtp: shouldUseDatabase() ? null : "1234",
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
      !shouldUseDatabase()
        ? await getDevOwner(session.mobileNumber)
        : await prisma.propertyOwner.findUnique({
            where: { mobileNumber: session.mobileNumber },
            select: {
              id: true,
              fullName: true,
              mobileNumber: true,
              email: true,
              aadhaarNumber: true,
              fullAddress: true,
              addressLine1: true,
              addressLine2: true,
              district: true,
              state: true,
              city: true,
              postalCode: true,
              fatherName: true,
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
  const aadhaarNumber = (body.aadhaarNumber ?? "").replace(/[^0-9]/g, "").trim();
  const fullAddress = (body.fullAddress ?? "").trim();
  const addressLine1 = (body.addressLine1 ?? "").trim();
  const addressLine2 = (body.addressLine2 ?? "").trim();
  const district = (body.district ?? "").trim();
  const state = (body.state ?? "").trim();
  const city = (body.city ?? "").trim();
  const postalCode = (body.postalCode ?? "").trim();
  const fatherName = (body.fatherName ?? "").trim();
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
  if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
    return NextResponse.json({ error: "Enter a valid 12-digit Aadhaar number." }, { status: 400 });
  }
  if (
    fullAddress.length > 2000 ||
    addressLine1.length > PARTY_ADDRESS_LIMITS.addressLine1 ||
    addressLine2.length > PARTY_ADDRESS_LIMITS.addressLine2 ||
    district.length > PARTY_ADDRESS_LIMITS.district ||
    state.length > PARTY_ADDRESS_LIMITS.state ||
    city.length > PARTY_ADDRESS_LIMITS.city ||
    postalCode.length > PARTY_ADDRESS_LIMITS.postalCode ||
    fatherName.length > 120
  ) {
    return NextResponse.json({ error: "Check the owner address and father's name length." }, { status: 400 });
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
      !shouldUseDatabase()
        ? await updateDevOwnerProfile(
            session.mobileNumber,
            fullName,
            email || null,
            passwordHash,
            {
              aadhaarNumber: aadhaarNumber || null,
              fullAddress: formatPartyAddress({ addressLine1, addressLine2, district, state, city, postalCode }) || fullAddress || null,
              addressLine1: addressLine1 || null,
              addressLine2: addressLine2 || null,
              district: district || null,
              state: state || null,
              city: city || null,
              postalCode: postalCode || null,
              fatherName: fatherName || null,
            },
          )
        : await (async () => {
            const currentOwner = await prisma.propertyOwner.findUnique({
              where: { mobileNumber: session.mobileNumber },
              select: { id: true },
            });
            if (!currentOwner) return null;
            return prisma.$transaction(async (transaction) => {
              await transaction.building.updateMany({
                where: { ownerId: currentOwner.id },
                data: { ownerName: fullName },
              });
              return transaction.propertyOwner.update({
                where: { id: currentOwner.id },
                data: {
                  fullName,
                  email: email || null,
                  aadhaarNumber: aadhaarNumber || null,
                  fullAddress: formatPartyAddress({ addressLine1, addressLine2, district, state, city, postalCode }) || fullAddress || null,
                  addressLine1: addressLine1 || null,
                  addressLine2: addressLine2 || null,
                  district: district || null,
                  state: state || null,
                  city: city || null,
                  postalCode: postalCode || null,
                  fatherName: fatherName || null,
                  ...(passwordHash ? { passwordHash } : {}),
                },
                select: {
                  id: true,
                  fullName: true,
                  mobileNumber: true,
                  email: true,
                  aadhaarNumber: true,
                  fullAddress: true,
                  addressLine1: true,
                  addressLine2: true,
                  district: true,
                  state: true,
                  city: true,
                  postalCode: true,
                  fatherName: true,
                  createdAt: true,
                  passwordHash: true,
                },
              });
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
