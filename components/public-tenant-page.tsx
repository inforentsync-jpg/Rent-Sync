"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  FileDown,
  FileCheck2,
  Home,
  ShieldCheck,
} from "lucide-react";
import AgreementApprovalWizard, { type ReviewableAgreement } from "@/components/agreement-approval-wizard";

type PublicAgreement = Omit<
  ReviewableAgreement,
  "tenantId"
> & {
  propertyName: string;
  buildingName: string;
  buildingAddress: string;
};
type PublicTenantData = {
  tenant: {
    fullName: string;
    mobileNumber: string | null;
    businessName: string | null;
    fullAddress: string | null;
    aadhaarNumber: string | null;
    fatherName: string | null;
    email: string | null;
    photoDataUrl: string | null;
  };
  assets: {
    id: string;
    name: string;
    assetType: string;
    unitNumber: string;
    roomNumber: string | null;
    ward: string | null;
    ksmartBuildingId: string | null;
    ksrbId: string | null;
    monthlyRent: number;
    securityDeposit: number;
    buildingName: string;
    city: string;
    state: string;
  }[];
  agreements: PublicAgreement[];
};
type PublicTab = "overview" | "assets" | "agreements" | "terms";

const publicTabs: Array<{ id: PublicTab; label: string; icon: typeof Home }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "assets", label: "Properties", icon: Building2 },
  { id: "agreements", label: "Agreements", icon: FileCheck2 },
  { id: "terms", label: "Terms", icon: BookOpenText },
];

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PublicTenantPage({ data, token }: { data: PublicTenantData; token: string }) {
  const [tab, setTab] = useState<PublicTab>("overview");
  const [reviewingAgreement, setReviewingAgreement] = useState<PublicTenantData["agreements"][number] | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const getStatus = (agreement: PublicAgreement) =>
    agreement.status === "DRAFT" ? "Draft" : agreement.endDate < today ? "Expired" : "Active";
  const currentAgreements = data.agreements.filter((agreement) => getStatus(agreement) === "Active");
  const expiryAgreement = [...currentAgreements].sort((left, right) => left.endDate.localeCompare(right.endDate))[0]
    ?? data.agreements.find((agreement) => agreement.status === "DRAFT")
    ?? data.agreements[0];
  const expiryLabel = expiryAgreement
    ? getStatus(expiryAgreement) === "Draft"
      ? "Agreement end date"
      : getStatus(expiryAgreement) === "Expired" ? "Last expired" : "Agreement expires"
    : null;
  const allTerms = data.agreements.flatMap((agreement) =>
    agreement.templateTerms?.flatMap((template) =>
      template.items.map((item) => ({ ...item, agreementNumber: agreement.agreementNumber })),
    ) ?? [],
  );

  return (
    <main className="min-h-screen bg-[#f4f7f4] text-[#17271e]">
      <header className="border-b border-[#e6ede7] bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#176b4b] text-white"><Building2 size={17} /></span>
            <span className="text-[17px] font-bold tracking-[-0.06em]">rent<span className="text-[#176b4b]">sync</span></span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#eff6f0] px-3 py-1.5 text-[10px] font-semibold text-[#286244]">
            <ShieldCheck size={14} /> Shared tenant page
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 pb-14 pt-5 sm:px-7 sm:pt-8">
        <section className="relative overflow-hidden rounded-[28px] bg-[#123d2c] px-5 py-7 text-white shadow-[0_18px_50px_-28px_rgba(18,61,44,0.65)] sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-28 size-72 rounded-full border-[38px] border-white/[0.045]" />
          <div className="pointer-events-none absolute -bottom-24 right-32 size-52 rounded-full bg-[#3e8764]/20 blur-2xl" />
          {expiryAgreement && expiryLabel ? (
            <div className="absolute right-5 top-5 inline-flex items-center gap-2.5 rounded-2xl border border-[#f4c66d]/70 bg-[#fff1c9] px-3 py-2.5 shadow-lg shadow-black/10 sm:right-8 sm:top-7">
              <span className="grid size-8 place-items-center rounded-xl bg-[#f9dfa0] text-[#86500e]"><CalendarDays size={15} /></span>
              <span className="block">
                <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#946018]">{expiryLabel}</span>
                <span className="mt-0.5 block text-[12px] font-semibold text-[#49300d]">{formatDate(expiryAgreement.endDate)}</span>
              </span>
            </div>
          ) : null}
          <div className="relative max-w-[700px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#a6d2b3]">Tenant information</p>
            <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.06em] sm:text-[42px]">
              {data.tenant.fullName}
            </h1>
            <p className="mt-2 max-w-[540px] text-[12px] leading-6 text-white/70 sm:text-[14px]">
              A clear, up-to-date overview of the assigned property and current rental agreement.
            </p>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeroStat label="Properties" value={data.assets.length.toLocaleString("en-IN")} />
            <HeroStat label="Current agreements" value={currentAgreements.length.toLocaleString("en-IN")} />
            <HeroStat label="Monthly rent" value={expiryAgreement ? `₹${expiryAgreement.monthlyRent.toLocaleString("en-IN")}` : "—"} />
            <HeroStat label="Security deposit" value={expiryAgreement ? `₹${expiryAgreement.securityDeposit.toLocaleString("en-IN")}` : "—"} />
          </div>
        </section>

        <div className="mt-5 rounded-2xl border border-[#dce9df] bg-white px-4 py-3.5 sm:flex sm:items-center sm:gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#eef6ef] text-[#286244]"><ShieldCheck size={16} /></span>
          <p className="mt-2 text-[10px] leading-5 text-[#718078] sm:mt-0 sm:text-[11px]">
            Anyone with this link can view tenant contact and KYC information, assigned properties, and current agreement, rent, deposit, approval, and terms details.
          </p>
        </div>

        <nav aria-label="Tenant information sections" className="sticky top-0 z-10 -mx-4 mt-5 overflow-x-auto border-y border-[#e6ede7] bg-[#f4f7f4]/95 px-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:px-2">
          <div role="tablist" className="flex min-w-max gap-1 py-1 sm:min-w-0 sm:py-2">
            {publicTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-[11px] font-semibold transition sm:flex-1 sm:justify-center ${tab === id ? "bg-[#176b4b] text-white shadow-sm" : "text-[#718078] hover:bg-[#eff5f0] hover:text-[#284b35]"}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </nav>

        <section role="tabpanel" className="mt-5">
          {tab === "overview" ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)] sm:p-7">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#769080]">Tenant profile</p>
                <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[#1c3024]">Current tenancy</h2>
                <div className="mt-5 rounded-xl bg-[#f7faf7] p-4">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#819087]">Tenant name</p>
                  <p className="mt-1.5 text-[14px] font-semibold text-[#294034]">{data.tenant.fullName}</p>
                </div>
                <p className="mt-4 text-[11px] leading-5 text-[#718078]">
                  This public profile is shared by the property owner. The information shown in the tenant and agreement sections is visible to anyone with this link.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <InfoTile label="Business name" value={data.tenant.businessName || "—"} />
                  <InfoTile label="Mobile number" value={data.tenant.mobileNumber ? `+${data.tenant.mobileNumber}` : "—"} />
                  <InfoTile label="Full address" value={data.tenant.fullAddress || "—"} />
                  <InfoTile label="Aadhaar number" value={data.tenant.aadhaarNumber || "—"} />
                  <InfoTile label="Father's name" value={data.tenant.fatherName || "—"} />
                  <InfoTile label="Email address" value={data.tenant.email || "—"} />
                </div>
              </article>
              <article className="rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)] sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#769080]">Current agreement</p>
                    <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[#1c3024]">Rental overview</h2>
                  </div>
                  <span className="grid size-10 place-items-center rounded-xl bg-[#eef6ef] text-[#286244]"><CalendarDays size={18} /></span>
                </div>
                {currentAgreements.length ? currentAgreements.slice(0, 2).map((agreement) => (
                  <div key={agreement.id} className="mt-4 rounded-xl border border-[#edf1ed] p-4">
                    <p className="text-[12px] font-semibold text-[#294034]">{agreement.propertyName}</p>
                    <p className="mt-1 text-[10px] text-[#718078]">{formatDate(agreement.startDate)} – {formatDate(agreement.endDate)}</p>
                    <button type="button" onClick={() => setReviewingAgreement(agreement)} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#176b4b]">
                      Review agreement <ArrowUpRight size={13} />
                    </button>
                  </div>
                )) : <p className="mt-4 rounded-xl bg-[#f7faf7] p-4 text-[11px] leading-5 text-[#718078]">No current agreement is available on this shared page.</p>}
              </article>
            </div>
          ) : null}

          {tab === "assets" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.assets.length ? data.assets.map((asset) => (
                <article key={asset.id} className="rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-[#eef6ef] text-[#286244]"><Building2 size={18} /></span>
                    <span className="rounded-full bg-[#f1f5f1] px-2.5 py-1 text-[9px] font-semibold text-[#63776a]">{asset.assetType}</span>
                  </div>
                  <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.03em] text-[#203328]">{asset.name}</h2>
                  <p className="mt-1 text-[11px] text-[#718078]">{asset.buildingName}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <InfoTile label="Unit" value={asset.unitNumber} />
                    <InfoTile label="Location" value={[asset.city, asset.state].filter(Boolean).join(", ") || "—"} />
                    <InfoTile label="Room number" value={asset.roomNumber || "—"} />
                    <InfoTile label="Ward number" value={asset.ward || "—"} />
                    <InfoTile label="K-SMART building ID" value={asset.ksmartBuildingId || "—"} />
                    <InfoTile label="KSRB ID" value={asset.ksrbId || "—"} />
                    <InfoTile label="Rent / month" value={`₹${asset.monthlyRent.toLocaleString("en-IN")}`} />
                    <InfoTile label="Security deposit" value={`₹${asset.securityDeposit.toLocaleString("en-IN")}`} />
                  </div>
                </article>
              )) : <EmptyCard text="No currently assigned properties are available." />}
            </div>
          ) : null}

          {tab === "agreements" ? (
            <div className="space-y-3">
              {data.agreements.length ? data.agreements.map((agreement) => {
                return (
                <article key={agreement.id} className="rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)] sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <h2 className="text-[36px] font-bold leading-none tracking-[-0.06em] text-[#203328]">{agreement.startDate.slice(0, 4)}</h2>
                    <p className="mt-2 text-[10px] font-medium text-[#829087]">Asset ID · {agreement.assetId}</p>
                  </div>
                  <div className="mt-4 grid w-full gap-2 sm:mt-0 sm:w-auto sm:grid-cols-2">
                    <button type="button" onClick={() => setReviewingAgreement(agreement)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[11px] font-semibold text-white transition hover:bg-[#10583c]">
                      Review agreement <ChevronRight size={15} />
                    </button>
                    <a
                      href={`/api/public/tenants/${encodeURIComponent(token)}/agreements/${encodeURIComponent(agreement.id)}/pdf`}
                      download
                      aria-label={`Download PDF for ${agreement.agreementNumber}`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfe0d3] bg-[#f5faf6] px-4 text-[11px] font-semibold text-[#176b4b] shadow-sm transition hover:border-[#176b4b] hover:bg-[#eaf4ed]"
                    >
                      <FileDown size={15} /> Download PDF
                    </a>
                  </div>
                </article>
                );
              }) : <EmptyCard text="No agreements are available on this shared page." />}
            </div>
          ) : null}

          {tab === "terms" ? (
            <div className="space-y-4">
              {data.agreements.length ? data.agreements.map((agreement) => {
                const terms = agreement.templateTerms?.flatMap((template) => template.items) ?? [];
                return (
                  <article key={agreement.id} className="rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)] sm:p-7">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#769080]">{agreement.agreementNumber}</p>
                    <h2 className="mt-2 text-[16px] font-semibold text-[#203328]">{agreement.propertyName}</h2>
                    {terms.length ? (
                      <ol className="mt-4 space-y-3">
                        {terms.map((item, index) => (
                          <li key={item.id} className="flex gap-3 rounded-xl bg-[#f7faf7] p-3.5">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-bold text-[#176b4b]">{index + 1}</span>
                            <span className="min-w-0 text-[13px] leading-6 text-[#465a4c]">
                              {item.importantObligation ? <strong className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide text-[#805b13]">Important obligation</strong> : null}
                              {item.text}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="mt-4 text-[11px] text-[#718078]">No reusable property terms are attached.</p>}
                    {agreement.terms ? <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[#edf1ed] p-4 text-[11px] leading-5 text-[#53675a]">{agreement.terms}</p> : null}
                    {agreement.importantTerms ? <p className="mt-3 whitespace-pre-wrap rounded-xl border border-[#f1dfb4] bg-[#fffaf0] p-4 text-[11px] leading-5 text-[#66552e]">{agreement.importantTerms}</p> : null}
                  </article>
                );
              }) : <EmptyCard text="Agreement terms will appear here when an agreement is available." />}
              {allTerms.length ? (
                <p className="px-1 text-[9px] leading-4 text-[#8a978e]">
                  Important obligations are marked for easier review. Open an agreement to read its full details.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#e1e9e2] py-5 text-center sm:flex-row sm:text-left">
          <p className="text-[9px] text-[#829087]">Shared with Rent-Sync · Information is provided by the property owner.</p>
          <p className="flex items-center gap-1 text-[9px] font-medium text-[#829087]"><ShieldCheck size={12} /> Read-only · No approvals or signatures</p>
        </footer>
      </div>

      {reviewingAgreement ? (
        <AgreementApprovalWizard
          key={reviewingAgreement.id}
          agreement={{
            ...reviewingAgreement,
            assetId: "",
            tenantId: "",
            terms: reviewingAgreement.terms ?? "",
          }}
          party="PUBLIC"
          readOnly
          tenantName={data.tenant.fullName}
          tenantMobile={data.tenant.mobileNumber ? `+${data.tenant.mobileNumber}` : null}
          propertyName={reviewingAgreement.propertyName}
          buildingAddress={reviewingAgreement.buildingAddress}
          onClose={() => setReviewingAgreement(null)}
          onApproved={() => setReviewingAgreement(null)}
        />
      ) : null}
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7faf7] px-3 py-2.5">
      <p className="text-[8px] font-bold uppercase tracking-[0.11em] text-[#829087]">{label}</p>
      <p className="mt-1 text-[10px] font-semibold text-[#465a4c]">{value}</p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-3">
      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white sm:text-[17px]">{value}</p>
      <p className="mt-1 truncate text-[9px] font-medium text-white/65 sm:text-[10px]">{label}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#dce6de] bg-white px-5 py-12 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#eef6ef] text-[#286244]"><Check size={18} /></span>
      <p className="mt-3 text-[11px] leading-5 text-[#718078]">{text}</p>
    </div>
  );
}
