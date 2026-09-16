import { redirect } from "next/navigation";
import { StaffDashboard } from "@/components/staff/StaffDashboard";
import { listHolds, listPendingStaffBookings } from "@/lib/bookings";
import { listEscalations } from "@/lib/escalations";
import { getOperationalRooms, readOperations } from "@/lib/operations";
import { listSessions } from "@/lib/sessions";
import { isStaffSession } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StaffDeskPage() {
  if (!(await isStaffSession())) {
    redirect("/staff/login");
  }

  return (
    <StaffDashboard
      initialOperations={readOperations()}
      initialRooms={getOperationalRooms()}
      initialEscalations={listEscalations("open")}
      initialSessions={listSessions()}
      initialHolds={listHolds()}
      initialPendingBookings={listPendingStaffBookings()}
    />
  );
}
