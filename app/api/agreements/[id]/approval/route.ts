import { NextResponse } from "next/server";
import { prisma } from "@/lib/database";
import {
  DevAgreementConflictError,
  reviewDevAgreement,
  type AgreementReviewInput,
} from "@/lib/dev-store";
import {
  hasValidAgreementDurationTerm,
  isAgreementDurationUnit,
} from "@/lib/agreement-duration";
import { getOwnerSession } from "@/lib/session";
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
  const { startDate, endDate, monthlyRent, securityDeposit } = value;
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    typeof monthlyRent !== "number" ||
    !Number.isSafeInteger(monthlyRent) ||
    monthlyRent <= 0 ||
    typeof securityDeposit !== "number" ||
    !Number.isSafeInteger(securityDeposit) ||
    securityDeposit < 0
  ) {
    return null;
  }
  return {
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ownerSession = await getOwnerSession();
  if (!ownerSession) {
    return NextResponse.json({ error: "Only the property owner can approve this agreement." }, { status: 403 });
  }
  const mobileNumber = ownerSession.mobileNumber;
  if (!mobileNumber) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
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
      { error: "Enter valid agreement dates, monthly rent, and security deposit before approving." },
      { status: 400 },
    );
  }
  const { id } = await params;

  if (!shouldUseDatabase()) {
    try {
      const agreement = await reviewDevAgreement(mobileNumber, id, input);
      if (!agreement) {
        return NextResponse.json(
          { error: "This agreement is not available for owner approval." },
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
            asset: {
              select: {
                agreementDurationUnit: true,
                agreementDurationValue: true,
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

        const owner = await transaction.propertyOwner.findUnique({
          where: { mobileNumber },
          select: { id: true },
        });
        const propertyOwnerId =
          current.asset.building.company?.ownerId ?? current.asset.building.ownerId;
        if (!owner || owner.id !== propertyOwnerId) {
          throw new AgreementApprovalError("This agreement is not assigned to your owner account.", 404);
        }

        if (!isAgreementDurationUnit(current.asset.agreementDurationUnit)) {
          throw new AgreementApprovalError(
            "This asset has an invalid agreement duration setting. Update it before approving.",
            500,
          );
        }
        if (
          !hasValidAgreementDurationTerm(
            input.startDate,
            input.endDate,
            current.asset.agreementDurationUnit,
            current.asset.agreementDurationValue,
          )
        ) {
          throw new AgreementApprovalError(
            "The agreement end date must match the duration configured for this asset.",
            400,
          );
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

        return transaction.rentalAgreement.update({
          where: { id },
          data: {
            startDate: startsAt,
            endDate: endsAt,
            agreementYear: Number(input.startDate.slice(0, 4)),
            monthlyRent: input.monthlyRent,
            securityDeposit: input.securityDeposit,
            ownerApprovedAt: new Date(),
            status: "ACTIVE",
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
