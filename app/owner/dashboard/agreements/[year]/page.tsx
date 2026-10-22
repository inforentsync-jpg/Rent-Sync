import OwnerDashboard from "@/components/owner-dashboard";
import { getOwnerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OwnerAgreementYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  if (!(await getOwnerSession())) redirect("/owner/register");

  const { year } = await params;
  if (!/^\d{4}$/.test(year)) redirect("/owner/dashboard?module=agreements");

  return <OwnerDashboard />;
}
