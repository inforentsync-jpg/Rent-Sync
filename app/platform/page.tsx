import { redirect } from "next/navigation";
import DevOtpLogin from "@/components/dev-otp-login";
import { getAdminSession } from "@/lib/session";

export default async function PlatformPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");
  const defaultMobile = (process.env.SUPER_ADMIN_MOBILE_NUMBER ?? "919567048809")
    .replace(/\D/g, "")
    .replace(/^91(?=\d{10}$)/, "");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f2] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-[0_25px_80px_-24px_rgba(21,57,39,0.19)] sm:p-9">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b8a76]">
          Restricted access
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#17251d]">
          Platform administrator
        </h1>
        <p className="mb-6 mt-2 text-sm leading-6 text-[#79867e]">
          Sign in with the super-admin mobile number and password configured for this deployment.
        </p>
        <DevOtpLogin
          enabled={Boolean(process.env.SUPER_ADMIN_PASSWORD)}
          defaultMobile={defaultMobile}
        />
      </section>
    </main>
  );
}
