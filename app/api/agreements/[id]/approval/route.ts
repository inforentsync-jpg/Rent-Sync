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
import { formatPartyAddress, PARTY_ADDRESS_LIMITS } from "@/lib/party-address";

class AgreementApprovalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function optionalReviewText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function requiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function parseReviewInput(value: unknown): AgreementReviewInput | null {
  if (!isRecord(value)) return null;
  const {
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
    ownerFullName,
    ownerAadhaarNumber,
    ownerFullAddress,
    ownerAddressLine1,
    ownerAddressLine2,
    ownerDistrict,
    ownerState,
    ownerCity,
    ownerPostalCode,
    ownerFatherName,
    tenantFullName,
    tenantMobileNumber,
    tenantBusinessName,
    tenantBusinessNature,
    tenantFullAddress,
    tenantAddressLine1,
    tenantAddressLine2,
    tenantDistrict,
    tenantState,
    tenantCity,
    tenantPostalCode,
    tenantAadhaarNumber,
    buildingAddress,
    buildingCity,
    buildingState,
    buildingPostalCode,
    buildingPanchayat,
    assetWard,
    assetRoomNumber,
  } = value;
  const required = {
    ownerFullName: requiredText(ownerFullName, 120),
    ownerAadhaarNumber: requiredText(ownerAadhaarNumber, 12),
    ownerAddressLine1: requiredText(ownerAddressLine1, PARTY_ADDRESS_LIMITS.addressLine1),
    ownerAddressLine2: optionalReviewText(ownerAddressLine2, PARTY_ADDRESS_LIMITS.addressLine2),
    ownerDistrict: requiredText(ownerDistrict, PARTY_ADDRESS_LIMITS.district),
    ownerState: requiredText(ownerState, PARTY_ADDRESS_LIMITS.state),
    ownerCity: requiredText(ownerCity, PARTY_ADDRESS_LIMITS.city),
    ownerPostalCode: requiredText(ownerPostalCode, PARTY_ADDRESS_LIMITS.postalCode),
    ownerFatherName: requiredText(ownerFatherName, 120),
    tenantFullName: requiredText(tenantFullName, 120),
    tenantMobileNumber: requiredText(tenantMobileNumber, 15),
    tenantBusinessName: requiredText(tenantBusinessName, 160),
    tenantBusinessNature: requiredText(tenantBusinessNature, 160),
    tenantAddressLine1: requiredText(tenantAddressLine1, PARTY_ADDRESS_LIMITS.addressLine1),
    tenantAddressLine2: optionalReviewText(tenantAddressLine2, PARTY_ADDRESS_LIMITS.addressLine2),
    tenantDistrict: requiredText(tenantDistrict, PARTY_ADDRESS_LIMITS.district),
    tenantState: requiredText(tenantState, PARTY_ADDRESS_LIMITS.state),
    tenantCity: requiredText(tenantCity, PARTY_ADDRESS_LIMITS.city),
    tenantPostalCode: requiredText(tenantPostalCode, PARTY_ADDRESS_LIMITS.postalCode),
    tenantAadhaarNumber: requiredText(tenantAadhaarNumber, 12),
    buildingAddress: requiredText(buildingAddress, 255),
    buildingCity: requiredText(buildingCity, 100),
    buildingState: requiredText(buildingState, 100),
    buildingPostalCode: requiredText(buildingPostalCode, 12),
    buildingPanchayat: requiredText(buildingPanchayat, 120),
    assetWard: requiredText(assetWard, 20),
    assetRoomNumber: requiredText(assetRoomNumber, 40),
  };
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    typeof monthlyRent !== "number" ||
    !Number.isSafeInteger(monthlyRent) ||
    monthlyRent <= 0 ||
    typeof securityDeposit !== "number" ||
    !Number.isSafeInteger(securityDeposit) ||
    securityDeposit < 0 ||
    Object.values(required).some((entry) => entry === null) ||
    !/^\d{12}$/.test(required.ownerAadhaarNumber ?? "") ||
    !/^\d{12}$/.test(required.tenantAadhaarNumber ?? "") ||
    !/^\d{10,15}$/.test((required.tenantMobileNumber ?? "").replace(/\D/g, ""))
  ) {
    return null;
  }
  return {
    startDate,
    endDate,
    monthlyRent,
    securityDeposit,
    ownerFullName: required.ownerFullName!,
    ownerAadhaarNumber: required.ownerAadhaarNumber!,
    ownerFullAddress: formatPartyAddress({
      addressLine1: required.ownerAddressLine1,
      addressLine2: required.ownerAddressLine2,
      district: required.ownerDistrict,
      state: required.ownerState,
      city: required.ownerCity,
      postalCode: required.ownerPostalCode,
    }),
    ownerAddressLine1: required.ownerAddressLine1!,
    ownerAddressLine2: required.ownerAddressLine2 ?? "",
    ownerDistrict: required.ownerDistrict!,
    ownerState: required.ownerState!,
    ownerCity: required.ownerCity!,
    ownerPostalCode: required.ownerPostalCode!,
    ownerFatherName: required.ownerFatherName!,
    tenantFullName: required.tenantFullName!,
    tenantMobileNumber: required.tenantMobileNumber!.replace(/\D/g, ""),
    tenantBusinessName: required.tenantBusinessName!,
    tenantBusinessNature: required.tenantBusinessNature!,
    tenantFullAddress: formatPartyAddress({
      addressLine1: required.tenantAddressLine1,
      addressLine2: required.tenantAddressLine2,
      district: required.tenantDistrict,
      state: required.tenantState,
      city: required.tenantCity,
      postalCode: required.tenantPostalCode,
    }),
    tenantAddressLine1: required.tenantAddressLine1!,
    tenantAddressLine2: required.tenantAddressLine2 ?? "",
    tenantDistrict: required.tenantDistrict!,
    tenantState: required.tenantState!,
    tenantCity: required.tenantCity!,
    tenantPostalCode: required.tenantPostalCode!,
    tenantAadhaarNumber: required.tenantAadhaarNumber!,
    buildingAddress: required.buildingAddress!,
    buildingCity: required.buildingCity!,
    buildingState: required.buildingState!,
    buildingPostalCode: required.buildingPostalCode!,
    buildingPanchayat: required.buildingPanchayat!,
    assetWard: required.assetWard!,
    assetRoomNumber: required.assetRoomNumber!,
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
      { error: "Complete all mandatory owner, tenant, property, and unit fields. Enter valid 12-digit Aadhaar numbers, a valid tenant mobile number, agreement dates, rent, and deposit." },
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
                id: true,
                buildingId: true,
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
        if (current.status !== "DRAFT" && current.status !== "ACTIVE") {
          throw new AgreementApprovalError("Only draft or active agreements can be re-approved.", 409);
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
        const duplicateTenantMobile = await transaction.tenant.findFirst({
          where: { id: { not: current.tenantId }, mobileNumber: input.tenantMobileNumber },
          select: { id: true },
        });
        if (duplicateTenantMobile) {
          throw new AgreementApprovalError("This tenant mobile number is already registered.", 409);
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

        const approvedAgreement = await transaction.rentalAgreement.update({
          where: { id },
          data: {
            startDate: startsAt,
            endDate: endsAt,
            agreementYear: Number(input.startDate.slice(0, 4)),
            monthlyRent: input.monthlyRent,
            securityDeposit: input.securityDeposit,
            ownerApprovedAt: new Date(),
            tenantApprovedAt: null,
            mandatoryDetailsApprovedAt: new Date(),
            status: "ACTIVE",
          },
        });
        await transaction.propertyOwner.update({
          where: { id: owner.id },
          data: {
            fullName: input.ownerFullName,
            aadhaarNumber: input.ownerAadhaarNumber,
            fullAddress: input.ownerFullAddress,
            addressLine1: input.ownerAddressLine1,
            addressLine2: input.ownerAddressLine2 || null,
            district: input.ownerDistrict,
            state: input.ownerState,
            city: input.ownerCity,
            postalCode: input.ownerPostalCode,
            fatherName: input.ownerFatherName,
          },
        });
        await transaction.tenant.update({
          where: { id: current.tenantId },
          data: {
            fullName: input.tenantFullName,
            mobileNumber: input.tenantMobileNumber,
            businessName: input.tenantBusinessName,
            businessNature: input.tenantBusinessNature,
            fullAddress: input.tenantFullAddress,
            addressLine1: input.tenantAddressLine1,
            addressLine2: input.tenantAddressLine2 || null,
            district: input.tenantDistrict,
            state: input.tenantState,
            city: input.tenantCity,
            postalCode: input.tenantPostalCode,
            aadhaarNumber: input.tenantAadhaarNumber,
          },
        });
        await transaction.building.update({
          where: { id: current.asset.buildingId },
          data: {
            ownerName: input.ownerFullName,
            address: input.buildingAddress,
            city: input.buildingCity,
            state: input.buildingState,
            postalCode: input.buildingPostalCode,
            panchayat: input.buildingPanchayat,
          },
        });
        await transaction.asset.update({
          where: { id: current.assetId },
          data: { ward: input.assetWard, roomNumber: input.assetRoomNumber },
        });
        const approvedAssetAgreements = await transaction.rentalAgreement.findMany({
          where: {
            assetId: current.assetId,
            status: "ACTIVE",
            ownerApprovedAt: { not: null },
          },
          select: {
            agreementYear: true,
            securityDeposit: true,
            ownerApprovedAt: true,
          },
          orderBy: [{ agreementYear: "desc" }, { ownerApprovedAt: "desc" }],
        });
        const latestApprovedAgreement = approvedAssetAgreements[0];
        if (latestApprovedAgreement) {
          await transaction.asset.update({
            where: { id: current.assetId },
            data: { securityDeposit: latestApprovedAgreement.securityDeposit },
          });
        }
        return approvedAgreement;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 15_000,
        timeout: 30_000,
      },
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
