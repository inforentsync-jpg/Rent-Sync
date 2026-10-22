import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { createDevBuilding, listDevBuildings } from "@/lib/dev-store";
import { getAdminSession } from "@/lib/session";

const fields = [
  "name",
  "address",
  "city",
  "state",
  "postalCode",
  "ownerName",
  "ownerMobile",
] as const;

function isBuildingInput(
  value: unknown,
): value is Record<(typeof fields)[number], string> {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return fields.every(
    (field) =>
      typeof record[field] === "string" &&
      record[field].trim().length > 0,
  );
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      return NextResponse.json({ buildings: await listDevBuildings() });
    } catch (error) {
      console.error("Failed to load local demo buildings.", error);
      return NextResponse.json(
        { error: "Unable to load local demo buildings." },
        { status: 503 },
      );
    }
  }

  try {
    const buildings = await prisma.building.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ buildings });
  } catch (error) {
    console.error("Failed to load buildings.", error);
    return NextResponse.json(
      { error: "Unable to load buildings. Check the database connection and migrations." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isBuildingInput(body)) {
    return NextResponse.json(
      { error: "Complete all building and owner fields." },
      { status: 400 },
    );
  }

  const values = Object.fromEntries(
    fields.map((field) => [field, body[field].trim()]),
  ) as Record<(typeof fields)[number], string>;
  const ownerMobileDigits = values.ownerMobile.replace(/\D/g, "");
  if (!/^\d{7,15}$/.test(ownerMobileDigits)) {
    return NextResponse.json(
      { error: "Enter a valid owner mobile number." },
      { status: 400 },
    );
  }
  values.ownerMobile =
    ownerMobileDigits.length === 10 ? `91${ownerMobileDigits}` : ownerMobileDigits;

  if (process.env.NODE_ENV !== "production") {
    try {
      const building = await createDevBuilding(values);
      return NextResponse.json({ building }, { status: 201 });
    } catch (error) {
      console.error("Failed to save local demo building.", error);
      return NextResponse.json(
        { error: "Unable to save the local demo building." },
        { status: 503 },
      );
    }
  }

  try {
    const building = await prisma.$transaction(async (transaction) => {
      const owner = await transaction.propertyOwner.upsert({
        where: { mobileNumber: values.ownerMobile },
        update: {},
        create: {
          fullName: values.ownerName,
          mobileNumber: values.ownerMobile,
        },
      });
      return transaction.building.create({
        data: { ...values, ownerId: owner.id },
      });
    });
    return NextResponse.json({ building }, { status: 201 });
  } catch (error) {
    console.error("Failed to create building.", error);
    return NextResponse.json(
      { error: "Unable to save the building. Check the database connection and migrations." },
      { status: 503 },
    );
  }
}
