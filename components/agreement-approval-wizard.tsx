"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import { addElevenMonthTerm } from "@/lib/rental-agreement";

export type ReviewableAgreement = {
  id: string;
  agreementNumber: string;
  assetId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms: string;
  importantTerms?: string;
  status: string;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
};

type ReviewStep = "kyc" | "rent" | "advance" | "terms" | "important-terms" | "approve";
const steps: Array<{ id: ReviewStep; label: string }> = [
  { id: "kyc", label: "KYC" },
  { id: "rent", label: "Rent" },
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

export default function AgreementApprovalWizard({
  agreement,
  party,
  tenantName,
  tenantMobile,
  propertyName,
  buildingAddress,
  onClose,
  onApproved,
}: {
  agreement: ReviewableAgreement;
  party: "OWNER" | "TENANT";
  tenantName: string;
  tenantMobile: string | null;
  propertyName: string;
  buildingAddress: string;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStepIndex, setFurthestStepIndex] = useState(0);
  const [startDate, setStartDate] = useState(agreement.startDate.slice(0, 10));
  const [monthlyRent, setMonthlyRent] = useState(String(agreement.monthlyRent));
  const [securityDeposit, setSecurityDeposit] = useState(String(agreement.securityDeposit));
  const [terms, setTerms] = useState(agreement.terms ?? "");
  const [importantTerms, setImportantTerms] = useState(agreement.importantTerms ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endDate = addElevenMonthTerm(startDate);
  const step = steps[stepIndex];

  function goNext() {
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    setStepIndex(nextIndex);
    setFurthestStepIndex((furthest) => Math.max(furthest, nextIndex));
  }

  function goPrevious() {
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function approve() {
    const rent = Number(monthlyRent);
    const deposit = Number(securityDeposit);
    if (!endDate || !Number.isSafeInteger(rent) || rent <= 0 || !Number.isSafeInteger(deposit) || deposit < 0) {
      setError("Enter a valid 11-month period, monthly rent, and security deposit.");
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
          terms,
          importantTerms,
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#10281c]/50 p-3 backdrop-blur-[2px] sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-review-title"
        className="my-auto w-full max-w-[760px] overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#edf0ed] px-5 py-4 sm:px-7">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">
              {party === "OWNER" ? "Owner approval" : "Tenant approval"}
            </p>
            <h2 id="agreement-review-title" className="mt-1 text-[18px] font-semibold text-[#203328]">
              Review agreement
            </h2>
            <p className="mt-1 text-[11px] text-[#79867e]">{agreement.agreementNumber}</p>
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

        <div role="tablist" aria-label="Agreement approval steps" className="flex overflow-x-auto border-b border-[#edf0ed] px-3 sm:px-5">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={stepIndex === index}
              disabled={index > furthestStepIndex}
              onClick={() => {
                setStepIndex(index);
              }}
              className={`shrink-0 border-b-2 px-3 py-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${stepIndex === index ? "border-[#176b4b] text-[#176b4b]" : "border-transparent text-[#849188] hover:text-[#355942]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="max-h-[58vh] min-h-[260px] space-y-4 overflow-y-auto p-5 sm:p-7">
          {step.id === "kyc" ? (
            <>
              <ReviewHeading title="Tenant and property details" text="Check who and what this agreement covers." />
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewValue label="Tenant" value={tenantName} />
                <ReviewValue label="Tenant mobile" value={tenantMobile ? `+${tenantMobile}` : "Not provided"} />
                <ReviewValue label="Property" value={propertyName} />
                <ReviewValue label="Address" value={buildingAddress || "Not recorded"} />
              </div>
              <p className="rounded-lg bg-[#f7faf7] px-3 py-2 text-[10px] leading-5 text-[#718078]">
                KYC documents are not stored in Rent-Sync. Contact the account owner if the registered tenant or property details need correction.
              </p>
            </>
          ) : null}

          {step.id === "rent" ? (
            <>
              <ReviewHeading title="Rent and agreement period" text="You can correct these details before approving." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Monthly rent (₹)
                <input type="number" min="1" step="1" required value={monthlyRent} onChange={(event) => setMonthlyRent(event.target.value)} className={inputClass} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-semibold text-[#465a4c]">
                  Agreement start date
                  <input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                </label>
                <ReviewValue label="Agreement end date (11 months)" value={endDate ?? "Choose a valid start date"} />
              </div>
            </>
          ) : null}

          {step.id === "advance" ? (
            <>
              <ReviewHeading title="Advance and security deposit" text="Confirm the agreed deposit amount." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Security deposit (₹)
                <input type="number" min="0" step="1" required value={securityDeposit} onChange={(event) => setSecurityDeposit(event.target.value)} className={inputClass} />
              </label>
            </>
          ) : null}

          {step.id === "terms" ? (
            <>
              <ReviewHeading title="Agreement terms" text="Edit the additional conditions for this rental, if needed." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Terms and notes
                <textarea rows={7} maxLength={2000} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Add agreed conditions..." className="mt-1.5 w-full resize-y rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 py-2.5 text-[12px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" />
              </label>
            </>
          ) : null}

          {step.id === "important-terms" ? (
            <>
              <ReviewHeading title="Important terms" text="Record any important terms both parties should review." />
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Important terms
                <textarea rows={7} maxLength={4000} value={importantTerms} onChange={(event) => setImportantTerms(event.target.value)} placeholder="Add important obligations or conditions..." className="mt-1.5 w-full resize-y rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 py-2.5 text-[12px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" />
              </label>
            </>
          ) : null}

          {step.id === "approve" ? (
            <>
              <ReviewHeading title="Final review and approval" text="Review the latest details, then approve this version of the agreement." />
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewValue label="Tenant" value={tenantName} />
                <ReviewValue label="Property" value={propertyName} />
                <ReviewValue label="Monthly rent" value={`₹${Number(monthlyRent || 0).toLocaleString("en-IN")}`} />
                <ReviewValue label="Security deposit" value={`₹${Number(securityDeposit || 0).toLocaleString("en-IN")}`} />
                <ReviewValue label="Agreement period" value={`${startDate || "—"} to ${endDate ?? "—"}`} />
                <ReviewValue label="Your role" value={party === "OWNER" ? "Owner" : "Tenant"} />
              </div>
              <div className="rounded-xl border border-[#e7ece7] p-4">
                <p className="text-[10px] font-semibold text-[#465a4c]">Approval record</p>
                <p className="mt-2 text-[10px] text-[#718078]">Owner: {formatDateTime(agreement.ownerApprovedAt)}</p>
                <p className="mt-1 text-[10px] text-[#718078]">Tenant: {formatDateTime(agreement.tenantApprovedAt)}</p>
              </div>
              <p className="text-[10px] leading-5 text-[#718078]">
                {party === "OWNER"
                  ? "The tenant will be asked to review and approve after you. Any changes made during their review will require your approval again."
                  : "If you change any agreement details, the owner must review and approve the updated version again."}
              </p>
            </>
          ) : null}
          {error ? <p role="alert" className="rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#edf0ed] px-5 py-4 sm:px-7">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e]">Cancel</button>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button type="button" onClick={goPrevious} className="flex h-10 items-center gap-1 rounded-lg border border-[#e3e9e4] px-3 text-[11px] font-semibold text-[#58695e]">
                <ChevronLeft size={14} /> Back
              </button>
            ) : null}
            {stepIndex < steps.length - 1 ? (
              <button type="button" onClick={goNext} className="flex h-10 items-center gap-1 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white hover:bg-[#10583c]">
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={() => void approve()} disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white hover:bg-[#10583c] disabled:opacity-60">
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? "Saving approval..." : "Approve agreement"}
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
