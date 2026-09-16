import { cookies } from "next/headers";

export const GUEST_SESSION_COOKIE = "asteria_guest";

export async function readGuestSessionId() {
  const jar = await cookies();
  return jar.get(GUEST_SESSION_COOKIE)?.value ?? null;
}

export async function setGuestSessionId(sessionId: string) {
  const jar = await cookies();
  jar.set(GUEST_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearGuestSessionId() {
  const jar = await cookies();
  jar.set(GUEST_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  jar.delete(GUEST_SESSION_COOKIE);
}
