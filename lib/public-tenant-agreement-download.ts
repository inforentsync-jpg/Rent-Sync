import { createHash } from "node:crypto";
import { prisma } from "@/lib/database";
import { type AgreementPdfData } from "@/lib/agreement-pdf.clean";

export async function getPublicTenantAgreementDownloadData(token: string, id: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tenant = await prisma.tenant.findUnique({
    where: { publicShareTokenHash: tokenHash },
    select: { id: true },
  });
  if (!tenant) return null;

  const agreement = await prisma.rentalAgreement.findFirst({
    where: { id, tenantId: tenant.id, mergedIntoAgreementId: null },
    include: {
      tenant: true,
      asset: {
        include: {
          building: {
            include: {
              owner: {
                select: {
                  fullName: true,
                  mobileNumber: true,
                  aadhaarNumber: true,
                  fullAddress: true,
                  addressLine1: true,
                  addressLine2: true,
                  district: true,
                  state: true,
                  city: true,
                  postalCode: true,
                  fatherName: true,
                },
              },
            },
          },
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
  if (!agreement) return null;

  const { asset, tenant: agreementTenant } = agreement;
  const building = asset.building;
  const assets = [...new Map(
    [asset, ...agreement.mergedMembers.map((member) => member.asset)]
      .map((entry) => [entry.id, entry]),
  ).values()];
  const groups = assets.flatMap((entry) =>
    entry.termTemplates.map(({ template }) => ({
      heading: template.name,
      items: template.items.map(({ position, text, importantObligation }) => ({
        position,
        text,
        importantObligation,
      })),
    })),
  );
  const uniqueGroups = new Map<string, typeof groups[number]>();
  for (const group of groups) {
    const current = uniqueGroups.get(group.heading) ?? { heading: group.heading, items: [] };
    const itemTexts = new Set(current.items.map((item) => item.text));
    for (const item of group.items) {
      if (!itemTexts.has(item.text)) {
        current.items.push(item);
        itemTexts.add(item.text);
      }
    }
    uniqueGroups.set(group.heading, current);
  }

  const data: AgreementPdfData = {
    agreementNumber: agreement.agreementNumber,
    startDate: agreement.startDate.toISOString().slice(0, 10),
    endDate: agreement.endDate.toISOString().slice(0, 10),
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
    assetName: assets.map((entry) => entry.name).join(", "),
    unitNumber: assets.map((entry) => entry.unitNumber).join(", "),
    assetType: asset.assetType,
    ward: [...new Set(assets.map((entry) => entry.ward).filter(Boolean))].join(", ") || null,
    panchayat: building.panchayat,
    roomNumber: assets.map((entry) => entry.roomNumber ?? entry.unitNumber).join(", "),
    usageDescription: agreementTenant.businessNature ?? null,
    tradeName: agreementTenant.businessName ?? null,
    templateTerms: [...uniqueGroups.values()],
  };
  return { agreement, data };
}
