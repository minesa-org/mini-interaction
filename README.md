# Mini Interaction

Discord interactions framework for HTTP/webhook bots with direct Discord API v10 payload compatibility.

## Quick start (slash command)
```ts
import { LegacyMiniInteractionAdapter } from '@minesa-org/mini-interaction';

const adapter = new LegacyMiniInteractionAdapter({ publicKey, applicationId, token });
adapter.router.onCommand('ping', async (_interaction, ctx) => ctx.reply({ content: 'pong' }));
```

## Modal example (label + upload + select)
```ts
import {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  FileUploadBuilder,
  ModalRoleSelectMenuBuilder,
} from '@minesa-org/mini-interaction';
```

## Radio example
```ts
import { RadioBuilder } from '@minesa-org/mini-interaction';

const radio = new RadioBuilder()
  .setCustomId('flavor')
  .addOptions({ label: 'Vanilla', value: 'v', default: true }, { label: 'Chocolate', value: 'c' });
```

## Error handling
Catch `ValidationError` from builders to surface actionable diagnostics.
