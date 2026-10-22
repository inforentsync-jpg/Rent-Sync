"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, LoaderCircle } from "lucide-react";

type SignInMethod = "otp" | "password";

export default function OwnerLoginForm({ otpEnabled }: { otpEnabled: boolean }) {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [method, setMethod] = useState<SignInMethod>("otp");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signIn() {
    if (!/^\d{10}$/.test(mobile)) {
      setMessage("Enter your 10-digit Indian mobile number.");
      return;
    }
    if (method === "otp" && !/^\d{4}$/.test(otp)) {
      setMessage("Enter the 4-digit test OTP.");
      return;
    }
    if (method === "password" && !password) {
      setMessage("Enter your password.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: `91${mobile}`,
          method,
          ...(method === "otp" ? { otp } : { password }),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      router.replace("/owner/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete sign-in.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-10">
      <section className="w-full max-w-[460px] rounded-[28px] border border-white bg-white p-8 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)]">
        <Link href="/" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#567362] hover:text-[#176b4b]">
          <ArrowLeft size={14} /> Back to Rent-Sync
        </Link>
        <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-[#eaf3ec] text-[#176b4b]"><Building2 size={21} /></span>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Property owner</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-0.05em] text-[#17251d]">Sign in to your account.</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#79867e]">Enter your registered mobile number, then choose OTP or password sign-in.</p>

        <label htmlFor="owner-login-mobile" className="mb-2 mt-6 block text-[11px] font-semibold text-[#44574b]">Mobile number</label>
        <div className="flex h-[48px] items-center rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 focus-within:border-[#6eaa83]">
          <span className="border-r border-[#e2e9e3] pr-3 text-[13px] font-semibold text-[#314b3b]">+91</span>
          <input
            id="owner-login-mobile"
            autoComplete="tel-national"
            inputMode="numeric"
            maxLength={10}
            placeholder="Enter registered number"
            value={mobile}
            onChange={(event) => {
              setMobile(event.target.value.replace(/\D/g, ""));
              setMessage("");
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#243a2e] outline-none placeholder:text-[#abb5ad]"
          />
        </div>

        {mobile.length === 10 && (
          <>
            <p className="mb-2 mt-5 block text-[11px] font-semibold text-[#44574b]">Choose a sign-in method</p>
            <div className={`grid gap-2 ${otpEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
              {otpEnabled && (
                <button type="button" onClick={() => { setMethod("otp"); setMessage(""); }} className={`rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${method === "otp" ? "border-[#176b4b] bg-[#eef7f0] text-[#176b4b]" : "border-[#e3eae4] text-[#65766a]"}`}>
                  Dummy OTP
                </button>
              )}
              <button type="button" onClick={() => { setMethod("password"); setMessage(""); }} className={`rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${method === "password" ? "border-[#176b4b] bg-[#eef7f0] text-[#176b4b]" : "border-[#e3eae4] text-[#65766a]"}`}>
                Password
              </button>
            </div>

            {method === "otp" && otpEnabled ? (
              <>
                <label htmlFor="owner-login-otp" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Test OTP</label>
                <input
                  id="owner-login-otp"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Enter 1234"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  onKeyDown={(event) => { if (event.key === "Enter" && !busy) void signIn(); }}
                  className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-[#abb5ad] focus:border-[#6eaa83]"
                />
                <p className="mt-2 text-[10px] text-[#829087]">Development only: use dummy OTP 1234. No SMS is sent.</p>
              </>
            ) : (
              <>
                <label htmlFor="owner-login-password" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Password</label>
                <input
                  id="owner-login-password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !busy) void signIn(); }}
                  className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] outline-none placeholder:text-[#abb5ad] focus:border-[#6eaa83]"
                />
              </>
            )}

            <button type="button" disabled={busy} onClick={() => void signIn()} className="mt-5 flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60">
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {busy ? "Signing in..." : "Sign in"}
              {!busy ? <ArrowRight size={15} /> : null}
            </button>
          </>
        )}

        {message && <p role="alert" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] leading-4 text-[#995634]">{message}</p>}
        <Link href="/owner/register" className="mt-5 block text-center text-[11px] font-semibold text-[#176b4b] hover:underline">New to Rent-Sync? Create an owner account</Link>
      </section>
    </main>
  );
}
