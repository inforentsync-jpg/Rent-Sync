import { createHash } from "node:crypto";
import { prisma } from "@/lib/database";

export async function getPublicTenantData(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tenant = await prisma.tenant.findUnique({
    where: { publicShareTokenHash: tokenHash },
    select: {
      fullName: true,
      mobileNumber: true,
      businessName: true,
      fullAddress: true,
      aadhaarNumber: true,
      fatherName: true,
      email: true,
      photoDataUrl: true,
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          asset: {
            select: {
              id: true,
              name: true,
              assetType: true,
              unitNumber: true,
              roomNumber: true,
              ward: true,
              ksmartBuildingId: true,
              ksrbId: true,
              monthlyRent: true,
              securityDeposit: true,
              building: { select: { name: true, city: true, state: true } },
            },
          },
        },
      },
      agreements: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          agreementNumber: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          securityDeposit: true,
          terms: true,
          importantTerms: true,
          status: true,
          ownerApprovedAt: true,
          tenantApprovedAt: true,
          asset: {
            select: {
              id: true,
              name: true,
              assetType: true,
              unitNumber: true,
              roomNumber: true,
              ward: true,
              ksmartBuildingId: true,
              ksrbId: true,
              monthlyRent: true,
              securityDeposit: true,
              building: { select: { name: true, city: true, state: true } },
              termTemplates: {
                orderBy: { template: { name: "asc" } },
                include: {
                  template: {
                    include: { items: { orderBy: { position: "asc" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!tenant) return null;
  return {
    tenant: {
      fullName: tenant.fullName,
      mobileNumber: tenant.mobileNumber,
      businessName: tenant.businessName,
      fullAddress: tenant.fullAddress,
      aadhaarNumber: tenant.aadhaarNumber,
      fatherName: tenant.fatherName,
      email: tenant.email,
      photoDataUrl: tenant.photoDataUrl,
    },
    assets: tenant.assets.map(({ asset }) => ({
      id: asset.id,
      name: asset.name,
      assetType: asset.assetType,
      unitNumber: asset.unitNumber,
      roomNumber: asset.roomNumber,
      ward: asset.ward,
      ksmartBuildingId: asset.ksmartBuildingId,
      ksrbId: asset.ksrbId,
      monthlyRent: asset.monthlyRent,
      securityDeposit: asset.securityDeposit,
      buildingName: asset.building.name,
      city: asset.building.city,
      state: asset.building.state,
    })),
    agreements: tenant.agreements.map(({ asset, ...agreement }) => ({
      ...agreement,
      startDate: agreement.startDate.toISOString().slice(0, 10),
      endDate: agreement.endDate.toISOString().slice(0, 10),
      ownerApprovedAt: agreement.ownerApprovedAt?.toISOString() ?? null,
      tenantApprovedAt: agreement.tenantApprovedAt?.toISOString() ?? null,
      propertyName: `${asset.name} · Unit ${asset.unitNumber}`,
      buildingName: asset.building.name,
      buildingAddress: [asset.building.city, asset.building.state].filter(Boolean).join(", "),
      assetId: asset.id,
      tenantId: "",
      templateTerms: asset.termTemplates.map(({ template }) => ({
        templateId: template.id,
        heading: template.name,
        items: template.items.map(({ id, position, text, importantObligation }) => ({
          id,
          position,
          text,
          importantObligation,
        })),
      })),
    })),
  };
}
