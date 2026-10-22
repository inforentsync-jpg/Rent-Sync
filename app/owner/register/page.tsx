import OwnerRegistrationForm from "@/components/owner-registration-form";
import { getOwnerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function OwnerRegisterPage() {
  if (await getOwnerSession()) redirect("/owner/dashboard");
  return <OwnerRegistrationForm />;
}
