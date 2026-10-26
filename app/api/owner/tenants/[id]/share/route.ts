import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";
import { encryptTenantShareToken } from "@/lib/tenant-share-token";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedTenant(id: string, mobileNumber: string) {
  const owner = await prisma.propertyOwner.findUnique({
    where: { mobileNumber },
    select: { id: true },
  });
  if (!owner) return null;
  return prisma.tenant.findFirst({
    where: { id, ownerId: owner.id },
    select: { id: true },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  if (!shouldUseDatabase()) {
    return NextResponse.json({ error: "Public tenant pages require database storage." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const tenant = await getOwnedTenant(id, session.mobileNumber);
    if (!tenant) return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        publicShareTokenHash: tokenHash,
        publicShareTokenEncrypted: encryptTenantShareToken(token),
      },
      select: { id: true },
    });

    return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to create tenant share link.", error);
    return NextResponse.json({ error: "Unable to create a tenant share link." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  if (!shouldUseDatabase()) {
    return NextResponse.json({ error: "Public tenant pages require database storage." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const tenant = await getOwnedTenant(id, session.mobileNumber);
    if (!tenant) return NextResponse.json({ error: "Tenant not found in your account." }, { status: 404 });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { publicShareTokenHash: null, publicShareTokenEncrypted: null },
      select: { id: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to revoke tenant share link.", error);
    return NextResponse.json({ error: "Unable to disable the public tenant page." }, { status: 503 });
  }
}
