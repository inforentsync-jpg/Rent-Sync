import { redirect } from "next/navigation";
import TenantDashboard from "@/components/tenant-dashboard";
import { getTenantSession } from "@/lib/session";

export default async function TenantDashboardPage() {
  const session = await getTenantSession();
  if (!session) redirect("/tenant/login");
  return <TenantDashboard mobileNumber={session.mobileNumber} />;
}
