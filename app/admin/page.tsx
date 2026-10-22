import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { getAdminSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/");

  return <AdminDashboard mobileNumber={session.mobileNumber} />;
}
