# Changelog

## Unreleased
### Breaking changes
- Reworked interaction architecture around `core/http`, `core/interactions`, `router`, and `compat` modules.
- Builder validation now throws hard `ValidationError` for out-of-spec payloads.
- `ModalBuilder` no longer auto-wraps arbitrary components into action rows.

### Added
- `DiscordRestClient` with retry + rate-limit behavior.
- `InteractionContext` lifecycle helpers for reply/defer/showModal/edit/followUp.
- `InteractionRouter` command/component/modal dispatch.
- `RadioBuilder` + `APIRadioComponent` types.
- `MIGRATION.md` and architecture docs.
