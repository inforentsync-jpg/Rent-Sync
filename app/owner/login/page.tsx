import OwnerLoginForm from "@/components/owner-login-form";
import { getOwnerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OwnerLoginPage() {
  if (await getOwnerSession()) redirect("/owner/dashboard");
  return <OwnerLoginForm otpEnabled={process.env.NODE_ENV !== "production"} />;
}
