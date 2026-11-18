"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CircleAlert,
  FileDown,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { type ReviewableAgreement } from "@/components/agreement-approval-wizard";
import {
  publicTenantProfileFields,
  publicTenantProfileFieldNames,
  type PublicTenantProfileField,
} from "@/lib/public-tenant-profile-fields";

type PublicAgreement = ReviewableAgreement & {
  propertyName: string;
  buildingName: string;
  buildingAddress: string;
};
type PublicTenantData = {
  profileComplete: boolean;
  missingProfileFields: PublicTenantProfileField[];
  tenant: {
    fullName: string;
    mobileNumber: string | null;
    businessName: string | null;
    businessNature: string | null;
    fullAddress: string | null;
    formattedAddress: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    district: string | null;
    state: string | null;
    city: string | null;
    postalCode: string | null;
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
function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PublicTenantPage({ data, token }: { data: PublicTenantData; token: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const agreementYears = [...new Set(data.agreements.map((agreement) => agreement.startDate.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const [selectedAgreementYear, setSelectedAgreementYear] = useState<string | null>(null);
  const activeAgreementYear = selectedAgreementYear ?? agreementYears[0] ?? null;
  const currentAgreements = data.agreements.filter((agreement) => {
    if (agreement.status === "CANCELLED" || agreement.status === "DRAFT") return false;
    return agreement.endDate >= today;
  });

  if (!data.profileComplete) {
    return <PublicTenantProfileCompletion token={token} data={data} />;
  }

  const latestAgreement = [...currentAgreements].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? data.agreements[0];
  const primaryAsset = data.assets[0];
  const totalMonthlyRent = currentAgreements.reduce((sum, agreement) => sum + Number(agreement.monthlyRent || 0), 0);
  const totalSecurityDeposit = currentAgreements.reduce((sum, agreement) => sum + Number(agreement.securityDeposit || 0), 0);
  const filteredAgreements = activeAgreementYear
    ? data.agreements.filter((agreement) => agreement.startDate.slice(0, 4) === activeAgreementYear)
    : data.agreements;
  const selectedAgreement = [...filteredAgreements].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? latestAgreement;
  const tenantFields = [
    { label: "Tenant name", value: data.tenant.fullName || "—" },
    { label: "Business", value: data.tenant.businessName || "—" },
    { label: "Business nature", value: data.tenant.businessNature || "—" },
    { label: "Mobile", value: data.tenant.mobileNumber ? `+${data.tenant.mobileNumber}` : "—" },
    { label: "Email", value: data.tenant.email || "—" },
    { label: "Aadhaar", value: data.tenant.aadhaarNumber || "—" },
    { label: "Father's name", value: data.tenant.fatherName || "—" },
    { label: "Address", value: data.tenant.formattedAddress || data.tenant.fullAddress || "—" },
    { label: "City", value: data.tenant.city || "—" },
    { label: "State", value: data.tenant.state || "—" },
    { label: "Postal code", value: data.tenant.postalCode || "—" },
  ];
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffaf4_0%,_#effbf2_31%,_#edf6ff_100%)] text-[#173327]">
      <div className="mx-auto max-w-md px-4 py-5 sm:max-w-lg">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#1e7d5d] via-[#125840] to-[#0d2e26] text-white shadow-[0_18px_30px_-16px_rgba(17,96,73,0.8)]">
              <Building2 size={18} />
            </span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#70857b]">Rent Sync</p>
              <p className="text-[22px] font-black tracking-[-0.08em] text-[#15382d]">
                rent<span className="text-[#1b7a59]">sync</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf9ee] px-2.5 py-1.5 text-[9px] font-black text-[#245f46] shadow-inner shadow-white/70">
            <ShieldCheck size={12} /> Shared
          </span>
        </header>

        <section className="mt-5 overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0e4d3c] via-[#155c45] to-[#0b3127] p-4 text-white shadow-[0_30px_65px_-30px_rgba(11,49,39,0.85)]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[9px] font-semibold text-white/80">
              <span className="size-1.5 rounded-full bg-[#8fe0a1] shadow-[0_0_12px_rgba(143,224,161,0.9)]" />
              Active
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#d7f6dd]">Tenant</span>
          </div>

          <h1 className="mt-5 text-[38px] font-black leading-[0.92] tracking-[-0.09em] text-white">
            {data.tenant.fullName}
          </h1>
          <p className="mt-2 text-[12px] leading-5 text-white/75">
            {primaryAsset ? `${primaryAsset.buildingName} • ${primaryAsset.city}` : data.tenant.formattedAddress || "Tenant agreement and property details"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <InfoTile label="Rent" value={`₹${totalMonthlyRent.toLocaleString("en-IN")}`} dark />
            <InfoTile label="Deposit" value={`₹${totalSecurityDeposit.toLocaleString("en-IN")}`} dark />
          </div>

          {selectedAgreement ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href={`/api/public/tenants/${encodeURIComponent(token)}/agreements/${encodeURIComponent(selectedAgreement.id)}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white px-3 py-2.5 text-[11px] font-black text-[#184b39] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)] transition hover:-translate-y-0.5 hover:bg-[#f4faf5]"
              >
                <FileDown size={14} /> PDF
              </a>
              <a
                href={`/api/public/tenants/${encodeURIComponent(token)}/agreements/${encodeURIComponent(selectedAgreement.id)}/word`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/8 px-3 py-2.5 text-[11px] font-black text-white shadow-[0_10px_24px_-16px_rgba(0,0,0,0.6)] transition hover:-translate-y-0.5 hover:bg-white/12"
              >
                <FileDown size={14} /> Word
              </a>
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-[28px] border border-[#e1ebdf] bg-white/90 p-4 shadow-[0_18px_30px_-26px_rgba(19,36,31,0.35)] backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#7f9184]">Profile</p>
            <span className="rounded-full bg-[#edf8ef] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[#2d6d4d]">Info</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {tenantFields.map((field) => (
              <InfoTile key={field.label} label={field.label} value={field.value} />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#e2ebdf] bg-white/90 p-4 shadow-[0_18px_30px_-26px_rgba(19,36,31,0.35)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#7f9184]">Property</p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.06em] text-[#173327]">All assets</h2>
            </div>
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#ebfff0] to-[#dff1ff] text-[#286244] shadow-inner shadow-white/90">
              <Building2 size={18} />
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {data.assets.length ? data.assets.map((asset) => (
              <div key={asset.id} className="rounded-[24px] bg-gradient-to-br from-[#f9fbfa] to-[#f2f7f4] p-3 shadow-[inset_0_0_0_1px_rgba(203,220,208,0.7)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-black tracking-[-0.04em] text-[#1d352a]">{asset.name}</p>
                    <p className="mt-1 text-[10px] text-[#72857d]">{asset.buildingName}</p>
                  </div>
                  <span className="rounded-full bg-[#edf9f0] px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em] text-[#2a694d]">{asset.assetType}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoTile label="Unit" value={asset.unitNumber || "—"} />
                  <InfoTile label="Rent" value={`₹${Number(asset.monthlyRent || 0).toLocaleString("en-IN")}`} />
                  <InfoTile label="Location" value={[asset.city, asset.state].filter(Boolean).join(", ") || "—"} />
                  <InfoTile label="Deposit" value={`₹${Number(asset.securityDeposit || 0).toLocaleString("en-IN")}`} />
                  <InfoTile label="Ward" value={asset.ward || "—"} />
                  <InfoTile label="Room" value={asset.roomNumber || "—"} />
                  <InfoTile label="KSRB ID" value={asset.ksrbId || "—"} />
                  <InfoTile label="KSMART ID" value={asset.ksmartBuildingId || "—"} />
                </div>
              </div>
            )) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-[#dfeae1] bg-[#f8faf8] p-5 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-2xl bg-[#edf8ef] text-[#2b6d49]">
                  <Check size={18} />
                </span>
                <p className="mt-3 text-[11px] leading-5 text-[#73857d]">No assigned property is available right now.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#e2ebdf] bg-white/90 p-4 shadow-[0_18px_30px_-26px_rgba(19,36,31,0.35)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#7f9184]">Agreement</p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.06em] text-[#173327]">All agreements</h2>
            </div>
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#ebfff0] to-[#eaf5ff] text-[#286244] shadow-inner shadow-white/90">
              <Check size={18} />
            </span>
          </div>

          {agreementYears.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {agreementYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedAgreementYear(activeAgreementYear === year ? null : year)}
                  className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[9px] font-black transition ${
                    activeAgreementYear === year
                      ? "border-[#0f583f] bg-gradient-to-r from-[#0f583f] to-[#1c7a58] text-white shadow-[0_10px_20px_-12px_rgba(15,88,63,0.9)]"
                      : "border-[#dfeae2] bg-[#f5faf6] text-[#49675a]"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {filteredAgreements.length ? filteredAgreements.map((agreement) => (
              <div key={agreement.id} className="rounded-[24px] bg-gradient-to-br from-[#f9fbfa] to-[#f1faf4] p-3 shadow-[inset_0_0_0_1px_rgba(203,220,208,0.7)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-black tracking-[-0.04em] text-[#1d352a]">{agreement.propertyName}</p>
                    <p className="mt-1 text-[10px] text-[#73857d]">{agreement.agreementNumber}</p>
                  </div>
                  <span className="rounded-full bg-[#edf9f0] px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em] text-[#2a694d]">{agreement.status}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoTile label="Start" value={formatDate(agreement.startDate)} />
                  <InfoTile label="End" value={formatDate(agreement.endDate)} />
                  <InfoTile label="Monthly" value={`₹${Number(agreement.monthlyRent || 0).toLocaleString("en-IN")}`} />
                  <InfoTile label="Deposit" value={`₹${Number(agreement.securityDeposit || 0).toLocaleString("en-IN")}`} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={`/api/public/tenants/${encodeURIComponent(token)}/agreements/${encodeURIComponent(agreement.id)}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dfeae2] bg-white px-2 py-2 text-[9px] font-black text-[#184b39] shadow-sm transition hover:-translate-y-0.5"
                  >
                    <FileDown size={12} /> PDF
                  </a>
                  <a
                    href={`/api/public/tenants/${encodeURIComponent(token)}/agreements/${encodeURIComponent(agreement.id)}/word`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dfeae2] bg-white px-2 py-2 text-[9px] font-black text-[#184b39] shadow-sm transition hover:-translate-y-0.5"
                  >
                    <FileDown size={12} /> Word
                  </a>
                </div>
              </div>
            )) : (
              <div className="mt-4 rounded-[22px] border border-dashed border-[#dfeae1] bg-[#f8faf8] p-5 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-2xl bg-[#edf8ef] text-[#2b6d49]">
                  <Check size={18} />
                </span>
                <p className="mt-3 text-[11px] leading-5 text-[#73857d]">No agreement details are available on this share link.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
function PublicTenantProfileCompletion({  token,
  data,
}: {
  token: string;
  data: PublicTenantData;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(publicTenantProfileFieldNames.map((field) => [field, data.tenant[field] ?? ""])),
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showForm) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setShowForm(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showForm, saving]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/public/tenants/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(
          publicTenantProfileFieldNames.map((field) => [field, values[field] ?? ""]),
        )),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to submit your tenant profile.";
        throw new Error(message);
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your tenant profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7f4] text-[#17271e]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[470px] bg-[radial-gradient(ellipse_at_50%_-20%,_rgba(40,128,91,0.13),_transparent_68%)]" />
      <header className="relative border-b border-[#e6ede7]/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[64px] max-w-[1120px] items-center justify-between gap-3 px-4 sm:min-h-[76px] sm:gap-4 sm:px-8">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="grid size-9 place-items-center rounded-[13px] bg-gradient-to-br from-[#21835e] to-[#10583d] text-white shadow-[0_8px_18px_-9px_rgba(17,94,64,0.8)] sm:size-10 sm:rounded-[14px]">
              <Building2 size={18} />
            </span>
            <span className="text-[17px] font-black tracking-[-0.07em] sm:text-[18px]">rent<span className="text-[#176b4b]">sync</span></span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#f1dfb8] bg-[#fffaf0] px-3 py-2 text-[11px] font-semibold text-[#895f1d] min-[380px]:inline-flex">
              <CircleAlert size={14} /> Profile incomplete
            </span>
          </div>
        </div>
      </header>
      <div className="relative mx-auto max-w-[1020px] px-4 pb-8 pt-5 min-[380px]:px-5 sm:px-8 sm:pb-16 sm:pt-14">
        <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#104934] via-[#14553f] to-[#0b3025] px-5 py-6 text-white shadow-[0_26px_55px_-34px_rgba(11,49,39,0.8)] min-[380px]:rounded-[28px] min-[380px]:px-6 min-[380px]:py-7 sm:rounded-[36px] sm:px-12 sm:py-12 sm:shadow-[0_32px_70px_-38px_rgba(11,49,39,0.8)]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 size-[340px] rounded-full border border-white/[0.07] sm:size-[440px]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-20 size-[240px] rounded-full border border-white/[0.08] sm:size-[340px]" />
          <div className="relative max-w-[620px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#c5ead3] sm:gap-2 sm:px-3 sm:text-[10px] sm:tracking-[0.16em]">
              <Sparkles size={12} /> Tenant profile
            </span>
            <h1 className="mt-4 break-words text-[31px] font-semibold leading-[1.08] tracking-[-0.06em] min-[380px]:text-[34px] sm:mt-6 sm:text-[52px] sm:tracking-[-0.065em]">
              {data.tenant.fullName ? `Welcome, ${data.tenant.fullName}` : "Let’s complete your profile"}
            </h1>
            <p className="mt-3 max-w-[520px] text-[13px] leading-6 text-white/75 sm:mt-4 sm:text-[15px] sm:leading-7">
              Add a few missing details to securely unlock your shared property and rental agreement.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="group mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-[13px] font-bold text-[#174c38] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#f1f8f2] sm:mt-7 sm:w-auto"
            >
              Add missing details <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
          <div className="relative mt-6 grid gap-2.5 border-t border-white/15 pt-4 text-[10px] font-medium text-white/70 min-[420px]:grid-cols-2 sm:mt-11 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 sm:pt-5 sm:text-[11px]">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="shrink-0 text-[#a9e3bb]" /> Your information stays protected</span>
            <span className="inline-flex items-center gap-2"><BadgeCheck size={14} className="shrink-0 text-[#a9e3bb]" /> Only required details are requested</span>
          </div>
        </section>

        <section className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[#e3ebe4] bg-white/95 p-4 shadow-[0_14px_38px_-30px_rgba(27,56,39,0.4)] min-[380px]:p-5 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff5df] text-[#a66a1d] sm:size-10"><CircleAlert size={17} /></span>
            <div>
              <p className="text-[12px] font-bold text-[#24382d] sm:text-[13px]">One last step to access your rental</p>
              <p className="mt-1 text-[11px] leading-[1.55] text-[#748178] sm:text-[12px] sm:leading-5">
                {data.missingProfileFields.length} required {data.missingProfileFields.length === 1 ? "detail is" : "details are"} still missing. Property and agreement information will appear once your profile is complete.
              </p>
            </div>
          </div>
        </section>
      </div>

      {showForm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#10251bcc] p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setShowForm(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="my-auto flex max-h-[100dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[24px] border border-white/70 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_36px_100px_-32px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[30px] sm:pb-0"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf1ed] px-4 py-4 min-[380px]:px-5 sm:gap-4 sm:px-7 sm:py-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf5ed] text-[#176b4b] sm:size-11 sm:rounded-2xl"><Building2 size={18} /></span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[#6c8c77]">Tenant profile</p>
                  <h2 id="profile-dialog-title" className="mt-1 text-[18px] font-bold tracking-[-0.045em] text-[#203328] min-[380px]:text-[20px] sm:text-[23px]">Review your profile</h2>
                  <p className="mt-1 text-[10px] leading-4 text-[#78857d] sm:text-[11px] sm:leading-5">Check your details and correct anything that needs updating.</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close profile form"
                disabled={saving}
                onClick={() => setShowForm(false)}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-[#738078] transition hover:bg-[#f1f5f1] hover:text-[#203328] disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(event) => void submit(event)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 min-[380px]:px-5 sm:px-7 sm:py-6">
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-[#f6faf6] px-3 py-2.5 sm:mb-5 sm:gap-3 sm:px-4 sm:py-3">
                <p className="text-[10px] leading-4 text-[#637369] sm:text-[11px] sm:leading-5">All profile details are shown. You can edit completed fields too.</p>
              </div>
              <div className="grid gap-3.5 min-[560px]:grid-cols-2 sm:gap-4">
                {publicTenantProfileFieldNames.map((field) => (
                  <label key={field} className="text-[11px] font-semibold text-[#3d5144]">
                    {publicTenantProfileFields[field].label}
                    {field === "addressLine2" ? <span className="ml-1 font-normal text-[#8b978f]">(optional)</span> : null}
                    <input
                      required={field !== "addressLine2"}
                      type={field === "mobileNumber" || field === "aadhaarNumber" || field === "postalCode" ? "tel" : "text"}
                      inputMode={field === "mobileNumber" ? "tel" : field === "aadhaarNumber" || field === "postalCode" ? "numeric" : undefined}
                      maxLength={publicTenantProfileFields[field].maxLength}
                      autoComplete={field === "fullName" ? "name" : undefined}
                      placeholder={field === "fullName" ? "Enter your Aadhaar name" : undefined}
                      value={values[field] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#dfe8e1] bg-[#fcfdfc] px-3.5 text-[16px] text-[#203328] outline-none transition placeholder:text-[#a0aca3] focus:border-[#70a984] focus:bg-white focus:ring-4 focus:ring-[#176b4b]/[0.08] sm:text-[13px]"
                    />
                  </label>
                ))}
              </div>
              {error ? <p role="alert" className="mt-4 rounded-xl border border-[#f0d7ca] bg-[#fff7f2] px-4 py-3 text-[12px] leading-5 text-[#995634]">{error}</p> : null}
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#edf1ed] pt-4 sm:mt-6 sm:flex-row sm:justify-end sm:gap-2.5 sm:pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="min-h-11 rounded-xl border border-[#e1e9e2] px-5 text-[12px] font-semibold text-[#54665a] transition hover:bg-[#f7faf7] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-5 text-[12px] font-bold text-white shadow-[0_10px_22px_-14px_rgba(23,107,75,0.8)] transition hover:bg-[#10583c] disabled:cursor-wait disabled:opacity-60">
                  {saving ? "Saving profile..." : "Save profile"} {!saving ? <ArrowRight size={15} /> : null}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function InfoTile({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={dark ? "rounded-xl border border-white/10 bg-white/10 px-3 py-2.5" : "rounded-xl bg-[#f7faf7] px-3 py-2.5"}>
      <p className={dark ? "text-[8px] font-bold uppercase tracking-[0.11em] text-[#d5e9db]" : "text-[8px] font-bold uppercase tracking-[0.11em] text-[#829087]"}>{label}</p>
      <p className={dark ? "mt-1 text-[10px] font-semibold text-white" : "mt-1 text-[10px] font-semibold text-[#465a4c]"}>{value}</p>
    </div>
  );
}
