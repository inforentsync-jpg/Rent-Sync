import { prisma } from "@/lib/database";
import { getDevOwnerAgreement } from "@/lib/dev-store";
import { generateAgreementPdf, type AgreementPdfData } from "@/lib/agreement-pdf.clean";
import { shouldUseDatabase } from "@/lib/storage-mode";

export class AgreementDownloadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AgreementDownloadError";
  }
}

function dateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export async function getOwnerAgreementPdfData(mobileNumber: string, id: string) {
  const record = !shouldUseDatabase()
    ? await getDevOwnerAgreement(mobileNumber, id)
    : await (async () => {
        const owner = await prisma.propertyOwner.findUnique({
          where: { mobileNumber },
          select: {
            id: true, fullName: true, mobileNumber: true, aadhaarNumber: true,
            fullAddress: true, addressLine1: true, addressLine2: true,
            district: true, state: true, city: true, postalCode: true, fatherName: true,
          },
        });
        if (!owner) return null;
        const agreement = await prisma.rentalAgreement.findFirst({
          where: {
            id,
            asset: {
              building: {
                OR: [
                  { ownerId: owner.id },
                  { company: { ownerId: owner.id } },
                ],
              },
            },
          },
          include: {
            tenant: true,
            asset: {
              include: {
                building: true,
                termTemplates: {
                  orderBy: { template: { name: "asc" } },
                  include: {
                    template: { include: { items: { orderBy: { position: "asc" } } } },
                  },
                },
              },
            },
          },
        });
        return agreement ? { owner, ...agreement } : null;
      })();
  if (!record) {
    throw new AgreementDownloadError("Agreement not found in your account.", 404);
  }

  const agreement = "agreement" in record ? record.agreement : record;
  const owner = record.owner;
  const asset = "asset" in agreement ? agreement.asset : record.asset;
  const building =
    "building" in asset
      ? asset.building
      : "building" in record
        ? record.building
        : null;
  const tenant = "tenant" in agreement ? agreement.tenant : record.tenant;
  const templateTerms = "termTemplates" in asset
    ? asset.termTemplates.map(({ template }) => ({
        heading: template.name,
        items: template.items.map(({ position, text, importantObligation }) => ({
          position,
          text,
          importantObligation,
        })),
      }))
    : [];
  if (!building) {
    throw new AgreementDownloadError("Agreement property was not found.", 404);
  }
  const data: AgreementPdfData = {
    agreementNumber: agreement.agreementNumber,
    startDate: dateOnly(agreement.startDate),
    endDate: dateOnly(agreement.endDate),
    monthlyRent: agreement.monthlyRent,
    securityDeposit: agreement.securityDeposit,
    isDraft: agreement.status === "DRAFT",
    ownerName: owner.fullName,
    ownerMobile: owner.mobileNumber,
    ownerAadhaar: owner.aadhaarNumber ?? null,
    ownerAddress: owner.fullAddress ?? null,
    ownerAddressLine1: owner.addressLine1 ?? null,
    ownerAddressLine2: owner.addressLine2 ?? null,
    ownerDistrict: owner.district ?? null,
    ownerState: owner.state ?? null,
    ownerCity: owner.city ?? null,
    ownerPostalCode: owner.postalCode ?? null,
    ownerFatherName: owner.fatherName ?? null,
    tenantName: tenant.fullName,
    tenantMobile: tenant.mobileNumber,
    tenantAddress: tenant.fullAddress ?? null,
    tenantAddressLine1: tenant.addressLine1 ?? null,
    tenantAddressLine2: tenant.addressLine2 ?? null,
    tenantDistrict: tenant.district ?? null,
    tenantState: tenant.state ?? null,
    tenantCity: tenant.city ?? null,
    tenantPostalCode: tenant.postalCode ?? null,
    tenantAadhaar: tenant.aadhaarNumber ?? null,
    buildingName: building.name,
    buildingAddress: building.address,
    city: building.city,
    state: building.state,
    postalCode: building.postalCode,
    assetName: asset.name,
    unitNumber: asset.unitNumber,
    assetType: asset.assetType,
    ward: asset.ward ?? null,
    panchayat: building.panchayat ?? null,
    roomNumber: asset.roomNumber ?? asset.unitNumber,
    usageDescription: tenant.businessNature ?? null,
    tradeName: tenant.businessName ?? null,
    templateTerms,
  };
  const safeName = agreement.agreementNumber.replace(/[^A-Za-z0-9_-]/g, "") || "rental-agreement";
  return { data, safeName };
}

export async function generateOwnerAgreementPdf(mobileNumber: string, id: string) {
  const { data, safeName } = await getOwnerAgreementPdfData(mobileNumber, id);
  const bytes = await generateAgreementPdf(data);
  return { bytes, safeName };
}
