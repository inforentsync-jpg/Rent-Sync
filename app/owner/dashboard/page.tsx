import { redirect } from "next/navigation";
import OwnerDashboard from "@/components/owner-dashboard";
import { getOwnerSession } from "@/lib/session";

export default async function OwnerDashboardPage() {
  const session = await getOwnerSession();
  if (!session) redirect("/owner/register");

  return <OwnerDashboard />;
}
