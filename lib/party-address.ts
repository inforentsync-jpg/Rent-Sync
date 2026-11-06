export const PARTY_ADDRESS_LIMITS = {
  addressLine1: 60,
  addressLine2: 60,
  district: 40,
  state: 40,
  city: 40,
  postalCode: 12,
} as const;

export type PartyAddressFields = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

export function formatPartyAddress(address: PartyAddressFields) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.district,
    address.state,
    address.city,
    address.postalCode,
  ].map((value) => value?.trim()).filter(Boolean).join(", ");
}
