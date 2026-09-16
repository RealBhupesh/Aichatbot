import { redirect } from "next/navigation";
import { isStaffSession } from "@/lib/staff-auth";

export default async function StaffIndexPage() {
  if (await isStaffSession()) {
    redirect("/staff/desk");
  }
  redirect("/staff/login");
}
