import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";
import { decryptTenantShareToken } from "@/lib/tenant-share-token";

export async function GET() {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  if (!shouldUseDatabase()) {
    return NextResponse.json({ error: "Public tenant pages require database storage." }, { status: 503 });
  }

  try {
    const owner = await prisma.propertyOwner.findUnique({
      where: { mobileNumber: session.mobileNumber },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner account was not found." }, { status: 404 });

    const tenants = await prisma.tenant.findMany({
      where: { ownerId: owner.id, publicShareTokenHash: { not: null } },
      select: { id: true, publicShareTokenEncrypted: true },
    });
    return NextResponse.json(
      {
        links: tenants.map((tenant) => ({
          tenantId: tenant.id,
          token: tenant.publicShareTokenEncrypted
            ? decryptTenantShareToken(tenant.publicShareTokenEncrypted)
            : null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load tenant share links.", error);
    return NextResponse.json({ error: "Unable to load tenant share links." }, { status: 503 });
  }
}
