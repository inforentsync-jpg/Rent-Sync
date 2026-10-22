"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, LoaderCircle, LogOut, Users } from "lucide-react";

type Account = {
  id: string;
  fullName: string;
  mobileNumber: string;
  createdAt: string;
};

type Accounts = {
  owners: Account[];
  tenants: Account[];
};

type AccountType = "OWNER" | "TENANT";

export default function AdminAccountsDashboard({ mobileNumber }: { mobileNumber: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Accounts>({ owners: [], tenants: [] });
  const [activeModule, setActiveModule] = useState<AccountType>("OWNER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/accounts/password", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load accounts.");
      setAccounts(payload);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to log out. Please try again.");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to log out.");
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);
    setFormError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/admin/accounts/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: activeModule,
          mobileNumber: selectedAccount.mobileNumber,
          password: newPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to reset the password.");
      setNewPassword("");
      setSuccessMessage(`${activeModule === "OWNER" ? "Owner" : "Tenant"} password reset successfully.`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  const visibleAccounts = activeModule === "OWNER" ? accounts.owners : accounts.tenants;
  const moduleName = activeModule === "OWNER" ? "Owners" : "Tenants";

  return (
    <main className="min-h-screen bg-[#f4f6f3] text-[#16251d]">
      <header className="flex h-[70px] items-center justify-between border-b border-[#e6ebe6] bg-white px-5 sm:px-8">
        <a href="/admin" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#e5f0e7] text-[#176b4b]"><Building2 size={19} /></span>
          <span className="text-[18px] font-bold tracking-[-0.06em]">rent<span className="text-[#176b4b]">sync</span></span>
        </a>
        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] text-[#65766a] sm:block">Super admin · +{mobileNumber}</span>
          <button type="button" onClick={() => void logout()} className="flex h-9 items-center gap-2 rounded-lg border border-[#e4eae5] bg-white px-3 text-[11px] font-medium text-[#315b41] hover:bg-[#f1f6f2]">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-[220px_1fr]">
        <nav aria-label="Account modules" className="flex gap-2 md:flex-col">
          {([
            ["OWNER", "Owners", Users],
            ["TENANT", "Tenants", Building2],
          ] as const).map(([type, label, Icon]) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveModule(type)}
              aria-current={activeModule === type ? "page" : undefined}
              className={`flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-[12px] font-semibold md:flex-none ${activeModule === type ? "bg-[#176b4b] text-white" : "border border-[#e4eae5] bg-white text-[#506457] hover:bg-[#f8fbf8]"}`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        <section className="overflow-hidden rounded-2xl border border-[#e7ece7] bg-white">
          <div className="border-b border-[#edf0ed] px-5 py-5 sm:px-6">
            <h1 className="text-[20px] font-semibold text-[#203328]">{moduleName}</h1>
            <p className="mt-1 text-[11px] text-[#819087]">Manage {moduleName.toLowerCase()} and reset account passwords.</p>
          </div>
          {error ? <p role="alert" className="m-5 rounded-lg bg-[#fff4ed] px-4 py-3 text-[11px] text-[#995634]">{error}</p> : null}
          {loading ? (
            <div className="grid min-h-48 place-items-center text-[12px] text-[#8b978f]">Loading {moduleName.toLowerCase()}...</div>
          ) : !error && visibleAccounts.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-[12px] text-[#8b978f]">No {moduleName.toLowerCase()} registered yet.</div>
          ) : !error ? (
            <div className="divide-y divide-[#f0f2f0]">
              {visibleAccounts.map((account) => (
                <article key={account.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="text-[12px] font-semibold text-[#294034]">{account.fullName}</h2>
                    <p className="mt-1 text-[10px] text-[#79867e]">+{account.mobileNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount(account);
                      setNewPassword("");
                      setFormError("");
                      setSuccessMessage("");
                    }}
                    className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#dce8de] px-3 text-[10px] font-semibold text-[#286244] hover:bg-[#f2f7f3]"
                  >
                    <KeyRound size={14} /> Reset password
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {selectedAccount ? (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#10281c]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="my-auto w-full max-w-[420px] rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-[#edf0ed] px-6 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b8a76]">{activeModule === "OWNER" ? "Owner" : "Tenant"} account</p>
              <h2 id="reset-password-title" className="mt-1 text-[17px] font-semibold text-[#203328]">Reset password</h2>
              <p className="mt-1 text-[11px] text-[#79867e]">{selectedAccount.fullName} · +{selectedAccount.mobileNumber}</p>
            </div>
            <form onSubmit={resetPassword} className="px-6 py-5">
              <label htmlFor="admin-new-password" className="block text-[10px] font-semibold text-[#465a4c]">
                New password
              </label>
              <input
                id="admin-new-password"
                required
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#e4eae5] bg-[#fcfdfc] px-3 text-[12px] text-[#33473a] outline-none placeholder:text-[#a8b1aa] focus:border-[#8cbd9b]"
              />
              {formError ? <p role="alert" className="mt-4 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] text-[#995634]">{formError}</p> : null}
              {successMessage ? <p role="status" className="mt-4 rounded-lg bg-[#eef7f0] px-3 py-2 text-[11px] text-[#276142]">{successMessage}</p> : null}
              <div className="mt-6 flex justify-end gap-2 border-t border-[#edf0ed] pt-4">
                <button type="button" onClick={() => setSelectedAccount(null)} className="h-10 rounded-lg border border-[#e3e9e4] px-4 text-[11px] font-semibold text-[#58695e] hover:bg-[#f7f9f7]">Close</button>
                <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-lg bg-[#176b4b] px-4 text-[11px] font-semibold text-white hover:bg-[#10583c] disabled:opacity-60">
                  {saving ? <LoaderCircle size={14} className="animate-spin" /> : <KeyRound size={13} />}
                  {saving ? "Resetting..." : "Reset password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
