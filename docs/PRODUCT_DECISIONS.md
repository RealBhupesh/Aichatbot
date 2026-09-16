# Product decisions

## What customer problem are we solving?

Hotel guests need fast, trustworthy answers while they are choosing a stay or already holding a reservation: check-in time, whether breakfast is included, which room sleeps three people, the cancellation window, and whether those dates have space. They should not have to hunt through a brochure site or wait on hold for questions the hotel already publishes. The assistant is a front desk that is always available, with a hard boundary: it may only speak from hotel data, and it may not invent a booking.

## What does the guest journey look like?

1. Land on the listing: reception-desk photo grid, hotel name, rating, and Talk.
2. Open the host conversation and ask a natural question, or tap a popular prompt.
3. Get a short, specific answer grounded in hotel data, with photographs of the desk, rooms, or amenities.
4. Ask a follow-up (“does it include breakfast?”) without repeating the room name.
5. If they want dates, provide check-in, check-out, and guest count in the conversation or in the form.
6. Inspect available rooms, photos, capacity, breakfast, and estimated totals.
7. Tap **Book the room**, provide a phone number, and wait for the front desk to confirm.
8. Receive an `AST-xxxx` confirmation code in chat only after staff approves the request.

Staff sign in at `/staff`, confirm or decline booking requests, take over live chats, and set inventory, rates, and closed dates so the guest assistant stays in sync.

## Why was the frontend designed this way?

The guest surface is a listing page, not a brochure with a chat widget bolted on. The first thing on the page is the real reception desk, in an Airbnb-style photo mosaic, with Leela as the host. The primary action is Talk. That opens a host-style conversation with popular prompts (availability, check-in, breakfast, rooms for three). Hotel facts stay in the dialogue, and answers arrive with photographs so the guest can see the desk, pool, breakfast room, or a room type instead of only reading copy.

Dates and occupancy still use a form, because a wrong date is a business error, not a language problem. Loading and retry states stay in the conversation so the guest always knows whether the hotel, the model, or the network is at fault.

## Which parts use AI?

- Intent understanding and tool orchestration (agent mode, default)
- Follow-up / reference resolution (“that one”, “does it include breakfast?”)
- Extracting stay parameters from prose when the guest volunteers them
- Optional natural-language phrasing when a live model is configured
- Deciding when to escalate to staff (via the `escalateToStaff` tool)

Booking **confirmation** is never AI-driven — staff must explicitly confirm or decline.

## Which parts remain deterministic?

- Dates and night counts
- Guest count validation
- Room capacity
- Nightly prices and stay totals
- Policies and amenity facts
- Mock inventory / availability
- Request validation and error mapping

## What can go wrong with AI?

- Hallucinated amenities, prices, or cancellation terms
- Wrong intent (a policy question classified as availability)
- Broken reference resolution (“it” attached to the wrong room)
- Malformed structured output
- Stale assumptions if the JSON is updated but the prompt is not
- Unsupported claims presented as confirmed facts

## How do we prevent hallucinations?

- The hotel JSON is the only factual source
- The system prompt forbids invention and forbids deciding inventory
- Structured model output is schema-validated
- Availability is computed only by `checkAvailability()`
- Factual replies for the assignment’s core questions are composed from `lib/answers.ts`, not from free-form model text
- Unknown topics return a contact-the-hotel fallback
- Tests cover check-in, pool, three-guest rooms, cancellation, helicopter, follow-ups, and provider failure

## What happens when dependencies fail?

- **LLM failure:** guest-safe retry message; the process does not crash
- **Frontend API / network failure:** “Something went wrong while contacting the assistant.” plus Retry
- **Backend validation error:** 400 with the first Zod message
- **Availability failure:** “I couldn't check room availability right now…”
- **Invalid user input:** specific copy for inverted dates, past check-in, and guest counts outside 1–8

## How would we measure usefulness?

- Answer success rate (assistant replied from hotel data)
- Fallback rate (unsupported / unknown)
- Availability completion rate (form started → results shown)
- Availability-to-booking conversion (after a real booking engine exists)
- Guest satisfaction / thumbs down on a turn
- Response latency (p50 / p95)
- Human escalation rate
- Repeated-question rate (same guest asking again after an answer)
- Incorrect-answer reports from staff audits

## What should be improved before production?

- Replace mock inventory with a PMS or booking-engine integration
- Persist conversations server-side with access control, not only in the browser
- Add tracing, metrics, and prompt/version identifiers
- Rate-limit the chat route by IP and session
- Monitor model quality with a labeled eval set
- Provide a staff escalation path with transcript handoff
- Product analytics on intents and drop-off
- Multilingual support for the Goa guest mix
- Dedicated accessibility testing (screen reader, keyboard, contrast)
- Security review of logging and data retention
- Prompt and dataset versioning
- Privacy review (what history is stored, for how long)
- Cache hotel JSON and repeated FAQs
- Cost monitoring on the AI Gateway
