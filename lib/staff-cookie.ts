import { createHmac, timingSafeEqual } from "node:crypto";

export const STAFF_SESSION_COOKIE = "asteria_staff";
export const STAFF_NAME_COOKIE = "asteria_staff_name";

function secret() {
  return process.env.STAFF_SECRET || process.env.STAFF_PASSWORD || "asteria-local-staff-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function staffCookieValue() {
  return `ok.${sign("ok")}`;
}

export function isStaffCookie(value: string | undefined) {
  if (!value) {
    return false;
  }
  const [flag, mac] = value.split(".");
  if (flag !== "ok" || !mac) {
    return false;
  }
  return safeEqual(mac, sign("ok"));
}
