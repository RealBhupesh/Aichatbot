import { listConversations } from "@/lib/staff-console";
import { isStaffSession } from "@/lib/staff-auth";
import type { SessionListFilter } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS = new Set<SessionListFilter>(["all", "takeover", "escalated"]);

export async function GET(request: Request) {
  if (!(await isStaffSession())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const rawFilter = url.searchParams.get("filter") ?? "all";
  const filter = FILTERS.has(rawFilter as SessionListFilter)
    ? (rawFilter as SessionListFilter)
    : "all";

  return Response.json({
    sessions: listConversations({ filter, query }),
  });
}
