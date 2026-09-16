import { randomUUID } from "node:crypto";
import { readJsonFile, resolveDataFile, writeJsonFile } from "@/lib/data-files";
import type { PendingChange, PendingHold } from "@/lib/bookings";
import { listEscalations } from "@/lib/escalations";

export type SessionMessageRole = "user" | "assistant" | "staff";

export type SessionMessage = {
  role: SessionMessageRole;
  content: string;
  at: string;
  authorName?: string;
};

export type SessionStay = {
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  maxBudget: number | null;
  selectedRoomId: string | null;
};

export type SessionGuest = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type SessionMode = "ai" | "staff";

export type GuestSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  stay: SessionStay;
  guest: SessionGuest;
  pendingHold: PendingHold | null;
  pendingChange: PendingChange | null;
  lastConfirmationCode: string | null;
  mode: SessionMode;
  assignedTo: string | null;
  takenOverAt: string | null;
  lastGuestMessageAt: string | null;
  staffLastReadAt: string | null;
};

export type SessionListFilter = "all" | "takeover" | "escalated";

export type SessionSummary = {
  id: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageRole: SessionMessageRole | null;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
  mode: SessionMode;
  assignedTo: string | null;
  hasOpenEscalation: boolean;
  unread: boolean;
  stay: SessionStay;
};

type SessionStore = {
  sessions: Record<string, GuestSession>;
};

const FILE = resolveDataFile("sessions.json");
const MAX_MESSAGES = 500;
const LLM_HISTORY_LIMIT = 12;

let cache: SessionStore | null = null;

function nowIso() {
  return new Date().toISOString();
}

function emptyStay(): SessionStay {
  return {
    checkIn: null,
    checkOut: null,
    guests: null,
    maxBudget: null,
    selectedRoomId: null,
  };
}

function emptyGuest(): SessionGuest {
  return {
    name: null,
    email: null,
    phone: null,
  };
}

function emptySession(id: string): GuestSession {
  const stamp = nowIso();
  return {
    id,
    createdAt: stamp,
    updatedAt: stamp,
    messages: [],
    stay: emptyStay(),
    guest: emptyGuest(),
    pendingHold: null,
    pendingChange: null,
    lastConfirmationCode: null,
    mode: "ai",
    assignedTo: null,
    takenOverAt: null,
    lastGuestMessageAt: null,
    staffLastReadAt: null,
  };
}

function normalizeSession(session: Partial<GuestSession> & { id: string }): GuestSession {
  const fallback = emptySession(session.id);
  return {
    ...fallback,
    ...session,
    stay: { ...fallback.stay, ...session.stay },
    guest: { ...fallback.guest, ...session.guest },
    messages: Array.isArray(session.messages) ? session.messages : [],
    mode: session.mode === "staff" ? "staff" : "ai",
    assignedTo: session.assignedTo ?? null,
    takenOverAt: session.takenOverAt ?? null,
    lastGuestMessageAt: session.lastGuestMessageAt ?? null,
    staffLastReadAt: session.staffLastReadAt ?? null,
    pendingHold: session.pendingHold ?? null,
    pendingChange: session.pendingChange ?? null,
    lastConfirmationCode: session.lastConfirmationCode ?? null,
  };
}

function previewMessage(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 140) {
    return trimmed;
  }
  return `${trimmed.slice(0, 137)}…`;
}

export function resetSessionsCache() {
  cache = null;
}

export function readSessionStore(): SessionStore {
  if (cache) {
    return cache;
  }

  cache = readJsonFile(FILE, { sessions: {} } as SessionStore);
  cache.sessions ??= {};
  for (const [id, session] of Object.entries(cache.sessions)) {
    cache.sessions[id] = normalizeSession({ ...session, id: session?.id ?? id });
  }
  return cache;
}

function writeSessionStore(store: SessionStore) {
  cache = store;
  writeJsonFile(FILE, store);
}

export function readSession(sessionId: string) {
  const session = readSessionStore().sessions[sessionId];
  return session ? normalizeSession(session) : null;
}

export function createSession() {
  const session = emptySession(randomUUID());
  const store = readSessionStore();
  store.sessions[session.id] = session;
  writeSessionStore(store);
  return session;
}

export function getOrCreateSession(sessionId?: string | null) {
  if (sessionId) {
    const existing = readSession(sessionId);
    if (existing) {
      return existing;
    }
  }
  return createSession();
}

export function updateSession(sessionId: string, patch: Partial<GuestSession>) {
  const store = readSessionStore();
  const current = store.sessions[sessionId];
  if (!current) {
    return null;
  }

  const next = normalizeSession({
    ...current,
    ...patch,
    stay: patch.stay ? { ...current.stay, ...patch.stay } : current.stay,
    guest: patch.guest ? { ...current.guest, ...patch.guest } : current.guest,
    updatedAt: nowIso(),
  });
  store.sessions[sessionId] = next;
  writeSessionStore(store);
  return next;
}

export function appendSessionMessages(
  sessionId: string,
  entries: Array<{ role: SessionMessageRole; content: string; authorName?: string }>,
) {
  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  const stamp = nowIso();
  const appended = entries.map((entry) => ({
    role: entry.role,
    content: entry.content,
    at: stamp,
    ...(entry.authorName ? { authorName: entry.authorName } : {}),
  }));
  const messages = [...session.messages, ...appended].slice(-MAX_MESSAGES);
  const lastGuest = [...appended].reverse().find((entry) => entry.role === "user");

  return updateSession(sessionId, {
    messages,
    lastGuestMessageAt: lastGuest?.at ?? session.lastGuestMessageAt,
  });
}

