"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

export default function TenantLoginForm({ otpEnabled }: { otpEnabled: boolean }) {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [method, setMethod] = useState<"otp" | "password">("password");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function login() {
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
      const response = await fetch("/api/tenant/login", {
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
      router.replace("/tenant/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete sign-in.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <label htmlFor="tenant-mobile" className="mb-2 block text-[11px] font-semibold text-[#44574b]">Registered mobile number</label>
      <div className="flex h-[48px] items-center rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 focus-within:border-[#6eaa83]">
        <span className="border-r border-[#e2e9e3] pr-3 text-[13px] font-semibold text-[#314b3b]">+91</span>
        <input id="tenant-mobile" autoComplete="tel-national" inputMode="numeric" maxLength={10} placeholder="Enter mobile number" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#243a2e] outline-none placeholder:text-[#abb5ad]" />
      </div>
      {mobile.length === 10 && (
        <>
          <p className="mb-2 mt-5 block text-[11px] font-semibold text-[#44574b]">Choose a sign-in method</p>
          <div className={`grid gap-2 ${otpEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
            <button type="button" onClick={() => { setMethod("password"); setMessage(""); }} className={`rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${method === "password" ? "border-[#176b4b] bg-[#eef7f0] text-[#176b4b]" : "border-[#e3eae4] text-[#65766a]"}`}>Password</button>
            {otpEnabled ? (
              <button type="button" onClick={() => { setMethod("otp"); setMessage(""); }} className={`rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${method === "otp" ? "border-[#176b4b] bg-[#eef7f0] text-[#176b4b]" : "border-[#e3eae4] text-[#65766a]"}`}>Test OTP</button>
            ) : null}
          </div>
          {method === "password" ? (
            <>
              <label htmlFor="tenant-password" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Password</label>
              <input id="tenant-password" type="password" autoComplete="current-password" maxLength={128} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !busy) void login(); }} className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] outline-none placeholder:text-[#abb5ad] focus:border-[#6eaa83]" />
            </>
          ) : (
            <>
              <label htmlFor="tenant-otp" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Test OTP</label>
              <input id="tenant-otp" autoComplete="one-time-code" inputMode="numeric" maxLength={4} placeholder="Enter 1234" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => { if (event.key === "Enter" && !busy) void login(); }} className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] tracking-[0.2em] outline-none placeholder:tracking-normal placeholder:text-[#abb5ad] focus:border-[#6eaa83]" />
              <p className="mt-2 text-[10px] text-[#829087]">Development only: use dummy OTP 1234. No SMS is sent.</p>
            </>
          )}
        </>
      )}
      <button type="button" disabled={busy || mobile.length !== 10} onClick={() => void login()} className="mt-5 flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60">
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
        {busy ? "Signing in..." : "Sign in"}
        {!busy ? <ArrowRight size={15} /> : null}
      </button>
      {message && <p role="alert" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] leading-4 text-[#995634]">{message}</p>}
      <p className="mt-3 text-[10px] leading-4 text-[#a0aaa3]">Ask your property owner to register your mobile number. Contact your super admin if you need a password reset.</p>
    </div>
  );
}
