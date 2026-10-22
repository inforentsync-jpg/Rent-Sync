"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

export default function DevOtpLogin({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [mobile, setMobile] = useState("9567048809");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signIn() {
    if (!/^\d{10}$/.test(mobile)) {
      setMessage("Enter your 10-digit super-admin mobile number.");
      return;
    }
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: `91${mobile}`, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      router.replace("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete sign-in.");
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] leading-4 text-[#995634]">
        Super-admin sign-in is not configured. Set the required deployment secrets.
      </p>
    );
  }

  return (
    <div>
      <label htmlFor="mobile" className="mb-2 block text-[11px] font-semibold text-[#44574b]">Super-admin mobile number</label>
      <div className="flex h-[50px] items-center rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-3 transition focus-within:border-[#6eaa83] focus-within:ring-4 focus-within:ring-[#176b4b]/[0.08]">
        <span className="border-r border-[#e2e9e3] pr-3 text-[13px] font-semibold text-[#314b3b]">+91</span>
        <input
          id="mobile"
          autoComplete="tel-national"
          inputMode="numeric"
          maxLength={10}
          placeholder="Enter mobile number"
          value={mobile}
          onChange={(event) => setMobile(event.target.value.replace(/\D/g, ""))}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[13px] text-[#243a2e] outline-none placeholder:text-[#abb5ad]"
        />
      </div>
      <div className="mt-4">
        <label htmlFor="password" className="mb-2 block text-[11px] font-semibold text-[#44574b]">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) void signIn();
          }}
          className="h-[50px] w-full rounded-xl border border-[#e3eae4] bg-[#fbfcfb] px-4 text-[13px] tracking-[0.2em] text-[#243a2e] outline-none transition placeholder:tracking-normal placeholder:text-[#abb5ad] focus:border-[#6eaa83] focus:ring-4 focus:ring-[#176b4b]/[0.08]"
        />
      </div>
      {message && (
        <p role="status" className="mt-3 rounded-lg bg-[#fff4ed] px-3 py-2 text-[11px] leading-4 text-[#995634]">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void signIn()}
        className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#176b4b] px-4 text-[13px] font-semibold text-white shadow-lg shadow-[#176b4b]/15 transition hover:bg-[#10583c] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : null}
        {busy ? "Signing in..." : "Sign in as admin"}
        {!busy ? <ArrowRight size={15} /> : null}
      </button>
      <p className="mt-3 text-[10px] text-[#a0aaa3]">Super-admin credentials are verified on the server.</p>
    </div>
  );
}
