"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { addAgreementDuration, type AgreementDurationUnit } from "@/lib/agreement-duration";
import { formatPartyAddress, PARTY_ADDRESS_LIMITS, type PartyAddressFields } from "@/lib/party-address";

export type ReviewableAgreement = {
  id: string;
  agreementNumber: string;
  assetId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  agreementDurationUnit?: AgreementDurationUnit;
  agreementDurationValue?: number;
  ward?: string | null;
  roomNumber?: string | null;
  terms: string;
  importantTerms?: string;
  templateTerms?: Array<{
    templateId: string;
    heading: string;
    items: Array<{ id: string; position: number; text: string; importantObligation: boolean }>;
  }>;
  status: string;
  agreementYear?: number;
  mergedAssetIds?: string[];
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
  mandatoryDetailsApprovedAt?: string | null;
};

type ReviewStep = "kyc" | "rent" | "expiry" | "advance" | "terms" | "important-terms" | "approve";
type OwnerApprovalProfile = {
  fullName: string;
  mobileNumber: string;
  aadhaarNumber?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  fatherName?: string | null;
};
type TenantApprovalProfile = {
  fullName: string;
  mobileNumber: string | null;
  businessName?: string | null;
  businessNature?: string | null;
  fullAddress?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  district?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  aadhaarNumber?: string | null;
};
type PropertyApprovalDetails = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  panchayat?: string | null;
  ward?: string | null;
  roomNumber?: string | null;
  unitNumber: string;
};
const steps: Array<{ id: ReviewStep; label: string }> = [
  { id: "kyc", label: "KYC" },
  { id: "rent", label: "Rent" },
  { id: "expiry", label: "Expiry" },
  { id: "advance", label: "Advance" },
  { id: "terms", label: "Terms" },
  { id: "important-terms", label: "Important Terms" },
  { id: "approve", label: "Approve" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "Awaiting approval";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PartyAddressFieldsInput({
  values,
  onChange,
}: {
  values: PartyAddressFields;
  onChange: (field: keyof PartyAddressFields, value: string) => void;
}) {
  const fields: Array<{ name: keyof PartyAddressFields; label: string; required: boolean }> = [
    { name: "addressLine1", label: "Address line 1", required: true },
    { name: "addressLine2", label: "Address line 2", required: false },
    { name: "district", label: "District", required: true },
    { name: "state", label: "State", required: true },
    { name: "city", label: "City", required: true },
    { name: "postalCode", label: "PIN code", required: true },
  ];
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
      {fields.map((field) => (
        <ApprovalField
          key={field.name}
          label={field.label}
          required={field.required}
          value={values[field.name] ?? ""}
          maxLength={PARTY_ADDRESS_LIMITS[field.name]}
          inputMode={field.name === "postalCode" ? "numeric" : undefined}
          onChange={(value) => onChange(field.name, value)}
        />
      ))}
    </div>
  );
}

export default function AgreementApprovalWizard({
  agreement,
  party,
  readOnly = false,
  tenantName,
  tenantMobile,
  propertyName,
  owner,
  tenant,
  property,
  wardNumber,
  roomNumber,
  onClose,
  onApproved,
}: {
  agreement: ReviewableAgreement;
  party: "OWNER" | "PUBLIC";
  readOnly?: boolean;
  tenantName: string;
  tenantMobile: string | null;
  propertyName: string;
  owner?: OwnerApprovalProfile | null;
  tenant?: TenantApprovalProfile | null;
  property?: PropertyApprovalDetails | null;
  wardNumber?: string | null;
  roomNumber?: string | null;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [startDate, setStartDate] = useState(
    agreement.startDate?.slice(0, 10) || `${agreement.agreementYear ?? new Date().getFullYear()}-01-01`,
  );
  const [monthlyRent, setMonthlyRent] = useState(String(agreement.monthlyRent));
  const [securityDeposit, setSecurityDeposit] = useState(String(agreement.securityDeposit));
  const [ownerDetails, setOwnerDetails] = useState({
    fullName: owner?.fullName ?? "",
    aadhaarNumber: owner?.aadhaarNumber ?? "",
    fullAddress: owner?.fullAddress ?? "",
    addressLine1: owner?.addressLine1 ?? "",
    addressLine2: owner?.addressLine2 ?? "",
    district: owner?.district ?? "",
    state: owner?.state ?? "",
    city: owner?.city ?? "",
    postalCode: owner?.postalCode ?? "",
    fatherName: owner?.fatherName ?? "",
  });
  const [tenantDetails, setTenantDetails] = useState({
    fullName: tenant?.fullName ?? tenantName,
    mobileNumber: tenant?.mobileNumber ?? tenantMobile ?? "",
    businessName: tenant?.businessName ?? "",
    businessNature: tenant?.businessNature ?? "",
    fullAddress: tenant?.fullAddress ?? "",
    addressLine1: tenant?.addressLine1 ?? "",
    addressLine2: tenant?.addressLine2 ?? "",
    district: tenant?.district ?? "",
    state: tenant?.state ?? "",
    city: tenant?.city ?? "",
    postalCode: tenant?.postalCode ?? "",
    aadhaarNumber: tenant?.aadhaarNumber ?? "",
  });
  const [propertyDetails, setPropertyDetails] = useState({
    address: property?.address ?? "",
    city: property?.city ?? "",
    state: property?.state ?? "",
    postalCode: property?.postalCode ?? "",
    panchayat: property?.panchayat ?? "",
    ward: property?.ward ?? wardNumber ?? "",
    roomNumber: property?.roomNumber ?? roomNumber ?? property?.unitNumber ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const durationUnit = agreement.agreementDurationUnit ?? "MONTH";
  const durationValue = agreement.agreementDurationValue ?? 11;
  const endDate = addAgreementDuration(startDate, durationUnit, durationValue);
  const mappedTerms = agreement.templateTerms?.flatMap((template) => template.items) ?? [];
  const importantObligations = mappedTerms
    .map((item, index) => ({ ...item, serialNumber: index + 1 }))
    .filter((item) => item.importantObligation);
  const visibleSteps = steps;
  const step = visibleSteps[stepIndex];

  function goNext() {
    const nextIndex = Math.min(stepIndex + 1, visibleSteps.length - 1);
    setStepIndex(nextIndex);
    setFurthestStepIndex((furthest) => Math.max(furthest, nextIndex));
  }

  function goPrevious() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function approve() {
    if (readOnly) return;
    const rent = Number(monthlyRent);
    const deposit = Number(securityDeposit);
    const mandatoryValues = [
      ownerDetails.fullName,
      ownerDetails.aadhaarNumber,
      ownerDetails.addressLine1,
      ownerDetails.district,
      ownerDetails.state,
      ownerDetails.city,
      ownerDetails.postalCode,
      ownerDetails.fatherName,
      tenantDetails.fullName,
      tenantDetails.mobileNumber,
      tenantDetails.businessName,
      tenantDetails.businessNature,
      tenantDetails.addressLine1,
      tenantDetails.district,
      tenantDetails.state,
      tenantDetails.city,
      tenantDetails.postalCode,
      tenantDetails.aadhaarNumber,
      propertyDetails.address,
      propertyDetails.city,
      propertyDetails.state,
      propertyDetails.postalCode,
      propertyDetails.panchayat,
      propertyDetails.ward,
      propertyDetails.roomNumber,
    ];
    if (
      mandatoryValues.some((value) => !value.trim()) ||
      !/^\d{12}$/.test(ownerDetails.aadhaarNumber.trim()) ||
      !/^\d{12}$/.test(tenantDetails.aadhaarNumber.trim()) ||
      !/^\d{10,15}$/.test(tenantDetails.mobileNumber.replace(/\D/g, ""))
    ) {
      setStepIndex(0);
      setFurthestStepIndex((furthest) => Math.max(furthest, 0));
      setError("Complete every required owner, tenant, and property field in the KYC step. Aadhaar must be 12 digits and tenant mobile must be valid.");
      return;
    }
    if (!endDate || !Number.isSafeInteger(rent) || rent <= 0 || !Number.isSafeInteger(deposit) || deposit < 0) {
      setError(`Enter a valid ${durationValue}-${durationUnit.toLowerCase()} period, monthly rent, and security deposit.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/agreements/${encodeURIComponent(agreement.id)}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          monthlyRent: rent,
          securityDeposit: deposit,
          ownerFullName: ownerDetails.fullName,
          ownerAadhaarNumber: ownerDetails.aadhaarNumber,
          ownerFullAddress: formatPartyAddress(ownerDetails),
          ownerAddressLine1: ownerDetails.addressLine1,
          ownerAddressLine2: ownerDetails.addressLine2,
          ownerDistrict: ownerDetails.district,
          ownerState: ownerDetails.state,
          ownerCity: ownerDetails.city,
          ownerPostalCode: ownerDetails.postalCode,
          ownerFatherName: ownerDetails.fatherName,
          tenantFullName: tenantDetails.fullName,
          tenantMobileNumber: tenantDetails.mobileNumber,
          tenantBusinessName: tenantDetails.businessName,
          tenantBusinessNature: tenantDetails.businessNature,
          tenantFullAddress: formatPartyAddress(tenantDetails),
          tenantAddressLine1: tenantDetails.addressLine1,
          tenantAddressLine2: tenantDetails.addressLine2,
          tenantDistrict: tenantDetails.district,
          tenantState: tenantDetails.state,
          tenantCity: tenantDetails.city,
          tenantPostalCode: tenantDetails.postalCode,
          tenantAadhaarNumber: tenantDetails.aadhaarNumber,
          buildingAddress: propertyDetails.address,
          buildingCity: propertyDetails.city,
          buildingState: propertyDetails.state,
          buildingPostalCode: propertyDetails.postalCode,
          buildingPanchayat: propertyDetails.panchayat,
          assetWard: propertyDetails.ward,
          assetRoomNumber: propertyDetails.roomNumber,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to approve this agreement.");
      onApproved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to approve this agreement.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[12px] text-[#33473a] outline-none focus:border-[#8cbd9b]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#10281c]/50 p-2 backdrop-blur-[2px] sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-review-title"
        className="my-auto flex max-h-[calc(100vh-1rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-2.5rem)]"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#edf0ed] px-4 py-3 sm:px-7 sm:py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">
              {readOnly ? "Public read-only review" : agreement.status === "ACTIVE" && agreement.mandatoryDetailsApprovedAt ? "Edit approved agreement" : "Complete details & approve"}
            </p>
            <h2 id="agreement-review-title" className="mt-1 text-[18px] font-semibold text-[#203328]">
              Review agreement
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close agreement review"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"
          >
            <X size={16} />
          </button>
        </div>

        <div role="tablist" aria-label="Agreement approval steps" className="flex shrink-0 overflow-x-auto border-b border-[#edf0ed] px-2 sm:px-5">
          {visibleSteps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={stepIndex === index}
              disabled={index > furthestStepIndex}
              onClick={() => {
                setStepIndex(index);
              }}
              className={`shrink-0 border-b-2 px-2.5 py-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${stepIndex === index ? "border-[#176b4b] text-[#176b4b]" : "border-transparent text-[#849188] hover:text-[#355942]"}`}
            >
              {readOnly && item.id === "approve" ? "Review" : item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-7">
          {step.id === "kyc" ? (
            <>
              <ReviewHeading title="Mandatory agreement details" text={readOnly ? "Tenant and unit details." : "Complete every required field before approval. These values are saved to the owner, tenant, property, and unit records and used in the PDF."} />
              {readOnly ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewValue label="Tenant" value={tenantName} />
                  <ReviewValue label="Tenant mobile" value="Private on this page" />
                  <ReviewValue label="Ward No." value={wardNumber || "Not recorded"} />
                  <ReviewValue label="Room No." value={roomNumber || "Not recorded"} />
                </div>
              ) : (
                <div className="space-y-4">
                  <section className="rounded-xl border border-[#e7ece7] p-3 sm:p-4">
                    <h4 className="mb-3 text-[11px] font-semibold text-[#294034]">Owner details</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ApprovalField label="Owner full name" required value={ownerDetails.fullName} onChange={(value) => { setOwnerDetails((current) => ({ ...current, fullName: value })); setError(""); }} />
                      <ReviewValue label="Owner mobile" value={owner?.mobileNumber ? `+${owner.mobileNumber}` : "Not recorded"} />
                      <ApprovalField label="Owner Aadhaar (12 digits)" required value={ownerDetails.aadhaarNumber} maxLength={12} inputMode="numeric" onChange={(value) => { setOwnerDetails((current) => ({ ...current, aadhaarNumber: value.replace(/\D/g, "") })); setError(""); }} />
                      <ApprovalField label="Father / guardian name" required value={ownerDetails.fatherName} onChange={(value) => { setOwnerDetails((current) => ({ ...current, fatherName: value })); setError(""); }} />
                      <PartyAddressFieldsInput
                        values={ownerDetails}
                        onChange={(field, value) => { setOwnerDetails((current) => ({ ...current, [field]: value })); setError(""); }}
                      />
                    </div>
                  </section>
                  <section className="rounded-xl border border-[#e7ece7] p-3 sm:p-4">
                    <h4 className="mb-3 text-[11px] font-semibold text-[#294034]">Tenant details</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ApprovalField label="Tenant full name" required value={tenantDetails.fullName} onChange={(value) => { setTenantDetails((current) => ({ ...current, fullName: value })); setError(""); }} />
                      <ApprovalField label="Tenant mobile" required value={tenantDetails.mobileNumber} inputMode="numeric" maxLength={15} onChange={(value) => { setTenantDetails((current) => ({ ...current, mobileNumber: value.replace(/\D/g, "") })); setError(""); }} />
                      <ApprovalField label="Tenant Aadhaar (12 digits)" required value={tenantDetails.aadhaarNumber} inputMode="numeric" maxLength={12} onChange={(value) => { setTenantDetails((current) => ({ ...current, aadhaarNumber: value.replace(/\D/g, "") })); setError(""); }} />
                      <PartyAddressFieldsInput
                        values={tenantDetails}
                        onChange={(field, value) => { setTenantDetails((current) => ({ ...current, [field]: value })); setError(""); }}
                      />
                      <ApprovalField label="Business / trade name" required value={tenantDetails.businessName} onChange={(value) => { setTenantDetails((current) => ({ ...current, businessName: value })); setError(""); }} />
                      <ApprovalField label="Business nature (PDF use)" required value={tenantDetails.businessNature} placeholder="e.g. Retail, Office, Warehouse" onChange={(value) => { setTenantDetails((current) => ({ ...current, businessNature: value })); setError(""); }} />
                    </div>
                  </section>
                  <section className="rounded-xl border border-[#e7ece7] p-3 sm:p-4">
                    <h4 className="mb-3 text-[11px] font-semibold text-[#294034]">Property and unit details</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ApprovalField label="Property street address" required value={propertyDetails.address} onChange={(value) => { setPropertyDetails((current) => ({ ...current, address: value })); setError(""); }} />
                      <ApprovalField label="Panchayat" required value={propertyDetails.panchayat} onChange={(value) => { setPropertyDetails((current) => ({ ...current, panchayat: value })); setError(""); }} />
                      <ApprovalField label="City" required value={propertyDetails.city} onChange={(value) => { setPropertyDetails((current) => ({ ...current, city: value })); setError(""); }} />
                      <ApprovalField label="State" required value={propertyDetails.state} onChange={(value) => { setPropertyDetails((current) => ({ ...current, state: value })); setError(""); }} />
                      <ApprovalField label="Postal code" required value={propertyDetails.postalCode} onChange={(value) => { setPropertyDetails((current) => ({ ...current, postalCode: value })); setError(""); }} />
                      <ApprovalField label="Ward number" required value={propertyDetails.ward} onChange={(value) => { setPropertyDetails((current) => ({ ...current, ward: value })); setError(""); }} />
                      <ApprovalField label="Room / unit number" required value={propertyDetails.roomNumber} onChange={(value) => { setPropertyDetails((current) => ({ ...current, roomNumber: value })); setError(""); }} />
                    </div>
                  </section>
                </div>
              )}
            </>
          ) : null}

          {step.id === "rent" ? (
            <>
              <ReviewHeading title="Monthly rent" text="You can correct the monthly rent before approving." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Monthly rent (₹)
                <input type="number" min="1" step="1" required disabled={readOnly} value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} className={inputClass} />
              </label>
            </>
          ) : null}

          {step.id === "expiry" ? (
            <>
              <ReviewHeading
                title="Agreement expiry"
                text={readOnly ? "View the agreement start date and automatically calculated end date." : `Confirm the agreement start date and its automatically calculated ${durationValue}-${durationUnit.toLowerCase()} end date.`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-semibold text-[#465a4c]">
                  Agreement start date
                  <input type="date" required disabled={readOnly} value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                </label>
                <ReviewValue label={`Agreement end date (${durationValue} ${durationUnit.toLowerCase()}${durationValue === 1 ? "" : "s"})`} value={endDate ?? "Choose a valid start date"} />
              </div>
            </>
          ) : null}

          {step.id === "advance" ? (
            <>
              <ReviewHeading title="Advance and security deposit" text="Confirm the agreed deposit amount." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Security deposit (₹)
                <input type="number" min="0" step="1" required disabled={readOnly} value={securityDeposit} onChange={(event) => setSecurityDeposit(event.target.value)} className={inputClass} />
              </label>
            </>
          ) : null}

          {step.id === "terms" ? (
            readOnly ? (
              mappedTerms.length ? (
                <ol className="space-y-2 rounded-xl border border-[#e7ece7] bg-[#f9fbf9] p-4 text-[13px] leading-6 text-[#53675a]">
                  {mappedTerms.map((item, index) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#294034]">{index + 1}.</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ol>
              ) : null
            ) : (
              <>
                <ReviewHeading
                  title="Agreement terms"
                  text="These terms are managed in the Terms module and cannot be changed during approval."
                />
                <ol className="space-y-2 rounded-xl border border-[#e7ece7] bg-[#f9fbf9] p-4 text-[10px] leading-6 text-[#53675a]">
                  {mappedTerms.length ? mappedTerms.map((item, index) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#294034]">{index + 1}.</span>
                      <span>
                        {item.importantObligation ? <strong className="mr-1 text-[#805b13]">Important obligation:</strong> : null}
                        {item.text}
                      </span>
                    </li>
                  )) : <li>No property terms are mapped to this unit.</li>}
                </ol>
              </>
            )
          ) : null}

          {step.id === "important-terms" ? (
            (() => {
              const additionalImportantTerms = (agreement.importantTerms ?? "")
                .split(/\r?\n/)
                .map((term) => term.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
                .filter(Boolean);
              const importantTerms = [
                ...importantObligations.map((item) => item.text.trim()).filter(Boolean),
                ...additionalImportantTerms,
              ];
              return importantTerms.length ? (
                <ol className={`list-decimal space-y-2 pl-5 leading-6 text-[#53675a] ${readOnly ? "text-[13px]" : "text-[10px]"}`}>
                  {importantTerms.map((term, index) => <li key={`${index}-${term}`}>{term}</li>)}
                </ol>
              ) : null;
            })()
          ) : null}

          {step.id === "approve" ? (
            <>
              <ReviewHeading
                title={readOnly ? "Agreement summary" : "Final review and approval"}
                text={readOnly ? "This shared agreement is available for viewing only." : "Review the latest details, then approve this version of the agreement."}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewValue label="Tenant" value={tenantName} />
                <ReviewValue label="Property" value={propertyName} />
                <ReviewValue label="Monthly rent" value={`₹${Number(monthlyRent || 0).toLocaleString("en-IN")}`} />
                <ReviewValue label="Security deposit" value={`₹${Number(securityDeposit || 0).toLocaleString("en-IN")}`} />
                <ReviewValue label="Agreement period" value={`${startDate || "—"} to ${endDate ?? "—"}`} />
                <ReviewValue label="Your role" value={party === "OWNER" ? "Owner" : "Public viewer"} />
              </div>
              {readOnly ? (
                mappedTerms.length ? (
                  <ol className="space-y-1.5 rounded-xl border border-[#e7ece7] bg-[#f9fbf9] p-4 text-[12px] leading-6 text-[#53675a]">
                    {mappedTerms.map((item, index) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="shrink-0 font-semibold text-[#294034]">{index + 1}.</span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : null
              ) : (
                <section className="rounded-xl border border-[#e7ece7] bg-[#f9fbf9] p-4">
                  <h3 className="text-[11px] font-semibold text-[#294034]">Mapped property terms</h3>
                  <ol className="mt-2 space-y-1.5 text-[10px] leading-6 text-[#53675a]">
                    {mappedTerms.length ? mappedTerms.map((item, index) => (
                      <li key={item.id} className="flex gap-2">
                        <span className="shrink-0 font-semibold text-[#294034]">{index + 1}.</span>
                        <span>
                          {item.importantObligation ? <strong className="mr-1 text-[#805b13]">Important obligation:</strong> : null}
                          {item.text}
                        </span>
                      </li>
                    )) : <li>No property terms are mapped to this unit.</li>}
                  </ol>
                </section>
              )}
              {!readOnly ? (
                <>
                  <div className="rounded-xl border border-[#e7ece7] p-4">
                    <p className="text-[10px] font-semibold text-[#465a4c]">Approval record</p>
                    <p className="mt-2 text-[10px] text-[#718078]">Owner: {formatDateTime(agreement.ownerApprovedAt)}</p>
                  </div>
                  <p className="text-[10px] leading-5 text-[#718078]">The agreement becomes active after owner approval. The tenant can view the approved agreement in their portal.</p>
                </>
              ) : null}
            </>
          ) : null}
          {error ? <p role="alert" className="rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{error}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-[#edf0ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
          <button type="button" onClick={onClose} className="h-10 w-full rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e] sm:w-auto">{readOnly ? "Close" : "Cancel"}</button>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {stepIndex > 0 ? (
              <button type="button" onClick={goPrevious} className="flex h-10 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#e3e9e4] px-2 text-[11px] font-semibold text-[#58695e] sm:px-3">
                <ChevronLeft size={14} /> Back
              </button>
            ) : null}
            {stepIndex < visibleSteps.length - 1 ? (
              <button type="button" onClick={goNext} className={`flex h-10 min-w-0 items-center justify-center gap-1 rounded-lg bg-[#176b4b] px-2 text-[11px] font-semibold text-white hover:bg-[#10583c] sm:px-4 ${stepIndex === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => readOnly ? onClose() : void approve()} disabled={saving} className="col-span-2 flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#176b4b] px-2 text-[11px] font-semibold text-white hover:bg-[#10583c] disabled:opacity-60 sm:col-span-1 sm:px-4">
                {readOnly ? <Check size={14} /> : saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                {readOnly ? "Done" : saving ? "Saving approval..." : agreement.status === "ACTIVE" && agreement.mandatoryDetailsApprovedAt ? "Save & approve again" : "Complete & approve"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ReviewHeading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold text-[#203328]">{title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-[#79867e]">{text}</p>
    </div>
  );
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e7ece7] bg-[#fcfdfc] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#829087]">{label}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#31483a]">{value}</p>
    </div>
  );
}

function ApprovalField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-[10px] font-semibold text-[#465a4c]">
      {label}{required ? <span className="ml-1 text-[#b34e36]">*</span> : null}
      <input
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[12px] text-[#33473a] outline-none focus:border-[#8cbd9b]"
      />
    </label>
  );
}
