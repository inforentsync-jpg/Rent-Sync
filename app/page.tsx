import Link from "next/link";
import { Building2, KeyRound } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f2] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#176b4b] text-white">
            <Building2 size={21} />
          </span>
          <span className="text-xl font-bold tracking-[-0.06em]">
            rent<span className="text-[#176b4b]">sync</span>
          </span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b8a76]">
          Welcome to Rent-Sync
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#17251d]">
          Choose your sign-in
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#79867e]">
          Select the account type you use to manage or access a rental.
        </p>

        <div className="mt-7 grid gap-3">
          <div className="rounded-2xl border border-[#e8eee9] p-4">
            <span className="mb-3 grid size-9 place-items-center rounded-xl bg-[#f0f5f1] text-[#367450]">
              <Building2 size={17} />
            </span>
            <h2 className="text-sm font-semibold text-[#294335]">Owner</h2>
            <div className="mt-3 flex gap-4 text-xs">
              <Link href="/owner/login" className="font-semibold text-[#176b4b] hover:underline">
                Sign in
              </Link>
              <Link href="/owner/register" className="text-[#69776f] hover:text-[#176b4b]">
                Create an account
              </Link>
            </div>
          </div>
          <Link
            href="/tenant/login"
            className="group rounded-2xl border border-[#e8eee9] p-4 transition hover:border-[#b9d6c3] hover:bg-[#f8fbf8]"
          >
            <span className="mb-3 grid size-9 place-items-center rounded-xl bg-[#f0f5f1] text-[#367450]">
              <KeyRound size={17} />
            </span>
            <span className="block text-sm font-semibold text-[#294335]">Tenant</span>
            <span className="mt-1 block text-xs text-[#849188] group-hover:text-[#176b4b]">
              Sign in to your rental
            </span>
          </Link>
        </div>

      </section>
    </main>
  );
}
