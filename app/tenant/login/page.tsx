import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import TenantLoginForm from "@/components/tenant-login-form";
import { getTenantSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function TenantLoginPage() {
  if (await getTenantSession()) redirect("/tenant/dashboard");
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f2] px-5 py-10">
      <section className="w-full max-w-[460px] rounded-[28px] border border-white bg-white p-8 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)]">
        <Link href="/" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#567362] hover:text-[#176b4b]"><ArrowLeft size={14} /> Back to Rent-Sync</Link>
        <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-[#eaf3ec] text-[#176b4b]"><KeyRound size={21} /></span>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b8a76]">Tenant portal</p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-0.05em] text-[#17251d]">Welcome home.</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#79867e]">Sign in with the same mobile number your property owner registered.</p>
        <TenantLoginForm />
        <Link href="/#login" className="mt-5 block text-center text-[11px] font-semibold text-[#176b4b] hover:underline">Return to home</Link>
      </section>
    </main>
  );
}
