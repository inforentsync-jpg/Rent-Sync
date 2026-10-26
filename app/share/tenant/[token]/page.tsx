import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicTenantPage from "@/components/public-tenant-page";
import { getPublicTenantData } from "@/lib/public-tenant";
import { shouldUseDatabase } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared tenant overview | Rent-Sync",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function TenantSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!shouldUseDatabase()) notFound();
  const { token } = await params;
  let data;
  try {
    data = await getPublicTenantData(token);
  } catch (error) {
    console.error("Unable to render a public tenant page.", error);
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f4] px-5 text-center">
        <section className="max-w-md rounded-2xl border border-[#e5ece6] bg-white p-7">
          <h1 className="text-[18px] font-semibold text-[#203328]">Tenant page temporarily unavailable</h1>
          <p className="mt-2 text-[12px] leading-5 text-[#718078]">The shared page could not be loaded right now. Please contact the property owner to confirm the link is active.</p>
        </section>
      </main>
    );
  }
  if (!data) notFound();
  return <PublicTenantPage data={data} token={token} />;
}
