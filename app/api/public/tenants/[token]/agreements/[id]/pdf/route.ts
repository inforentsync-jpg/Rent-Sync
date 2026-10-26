import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { generateAgreementPdf } from "@/lib/agreement-pdf";
import { shouldUseDatabase } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  if (!shouldUseDatabase()) {
    return NextResponse.json(
      { error: "Public agreement downloads are unavailable in local demo storage." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { token, id } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
  }

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tenant = await prisma.tenant.findUnique({
      where: { publicShareTokenHash: tokenHash },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "This shared tenant page is unavailable." }, { status: 404 });
    }

    const agreement = await prisma.rentalAgreement.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        tenant: { select: { fullName: true, mobileNumber: true } },
        asset: {
          include: {
            building: true,
            termTemplates: {
              orderBy: { template: { name: "asc" } },
              include: {
                template: { include: { items: { orderBy: { position: "asc" } } } },
              },
            },
          },
        },
      },
    });
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found on this shared tenant page." }, { status: 404 });
    }

    const { asset, tenant: agreementTenant } = agreement;
    const building = asset.building;
    const bytes = await generateAgreementPdf({
      agreementNumber: agreement.agreementNumber,
      startDate: dateOnly(agreement.startDate),
      endDate: dateOnly(agreement.endDate),
      monthlyRent: agreement.monthlyRent,
      securityDeposit: agreement.securityDeposit,
      isDraft: agreement.status === "DRAFT",
      ownerName: building.ownerName,
      ownerMobile: building.ownerMobile,
      tenantName: agreementTenant.fullName,
      tenantMobile: agreementTenant.mobileNumber,
      buildingName: building.name,
      buildingAddress: building.address,
      city: building.city,
      state: building.state,
      postalCode: building.postalCode,
      assetName: asset.name,
      unitNumber: asset.unitNumber,
      assetType: asset.assetType,
      ward: asset.ward,
      templateTerms: asset.termTemplates.map(({ template }) => ({
        heading: template.name,
        items: template.items.map(({ position, text, importantObligation }) => ({
          position,
          text,
          importantObligation,
        })),
      })),
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
    console.error("Unable to generate a public agreement PDF.", error);
    return NextResponse.json(
      { error: "Unable to generate the agreement PDF." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
