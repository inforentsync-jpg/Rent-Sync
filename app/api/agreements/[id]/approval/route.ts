import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import {
  DevAgreementConflictError,
  reviewDevAgreement,
  type AgreementReviewInput,
} from "@/lib/dev-store";
import { getNextAgreementApprovals } from "@/lib/agreement-approval";
import { hasValidElevenMonthTerm } from "@/lib/rental-agreement";
import { getOwnerSession, getTenantSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

class AgreementApprovalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseReviewInput(value: unknown): AgreementReviewInput | null {
  if (!isRecord(value)) return null;
  const { startDate, endDate, monthlyRent, securityDeposit, terms, importantTerms } = value;
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !hasValidElevenMonthTerm(startDate, endDate) ||
    typeof monthlyRent !== "number" ||
    !Number.isSafeInteger(monthlyRent) ||
    monthlyRent <= 0 ||
    typeof securityDeposit !== "number" ||
    !Number.isSafeInteger(securityDeposit) ||
    securityDeposit < 0 ||
    typeof terms !== "string" ||
    terms.trim().length > 2000 ||
    typeof importantTerms !== "string" ||
    importantTerms.trim().length > 4000
  ) {
    return null;
  }
  return {
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
    terms: terms.trim(),
    importantTerms: importantTerms.trim(),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ownerSession = await getOwnerSession();
  const tenantSession = await getTenantSession();
  if (!ownerSession && !tenantSession) {
    return NextResponse.json({ error: "Agreement owner or tenant sign-in is required." }, { status: 401 });
  }
  const role = ownerSession ? "OWNER" : "TENANT";
  const mobileNumber = ownerSession?.mobileNumber ?? tenantSession?.mobileNumber;
  if (!mobileNumber) {
    return NextResponse.json({ error: "Agreement owner or tenant sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const input = parseReviewInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Enter a valid 11-month agreement, rent, deposit, and terms before approving." },
      { status: 400 },
    );
  }
  const { id } = await params;

  if (!shouldUseDatabase()) {
    try {
      const agreement = await reviewDevAgreement(mobileNumber, role, id, input);
      if (!agreement) {
        return NextResponse.json(
          { error: "This agreement is not available for your approval, or it has already been approved by you." },
          { status: 409 },
        );
      }
      return NextResponse.json({ agreement });
    } catch (error) {
      if (error instanceof DevAgreementConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error("Unable to save local agreement approval.", error);
      return NextResponse.json({ error: "Unable to save agreement approval." }, { status: 503 });
    }
  }

  try {
    const agreement = await prisma.$transaction(
      async (transaction) => {
        const current = await transaction.rentalAgreement.findUnique({
          where: { id },
          include: {
            tenant: { select: { mobileNumber: true } },
            asset: {
              select: {
                building: {
                  select: {
                    ownerId: true,
                    company: { select: { ownerId: true } },
                  },
                },
              },
            },
          },
        });
        if (!current) throw new AgreementApprovalError("Agreement not found.", 404);
        if (current.status !== "DRAFT") {
          throw new AgreementApprovalError("Only draft agreements can be approved.", 409);
        }

        if (role === "OWNER") {
          const owner = await transaction.propertyOwner.findUnique({
            where: { mobileNumber },
            select: { id: true },
          });
          const propertyOwnerId =
            current.asset.building.company?.ownerId ?? current.asset.building.ownerId;
          if (!owner || owner.id !== propertyOwnerId) {
            throw new AgreementApprovalError("This agreement is not assigned to your owner account.", 404);
          }
          if (current.ownerApprovedAt) {
            throw new AgreementApprovalError("You have already approved this agreement.", 409);
          }
        } else {
          if (current.tenant.mobileNumber !== mobileNumber) {
            throw new AgreementApprovalError("This agreement is not assigned to your tenant account.", 404);
          }
          if (!current.ownerApprovedAt) {
            throw new AgreementApprovalError("The owner must approve this agreement before you.", 409);
          }
          if (current.tenantApprovedAt) {
            throw new AgreementApprovalError("You have already approved this agreement.", 409);
          }
        }

        const startsAt = new Date(`${input.startDate}T00:00:00.000Z`);
        const endsAt = new Date(`${input.endDate}T00:00:00.000Z`);
        const duplicateYear = await transaction.rentalAgreement.findFirst({
          where: {
            id: { not: id },
            assetId: current.assetId,
            tenantId: current.tenantId,
            agreementYear: Number(input.startDate.slice(0, 4)),
          },
          select: { id: true },
        });
        if (duplicateYear) {
          throw new AgreementApprovalError("An agreement already exists for this tenant, asset, and year.", 409);
        }
        const overlapping = await transaction.rentalAgreement.findFirst({
          where: {
            id: { not: id },
            assetId: current.assetId,
            status: "ACTIVE",
            startDate: { lte: endsAt },
            endDate: { gte: startsAt },
          },
          select: { id: true },
        });
        if (overlapping) {
          throw new AgreementApprovalError("This asset already has an active agreement for those dates.", 409);
        }

        const hasChanges =
          current.startDate.toISOString().slice(0, 10) !== input.startDate ||
          current.endDate.toISOString().slice(0, 10) !== input.endDate ||
          current.monthlyRent !== input.monthlyRent ||
          current.securityDeposit !== input.securityDeposit ||
          current.terms !== input.terms ||
          current.importantTerms !== input.importantTerms;
        const { ownerApprovedAt, tenantApprovedAt } = getNextAgreementApprovals(
          current,
          role,
          hasChanges,
        );
        return transaction.rentalAgreement.update({
          where: { id },
          data: {
            startDate: startsAt,
            endDate: endsAt,
            agreementYear: Number(input.startDate.slice(0, 4)),
            monthlyRent: input.monthlyRent,
            securityDeposit: input.securityDeposit,
            terms: input.terms,
            importantTerms: input.importantTerms,
            ownerApprovedAt,
            tenantApprovedAt,
            status: ownerApprovedAt && tenantApprovedAt ? "ACTIVE" : "DRAFT",
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    return NextResponse.json({ agreement });
  } catch (error) {
    if (error instanceof AgreementApprovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "An agreement already exists for this tenant, asset, and year." },
        { status: 409 },
      );
    }
    console.error("Unable to save database agreement approval.", error);
    return NextResponse.json({ error: "Unable to save agreement approval." }, { status: 503 });
  }
}
