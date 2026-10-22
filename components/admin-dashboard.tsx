"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Clock3,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

type BuildingRecord = {
  id: string;
  createdAt: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  ownerName: string;
  ownerMobile: string;
};

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  ownerName: "",
  ownerMobile: "",
};

const navItems = [
  { title: "Overview", icon: LayoutDashboard, active: true },
  { title: "Buildings", icon: Building2, active: false },
  { title: "Owners", icon: Users, active: false },
  { title: "Settings", icon: Settings2, active: false },
];

export default function AdminDashboard({ mobileNumber }: { mobileNumber: string }) {
  const router = useRouter();
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showOwnerPasswordForm, setShowOwnerPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [ownerPasswordError, setOwnerPasswordError] = useState("");
  const [ownerPasswordMessage, setOwnerPasswordMessage] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const loadBuildings = useCallback(async () => {
    try {
      const response = await fetch("/api/buildings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load buildings.");
      setBuildings(payload.buildings);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load buildings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBuildings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBuildings]);

  async function createBuilding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save the building.");
      setBuildings((current) => [payload.building, ...current]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to save the building.");
    } finally {
      setSaving(false);
    }
  }

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

  async function resetOwnerPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResettingPassword(true);
    setOwnerPasswordError("");
    setOwnerPasswordMessage("");
    try {
      const response = await fetch("/api/admin/owners/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: ownerMobile, password: ownerPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to reset the owner password.");
      setOwnerPassword("");
      setOwnerPasswordMessage("Owner password reset successfully.");
    } catch (cause) {
      setOwnerPasswordError(
        cause instanceof Error ? cause.message : "Unable to reset the owner password.",
      );
    } finally {
      setResettingPassword(false);
    }
  }

  const visibleBuildings = buildings.filter((building) =>
    `${building.name} ${building.ownerName} ${building.city}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#f4f6f3] text-[#16251d]">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[258px] flex-col bg-[#123d2c] text-white transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
          <a href="/admin" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#e5f0e7] text-[#176b4b]"><Building2 size={19} /></span>
            <span className="text-[18px] font-bold tracking-[-0.06em]">rent<span className="text-[#9bd0ad]">sync</span></span>
          </a>
          <button type="button" aria-label="Close menu" onClick={() => setMobileMenu(false)} className="lg:hidden"><X size={18} /></button>
        </div>
        <div className="px-5 pt-7">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Workspace</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3">
            <span className="grid size-8 place-items-center rounded-lg bg-[#d8ebe0] text-[#176b4b]"><ShieldCheck size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold">Rent-Sync Admin</span>
              <span className="mt-0.5 block text-[9px] text-white/50">Super admin</span>
            </span>
            <ChevronDown size={14} className="text-white/50" />
          </div>
        </div>
        <nav className="mt-8 flex-1 px-4">
          <p className="px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/40">Manage</p>
          <div className="mt-3 space-y-1">
            {navItems.map(({ title, icon: Icon, active }) => (
              <button key={title} type="button" onClick={() => {
                if (title === "Buildings") {
                  document.getElementById("buildings")?.scrollIntoView({ behavior: "smooth" });
                } else if (title === "Owners") {
                  setOwnerPasswordError("");
                  setOwnerPasswordMessage("");
                  setShowOwnerPasswordForm(true);
                }
              }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-medium transition ${active ? "bg-[#e9f3eb] text-[#154b34]" : "text-white/65 hover:bg-white/[0.07] hover:text-white"}`}>
                <Icon size={16} strokeWidth={1.8} /> {title}
                {title === "Buildings" && buildings.length > 0 ? <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[9px]">{buildings.length}</span> : null}
              </button>
            ))}
          </div>
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid size-8 place-items-center rounded-full bg-[#d8ebe0] text-[10px] font-bold text-[#176b4b]">SA</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold">Super administrator</span>
              <span className="mt-0.5 block truncate text-[9px] text-white/45">+{mobileNumber}</span>
            </span>
          </div>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] text-white/65 transition hover:bg-white/[0.07] hover:text-white"><LogOut size={15} /> Logout</button>
        </div>
      </aside>

      {mobileMenu ? <button type="button" aria-label="Close sidebar" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-20 bg-black/30 lg:hidden" /> : null}

      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-[#e6ebe6] bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open menu" onClick={() => setMobileMenu(true)} className="grid size-9 place-items-center rounded-lg border border-[#e4eae5] text-[#53675a] lg:hidden"><Menu size={17} /></button>
            <div>
              <p className="text-[10px] font-medium text-[#8b978f]">Workspace / <span className="text-[#496453]">Overview</span></p>
              <h1 className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-[#1b2c22]">Good day, Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-2 rounded-full bg-[#f1f6f2] px-3 py-2 text-[10px] font-medium text-[#50715b] sm:flex"><span className="size-1.5 rounded-full bg-[#33a66e]" /> All systems in sync</span>
            <button type="button" onClick={logout} className="flex h-9 items-center gap-2 rounded-lg border border-[#e4eae5] bg-white px-3 text-[11px] font-medium text-[#315b41] transition hover:bg-[#f1f6f2]"><LogOut size={15} /><span>Logout</span></button>
          </div>
        </header>

        <main className="mx-auto max-w-[1450px] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Your portfolio</p>
              <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.05em] text-[#17271e] sm:text-[30px]">A clear view of your rentals.</h2>
              <p className="mt-2 text-[12px] text-[#77847b]">Buildings, owners and agreements — all moving together.</p>
            </div>
            <button type="button" onClick={() => { setFormError(""); setShowForm(true); }} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[11px] font-semibold text-white shadow-md shadow-[#176b4b]/15 transition hover:bg-[#10583c]"><Plus size={15} /> Add a building</button>
          </div>

          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total buildings", value: buildings.length.toString().padStart(2, "0"), icon: Building2, detail: "In your portfolio", color: "bg-[#e8f2eb] text-[#27704a]" },
              { label: "Property owners", value: new Set(buildings.map((building) => building.ownerMobile)).size.toString().padStart(2, "0"), icon: Users, detail: "Across all buildings", color: "bg-[#f0ecfa] text-[#735ba6]" },
              { label: "Active tenants", value: "—", icon: Home, detail: "Tenant setup coming soon", color: "bg-[#eaf1f8] text-[#527ca5]" },
              { label: "Next renewal", value: "—", icon: Clock3, detail: "Agreement tracking coming soon", color: "bg-[#fbf0e8] text-[#b27743]" },
            ].map(({ label, value, icon: Icon, detail, color }) => (
              <article key={label} className="rounded-2xl border border-[#e7ece7] bg-white p-5 shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium text-[#78867d]">{label}</span>
                  <span className={`grid size-8 place-items-center rounded-lg ${color}`}><Icon size={16} /></span>
                </div>
                <p className="mt-4 text-[27px] font-semibold tracking-[-0.05em] text-[#192a20]">{value}</p>
                <p className="mt-1 text-[9px] text-[#94a097]">{detail}</p>
              </article>
            ))}
          </section>

          <section id="buildings" className="mt-8 scroll-mt-24 overflow-hidden rounded-2xl border border-[#e7ece7] bg-white shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)]">
            <div className="flex flex-col justify-between gap-4 border-b border-[#edf0ed] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
              <div>
                <h3 className="text-[14px] font-semibold text-[#203328]">Buildings & owners</h3>
                <p className="mt-1 text-[10px] text-[#8a968e]">The places you manage, with owner details close at hand.</p>
              </div>
              <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e6ebe6] px-3 text-[#8a968e] focus-within:border-[#9cc7a8]">
                <Search size={14} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buildings..." className="w-full min-w-0 bg-transparent text-[10px] text-[#33473a] outline-none placeholder:text-[#a6afa9] sm:w-40" />
              </label>
            </div>
            {loading ? (
              <div className="grid min-h-48 place-items-center text-[12px] text-[#8b978f]">Loading your buildings...</div>
            ) : error ? (
              <div className="m-5 rounded-xl border border-[#f1d9ce] bg-[#fff8f4] p-4 text-[11px] leading-5 text-[#995634]">{error}</div>
            ) : visibleBuildings.length === 0 ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-[#edf4ee] text-[#46805a]"><Building2 size={21} /></span>
                <h4 className="mt-4 text-[13px] font-semibold text-[#2a3e31]">{search ? "No buildings found" : "Your first building starts here"}</h4>
                <p className="mt-2 max-w-[300px] text-[10px] leading-5 text-[#849188]">{search ? "Try another name, owner or city." : "Add a property and its owner details to begin building your portfolio."}</p>
                {!search ? <button type="button" onClick={() => setShowForm(true)} className="mt-5 flex items-center gap-2 rounded-lg border border-[#dce8de] px-3 py-2 text-[10px] font-semibold text-[#286244] transition hover:bg-[#f2f7f3]"><Plus size={13} /> Add your first building</button> : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-[#f8faf8] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#86938a]">
                    <tr><th className="px-6 py-3">Building</th><th className="px-6 py-3">Location</th><th className="px-6 py-3">Owner</th><th className="px-6 py-3">Owner mobile</th><th className="px-6 py-3">Added</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f2f0]">
                    {visibleBuildings.map((building) => (
                      <tr key={building.id} className="text-[11px] text-[#4e6054]">
                        <td className="px-6 py-4"><span className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#edf4ef] text-[#37734d]"><Building2 size={15} /></span><span className="font-semibold text-[#294034]">{building.name}</span></span></td>
                        <td className="px-6 py-4">{building.city}, {building.state}</td>
                        <td className="px-6 py-4 font-medium text-[#3d5245]">{building.ownerName}</td>
                        <td className="px-6 py-4">+{building.ownerMobile}</td>
                        <td className="px-6 py-4">{new Date(building.createdAt).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="building-form-title" className="my-auto w-full max-w-[600px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-6 py-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Portfolio setup</p>
                <h3 id="building-form-title" className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-[#203328]">Add a building</h3>
              </div>
              <button type="button" aria-label="Close form" onClick={() => setShowForm(false)} className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"><X size={16} /></button>
            </div>
            <form onSubmit={createBuilding} className="px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Building name" name="name" value={form.name} setForm={setForm} placeholder="e.g. Greenview Residency" />
                <Field label="Property owner" name="ownerName" value={form.ownerName} setForm={setForm} placeholder="Owner's full name" />
                <Field label="Owner mobile number" name="ownerMobile" value={form.ownerMobile} setForm={setForm} placeholder="91XXXXXXXXXX" />
                <Field label="Street address" name="address" value={form.address} setForm={setForm} placeholder="Door no. and street" />
                <Field label="City" name="city" value={form.city} setForm={setForm} placeholder="City" />
                <Field label="State" name="state" value={form.state} setForm={setForm} placeholder="State" />
                <Field label="PIN code" name="postalCode" value={form.postalCode} setForm={setForm} placeholder="6-digit PIN code" />
              </div>
              {formError ? <p role="alert" className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{formError}</p> : null}
              <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0ed] pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e] hover:bg-[#f7f9f7]">Cancel</button>
                <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60">{saving ? "Saving..." : "Save building"} <Plus size={13} /></button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {showOwnerPasswordForm ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="owner-password-title" className="my-auto w-full max-w-[460px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf0ed] px-6 py-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">Owner account support</p>
                <h3 id="owner-password-title" className="mt-1 text-[17px] font-semibold tracking-[-0.03em] text-[#203328]">Reset owner password</h3>
              </div>
              <button type="button" aria-label="Close password reset" onClick={() => setShowOwnerPasswordForm(false)} className="grid size-8 place-items-center rounded-lg text-[#809087] hover:bg-[#f1f5f1]"><X size={16} /></button>
            </div>
            <form onSubmit={resetOwnerPassword} className="px-6 py-5">
              <label className="block text-[10px] font-semibold text-[#465a4c]">
                Owner mobile number
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                  value={ownerMobile}
                  onChange={(event) => setOwnerMobile(event.target.value.replace(/\D/g, ""))}
                  placeholder="Country code and mobile number"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none placeholder:text-[#a8b1aa] focus:border-[#8cbd9b] focus:ring-2 focus:ring-[#176b4b]/10"
                />
              </label>
              <label className="mt-4 block text-[10px] font-semibold text-[#465a4c]">
                New password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none placeholder:text-[#a8b1aa] focus:border-[#8cbd9b] focus:ring-2 focus:ring-[#176b4b]/10"
                />
              </label>
              {ownerPasswordError ? <p role="alert" className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{ownerPasswordError}</p> : null}
              {ownerPasswordMessage ? <p role="status" className="mt-4 rounded-lg bg-[#eef7f0] px-3 py-2 text-[11px] text-[#276142]">{ownerPasswordMessage}</p> : null}
              <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0ed] pt-4">
                <button type="button" onClick={() => setShowOwnerPasswordForm(false)} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e] hover:bg-[#f7f9f7]">Close</button>
                <button type="submit" disabled={resettingPassword} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60">{resettingPassword ? "Resetting..." : "Reset password"} <KeyRound size={13} /></button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  value,
  setForm,
  placeholder,
}: {
  label: string;
  name: keyof typeof emptyForm;
  value: string;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  placeholder: string;
}) {
  return (
    <label className="block text-[10px] font-semibold text-[#465a4c]">
      {label}
      <input
        required
        name={name}
        value={value}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
        placeholder={placeholder}
        className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[11px] font-normal text-[#33473a] outline-none transition placeholder:text-[#a8b1aa] focus:border-[#8cbd9b] focus:ring-2 focus:ring-[#176b4b]/10"
      />
    </label>
  );
}
