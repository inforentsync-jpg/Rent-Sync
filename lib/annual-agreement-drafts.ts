import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database";
import { getUpcomingAgreementTerm } from "@/lib/agreement-year";

export async function generateAnnualAgreementDrafts(now = new Date()) {
  const term = getUpcomingAgreementTerm(now);
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      monthlyRent: true,
      securityDeposit: true,
      building: {
        select: {
          ownerId: true,
          company: { select: { ownerId: true } },
        },
      },
      tenants: {
        select: {
          tenantId: true,
          tenant: { select: { ownerId: true } },
        },
      },
      agreements: {
        where: { agreementYear: term.year },
        select: { tenantId: true },
      },
    },
  });

  const existingPairs = new Set(
    assets.flatMap((asset) =>
      asset.agreements.map((agreement) => `${asset.id}:${agreement.tenantId}`),
    ),
  );
  const draftData = assets.flatMap((asset) => {
    const propertyOwnerId = asset.building.company?.ownerId ?? asset.building.ownerId;
    return asset.tenants.flatMap((assignment) => {
      if (
        assignment.tenant.ownerId !== propertyOwnerId ||
        existingPairs.has(`${asset.id}:${assignment.tenantId}`)
      ) {
        return [];
      }
      return [{
        agreementNumber: `RS-${term.year}-${randomUUID().slice(0, 8).toUpperCase()}`,
        assetId: asset.id,
        tenantId: assignment.tenantId,
        agreementYear: term.year,
        startDate: new Date(`${term.startDate}T00:00:00.000Z`),
        endDate: new Date(`${term.endDate}T00:00:00.000Z`),
        monthlyRent: asset.monthlyRent,
        securityDeposit: asset.securityDeposit,
        terms: "",
        status: "DRAFT",
      }];
    });
  });

  if (draftData.length === 0) return 0;
  const result = await prisma.rentalAgreement.createMany({
    data: draftData,
    skipDuplicates: true,
  });
  return result.count;
}
