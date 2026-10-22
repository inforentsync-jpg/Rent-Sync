import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { listDevOwnerBuildings } from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  if (!shouldUseDatabase()) {
    try {
      const buildings = await listDevOwnerBuildings(session.mobileNumber);
      if (!buildings) {
        return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
      }
      return NextResponse.json({ buildings });
    } catch (error) {
      console.error("Unable to load local owner buildings.", error);
      return NextResponse.json(
        { error: "Unable to load your local demo buildings." },
        { status: 503 },
      );
    }
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });
    }
    const buildings = await prisma.building.findMany({
      where: {
        OR: [
          { ownerId: owner.id },
          { ownerMobile: session.mobileNumber },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ buildings });
  } catch (error) {
    console.error("Unable to load owner buildings.", error);
    return NextResponse.json(
      { error: "Unable to load your buildings. Check the database connection and migrations." },
      { status: 503 },
    );
  }
}
