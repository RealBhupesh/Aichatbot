import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import {
  isStaffCookie,
  STAFF_NAME_COOKIE,
  STAFF_SESSION_COOKIE,
  staffCookieValue,
} from "@/lib/staff-cookie";

export { isStaffCookie, STAFF_NAME_COOKIE, STAFF_SESSION_COOKIE, staffCookieValue };

const DEFAULT_STAFF_NAME = "Front desk";

export function staffPassword() {
  return process.env.STAFF_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "asteria-desk");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifyStaffPassword(password: string) {
  const expected = staffPassword();
  if (!expected) {
    return false;
  }
  return safeEqual(password, expected);
}

export async function isStaffSession() {
  const jar = await cookies();
  return isStaffCookie(jar.get(STAFF_SESSION_COOKIE)?.value);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function setStaffSession(name?: string | null) {
  const jar = await cookies();
  jar.set(STAFF_SESSION_COOKIE, staffCookieValue(), cookieOptions());
  const trimmed = name?.trim();
  if (trimmed) {
    jar.set(STAFF_NAME_COOKIE, trimmed.slice(0, 80), cookieOptions());
  } else {
    jar.delete(STAFF_NAME_COOKIE);
  }
}

export async function readStaffName() {
  const jar = await cookies();
  return jar.get(STAFF_NAME_COOKIE)?.value?.trim() || DEFAULT_STAFF_NAME;
}

export async function clearStaffSession() {
  const jar = await cookies();
  jar.delete(STAFF_SESSION_COOKIE);
  jar.delete(STAFF_NAME_COOKIE);
}
