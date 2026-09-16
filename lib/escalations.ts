import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type EscalationStatus = "open" | "resolved";

export type EscalationTicket = {
  id: string;
  sessionId: string;
  reason: string;
  summary: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: EscalationStatus;
  createdAt: string;
  resolvedAt: string | null;
};

type EscalationStore = {
  tickets: EscalationTicket[];
};

const FILE = path.join(process.cwd(), "data/escalations.json");

let cache: EscalationStore | null = null;

function nowIso() {
  return new Date().toISOString();
}

export function resetEscalationsCache() {
  cache = null;
}

export function readEscalationStore(): EscalationStore {
  if (cache) {
    return cache;
  }

  if (!existsSync(FILE)) {
    cache = { tickets: [] };
    return cache;
  }

  cache = JSON.parse(readFileSync(FILE, "utf8")) as EscalationStore;
  cache.tickets ??= [];
  return cache;
}

function writeEscalationStore(store: EscalationStore) {
  cache = store;
  writeFileSync(FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export type CreateEscalationInput = {
  sessionId: string;
  reason: string;
  summary: string;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
};

export function createEscalation(input: CreateEscalationInput) {
  const ticket: EscalationTicket = {
    id: randomUUID(),
    sessionId: input.sessionId,
    reason: input.reason.trim(),
    summary: input.summary.trim(),
    guestName: input.guestName?.trim() || null,
    guestEmail: input.guestEmail?.trim() || null,
    guestPhone: input.guestPhone?.trim() || null,
    status: "open",
    createdAt: nowIso(),
    resolvedAt: null,
  };

  const store = readEscalationStore();
  store.tickets.unshift(ticket);
  writeEscalationStore(store);
  return ticket;
}

export function listEscalations(status?: EscalationStatus) {
  const tickets = readEscalationStore().tickets;
  if (!status) {
    return tickets;
  }
  return tickets.filter((ticket) => ticket.status === status);
}

export function getOpenEscalationForSession(sessionId: string) {
  return listEscalations("open").find((ticket) => ticket.sessionId === sessionId) ?? null;
}

export function resolveEscalation(ticketId: string) {
  const store = readEscalationStore();
  const ticket = store.tickets.find((entry) => entry.id === ticketId);
  if (!ticket) {
    return null;
  }

  ticket.status = "resolved";
  ticket.resolvedAt = nowIso();
  writeEscalationStore(store);
  return ticket;
}
