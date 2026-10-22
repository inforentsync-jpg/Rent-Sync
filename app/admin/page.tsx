import { redirect } from "next/navigation";
import AdminAccountsDashboard from "@/components/admin-accounts-dashboard";
import { getAdminSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/");

  return <AdminAccountsDashboard mobileNumber={session.mobileNumber} />;
}
