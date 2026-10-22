"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Save, UserRound } from "lucide-react";

type OwnerProfileData = {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  createdAt: string;
};

export default function OwnerProfile() {
  const [profile, setProfile] = useState<OwnerProfileData | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const response = await fetch("/api/owner/profile", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load your profile.");
        if (cancelled) return;
        setProfile(payload.profile);
        setFullName(payload.profile.fullName);
        setEmail(payload.profile.email ?? "");
        setTestOtp(payload.testOtp);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load your profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/owner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save your profile.");
      setProfile(payload.profile);
      setFullName(payload.profile.fullName);
      setEmail(payload.profile.email ?? "");
      setMessage("Profile saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f3] px-5 py-8 text-[#16251d] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/owner/dashboard"
          className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#567362] hover:text-[#176b4b]"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <header className="mt-8 flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#e5f0e7] text-[#176b4b]">
            <UserRound size={24} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Owner account</p>
            <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.05em]">Profile</h1>
          </div>
        </header>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 rounded-2xl bg-white p-6 text-[13px] text-[#65766a]">
            <LoaderCircle size={16} className="animate-spin" /> Loading profile...
          </div>
        ) : error && !profile ? (
          <p role="alert" className="mt-8 rounded-xl bg-[#fff4ed] px-4 py-3 text-[13px] text-[#995634]">{error}</p>
        ) : profile ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <form onSubmit={(event) => void saveProfile(event)} className="rounded-2xl border border-[#e7ece7] bg-white p-6 shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)] sm:p-8">
              <h2 className="text-[16px] font-semibold">Profile details</h2>
              <label htmlFor="owner-profile-name" className="mb-2 mt-6 block text-[11px] font-semibold text-[#44574b]">Profile name</label>
              <input
                id="owner-profile-name"
                autoComplete="name"
                maxLength={120}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 text-[13px] outline-none focus:border-[#6eaa83]"
              />
              <label htmlFor="owner-profile-mobile" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Mobile number</label>
              <input
                id="owner-profile-mobile"
                value={`+${profile.mobileNumber}`}
                readOnly
                className="h-11 w-full rounded-xl border border-[#e3eae4] bg-[#f3f6f3] px-3 text-[13px] text-[#718078] outline-none"
              />
              <label htmlFor="owner-profile-email" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Email ID</label>
              <input
                id="owner-profile-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 text-[13px] outline-none placeholder:text-[#abb5ad] focus:border-[#6eaa83]"
              />
              <button
                type="submit"
                disabled={saving}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[12px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60"
              >
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? "Saving..." : "Save profile"}
              </button>
              {error && <p role="alert" className="mt-3 text-[12px] text-[#995634]">{error}</p>}
              {message && <p role="status" className="mt-3 text-[12px] text-[#276142]">{message}</p>}
            </form>

            <section className="rounded-2xl border border-[#e7ece7] bg-white p-6 shadow-[0_4px_20px_-12px_rgba(28,53,37,0.12)] sm:p-8">
              <h2 className="text-[16px] font-semibold">Account information</h2>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#829087]">Created date</dt>
                  <dd className="mt-1 text-[13px] text-[#314b3b]">{new Date(profile.createdAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#829087]">Password</dt>
                  <dd className="mt-1 text-[13px] text-[#314b3b]">Not configured. Owner sign-in uses OTP.</dd>
                </div>
                {testOtp && (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#829087]">Dummy OTP</dt>
                    <dd className="mt-1 text-[13px] font-semibold tracking-[0.15em] text-[#176b4b]">{testOtp} <span className="ml-1 text-[10px] font-normal tracking-normal text-[#829087]">development only</span></dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
