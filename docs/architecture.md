# Architecture (vNext)

## Module layout
- `core/http`: `DiscordRestClient` provides raw Discord API v10 REST calls, retry/backoff, and 429 handling.
- `core/interactions`: signature verification + `InteractionContext` response lifecycle (`reply`, `deferReply`, `showModal`, `editReply`, `followUp`).
- `builders/*`: schema-driven builders with runtime validation and strict typing.
- `router/*`: `InteractionRouter` dispatches command/component/modal handlers by name/custom_id.
- `types/*`: reusable contracts (`radio`, validation errors, payload helpers).
- `compat/*`: `LegacyMiniInteractionAdapter` to bridge older `MiniInteraction` usage toward the new stack.

## Lifecycle safeguards
- Optional auto-ack timer diagnostics in `InteractionContext`.
- Centralized token-based webhook usage for edit/follow-up.
- Deterministic fallback response (`deferReply`) via adapter when a handler returns nothing.

## Radio components
- Implemented as explicit local API contract (`types/radio.ts`) to decouple from `discord-api-types` release lag.
- Enforces single-default option and option length constraints.
