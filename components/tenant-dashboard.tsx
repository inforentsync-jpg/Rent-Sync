"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileCheck2,
  FileText,
  Home,
  LogOut,
  Menu,
  Printer,
  X,
} from "lucide-react";
import { addElevenMonthTerm } from "@/lib/rental-agreement";
import AgreementFacts from "@/components/agreement-facts";

type Asset = {
  id: string;
  name: string;
  assetType: string;
  unitNumber: string;
  monthlyRent: number;
  securityDeposit: number;
  buildingId?: string;
  buildingName?: string;
  buildingAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  companyName?: string | null;
  agreements?: Agreement[];
};

type Agreement = {
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
  createdAt: string;
  status: string;
  ownerApprovedAt?: string | null;
  tenantApprovedAt?: string | null;
};

type TenantPortal = {
  tenant: { id: string; fullName: string; mobileNumber: string };
  assets: Asset[];
  agreements: Agreement[];
};

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatApprovalDate(value?: string | null, status?: string) {
  return value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : status === "DRAFT" ? "Awaiting approval" : "Not recorded for this agreement";
}

function getNextJanuaryFirst() {
  return `${new Date().getFullYear() + 1}-01-01`;
}

export default function TenantDashboard({ mobileNumber }: { mobileNumber: string }) {
  const router = useRouter();
  const [portal, setPortal] = useState<TenantPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [startDate, setStartDate] = useState(getNextJanuaryFirst());
  const [terms, setTerms] = useState("");
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);

  const loadPortal = useCallback(async () => {
    try {
      const response = await fetch("/api/tenant/agreements", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load your tenant account.");
      setPortal(payload);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your tenant account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPortal(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPortal]);

  const endDate = useMemo(() => addElevenMonthTerm(startDate), [startDate]);
  const agreements = portal?.agreements ?? [];
  const assets = portal?.assets ?? [];
  const selectedAsset = assets.find((asset) => asset.id === assetId) ?? null;

  function hasAgreementForPeriod(asset: Asset, start: string, end: string | null) {
    if (!end) return true;
    return agreements.some(
      (agreement) =>
        agreement.assetId === asset.id &&
        (agreement.startDate.slice(0, 4) === start.slice(0, 4) ||
          (agreement.status === "ACTIVE" &&
            agreement.startDate.slice(0, 10) <= end &&
            agreement.endDate.slice(0, 10) >= start)),
    );
  }

  const availableAssets = assets.filter(
    (asset) => !hasAgreementForPeriod(asset, startDate, endDate),
  );

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to log out. Please try again.");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to log out. Please try again.");
    }
  }

  async function createAgreement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assetId || !endDate) {
      setFormError("Choose an available property and valid start date.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/tenant/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, startDate, endDate, terms }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create this agreement.");
      setShowAgreementForm(false);
      setSelectedAgreement(payload.agreement);
      setTerms("");
      await loadPortal();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to create this agreement.");
    } finally {
      setSaving(false);
    }
  }

  const agreementAsset = selectedAgreement
    ? assets.find((asset) => asset.id === selectedAgreement.assetId)
    : null;

  return (
    <div className="min-h-screen bg-[#f4f6f3] text-[#16251d]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[258px] flex-col bg-[#123d2c] text-white transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <a href="/tenant/dashboard" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e5f0e7] text-[#176b4b]"><Building2 size={19} /></span><span className="text-[18px] font-bold tracking-[-0.06em]">rent<span className="text-[#9bd0ad]">sync</span></span></a>
          <button type="button" aria-label="Close menu" onClick={() => setMobileMenu(false)} className="lg:hidden"><X size={18} /></button>
        </div>
        <div className="px-5 pt-7"><p className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Workspace</p><div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3"><span className="grid size-8 place-items-center rounded-lg bg-[#d8ebe0] text-[#176b4b]"><Home size={16} /></span><span><span className="block text-[11px] font-semibold">Tenant portal</span><span className="mt-0.5 block text-[9px] text-white/50">My rental</span></span></div></div>
        <nav className="mt-8 flex-1 px-4"><p className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Manage</p><a href="#my-rental" className="mt-3 flex items-center gap-3 rounded-xl bg-[#e9f3eb] px-3 py-3 text-[12px] font-medium text-[#154b34]"><Home size={16} /> My rental</a><a href="#agreements" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-medium text-white/70 hover:bg-white/[0.07]"><FileText size={16} /> Agreements</a></nav>
        <div className="border-t border-white/10 p-4"><div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2"><span className="grid size-8 place-items-center rounded-full bg-[#d8ebe0] text-[10px] font-bold text-[#176b4b]">TN</span><span><span className="block text-[10px] font-semibold">{portal?.tenant.fullName ?? "Tenant"}</span><span className="mt-0.5 block text-[9px] text-white/45">+{mobileNumber}</span></span></div><button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] text-white/65 transition hover:bg-white/[0.07] hover:text-white"><LogOut size={15} /> Logout</button></div>
      </aside>

      {mobileMenu ? <button type="button" aria-label="Close sidebar" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-20 bg-black/30 lg:hidden" /> : null}

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-[#e6ebe6] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3"><button type="button" aria-label="Open menu" onClick={() => setMobileMenu(true)} className="grid size-9 place-items-center rounded-lg border border-[#e4eae5] text-[#53675a] lg:hidden"><Menu size={17} /></button><div><p className="text-[10px] font-medium text-[#8b978f]">Tenant portal / <span className="text-[#496453]">My rental</span></p><h1 className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-[#1b2c22]">Your rental home</h1></div></div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full bg-[#f1f6f2] px-3 py-2 text-[10px] font-medium text-[#50715b] sm:flex"><span className="size-1.5 rounded-full bg-[#33a66e]" /> Tenant portal</span>
            <button type="button" onClick={logout} className="flex h-9 items-center gap-2 rounded-lg border border-[#e4eae5] bg-white px-3 text-[11px] font-medium text-[#315b41] transition hover:bg-[#f1f6f2]"><LogOut size={15} /><span>Logout</span></button>
          </div>
        </header>

        <main className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Tenant workspace</p><h2 className="mt-2 text-[25px] font-semibold tracking-[-0.05em] text-[#17271e] sm:text-[30px]">Welcome, {portal?.tenant.fullName ?? "Tenant"}.</h2><p className="mt-2 text-[12px] text-[#77847b]">View your rental agreement or create one for an available assigned property.</p></div><button type="button" onClick={() => { setAssetId(availableAssets[0]?.id ?? ""); setStartDate(getNextJanuaryFirst()); setFormError(""); setShowAgreementForm(true); }} disabled={!availableAssets.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[11px] font-semibold text-white shadow-md transition hover:bg-[#10583c] disabled:cursor-not-allowed disabled:opacity-50"><FileCheck2 size={15} /> Generate rental agreement</button></div>

          <section id="my-rental" className="mt-7 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Assigned assets" value={assets.length} icon={<Building2 size={17} />} />
            <SummaryCard label="Rental agreements" value={agreements.length} icon={<FileText size={17} />} />
            <SummaryCard label="Available to rent" value={availableAssets.length} icon={<CalendarDays size={17} />} />
          </section>

          <section className="mt-8 rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
            <div className="border-b border-[#edf0ed] px-5 py-4 sm:px-6"><h3 className="text-[13px] font-semibold text-[#203328]">Your assigned properties</h3><p className="mt-1 text-[10px] text-[#8a968e]">Properties linked to your registered mobile number by the owner.</p></div>
            {loading ? <PanelMessage>Loading properties...</PanelMessage> : error ? <PanelMessage error>{error}</PanelMessage> : !assets.length ? <PanelMessage>No properties are linked to your tenant account yet. Ask your owner to add your registered mobile number to an asset.</PanelMessage> : (
              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                {assets.map((asset) => {
                  const existing = agreements.filter((agreement) => agreement.assetId === asset.id);
                  return <article key={asset.id} className="rounded-xl border border-[#e7ece7] bg-[#fcfdfc] p-5"><span className="grid size-9 place-items-center rounded-lg bg-[#edf4ef] text-[#37734d]"><Building2 size={17} /></span><h4 className="mt-4 text-[14px] font-semibold text-[#294034]">{asset.name} · {asset.unitNumber}</h4><p className="mt-1 text-[10px] text-[#718078]">{asset.assetType}{asset.buildingName ? ` · ${asset.buildingName}` : ""}</p><p className="mt-3 text-[11px] font-semibold text-[#315b41]">₹{asset.monthlyRent.toLocaleString("en-IN")} <span className="font-normal text-[#849188]">/ month</span></p><p className="mt-2 text-[9px] leading-4 text-[#849188]">{asset.buildingAddress}{asset.city ? `, ${asset.city}` : ""}{asset.state ? `, ${asset.state}` : ""}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf0ed] pt-3"><span className="text-[9px] text-[#849188]">{existing.length ? `${existing.length} agreement${existing.length === 1 ? "" : "s"} in history` : "No agreement yet"}</span>{existing.length ? <button type="button" onClick={() => setSelectedAgreement(existing[0])} className="text-[9px] font-semibold text-[#286244] hover:underline">View latest</button> : <span className="rounded-full bg-[#edf5ef] px-2 py-1 text-[8px] font-semibold text-[#467253]">Available</span>}</div></article>;
                })}
              </div>
            )}
          </section>

          <section id="agreements" className="mt-8 scroll-mt-24 rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
            <div className="border-b border-[#edf0ed] px-5 py-4 sm:px-6"><h3 className="text-[13px] font-semibold text-[#203328]">Rental agreement history</h3><p className="mt-1 text-[10px] text-[#8a968e]">View your agreements and their owner approval status.</p></div>
            {!agreements.length ? <PanelMessage>No agreements have been generated yet.</PanelMessage> : <div className="divide-y divide-[#f0f2f0]">{agreements.map((agreement) => {
              return (
                <div key={agreement.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-[#3d5245]">{agreement.agreementNumber}</p>
                      <p className="mt-1 text-[9px] text-[#849188]">{assets.find((asset) => asset.id === agreement.assetId)?.name}</p>
                      <p className="mt-1 text-[9px] font-medium text-[#54705d]">
                        {agreement.status === "DRAFT" && !agreement.ownerApprovedAt ? "Waiting for owner approval" : "Owner approved"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedAgreement(agreement)} className="rounded-lg border border-[#dce8de] px-3 py-2 text-[9px] font-semibold text-[#286244] hover:bg-[#f2f7f3]">View agreement</button>
                    </div>
                  </div>
                  <AgreementFacts startDate={agreement.startDate} endDate={agreement.endDate} monthlyRent={agreement.monthlyRent} advanceAmount={agreement.securityDeposit} compact />
                  <div className="grid gap-2 text-[9px] text-[#718078] sm:grid-cols-2">
                    <p>Owner approved: {formatApprovalDate(agreement.ownerApprovedAt, agreement.status)}</p>
                  </div>
                </div>
              );
            })}</div>}
          </section>
        </main>
      </div>

      {showAgreementForm && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="agreement-form-title" className="my-auto w-full max-w-[560px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-6 py-5"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">11-month rental term</p><h3 id="agreement-form-title" className="mt-1 text-[17px] font-semibold text-[#203328]">Generate rental agreement</h3></div><button type="button" aria-label="Close form" onClick={() => setShowAgreementForm(false)} className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"><X size={16} /></button></div>
            <form onSubmit={createAgreement} className="px-6 py-5">
              <label className="block text-[10px] font-semibold text-[#465a4c]">Available assigned asset<select required value={assetId} onChange={(event) => setAssetId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]"><option value="">Select asset</option>{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.unitNumber} · ₹{asset.monthlyRent.toLocaleString("en-IN")}/month</option>)}</select></label>
              {selectedAsset && <div className="mt-3 rounded-lg bg-[#f5f8f5] px-3 py-2.5 text-[10px] leading-5 text-[#617368]"><p>Monthly rent: ₹{selectedAsset.monthlyRent.toLocaleString("en-IN")}</p><p>Security deposit: ₹{selectedAsset.securityDeposit.toLocaleString("en-IN")}</p><p>Property: {selectedAsset.buildingName ?? selectedAsset.name}{selectedAsset.city ? `, ${selectedAsset.city}` : ""}</p></div>}
              <label className="mt-4 block text-[10px] font-semibold text-[#465a4c]">Agreement start date<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none focus:border-[#8cbd9b]" /></label>
              <div className="mt-3 rounded-lg border border-[#e6eee7] bg-[#f7faf7] px-3 py-2.5 text-[10px] text-[#55705f]">Agreement end date: <strong>{endDate ? formatDate(endDate) : "Select a valid start date"}</strong> · 11 months. The default upcoming-year term is January 1 through November 30; November 31 is not a valid date. One agreement is allowed for each tenant, asset, and year.</div>
              <label className="mt-4 block text-[10px] font-semibold text-[#465a4c]">Additional terms or notes (optional)<textarea rows={4} maxLength={2000} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="Any agreed conditions, maintenance notes, or additional terms..." className="mt-1.5 w-full resize-y rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 py-2.5 text-[11px] font-normal text-[#33473a] outline-none placeholder:text-[#a8b1aa] focus:border-[#8cbd9b]" /></label>
              <p className="mt-3 text-[9px] leading-4 text-[#849188]">Review and print the generated agreement before signing. Follow local registration and stamp-duty requirements.</p>
              {formError && <p role="alert" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{formError}</p>}
              <div className="mt-5 flex justify-end gap-2 border-t border-[#edf0ed] pt-4"><button type="button" onClick={() => setShowAgreementForm(false)} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e]">Cancel</button><button type="submit" disabled={saving || !availableAssets.length} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white disabled:opacity-60">{saving ? "Generating..." : "Generate agreement"} <FileCheck2 size={14} /></button></div>
            </form>
          </section>
        </div>
      )}

      {selectedAgreement && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section className="my-auto max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-5 py-4 print:hidden"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Rental agreement</p><h3 className="mt-1 text-[15px] font-semibold text-[#203328]">{selectedAgreement.agreementNumber}</h3></div><button type="button" aria-label="Close agreement" onClick={() => setSelectedAgreement(null)} className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"><X size={16} /></button></div>
            <article id="agreement-print" className="p-6 sm:p-10">
              <div className="flex items-start justify-between gap-3 border-b-2 border-[#176b4b] pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#176b4b]">Rent-Sync · Rental agreement</p><h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#17271e]">Residential tenancy agreement</h2></div><span className="rounded-lg bg-[#edf5ef] px-3 py-2 text-[10px] font-semibold text-[#467253]">{selectedAgreement.agreementNumber}</span></div>
              <p className="mt-5 text-[11px] leading-6 text-[#52645a]">This rental agreement records the tenancy details entered by the tenant and the property details registered by the owner. The parties should review the details and comply with applicable local registration, stamp duty and legal requirements before signing.</p>
              <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Tenant name" value={portal?.tenant.fullName ?? "—"} />
                <Detail label="Tenant mobile" value={`+${mobileNumber}`} />
                <Detail label="Property" value={`${agreementAsset?.name ?? "Rental asset"} · ${agreementAsset?.unitNumber ?? ""}`} />
                <Detail label="Building" value={agreementAsset?.buildingName ?? "—"} />
                <Detail label="Property address" value={[agreementAsset?.buildingAddress, agreementAsset?.city, agreementAsset?.state, agreementAsset?.postalCode].filter(Boolean).join(", ") || "—"} />
              </div>
              <div className="mt-5">
                <AgreementFacts
                  startDate={selectedAgreement.startDate}
                  endDate={selectedAgreement.endDate}
                  monthlyRent={selectedAgreement.monthlyRent}
                  advanceAmount={selectedAgreement.securityDeposit}
                />
              </div>
              <div className="mt-6 border-t border-[#e7ece7] pt-4"><h3 className="text-[11px] font-semibold text-[#294034]">Additional terms</h3><p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-[#65756b]">{selectedAgreement.terms.trim() || "No additional terms entered."}</p></div>
              <div className="mt-4 border-t border-[#e7ece7] pt-4"><h3 className="text-[11px] font-semibold text-[#294034]">Important terms</h3><p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-[#65756b]">{selectedAgreement.importantTerms?.trim() || "No important terms entered."}</p></div>
              <div className="mt-4 grid gap-2 border-t border-[#e7ece7] pt-4 text-[10px] text-[#65756b] sm:grid-cols-2">
                <p>Owner approved: {formatApprovalDate(selectedAgreement.ownerApprovedAt, selectedAgreement.status)}</p>
              </div>
              <div className="mt-12 grid grid-cols-2 gap-10 text-[10px] text-[#52645a]"><div className="border-t border-[#89968d] pt-2">Owner signature & date</div><div className="border-t border-[#89968d] pt-2">Tenant signature & date</div></div>
            </article>
            <div className="flex justify-end gap-2 border-t border-[#edf0ed] px-5 py-4 print:hidden"><button type="button" onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg bg-[#176b4b] px-3 text-[10px] font-semibold text-white"><Printer size={14} /> Print agreement</button><button type="button" onClick={() => setSelectedAgreement(null)} className="h-9 rounded-lg border border-[#e3e9e4] px-3 text-[10px] font-semibold text-[#58695e]">Close</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <article className="rounded-2xl border border-[#e7ece7] bg-white p-4 shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]"><div className="flex items-center justify-between text-[10px] text-[#78867d]"><span>{label}</span><span className="text-[#367450]">{icon}</span></div><p className="mt-3 text-[25px] font-semibold tracking-[-0.05em] text-[#192a20]">{value}</p></article>;
}

function PanelMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : undefined} className={`px-5 py-8 text-[11px] ${error ? "text-[#995634]" : "text-[#849188]"}`}>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#829087]">{label}</p><p className="mt-1 text-[11px] leading-5 text-[#31483a]">{value}</p></div>;
}
