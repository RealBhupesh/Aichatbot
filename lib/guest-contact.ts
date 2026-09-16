export type GuestContactValues = {
  guestNames: string[];
  guestEmail: string;
  guestPhone: string;
};

export function primaryGuestName(values: GuestContactValues) {
  return values.guestNames[0]?.trim() ?? "";
}

export function formatGuestNamesForHold(names: string[]) {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return "";
  }
  if (trimmed.length === 1) {
    return trimmed[0];
  }
  if (trimmed.length === 2) {
    return `${trimmed[0]} and ${trimmed[1]}`;
  }
  return `${trimmed.slice(0, -1).join(", ")}, and ${trimmed.at(-1)}`;
}

export function buildGuestHoldMessage(values: GuestContactValues, roomId?: string | null) {
  const names = formatGuestNamesForHold(values.guestNames);
  const room = roomId ? `the ${roomId}` : "the room";
  return `Please book ${room} for ${names}. Email: ${values.guestEmail || "n/a"}. Phone: ${values.guestPhone || "n/a"}.`;
}

export function buildGuestContactChatMessage(values: GuestContactValues) {
  const names = formatGuestNamesForHold(values.guestNames);
  return `Guest name${values.guestNames.length > 1 ? "s" : ""}: ${names}. Email: ${values.guestEmail || "not provided"}. Phone: ${values.guestPhone || "not provided"}.`;
}

export function guestContactIntro(guestCount: number) {
  if (guestCount <= 1) {
    return "Almost there — share the guest name and a phone number so the front desk can call to confirm.";
  }
  return `Almost there — share the full names of all ${guestCount} guests plus a phone number the desk can call.`;
}
