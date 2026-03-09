# Migration guide

## Old
```ts
const client = new MiniInteraction({ publicKey, applicationId });
```

## New
```ts
const adapter = new LegacyMiniInteractionAdapter({ publicKey, applicationId, token });
adapter.router.onCommand('ping', (_i, ctx) => ctx.reply({ content: 'pong' }));
```

## Modal builders
- `ModalBuilder` now validates title/custom_id length and top-level component compatibility.
- `LabelBuilder`, `TextInputBuilder`, `FileUploadBuilder`, and modal select builders now throw `ValidationError` with builder+field context.

## Radio
```ts
const radio = new RadioBuilder()
  .setCustomId('tier')
  .addOptions(
    { label: 'Free', value: 'free', default: true },
    { label: 'Pro', value: 'pro' },
  );
```
