"use client";

import { PARTY_ADDRESS_LIMITS, type PartyAddressFields } from "@/lib/party-address";

const addressFields: Array<{
  name: keyof PartyAddressFields;
  label: string;
  required: boolean;
}> = [
  { name: "addressLine1", label: "Address line 1", required: true },
  { name: "addressLine2", label: "Address line 2", required: false },
  { name: "district", label: "District", required: true },
  { name: "state", label: "State", required: true },
  { name: "city", label: "City", required: true },
  { name: "postalCode", label: "PIN code", required: true },
];

export default function PartyAddressInputs({
  values,
  onChange,
  idPrefix,
  requiredFields = false,
}: {
  values: PartyAddressFields;
  onChange: (field: keyof PartyAddressFields, value: string) => void;
  idPrefix: string;
  requiredFields?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addressFields.map((field) => (
        <label key={field.name} htmlFor={`${idPrefix}-${field.name}`} className="block text-[10px] font-semibold text-[#465a4c]">
          {field.label}{requiredFields && field.required ? " *" : ""}
          <input
            id={`${idPrefix}-${field.name}`}
            required={requiredFields && field.required}
            maxLength={PARTY_ADDRESS_LIMITS[field.name]}
            value={values[field.name] ?? ""}
            onChange={(event) => onChange(field.name, event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-white px-3 text-[11px] text-[#33473a] outline-none focus:border-[#8cbd9b]"
          />
        </label>
      ))}
    </div>
  );
}
