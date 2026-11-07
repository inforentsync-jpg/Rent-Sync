import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database";
import {
  DevAgreementMergeError,
  mergeDevAgreements,
} from "@/lib/dev-store";
import { getOwnerSession } from "@/lib/session";
import { shouldUseDatabase } from "@/lib/storage-mode";

class AgreementMergeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function parseAgreementIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 12 ||
    value.some((id) => typeof id !== "string" || id.length > 100)
  ) {
    return null;
  }
  const ids = [...new Set(value as string[])];
  return ids.length === value.length ? ids : null;
}

export async function POST(request: Request) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Owner sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const ids = body && typeof body === "object" && "agreementIds" in body
    ? parseAgreementIds(body.agreementIds)
    : null;
  if (!ids) {
    return NextResponse.json({ error: "Select between 2 and 12 distinct agreements to merge." }, { status: 400 });
  }

  if (!shouldUseDatabase()) {
    try {
      const agreement = await mergeDevAgreements(session.mobileNumber, ids);
      return NextResponse.json({ agreement });
    } catch (error) {
      if (error instanceof DevAgreementMergeError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error("Unable to merge local rental agreements.", error);
      return NextResponse.json({ error: "Unable to merge these agreements." }, { status: 503 });
    }
  }

  try {
    const agreement = await prisma.$transaction(async (transaction) => {
      const owner = await transaction.propertyOwner.findUnique({
        where: { mobileNumber: session.mobileNumber },
        select: { id: true },
      });
      if (!owner) throw new AgreementMergeError("Owner account was not found.", 404);
      const agreements = await transaction.rentalAgreement.findMany({
        where: { id: { in: ids } },
        include: {
          mergedMembers: { select: { id: true } },
          asset: {
            include: {
              tenants: { select: { tenantId: true } },
              building: { select: { id: true, ownerId: true, company: { select: { ownerId: true } } } },
            },
          },
        },
      });
      if (agreements.length !== ids.length) {
        throw new AgreementMergeError("One or more agreements were not found.", 404);
      }
      const primary = agreements.find((entry) => entry.id === ids[0]);
      if (!primary) throw new AgreementMergeError("Primary agreement was not found.", 404);
      const sameBuilding = agreements.every(
        (entry) => entry.asset.building.id === primary.asset.building.id,
      );
      const ownedBySession = agreements.every(
        (entry) =>
          (entry.asset.building.company?.ownerId ?? entry.asset.building.ownerId) === owner.id,
      );
      const assignedToTenant = agreements.every((entry) =>
        entry.asset.tenants.some((assignment) => assignment.tenantId === primary.tenantId),
      );
      const sameDuration = agreements.every(
        (entry) =>
          entry.asset.agreementDurationUnit === primary.asset.agreementDurationUnit &&
          entry.asset.agreementDurationValue === primary.asset.agreementDurationValue,
      );
      const noNestedGroups = agreements.every(
        (entry) => !entry.mergedIntoAgreementId && entry.mergedMembers.length === 0,
      );
      const distinctAssets = new Set(agreements.map((entry) => entry.assetId)).size === agreements.length;
      if (
        agreements.some((entry) => entry.tenantId !== primary.tenantId) ||
        agreements.some((entry) => entry.status !== "ACTIVE" && entry.status !== "DRAFT") ||
        !sameBuilding ||
        !ownedBySession ||
        !assignedToTenant ||
        !sameDuration ||
        !noNestedGroups ||
        !distinctAssets
      ) {
        throw new AgreementMergeError(
          "Select one unmerged agreement per asset. Agreements must belong to the same tenant and building and use matching duration settings.",
          409,
        );
      }

      const conflictingAgreement = await transaction.rentalAgreement.findFirst({
        where: {
          assetId: { in: agreements.map((entry) => entry.assetId) },
          status: "ACTIVE",
          startDate: { lte: primary.endDate },
          endDate: { gte: primary.startDate },
          id: { notIn: ids },
          mergedIntoAgreementId: null,
        },
        select: { id: true },
      });
      if (conflictingAgreement) {
        throw new AgreementMergeError(
          "One of these units has another active agreement during this period. Resolve the overlap before merging.",
          409,
        );
      }

      const monthlyRent = agreements.reduce((total, entry) => total + entry.monthlyRent, 0);
      const securityDeposit = agreements.reduce((total, entry) => total + entry.securityDeposit, 0);
      if (!Number.isSafeInteger(monthlyRent) || !Number.isSafeInteger(securityDeposit)) {
        throw new AgreementMergeError("The combined rent or deposit exceeds the supported amount.", 400);
      }

      const uniqueText = (values: string[]) =>
        [...new Set(values.map((value) => value.trim()).filter(Boolean))].join("\n");
      for (const member of agreements) {
        await transaction.rentalAgreement.update({
          where: { id: member.id },
          data: {
            mergedOriginalStatus: member.status,
            mergedOriginalStartDate: member.startDate,
            mergedOriginalEndDate: member.endDate,
            mergedOriginalAgreementYear: member.agreementYear,
            mergedOriginalMonthlyRent: member.monthlyRent,
            mergedOriginalSecurityDeposit: member.securityDeposit,
            mergedOriginalOwnerApprovedAt: member.ownerApprovedAt,
            mergedOriginalTenantApprovedAt: member.tenantApprovedAt,
            mergedOriginalMandatoryDetailsApprovedAt: member.mandatoryDetailsApprovedAt,
            status: "CANCELLED",
          },
        });
      }
      const merged = await transaction.rentalAgreement.create({
        data: {
          agreementNumber: `RS-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          assetId: primary.assetId,
          tenantId: primary.tenantId,
          agreementYear: primary.agreementYear,
          startDate: primary.startDate,
          endDate: primary.endDate,
          monthlyRent,
          securityDeposit,
          terms: uniqueText(agreements.map((entry) => entry.terms)),
          importantTerms: uniqueText(agreements.map((entry) => entry.importantTerms)),
          status: "DRAFT",
        },
      });
      await transaction.rentalAgreement.updateMany({
        where: { id: { in: ids } },
        data: { mergedIntoAgreementId: merged.id },
      });
      return merged;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ agreement });
  } catch (error) {
    if (error instanceof AgreementMergeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "These agreements changed while merging. Refresh and try again." }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "An active agreement already exists for one of these assets and years." }, { status: 409 });
    }
    console.error("Unable to merge database rental agreements.", error);
    return NextResponse.json({ error: "Unable to merge these agreements." }, { status: 503 });
  }
}
