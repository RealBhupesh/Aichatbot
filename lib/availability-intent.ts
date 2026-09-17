export function isDirectAvailabilityRequest(message: string) {
  const trimmed = message.trim();
  return /^(check room availability|check availability|see available rooms|show available rooms|rooms available|find available rooms)\.?$/i.test(
    trimmed,
  );
}

export function looksLikeAvailabilityDatePrompt(message: string) {
  return /check-?in|check-?out|dates? you have in mind|which dates|how many guests|guest count|number of guests|when (are you|would you|do you)|arrival date|departure date|staying with us/i.test(
    message,
  );
}

export function looksLikeAvailabilityIntent(message: string) {
  if (isDirectAvailabilityRequest(message)) {
    return true;
  }

  if (/what time is check-?in|check-?in time|check-?out time/i.test(message)) {
    return false;
  }

  return /available|availability|any rooms|vacanc|book a room|reserve|cheapest room|need a room|rooms? under|check.*rooms?/i.test(
    message,
  );
}
