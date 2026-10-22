import { redirect } from "next/navigation";
import OwnerProfile from "@/components/owner-profile";
import { getOwnerSession } from "@/lib/session";

export default async function OwnerProfilePage() {
  if (!(await getOwnerSession())) redirect("/owner/register");
  return <OwnerProfile />;
}
