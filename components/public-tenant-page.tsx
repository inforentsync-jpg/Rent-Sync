"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  FileDown,
  ShieldCheck,
} from "lucide-react";
import { type ReviewableAgreement } from "@/components/agreement-approval-wizard";
import {
  publicTenantProfileFields,
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
    Object.fromEntries(data.missingProfileFields.map((field) => [field, data.tenant[field] ?? ""])),
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetTenantDetails() {
    setValues((current) => {
      const next = { ...current };
      const preservedName = data.tenant.fullName || current.fullName || "";
      for (const field of Object.keys(publicTenantProfileFields) as PublicTenantProfileField[]) {
        next[field] = field === "fullName" ? preservedName : "";
      }
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/public/tenants/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(
          data.missingProfileFields.map((field) => [field, values[field] ?? ""]),
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
    <main className="min-h-screen bg-[#f4f7f4] text-[#17271e]">
      <header className="border-b border-[#e6ede7] bg-white">
        <div className="mx-auto flex min-h-[68px] max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-7">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#176b4b] text-white"><Building2 size={17} /></span>
            <span className="text-[17px] font-bold tracking-[-0.06em]">rent<span className="text-[#176b4b]">sync</span></span>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((visible) => !visible)}
            className="min-h-10 rounded-xl bg-[#176b4b] px-3 text-[10px] font-semibold text-white transition hover:bg-[#10583c] sm:px-4 sm:text-[11px]"
          >
            Your profile is incomplete Â· {showForm ? "Hide form" : "Complete now"}
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-7 sm:py-12">
        <section className="rounded-[24px] bg-[#123d2c] px-5 py-7 text-white shadow-[0_18px_50px_-28px_rgba(18,61,44,0.65)] sm:px-8 sm:py-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#a6d2b3]">Tenant profile</p>
          <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.05em] sm:text-[34px]">
            {data.tenant.fullName || "Complete your profile"}
          </h1>
          <p className="mt-2 max-w-[540px] text-[12px] leading-6 text-white/75">
            Complete the missing details to explore your shared properties and agreements.
          </p>
        </section>
        <div className="mt-4 rounded-2xl border border-[#dce9df] bg-white px-4 py-3.5 text-[11px] leading-5 text-[#718078]">
          Property and agreement information stays hidden until the required tenant profile fields are submitted.
        </div>
        {showForm ? (
          <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-2xl border border-[#e5ece6] bg-white p-5 shadow-[0_8px_28px_-24px_rgba(26,54,36,0.3)] sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#203328]">Complete your profile</h2>
                <p className="mt-1 text-[11px] text-[#718078]">Only the missing required fields are shown.</p>
              </div>
              <button
                type="button"
                onClick={resetTenantDetails}
                className="rounded-lg border border-[#dfe8e1] bg-[#f7faf7] px-3 py-2 text-[10px] font-semibold text-[#1f4c3d] transition hover:bg-[#edf7ef]"
              >
                Reset tenant details
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.missingProfileFields.map((field) => (
                <label key={field} className="text-[10px] font-semibold text-[#465a4c]">
                  {publicTenantProfileFields[field].label}
                  <input
                    required
                    type={field === "mobileNumber" || field === "aadhaarNumber" || field === "postalCode" ? "tel" : "text"}
                    inputMode={field === "mobileNumber" ? "tel" : field === "aadhaarNumber" || field === "postalCode" ? "numeric" : undefined}
                    maxLength={publicTenantProfileFields[field].maxLength}
                    value={values[field] ?? ""}
                    onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                    className="mt-1.5 h-11 w-full rounded-lg border border-[#dfe8e1] bg-[#fcfdfc] px-3 text-[12px] outline-none transition focus:border-[#8cbd9b]"
                  />
                </label>
              ))}
            </div>
            {error ? <p role="alert" className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{error}</p> : null}
            <button type="submit" disabled={saving} className="mt-5 min-h-11 w-full rounded-xl bg-[#176b4b] px-4 text-[11px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60">
              {saving ? "Submitting..." : "Submit and explore"}
            </button>
          </form>
        ) : null}
      </div>
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
