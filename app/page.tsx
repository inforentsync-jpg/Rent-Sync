import Link from "next/link";
import { ArrowDownRight, ArrowRight, Building2, Check, Home, KeyRound, ShieldCheck } from "lucide-react";
import DevOtpLogin from "@/components/dev-otp-login";

const highlights = [
  "Every property, owner and agreement in one place",
  "11-month agreements with clear renewal dates",
  "A calmer way to keep rent on track",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f5f2]">
      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-3" aria-label="Rent-Sync home">
          <span className="grid size-10 place-items-center rounded-xl bg-[#176b4b] text-white shadow-lg shadow-emerald-950/15">
            <Building2 size={20} strokeWidth={2.2} />
          </span>
          <span className="text-[19px] font-bold tracking-[-0.06em]">rent<span className="text-[#176b4b]">sync</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#69776f] md:flex">
          <a href="#how-it-works" className="transition hover:text-[#176b4b]">How it works</a>
          <a href="#portals" className="transition hover:text-[#176b4b]">Portals</a>
          <a href="#login" className="rounded-full border border-[#dce5de] bg-white px-5 py-2.5 font-semibold text-[#173c2c] shadow-sm transition hover:border-[#176b4b]">Sign in</a>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:grid-cols-[1fr_0.88fr] lg:gap-16 lg:px-16 lg:pb-28 lg:pt-12">
        <div className="pointer-events-none absolute -left-48 top-10 size-[500px] rounded-full bg-[#dcebe1]/55 blur-[100px]" />
        <div className="relative z-10 max-w-[650px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce7df] bg-white/80 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#38614d] shadow-sm">
            <span className="size-1.5 rounded-full bg-[#36a06e]" />
            Property management, in sync
          </div>
          <h1 className="max-w-[650px] text-[48px] font-semibold leading-[1.05] tracking-[-0.065em] text-[#14221c] sm:text-[65px] lg:text-[76px]">
            Good rentals start with <span className="font-serif font-medium italic text-[#176b4b]">good rhythm.</span>
          </h1>
          <p className="mt-7 max-w-[490px] text-[16px] leading-7 text-[#6b7871] sm:text-[17px]">
            One thoughtful place to manage your buildings, owners and rental agreements. Less chasing, more peace of mind.
          </p>
          <ul className="mt-8 space-y-3.5">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[13px] font-medium text-[#44564c]">
                <span className="grid size-5 place-items-center rounded-full bg-[#dfede4] text-[#176b4b]"><Check size={12} strokeWidth={3} /></span>
                {item}
              </li>
            ))}
          </ul>
          <a href="#how-it-works" className="mt-9 inline-flex items-center gap-2 text-[13px] font-semibold text-[#176b4b] transition hover:gap-3">
            Explore Rent-Sync <ArrowDownRight size={15} />
          </a>
        </div>

        <div id="login" className="relative z-10 mx-auto w-full max-w-[500px] scroll-mt-6">
          <div className="absolute -right-5 -top-5 z-10 hidden rounded-2xl border border-[#e8eee9] bg-white px-4 py-3 shadow-xl shadow-[#143b2917] sm:block">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-[#51705e]"><ShieldCheck size={15} className="text-[#32825b]" /> Super-admin access</div>
          </div>
          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)] sm:p-8">
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b8a76]">Welcome back</p>
              <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.05em] text-[#17251d]">Sign in to your space</h2>
              <p className="mt-2 text-[13px] leading-5 text-[#79867e]">Sign in with your configured super-admin mobile number and password.</p>
            </div>
            <DevOtpLogin enabled={Boolean(process.env.SUPER_ADMIN_PASSWORD)} />
            <div className="my-6 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[#9aa59e]">
              <span className="h-px flex-1 bg-[#edf0ed]" /> More ways to get started <span className="h-px flex-1 bg-[#edf0ed]" />
            </div>
            <div id="portals" className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#e8eee9] p-4 transition hover:border-[#b9d6c3] hover:bg-[#f8fbf8]">
                <span className="mb-3 grid size-9 place-items-center rounded-xl bg-[#f0f5f1] text-[#367450]"><Home size={17} /></span>
                <span className="block text-[12px] font-semibold text-[#294335]">I&apos;m an owner</span>
                <Link href="/owner/register" className="mt-1 flex items-center gap-1 text-[10px] text-[#849188] hover:text-[#176b4b]">Create account <ArrowRight size={11} /></Link>
                <Link href="/owner/login" className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#367450] hover:text-[#176b4b]">Sign in <ArrowRight size={11} /></Link>
              </div>
              <Link href="/tenant/login" className="group rounded-2xl border border-[#e8eee9] p-4 transition hover:border-[#b9d6c3] hover:bg-[#f8fbf8]">
                <span className="mb-3 grid size-9 place-items-center rounded-xl bg-[#f0f5f1] text-[#367450]"><KeyRound size={17} /></span>
                <span className="block text-[12px] font-semibold text-[#294335]">I&apos;m a tenant</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-[#849188]">Tenant sign in <ArrowRight size={11} className="transition group-hover:translate-x-0.5" /></span>
              </Link>
            </div>
            <p className="mt-5 text-center text-[10px] leading-4 text-[#a0aaa3]">By continuing, you agree to the Rent-Sync terms and privacy policy.</p>
          </div>
          <p className="mt-5 text-center text-[11px] text-[#89958d]">Admin access is for the super administrator only.</p>
        </div>
      </section>

      <section id="how-it-works" className="relative bg-[#123d2c] px-6 py-16 text-white sm:px-10 sm:py-20 lg:px-16">
        <div className="grid-pattern absolute inset-0 opacity-50" />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8d3b7]">A better way to manage rent</p>
            <h2 className="mt-4 max-w-[450px] text-[36px] font-semibold leading-tight tracking-[-0.055em] sm:text-[44px]">The details, taken care of.</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              ["01", "Add your buildings", "Bring each property and its owner details together."],
              ["02", "Keep agreements clear", "Track the 11-month rental term and important dates."],
              ["03", "Stay in sync", "Give owners and tenants a simpler way to stay connected."],
            ].map(([number, title, description]) => (
              <article key={number} className="border-t border-white/20 pt-4">
                <span className="text-[11px] font-semibold text-[#a8d3b7]">{number}</span>
                <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                <p className="mt-2 text-[12px] leading-5 text-white/65">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 py-6 text-[11px] text-[#849188] sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
        <span>© 2026 Rent-Sync. Rentals, in rhythm.</span>
        <span>Made for the people who make a home.</span>
      </footer>
    </main>
  );
}
