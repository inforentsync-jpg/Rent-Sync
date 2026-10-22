import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getDevOwnerAgreement } from "@/lib/dev-store";
import { generateAgreementPdf } from "@/lib/agreement-pdf";
import { getOwnerSession } from "@/lib/session";

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }
  const { id } = await params;

  try {
    const record = process.env.NODE_ENV !== "production"
      ? await getDevOwnerAgreement(session.mobileNumber, id)
      : await (async () => {
          const owner = await prisma.propertyOwner.findUnique({
            where: { mobileNumber: session.mobileNumber },
            select: { id: true, fullName: true, mobileNumber: true },
          });
          if (!owner) return null;
          const agreement = await prisma.rentalAgreement.findFirst({
            where: {
              id,
              asset: {
                building: {
                  OR: [
                    { ownerId: owner.id },
                    { company: { ownerId: owner.id } },
                  ],
                },
              },
            },
            include: {
              tenant: true,
              asset: { include: { building: true } },
            },
          });
          return agreement ? { owner, ...agreement } : null;
        })();
    if (!record) {
      return NextResponse.json({ error: "Agreement not found in your account." }, { status: 404 });
    }

    const agreement = "agreement" in record ? record.agreement : record;
    const owner = record.owner;
    const asset = "asset" in agreement ? agreement.asset : record.asset;
    const building =
      "building" in asset
        ? asset.building
        : "building" in record
          ? record.building
          : null;
    const tenant = "tenant" in agreement ? agreement.tenant : record.tenant;
    if (!building) {
      return NextResponse.json({ error: "Agreement property was not found." }, { status: 404 });
    }
    const bytes = await generateAgreementPdf({
      agreementNumber: agreement.agreementNumber,
      startDate: dateOnly(agreement.startDate),
      endDate: dateOnly(agreement.endDate),
      monthlyRent: agreement.monthlyRent,
      securityDeposit: agreement.securityDeposit,
      isDraft: agreement.status === "DRAFT",
      ownerName: owner.fullName,
      ownerMobile: owner.mobileNumber,
      tenantName: tenant.fullName,
      tenantMobile: tenant.mobileNumber,
      buildingName: building.name,
      buildingAddress: building.address,
      city: building.city,
      state: building.state,
      postalCode: building.postalCode,
      assetName: asset.name,
      unitNumber: asset.unitNumber,
      assetType: asset.assetType,
      ward: asset.ward ?? null,
    });
    const safeName = agreement.agreementNumber.replace(/[^A-Za-z0-9_-]/g, "");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName || "rental-agreement"}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to generate owner agreement PDF.", error);
    return NextResponse.json({ error: "Unable to generate the agreement PDF." }, { status: 503 });
  }
}
