import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import { generateAgreementPdf } from "@/lib/agreement-pdf.clean";
import { agreementContentDisposition, agreementDownloadFilename } from "@/lib/agreement-download-filename";
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const agreement = await prisma.rentalAgreement.findFirst({
      where: {
        id,
        tenantId: tenant.id,
        mergedIntoAgreementId: null,
        status: "ACTIVE",
        ownerApprovedAt: { not: null },
        mandatoryDetailsApprovedAt: { not: null },
        endDate: { gte: today },
      },
      include: {
        tenant: {
          select: {
            fullName: true, mobileNumber: true, fullAddress: true,
            addressLine1: true, addressLine2: true, district: true, state: true, city: true, postalCode: true,
            aadhaarNumber: true, businessName: true, businessNature: true,
          },
        },
        asset: {
          include: {
            building: { include: { owner: true } },
            termTemplates: {
              orderBy: { template: { name: "asc" } },
              include: {
                template: { include: { items: { orderBy: { position: "asc" } } } },
              },
            },
          },
        },
        mergedMembers: {
          orderBy: { createdAt: "asc" },
          include: {
            asset: {
              include: {
                termTemplates: {
                  orderBy: { template: { name: "asc" } },
                  include: {
                    template: { include: { items: { orderBy: { position: "asc" } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!agreement) {
      return NextResponse.json({ error: "Agreement not found on this shared tenant page." }, { status: 404 });
    }
    if (agreement.status === "ACTIVE" && !agreement.mandatoryDetailsApprovedAt) {
      return NextResponse.json(
        { error: "This agreement is being updated by the property owner and will be available after re-approval." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { asset, tenant: agreementTenant } = agreement;
    const building = asset.building;
    const mergedAssets = [...new Map(
      [asset, ...agreement.mergedMembers.map((member) => member.asset)]
        .map((mergedAsset) => [mergedAsset.id, mergedAsset]),
    ).values()];
    const templateTerms = mergedAssets.flatMap((mergedAsset) =>
      mergedAsset.termTemplates.map(({ template }) => ({
        heading: template.name,
        items: template.items.map(({ position, text, importantObligation }) => ({
          position,
          text,
          importantObligation,
        })),
      })),
    );
    const uniqueTemplateTerms = new Map<string, typeof templateTerms[number]>();
    for (const group of templateTerms) {
      const current = uniqueTemplateTerms.get(group.heading) ?? { heading: group.heading, items: [] };
      const itemTexts = new Set(current.items.map((item) => item.text));
      for (const item of group.items) {
        if (!itemTexts.has(item.text)) {
          current.items.push(item);
          itemTexts.add(item.text);
        }
      }
      uniqueTemplateTerms.set(group.heading, current);
    }
    const bytes = await generateAgreementPdf({
      agreementNumber: agreement.agreementNumber,
      startDate: dateOnly(agreement.startDate),
      endDate: dateOnly(agreement.endDate),
      monthlyRent: agreement.monthlyRent,
      securityDeposit: agreement.securityDeposit,
      isDraft: agreement.status === "DRAFT",
      ownerName: building.owner?.fullName || building.ownerName,
      ownerMobile: building.owner?.mobileNumber || building.ownerMobile,
      ownerAadhaar: building.owner?.aadhaarNumber ?? null,
      ownerAddress: building.owner?.fullAddress ?? null,
      ownerAddressLine1: building.owner?.addressLine1 ?? null,
      ownerAddressLine2: building.owner?.addressLine2 ?? null,
      ownerDistrict: building.owner?.district ?? null,
      ownerState: building.owner?.state ?? null,
      ownerCity: building.owner?.city ?? null,
      ownerPostalCode: building.owner?.postalCode ?? null,
      ownerFatherName: building.owner?.fatherName ?? null,
      tenantName: agreementTenant.fullName,
      tenantMobile: agreementTenant.mobileNumber,
      tenantAddress: agreementTenant.fullAddress ?? null,
      tenantAddressLine1: agreementTenant.addressLine1 ?? null,
      tenantAddressLine2: agreementTenant.addressLine2 ?? null,
      tenantDistrict: agreementTenant.district ?? null,
      tenantState: agreementTenant.state ?? null,
      tenantCity: agreementTenant.city ?? null,
      tenantPostalCode: agreementTenant.postalCode ?? null,
      tenantAadhaar: agreementTenant.aadhaarNumber ?? null,
      buildingName: building.name,
      buildingAddress: building.address,
      city: building.city,
      state: building.state,
      postalCode: building.postalCode,
      assetName: mergedAssets.map((entry) => entry.name).join(", "),
      unitNumber: mergedAssets.map((entry) => entry.unitNumber).join(", "),
      assetType: asset.assetType,
      ward: [...new Set(mergedAssets.map((entry) => entry.ward).filter(Boolean))].join(", ") || null,
      panchayat: building.panchayat,
      roomNumber: mergedAssets.map((entry) => entry.roomNumber ?? entry.unitNumber).join(", "),
      usageDescription: agreementTenant.businessNature ?? null,
      tradeName: agreementTenant.businessName ?? null,
      templateTerms: [...uniqueTemplateTerms.values()],
    });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": agreementContentDisposition(
          agreementDownloadFilename(
            agreementTenant.fullName,
            agreementTenant.businessName,
            agreement.startDate,
            "pdf",
          ),
        ),
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
