export const publicTenantProfileFields = {
  fullName: { label: "Tenant name", maxLength: 120 },
  mobileNumber: { label: "Mobile number", maxLength: 15 },
  businessName: { label: "Business name", maxLength: 160 },
  businessNature: { label: "Business nature", maxLength: 160 },
  addressLine1: { label: "Address line 1", maxLength: 60 },
  addressLine2: { label: "Address line 2", maxLength: 60 },
  district: { label: "District", maxLength: 40 },
  state: { label: "State", maxLength: 40 },
  city: { label: "City", maxLength: 40 },
  postalCode: { label: "Postal code", maxLength: 12 },
  aadhaarNumber: { label: "Aadhaar number", maxLength: 12 },
  fatherName: { label: "Father's name", maxLength: 120 },
} as const;

export type PublicTenantProfileField = keyof typeof publicTenantProfileFields;

export const requiredPublicTenantProfileFields: PublicTenantProfileField[] = [
  "fullName",
  "mobileNumber",
  "businessName",
  "businessNature",
  "addressLine1",
  "district",
  "state",
  "city",
  "postalCode",
  "aadhaarNumber",
  "fatherName",
];

export function isPublicTenantProfileFieldComplete(
  field: PublicTenantProfileField,
  value: string | null | undefined,
) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.length > publicTenantProfileFields[field].maxLength) return false;
  if (field === "mobileNumber") return /^\d{10,15}$/.test(normalized.replace(/\D/g, ""));
  if (field === "aadhaarNumber") return /^\d{12}$/.test(normalized);
  return true;
}

export function getMissingPublicTenantProfileFields(
  tenant: Partial<Record<PublicTenantProfileField, string | null>>,
) {
  return requiredPublicTenantProfileFields.filter(
    (field) => !isPublicTenantProfileFieldComplete(field, tenant[field]),
  );
}
