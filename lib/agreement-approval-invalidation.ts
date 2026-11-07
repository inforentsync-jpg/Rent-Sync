import type { Prisma } from "@prisma/client";

async function resetAgreementsForReview(
  transaction: Prisma.TransactionClient,
  where: Prisma.RentalAgreementWhereInput,
) {
  const agreements = await transaction.rentalAgreement.findMany({
    where,
    select: { id: true },
  });
  if (!agreements.length) return;
  const agreementIds = agreements.map(({ id }) => id);
  await transaction.rentalAgreement.updateMany({
    where: { id: { in: agreementIds } },
    data: {
      status: "DRAFT",
      ownerApprovedAt: null,
      tenantApprovedAt: null,
      mandatoryDetailsApprovedAt: null,
    },
  });
  await transaction.rentalAgreement.updateMany({
    where: { mergedIntoAgreementId: { in: agreementIds } },
    data: {
      mergedOriginalStatus: "DRAFT",
      mergedOriginalOwnerApprovedAt: null,
      mergedOriginalTenantApprovedAt: null,
      mergedOriginalMandatoryDetailsApprovedAt: null,
    },
  });
}

export async function requireAgreementReapprovalForAssets(
  transaction: Prisma.TransactionClient,
  assetIds: string[],
  excludeAgreementIds: string[] = [],
) {
  const distinctAssetIds = [...new Set(assetIds)];
  if (!distinctAssetIds.length) return;

  await resetAgreementsForReview(transaction, {
      mergedIntoAgreementId: null,
      status: { in: ["ACTIVE", "DRAFT"] },
      id: { notIn: excludeAgreementIds },
      OR: [
        { assetId: { in: distinctAssetIds } },
        { mergedMembers: { some: { assetId: { in: distinctAssetIds } } } },
      ],
  });
}

export async function requireAgreementReapprovalForTenant(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  excludeAgreementIds: string[] = [],
) {
  await resetAgreementsForReview(transaction, {
      tenantId,
      mergedIntoAgreementId: null,
      status: { in: ["ACTIVE", "DRAFT"] },
      id: { notIn: excludeAgreementIds },
  });
}

export async function requireAgreementReapprovalForOwner(
  transaction: Prisma.TransactionClient,
  ownerId: string,
  excludeAgreementIds: string[] = [],
) {
  await resetAgreementsForReview(transaction, {
      mergedIntoAgreementId: null,
      status: { in: ["ACTIVE", "DRAFT"] },
      id: { notIn: excludeAgreementIds },
      asset: {
        building: {
          OR: [{ ownerId }, { company: { ownerId } }],
        },
      },
  });
}

export async function syncAgreementAmountsFromAssets(
  transaction: Prisma.TransactionClient,
  assetIds: string[],
) {
  const distinctAssetIds = [...new Set(assetIds)];
  if (!distinctAssetIds.length) return;
  const agreements = await transaction.rentalAgreement.findMany({
    where: {
      mergedIntoAgreementId: null,
      status: { in: ["ACTIVE", "DRAFT"] },
      OR: [
        { assetId: { in: distinctAssetIds } },
        { mergedMembers: { some: { assetId: { in: distinctAssetIds } } } },
      ],
    },
    select: {
      id: true,
      assetId: true,
      mergedMembers: { select: { assetId: true } },
    },
  });
  for (const agreement of agreements) {
    const memberAssetIds = [...new Set([
      agreement.assetId,
      ...agreement.mergedMembers.map((member) => member.assetId),
    ])];
    const amounts = await transaction.asset.aggregate({
      where: { id: { in: memberAssetIds } },
      _sum: { monthlyRent: true, securityDeposit: true },
    });
    await transaction.rentalAgreement.update({
      where: { id: agreement.id },
      data: {
        monthlyRent: amounts._sum.monthlyRent ?? 0,
        securityDeposit: amounts._sum.securityDeposit ?? 0,
      },
    });
  }
}
