# Evaluation

Results below come from the automated suite in this repository. A row is marked **Pass** only when the command that covers it succeeded.

Commands run on 16 Sep 2026:

```bash
npm test          # 18 files, 75 passed
npx playwright test  # 2 passed
```

| # | Scenario | Input | Expected | Observed | Result |
| - | -------- | ----- | -------- | -------- | ------ |
| 1 | Check-in time | "What time is check-in?" | Answer includes 3:00 PM from hotel JSON | `tests/chat-api.test.ts` returned type `answer` with "3:00 PM" | Pass |
| 2 | Swimming pool | "Does the hotel have a swimming pool?" | Confirms the pool from amenity data | Amenity answer included "swimming pool" | Pass |
| 3 | Three-guest rooms | "Which room is suitable for three guests?" | Family Room and Executive Suite only | Message listed those two rooms and not Standard Queen | Pass |
| 4 | Cancellation policy | "What is the cancellation policy?" | Grounded in the 24-hour policy text | Policy text included "24 hours" | Pass |
| 5 | Unsupported service | "Do you have helicopter transfers?" | Fallback, no invented service | type `fallback`, "don't have reliable information", mentions helicopter | Pass |
| 6 | Availability, missing dates | "Do you have rooms available?" | `availability_request` + missing fields | type `availability_request`, missing checkIn/checkOut/guests | Pass |
| 7 | Valid availability | 2026-09-20 → 2026-09-22, 3 guests | `checkAvailability()` returns compatible rooms | Family Room returned, 2 nights, ₹17,000 total | Pass |
| 8 | Invalid dates | Check-out before check-in | Helpful validation error | "Check-out must be after check-in." | Pass |
| 9 | Follow-up | Family Room, then "Does it include breakfast?" | Breakfast included for Family Room | Follow-up answered Family Room breakfast included | Pass |
| 10 | AI failure | Interpreter throws | Safe AI error, process stays up | HTTP 200, guest-safe retry copy, no stack/key leak | Pass |
| 11 | Availability failure | Inventory function throws | Availability failure copy | "I couldn't check room availability right now. Please try again shortly." | Pass |
| 12 | End-to-end | Browser guest flow | Question, images, form, room results | Playwright: check-in answer with photo, availability form, Family Room card | Pass |
| 13 | Staff desk | Password `asteria-desk` | Operations dashboard | Playwright: sign-in shows Family Room inventory | Pass |

Additional unit coverage in `tests/availability.test.ts`, `tests/hotel.test.ts`, and `tests/operations.test.ts`: past dates, guest-count limits, blackout nights, capacity filter, staff closing a room, staff rate changes, and JSON grounding for pool / cancellation / helicopter.

Quality gates:

| Command | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass (75) |
| `npm run build` | Pass |
| `npx playwright test` | Pass (2) |
