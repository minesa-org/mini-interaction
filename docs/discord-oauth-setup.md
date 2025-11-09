# Discord OAuth Linked Roles Setup

This guide shows how to wire Discord linked roles to your application with the
`MiniInteraction` helper methods, MongoDB, and the official Discord developer
portal settings.

## Prerequisites

- A Discord application with Linked Roles enabled.
- Environment variables configured in your hosting platform:
  - `DISCORD_APPLICATION_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DISCORD_REDIRECT_URI`
  - `MONGODB_URI`
- A MongoDB collection where you can persist metadata and OAuth tokens.

## 1. Configure Redirects in the Discord Developer Portal

1. Open your application at <https://discord.com/developers/applications>.
2. Navigate to **OAuth2 → General**.
3. Add your backend callback URL (for example
   `https://your-app.com/api/discord-oauth-callback`) to the **Redirects** list.
4. Add the verification endpoint that Discord pings when validating your linked
   roles API (for example `https://your-app.com/api/discord-role-metadata`) to
   **Linked Roles → Verification URL**.

> 💡 Make sure the redirect URL exactly matches the one your server exposes.

## 2. Create an Interaction Client

```ts
// interaction.ts
import { MiniInteraction } from "@minesa-org/mini-interaction";

export const mini = new MiniInteraction({
  applicationId: process.env.DISCORD_APPLICATION_ID!,
  publicKey: process.env.DISCORD_PUBLIC_KEY!,
});
```

Expose the interaction handler using your framework of choice (Express,
Fastify, Next.js API routes, etc.).

## 3. Add a Minimal Discord OAuth Callback Route

`MiniInteraction.discordOAuthCallback()` reads the OAuth configuration from the
environment variables listed above. The only code you need to provide is what
happens after Discord authorises the user.

```ts
// pages/api/discord-oauth-callback.ts (Next.js example)
import type { NextApiRequest, NextApiResponse } from "next";
import { mini } from "../../interaction";
import { MiniDatabase } from "@minesa-org/mini-interaction";

const db = MiniDatabase.fromEnv();

export default mini.discordOAuthCallback({
  async onAuthorize({ user, tokens }) {
    await db.set(user.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
    });
  },
});
```

No request parsing, template rendering, or redirect handling is required. If
you need a custom redirect URL, provide `successRedirect` to the helper.

## 4. Generate the OAuth URL on Demand

Protect your client secret by producing the OAuth URL server-side and fetching
it from the frontend.

```ts
// pages/api/get-oauth-url.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { generateOAuthUrl } from "@minesa-org/mini-interaction";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { url, state } = generateOAuthUrl(
    {
      appId: process.env.DISCORD_APPLICATION_ID!,
      appSecret: process.env.DISCORD_CLIENT_SECRET!,
      redirectUri: process.env.DISCORD_REDIRECT_URI!,
    },
    ["identify", "role_connections.write"],
  );

  res.status(200).json({ url, state });
}
```

The frontend can now redirect the user to `url` and send the `state` value back
to your backend to validate the OAuth callback.

## 5. Update Linked Role Metadata

Inside your `onAuthorize` handler you can call Discord's Linked Roles API or a
separate helper that updates your metadata stored in MongoDB. Keep the logic
close to the helper so new developers can onboard quickly.

```ts
import { updateDiscordMetadata } from "../server/update-discord-metadata";

export default mini.discordOAuthCallback({
  async onAuthorize({ user, tokens }) {
    await updateDiscordMetadata(user.id, tokens.access_token);
  },
});
```

## 6. Optional: Validate OAuth State Tokens

`discordOAuthCallback` accepts a `validateState` function to confirm the `state`
parameter Discord returns. Returning `false` renders a friendly error page.

```ts
import { kv } from "@vercel/kv";

export default mini.discordOAuthCallback({
  async validateState(state) {
    if (!state) return false;
    const expected = await kv.get(`discord-state:${state}`);
    return expected === "1";
  },
});
```

You are now ready to guide users through Linked Roles with minimal boilerplate
and a single MongoDB connection configured via `MONGODB_URI`.
