const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function utcToday(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const start = parseIsoDate(checkIn);
  const end = parseIsoDate(checkOut);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function eachNight(checkIn: string, checkOut: string) {
  const start = parseIsoDate(checkIn);
  const nights = nightsBetween(checkIn, checkOut);

  if (!start || nights === null || nights <= 0) {
    return [];
  }

  return Array.from({ length: nights }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return toIsoDate(date);
  });
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
}

function upcomingWeekday(from: Date, weekday: number, weeksAhead = 0) {
  const current = from.getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  delta += weeksAhead * 7;
  return addDays(from, delta);
}

export function extractIsoDates(text: string, now = new Date()) {
  const today = utcToday(now);
  const found: string[] = [];

  const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  for (const match of isoMatches) {
    if (parseIsoDate(match)) {
      found.push(match);
    }
  }

  const monthPattern =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi;

  for (const match of text.matchAll(monthPattern)) {
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : today.getUTCFullYear();
    const candidate = toIsoDate(new Date(Date.UTC(year, month, day)));
    if (parseIsoDate(candidate)) {
      found.push(candidate);
    }
  }

  const lower = text.toLowerCase();

  if (/\bthis weekend\b/.test(lower)) {
    const saturday = upcomingWeekday(today, 6);
    if (today.getUTCDay() === 6) {
      found.push(toIsoDate(today), toIsoDate(addDays(today, 1)));
    } else if (today.getUTCDay() === 0) {
      found.push(toIsoDate(addDays(today, -1)), toIsoDate(today));
    } else {
      found.push(toIsoDate(saturday), toIsoDate(addDays(saturday, 1)));
    }
  } else if (/\bnext weekend\b/.test(lower)) {
    const thisSaturday = upcomingWeekday(today, 6);
    const nextSaturday =
      today.getUTCDay() === 6 || today.getUTCDay() === 0
        ? upcomingWeekday(today, 6)
        : addDays(thisSaturday, 7);
    found.push(toIsoDate(nextSaturday), toIsoDate(addDays(nextSaturday, 1)));
  }

  for (const [name, weekday] of Object.entries(WEEKDAY_WORDS)) {
    if (new RegExp(`\\bnext ${name}\\b`).test(lower)) {
      found.push(toIsoDate(upcomingWeekday(today, weekday)));
    }
  }

  if (/\bday after tomorrow\b/.test(lower)) {
    found.push(toIsoDate(addDays(today, 2)));
  } else if (/\btomorrow\b/.test(lower)) {
    found.push(toIsoDate(addDays(today, 1)));
  } else if (/\b(today|tonight)\b/.test(lower)) {
    found.push(toIsoDate(today));
  }

  const inDays = lower.match(/\bin\s+(\d+|a|one|two|three)\s+days?\b/);
  if (inDays) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3 };
    const days = words[inDays[1]] ?? Number(inDays[1]);
    if (Number.isFinite(days) && days > 0) {
      found.push(toIsoDate(addDays(today, days)));
    }
  }

  return [...new Set(found)];
}

export function extractGuestCount(text: string) {
  const numeric = text.match(
    /\b(\d+)\s*(?:guests?|people|adults|of us|travelers?|travellers?)\b/i,
  );
  if (numeric) {
    return Number(numeric[1]);
  }

  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };

  const word = text.match(
    /\b(one|two|three|four|five|six|seven|eight)\s*(?:guests?|people|adults|of us)\b/i,
  );
  if (word) {
    return words[word[1].toLowerCase()];
  }

  const ofUs = text.match(/\b(?:for|of)\s+(one|two|three|four|five|six|\d+)\b/i);
  if (ofUs) {
    return words[ofUs[1].toLowerCase()] ?? Number(ofUs[1]);
  }

  return null;
}

export function extractNightCount(text: string) {
  const numeric = text.match(/\b(\d+)\s*nights?\b/i);
  if (numeric) {
    return Number(numeric[1]);
  }
  if (/\b(a|one) night\b/i.test(text)) {
    return 1;
  }
  if (/\btwo nights\b/i.test(text)) {
    return 2;
  }
  if (/\bthree nights\b/i.test(text)) {
    return 3;
  }
  return null;
}

export type RoomPreference = "cheapest" | "deluxe" | "family" | "suite" | null;

export function extractMaxBudget(text: string): number | null {
  const lower = text.toLowerCase();

  const patterns = [
    /(?:under|below|less than|within|max(?:imum)?|up to)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i,
    /(?:under|below|less than|within|max(?:imum)?|up to)\s*(?:₹|rs\.?|inr)?\s*(\d{3,6})\b/i,
    /(\d+(?:\.\d+)?)\s*k\s+budget/i,
    /budget\s*(?:of|under|below)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i,
    /budget\s*(?:of|under|below)?\s*(?:₹|rs\.?|inr)?\s*(\d{3,6})\b/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (!match) {
      continue;
    }
    const raw = match[1];
    const value = raw.includes(".") || /\d\s*k\b/i.test(match[0])
      ? Number(raw) * 1000
      : Number(raw);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  return null;
}

export function looksLikeRoomSearch(text: string) {
  return /check.*rooms?|rooms? under|under\s+\d|below\s+\d|less than\s+₹?|budget|within.*budget|price range|under\s+.*k\b/i.test(
    text,
  );
}

export function extractRoomPreference(text: string): RoomPreference {
  const lower = text.toLowerCase();
  if (extractMaxBudget(text)) {
    return null;
  }
  if (/cheapest|lowest[- ]price|least expensive|budget room/.test(lower)) {
    return "cheapest";
  }
  if (/executive suite|\bsuite\b/.test(lower)) {
    return "suite";
  }
  if (/family room/.test(lower)) {
    return "family";
  }
  if (/deluxe/.test(lower)) {
    return "deluxe";
  }
  return null;
}

export function looksLikeBookingRequest(text: string) {
  return /book|reserve|cheapest|wanna check in|want to check in|checking in|get me a room|need a room|i want a room|wanna book/i.test(
    text,
  );
}

export function shouldDefaultStay(text: string) {
  return looksLikeBookingRequest(text) || looksLikeRoomSearch(text) || Boolean(extractMaxBudget(text));
}

export function asIsoDate(value: string | null | undefined, now = new Date()) {
  if (!value) {
    return null;
  }
  if (parseIsoDate(value)) {
    return value;
  }
  return extractIsoDates(value, now)[0] ?? null;
}

export function inferStayFromMessage(text: string, now = new Date()) {
  const dates = extractIsoDates(text, now);
  const nights = extractNightCount(text) ?? 1;
  let checkIn = dates[0] ?? null;
  let checkOut = dates[1] ?? null;

  if (checkIn && !checkOut) {
    const start = parseIsoDate(checkIn);
    if (start) {
      checkOut = toIsoDate(addDays(start, nights));
    }
  }

  let guests = extractGuestCount(text);
  if (typeof guests !== "number" && shouldDefaultStay(text)) {
    guests = 2;
  }

  if (!checkIn && shouldDefaultStay(text)) {
    checkIn = toIsoDate(addDays(utcToday(now), 1));
    checkOut = toIsoDate(addDays(utcToday(now), 2));
  }

  return {
    checkIn,
    checkOut,
    guests,
    preference: extractRoomPreference(text),
    maxBudget: extractMaxBudget(text),
  };
}
