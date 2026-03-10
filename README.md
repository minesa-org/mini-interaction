# 🌌 Mini Interaction

> **Sleek, Modular, and Type-Safe Discord Interactions Framework.**

Mini Interaction is a high-performance framework designed for building Discord HTTP/Webhook-based bots. It provides a modular architecture that separates concerns, making your bot easier to maintain, test, and scale.

---

## ✨ Features

- **🚀 Modular Router**: Easily map commands, components, and modals to handlers.
- **⚡ Core V10 Engine**: Native support for Discord API v10 payloads.
- **🛡️ Type Safety**: Full TypeScript support with rich autocompletion.
- **🧩 Fluent Builders**: Construct complex messages and components with a premium API.
- **🔐 Integrated OAuth**: Simple handlers for Discord OAuth2 flows.
- **🗃️ Mini Database**: Lightweight, document-based storage integration.

---

## 📦 Installation

```bash
npm install @minesa-org/mini-interaction
```

---

## 🛠️ Quick Start

Mini Interaction uses a modular approach with a dedicated Router and Context.

### 1. Define your Router
```ts
import { InteractionRouter } from '@minesa-org/mini-interaction';

const router = new InteractionRouter();

// Register a slash command
router.onCommand('ping', async (interaction, ctx) => {
  return ctx.reply({ content: '🏓 Pong!' });
});

// Register a component handler
router.onComponent('my_button', async (interaction, ctx) => {
  return ctx.reply({ content: 'Button clicked!', ephemeral: true });
});
```

### 2. Handle Interactions
```ts
import { 
  verifyAndParseInteraction, 
  InteractionContext, 
  DiscordRestClient 
} from '@minesa-org/mini-interaction';

const rest = new DiscordRestClient({ 
  applicationId: process.env.DISCORD_APP_ID, 
  token: process.env.DISCORD_TOKEN 
});

// In your web server (e.g., Next.js, Vercel, Express)
export async function POST(req) {
  const body = await req.text();
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  // Verify and parse the interaction
  const interaction = await verifyAndParseInteraction({
    body,
    signature,
    timestamp,
    publicKey: process.env.DISCORD_PUBLIC_KEY
  });

  if (interaction.type === 1) return Response.json({ type: 1 });

  const ctx = new InteractionContext({ interaction, rest });
  const response = await router.dispatch(interaction, ctx);

  return Response.json(response ?? ctx.deferReply());
}
```

---

## 🎨 Message Builders

Mini Interaction provides a rich set of builders to create beautiful Discord content.

```ts
import { ModalBuilder, TextInputBuilder, TextInputStyle } from '@minesa-org/mini-interaction';

const modal = new ModalBuilder()
  .setCustomId('feedback_form')
  .setTitle('Send us Feedback')
  .addComponents(
    new TextInputBuilder()
      .setCustomId('feedback_text')
      .setLabel('Your Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us what you think...')
  );
```

---

## 📡 Advanced Routing

You can organize your handlers into separate modules for better scalability.

```ts
// components/modals.ts
router.onModal('feedback_submit', async (interaction, ctx) => {
  const feedback = interaction.getTextFieldValue('feedback_text');
  // Process feedback...
  return ctx.reply({ content: 'Thank you for your feedback!' });
});
```

---

## 🛡️ Error Handling

Mini Interaction includes built-in validation to ensure your payloads follow Discord's requirements.

```ts
import { ValidationError } from '@minesa-org/mini-interaction';

try {
  const builder = new TextInputBuilder().setCustomId(''); // Too short!
  builder.toJSON();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed for ${error.component}: ${error.message}`);
  }
}
```

---

## 📜 License

MIT © [Minesa](https://github.com/minesa-org)
