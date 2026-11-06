import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { getDevOwnerAgreement } from "@/lib/dev-store";
import { generateAgreementPdf } from "@/lib/agreement-pdf.clean";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

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
    const record = !shouldUseDatabase()
      ? await getDevOwnerAgreement(session.mobileNumber, id)
      : await (async () => {
          const owner = await prisma.propertyOwner.findUnique({
            where: { mobileNumber: session.mobileNumber },
            select: {
              id: true, fullName: true, mobileNumber: true, aadhaarNumber: true,
              fullAddress: true, addressLine1: true, addressLine2: true,
              district: true, state: true, city: true, postalCode: true, fatherName: true,
            },
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
    const templateTerms = "termTemplates" in asset
      ? asset.termTemplates.map(({ template }) => ({
          heading: template.name,
          items: template.items.map(({ position, text, importantObligation }) => ({
            position,
            text,
            importantObligation,
          })),
        }))
      : [];
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
      ownerAadhaar: owner.aadhaarNumber ?? null,
      ownerAddress: owner.fullAddress ?? null,
      ownerAddressLine1: owner.addressLine1 ?? null,
      ownerAddressLine2: owner.addressLine2 ?? null,
      ownerDistrict: owner.district ?? null,
      ownerState: owner.state ?? null,
      ownerCity: owner.city ?? null,
      ownerPostalCode: owner.postalCode ?? null,
      ownerFatherName: owner.fatherName ?? null,
      tenantName: tenant.fullName,
      tenantMobile: tenant.mobileNumber,
      tenantAddress: tenant.fullAddress ?? null,
      tenantAddressLine1: tenant.addressLine1 ?? null,
      tenantAddressLine2: tenant.addressLine2 ?? null,
      tenantDistrict: tenant.district ?? null,
      tenantState: tenant.state ?? null,
      tenantCity: tenant.city ?? null,
      tenantPostalCode: tenant.postalCode ?? null,
      tenantAadhaar: tenant.aadhaarNumber ?? null,
      buildingName: building.name,
      buildingAddress: building.address,
      city: building.city,
      state: building.state,
      postalCode: building.postalCode,
      assetName: asset.name,
      unitNumber: asset.unitNumber,
      assetType: asset.assetType,
      ward: asset.ward ?? null,
      panchayat: building.panchayat ?? null,
      roomNumber: asset.roomNumber ?? asset.unitNumber,
      usageDescription: tenant.businessNature ?? null,
      tradeName: tenant.businessName ?? null,
      templateTerms,
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
