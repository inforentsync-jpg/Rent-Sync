import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import {
  DevAgreementMergeError,
  splitDevAgreement,
} from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

class AgreementSplitError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }
  const { id } = await params;

  if (!shouldUseDatabase()) {
    try {
      return NextResponse.json(await splitDevAgreement(session.mobileNumber, id));
    } catch (error) {
      if (error instanceof DevAgreementMergeError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error("Unable to split local rental agreement.", error);
      return NextResponse.json({ error: "Unable to split this agreement." }, { status: 503 });
    }
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const owner = await transaction.propertyOwner.findUnique({
        where: { mobileNumber: session.mobileNumber },
        select: { id: true },
      });
      const agreement = await transaction.rentalAgreement.findFirst({
        where: {
          id,
          mergedIntoAgreementId: null,
          asset: {
            building: {
              OR: [{ ownerId: owner?.id }, { company: { ownerId: owner?.id } }],
            },
          },
        },
        include: { mergedMembers: true },
      });
      if (!owner || !agreement) {
        throw new AgreementSplitError("Merged agreement was not found in your account.", 404);
      }
      if (!agreement.mergedMembers.length) {
        throw new AgreementSplitError("This agreement is not a merged agreement.", 409);
      }
      const approvedAfterMerge =
        agreement.status === "ACTIVE" && Boolean(agreement.mandatoryDetailsApprovedAt);
      const freshCombinedAgreement = agreement.mergedMembers.every(
        (member) => member.mergedOriginalMonthlyRent !== null &&
          member.mergedOriginalSecurityDeposit !== null &&
          member.mergedOriginalStatus !== null,
      );
      if (freshCombinedAgreement) {
        await transaction.rentalAgreement.update({
          where: { id: agreement.id },
          data: { status: "CANCELLED" },
        });
        for (const member of agreement.mergedMembers) {
          await transaction.rentalAgreement.update({
            where: { id: member.id },
            data: {
              mergedIntoAgreementId: null,
              startDate: member.mergedOriginalStartDate ?? member.startDate,
              endDate: member.mergedOriginalEndDate ?? member.endDate,
              agreementYear: member.mergedOriginalAgreementYear ?? member.agreementYear,
              monthlyRent: member.mergedOriginalMonthlyRent ?? member.monthlyRent,
              securityDeposit: member.mergedOriginalSecurityDeposit ?? member.securityDeposit,
              status: approvedAfterMerge ? "DRAFT" : member.mergedOriginalStatus ?? "DRAFT",
              ownerApprovedAt: approvedAfterMerge ? null : member.mergedOriginalOwnerApprovedAt,
              tenantApprovedAt: approvedAfterMerge ? null : member.mergedOriginalTenantApprovedAt,
              mandatoryDetailsApprovedAt: approvedAfterMerge
                ? null
                : member.mergedOriginalMandatoryDetailsApprovedAt,
              mergedOriginalStatus: null,
              mergedOriginalStartDate: null,
              mergedOriginalEndDate: null,
              mergedOriginalAgreementYear: null,
              mergedOriginalMonthlyRent: null,
              mergedOriginalSecurityDeposit: null,
              mergedOriginalOwnerApprovedAt: null,
              mergedOriginalTenantApprovedAt: null,
              mergedOriginalMandatoryDetailsApprovedAt: null,
            },
          });
        }
        return { success: true, splitCount: agreement.mergedMembers.length };
      }

      if (
        !agreement.mergedOriginalStatus ||
        agreement.mergedOriginalMonthlyRent === null ||
        agreement.mergedOriginalSecurityDeposit === null
      ) {
        throw new AgreementSplitError("This agreement has incomplete merge data and cannot be split.", 409);
      }
      await transaction.rentalAgreement.update({
        where: { id: agreement.id },
        data: {
          monthlyRent: agreement.mergedOriginalMonthlyRent,
          securityDeposit: agreement.mergedOriginalSecurityDeposit,
          startDate: agreement.mergedOriginalStartDate ?? agreement.startDate,
          endDate: agreement.mergedOriginalEndDate ?? agreement.endDate,
          agreementYear: agreement.mergedOriginalAgreementYear ?? agreement.agreementYear,
          status: approvedAfterMerge ? "DRAFT" : agreement.mergedOriginalStatus,
          ownerApprovedAt: approvedAfterMerge ? null : agreement.mergedOriginalOwnerApprovedAt,
          tenantApprovedAt: approvedAfterMerge ? null : agreement.mergedOriginalTenantApprovedAt,
          mandatoryDetailsApprovedAt: approvedAfterMerge
            ? null
            : agreement.mergedOriginalMandatoryDetailsApprovedAt,
          mergedOriginalStatus: null,
          mergedOriginalStartDate: null,
          mergedOriginalEndDate: null,
          mergedOriginalAgreementYear: null,
          mergedOriginalMonthlyRent: null,
          mergedOriginalSecurityDeposit: null,
          mergedOriginalOwnerApprovedAt: null,
          mergedOriginalTenantApprovedAt: null,
          mergedOriginalMandatoryDetailsApprovedAt: null,
        },
      });
      for (const member of agreement.mergedMembers) {
        await transaction.rentalAgreement.update({
          where: { id: member.id },
          data: {
            mergedIntoAgreementId: null,
            status: approvedAfterMerge ? "DRAFT" : member.mergedOriginalStatus ?? "DRAFT",
            ownerApprovedAt: approvedAfterMerge ? null : member.ownerApprovedAt,
            tenantApprovedAt: approvedAfterMerge ? null : member.tenantApprovedAt,
            mandatoryDetailsApprovedAt: approvedAfterMerge
              ? null
              : member.mandatoryDetailsApprovedAt,
            mergedOriginalStatus: null,
          },
        });
      }
      return { success: true, splitCount: agreement.mergedMembers.length + 1 };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AgreementSplitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "This agreement changed while splitting. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to split database rental agreement.", error);
    return NextResponse.json({ error: "Unable to split this agreement." }, { status: 503 });
  }
}
