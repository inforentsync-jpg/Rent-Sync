import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database";
import { getRenewalAgreementTerm } from "@/lib/agreement-year";

export async function generateAnnualAgreementDrafts(now = new Date()) {
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
        select: {
          tenantId: true,
          agreementYear: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  const draftData = assets.flatMap((asset) => {
    const propertyOwnerId = asset.building.company?.ownerId ?? asset.building.ownerId;
    return asset.tenants.flatMap((assignment) => {
      if (assignment.tenant.ownerId !== propertyOwnerId) return [];
      const tenantAgreements = asset.agreements
        .filter((agreement) => agreement.tenantId === assignment.tenantId)
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      const latestAgreement = tenantAgreements[0];
      if (!latestAgreement) return [];
      const term = getRenewalAgreementTerm(
        latestAgreement.startDate.toISOString().slice(0, 10),
        latestAgreement.endDate.toISOString().slice(0, 10),
        now,
      );
      if (!term || tenantAgreements.some((agreement) => agreement.agreementYear === term.year)) {
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
        importantTerms: "",
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