export function appendStaffMessage(sessionId: string, content: string, authorName = "Front desk") {
  const trimmed = content.trim();
  if (!trimmed) {
    return readSession(sessionId);
  }

  const session = readSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.mode !== "staff") {
    setSessionMode(sessionId, "staff", authorName);
  }

  return appendSessionMessages(sessionId, [
    { role: "staff", content: trimmed, authorName: authorName.trim() || "Front desk" },
  ]);
}

export function setSessionMode(sessionId: string, mode: SessionMode, assignedTo?: string | null) {
  if (mode === "staff") {
    return updateSession(sessionId, {
      mode: "staff",
      assignedTo: assignedTo?.trim() || "Front desk",
      takenOverAt: nowIso(),
    });
  }

  return updateSession(sessionId, {
    mode: "ai",
    assignedTo: null,
    takenOverAt: null,
  });
}

export function markSessionRead(sessionId: string) {
  const store = readSessionStore();
  const current = store.sessions[sessionId];
  if (!current) {
    return null;
  }

  const next = normalizeSession({
    ...current,
    staffLastReadAt: nowIso(),
  });
  store.sessions[sessionId] = next;
  writeSessionStore(store);
  return next;
}

export function sessionHistory(session: GuestSession) {
  return session.messages.map((message) => ({
    role: (message.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content:
      message.role === "staff"
        ? `${message.authorName ?? "Front desk"}: ${message.content}`
        : message.content,
  }));
}

export function llmSessionHistory(session: GuestSession) {
  return sessionHistory(session).slice(-LLM_HISTORY_LIMIT);
}

export function listSessions(options?: { filter?: SessionListFilter; query?: string }): SessionSummary[] {
  const filter = options?.filter ?? "all";
  const query = options?.query?.trim().toLowerCase() ?? "";
  const openEscalations = new Set(
    listEscalations("open").map((ticket) => ticket.sessionId),
  );

  const summaries = Object.values(readSessionStore().sessions)
    .map((session) => {
      const normalized = normalizeSession(session);
      const last = normalized.messages.at(-1) ?? null;
      const unread = Boolean(
        normalized.lastGuestMessageAt &&
          (!normalized.staffLastReadAt || normalized.lastGuestMessageAt > normalized.staffLastReadAt),
      );

      return {
        id: normalized.id,
        guestName: normalized.guest.name,
        guestEmail: normalized.guest.email,
        guestPhone: normalized.guest.phone,
        lastMessagePreview: last ? previewMessage(last.content) : null,
        lastMessageAt: last?.at ?? null,
        lastMessageRole: last?.role ?? null,
        updatedAt: normalized.updatedAt,
        createdAt: normalized.createdAt,
        messageCount: normalized.messages.length,
        mode: normalized.mode,
        assignedTo: normalized.assignedTo,
        hasOpenEscalation: openEscalations.has(normalized.id),
        unread,
        stay: normalized.stay,
      } satisfies SessionSummary;
    })
    .filter((summary) => summary.messageCount > 0)
    .filter((summary) => {
      if (filter === "takeover") {
        return summary.mode === "staff";
      }
      if (filter === "escalated") {
        return summary.hasOpenEscalation;
      }
      return true;
    })
    .filter((summary) => {
      if (!query) {
        return true;
      }
      const haystack = [
        summary.id,
        summary.guestName,
        summary.guestEmail,
        summary.guestPhone,
        summary.lastMessagePreview,
        summary.assignedTo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return summaries;
}

export function listPendingSessionHolds() {
  return Object.values(readSessionStore().sessions)
    .map((session) => normalizeSession(session))
    .filter((session) => Boolean(session.pendingHold))
    .map((session) => ({
      sessionId: session.id,
      guest: session.guest,
      hold: session.pendingHold as PendingHold,
      updatedAt: session.updatedAt,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function mergeSessionStay(
  session: GuestSession,
  availability?: {
    checkIn?: string | null;
    checkOut?: string | null;
    guests?: number | null;
  },
) {
  return {
    checkIn: availability?.checkIn ?? session.stay.checkIn,
    checkOut: availability?.checkOut ?? session.stay.checkOut,
    guests:
      typeof availability?.guests === "number" ? availability.guests : session.stay.guests,
  };
}

export function syncStayFromResponse(
  session: GuestSession,
  data: {
    checkIn?: string | null;
    checkOut?: string | null;
    guests?: number | null;
    selectedRoomId?: string | null;
    maxBudget?: number | null;
  },
) {
  return updateSession(session.id, {
    stay: {
      checkIn: data.checkIn ?? session.stay.checkIn,
      checkOut: data.checkOut ?? session.stay.checkOut,
      guests: typeof data.guests === "number" ? data.guests : session.stay.guests,
      maxBudget:
        typeof data.maxBudget === "number" ? data.maxBudget : session.stay.maxBudget,
      selectedRoomId: data.selectedRoomId ?? session.stay.selectedRoomId,
    },
  });
}
