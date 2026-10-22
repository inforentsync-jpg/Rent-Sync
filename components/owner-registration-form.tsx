"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, LoaderCircle } from "lucide-react";

export default function OwnerRegistrationForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function requestTestOtp() {
    if (fullName.trim().length < 2) {
      setMessage("Enter your full name.");
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      setMessage("Enter your 10-digit Indian mobile number.");
      return;
    }
    setOtpRequested(true);
    setMessage("Test OTP: 1234. No SMS is sent during local testing.");
  }

  async function register() {
    if (!/^\d{4}$/.test(otp)) {
      setMessage("Enter the 4-digit test OTP.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/owner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          mobileNumber: `91${mobile}`,
          otp,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create your account.");
      router.replace("/owner/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create your account.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-10">
      <section className="w-full max-w-[460px] rounded-[28px] border border-white bg-white p-8 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)]">
        <Link href="/" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#567362] hover:text-[#176b4b]"><ArrowLeft size={14} /> Back to Rent-Sync</Link>
        <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-[#eaf3ec] text-[#176b4b]"><Building2 size={21} /></span>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Property owner</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-0.05em] text-[#17251d]">Create your account.</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#79867e]">Register with your mobile number to access your property dashboard.</p>

        <label htmlFor="owner-name" className="mb-2 mt-6 block text-[11px] font-semibold text-[#44574b]">Full name</label>
        <input
          id="owner-name"
          autoComplete="name"
          maxLength={120}
          placeholder="Your full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 text-[13px] text-[#243a2e] outline-none placeholder:text-[#abb5ad] focus:border-[#6eaa83]"
        />

        <label htmlFor="owner-mobile" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Mobile number</label>
        <div className="flex h-[48px] items-center rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 focus-within:border-[#6eaa83]">
          <span className="border-r border-[#e2e9e3] pr-3 text-[13px] font-semibold text-[#314b3b]">+91</span>
          <input
            id="owner-mobile"
            autoComplete="tel-national"
            inputMode="numeric"
            maxLength={10}
            placeholder="Enter mobile number"
            value={mobile}
            onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#243a2e] outline-none placeholder:text-[#abb5ad]"
          />
        </div>

        {otpRequested && (
          <>
            <label htmlFor="owner-otp" className="mb-2 mt-4 block text-[11px] font-semibold text-[#44574b]">Test OTP</label>
            <input
              id="owner-otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter 1234"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !busy) void register();
              }}
              className="h-[48px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] tracking-[0.2em] text-[#243a2e] outline-none placeholder:tracking-normal placeholder:text-[#abb5ad] focus:border-[#6eaa83]"
            />
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={otpRequested ? () => void register() : requestTestOtp}
          className="mt-5 flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[13px] font-semibold text-white transition hover:bg-[#10583c] disabled:opacity-60"
        >
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
          {busy ? "Creating account..." : otpRequested ? "Verify & create account" : "Continue with mobile"}
          {!busy ? <ArrowRight size={15} /> : null}
        </button>
        {message && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[11px] leading-4 ${message.includes("Test OTP:") ? "bg-[#eef7f0] text-[#276142]" : "bg-[#fff4ed] text-[#995634]"}`}>{message}</p>}
        <p className="mt-3 text-[10px] leading-4 text-[#a0aaa3]">Local testing only: OTP 1234 is displayed here; no SMS is sent. Public registration needs a real OTP provider.</p>
        <Link href="/owner/login" className="mt-5 block text-center text-[11px] font-semibold text-[#176b4b] hover:underline">Already have an account? Sign in</Link>
      </section>
    </main>
  );
}
