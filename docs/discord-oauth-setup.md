# Discord OAuth Linked Roles Setup

This guide shows how to wire Discord linked roles to your Vercel deployment
with the `MiniInteraction` helpers, MongoDB, and the official Discord developer
portal settings.

## Prerequisites

- A Discord application with Linked Roles enabled.
- Environment variables configured in Vercel:
  - `DISCORD_APPLICATION_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DISCORD_REDIRECT_URI`
  - `MONGODB_URI`
- A MongoDB collection where you can persist metadata and OAuth tokens.

## 1. Configure Redirects in the Discord Developer Portal

1. Open your application at <https://discord.com/developers/applications>.
2. Navigate to **OAuth2 → General**.
3. Add your backend callback URL (for example
   `https://your-app.vercel.app/api/discord-oauth-callback`) to the
   **Redirects** list.
4. Add the verification endpoint that Discord pings when validating your linked
   roles API (for example `https://your-app.vercel.app/api/discord-role-metadata`)
   to **Linked Roles → Verification URL**.

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

You can reuse this client anywhere you need to expose Discord endpoints on
Vercel (API routes under the `api/` directory).

## 3. Provide Connected and Failed Pages

Place your HTML responses in the `public` directory so they can be bundled with
your deployment:

```
public/pages/connected.html
public/pages/failed.html
```

`MiniInteraction` replaces simple template tokens inside these files. The
success page understands:

- `{{username}}`, `{{discriminator}}`, `{{user_tag}}`, `{{user_id}}`
- `{{access_token}}`, `{{refresh_token}}`, `{{token_type}}`, `{{scope}}`,
  `{{expires_at}}`
- `{{state}}`

The error page understands:

- `{{error}}`
- `{{state}}`

Any tokens you omit are replaced with an empty string so you can opt in to only
what you need.

## 4. Add the Discord OAuth Callback Route for Vercel

`MiniInteraction.discordOAuthCallback()` reads the OAuth configuration from the
environment variables listed above. You only need to handle what happens after
Discord authorises the user and choose which HTML files are rendered.

```ts
// api/discord-oauth-callback.ts
import { MiniDatabase } from "@minesa-org/mini-interaction";
import { mini } from "../interaction";

const database = MiniDatabase.fromEnv();
const failedPage = mini.failedOAuthPage("public/pages/failed.html");

export default mini.discordOAuthCallback({
  templates: {
    success: mini.connectedOAuthPage("public/pages/connected.html"),
    missingCode: failedPage,
    oauthError: failedPage,
    invalidState: failedPage,
    serverError: failedPage,
  },
  async onAuthorize({ user, tokens }) {
    await database.set(user.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      scope: tokens.scope,
    });
  },
});
```

No request parsing or template rendering is required – the helper handles it.
If you need a custom redirect URL, provide `successRedirect` to the helper.

## 5. Generate the OAuth URL on Demand

Protect your client secret by producing the OAuth URL server-side and fetching
it from the frontend.

```ts
// api/get-oauth-url.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { generateOAuthUrl } from "@minesa-org/mini-interaction";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const { url, state } = generateOAuthUrl(
      {
        appId: process.env.DISCORD_APPLICATION_ID!,
        appSecret: process.env.DISCORD_CLIENT_SECRET!,
        redirectUri: process.env.DISCORD_REDIRECT_URI!,
      },
      ["identify", "role_connections.write"],
    );

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.setHeader("access-control-allow-origin", "*");
    res.end(JSON.stringify({ url, state }));
  } catch (error) {
    console.error("Error generating OAuth URL:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Failed to generate OAuth URL" }));
  }
}
```

The frontend can now redirect the user to `url` and send the `state` value back
to your backend to validate the OAuth callback.

## 6. Update Linked Role Metadata

Inside your `onAuthorize` handler you can call Discord's Linked Roles API or a
separate helper that updates your metadata stored in MongoDB. Keeping the logic
close to the helper makes onboarding new developers straightforward.

```ts
import { updateDiscordMetadata } from "../server/update-discord-metadata";

const failedPage = mini.failedOAuthPage("public/pages/failed.html");

export default mini.discordOAuthCallback({
  templates: {
    success: mini.connectedOAuthPage("public/pages/connected.html"),
    missingCode: failedPage,
    oauthError: failedPage,
    invalidState: failedPage,
    serverError: failedPage,
  },
  async onAuthorize({ user, tokens }) {
    await updateDiscordMetadata(user.id, tokens.access_token);
  },
});
```

## 7. Optional: Validate OAuth State Tokens

`discordOAuthCallback` accepts a `validateState` function to confirm the `state`
parameter Discord returns. Returning `false` renders your failed template.

```ts
import { kv } from "@vercel/kv";

const failedPage = mini.failedOAuthPage("public/pages/failed.html");

export default mini.discordOAuthCallback({
  templates: {
    success: mini.connectedOAuthPage("public/pages/connected.html"),
    missingCode: failedPage,
    oauthError: failedPage,
    invalidState: failedPage,
    serverError: failedPage,
  },
  async validateState(state) {
    if (!state) return false;
    const expected = await kv.get(`discord-state:${state}`);
    return expected === "1";
  },
});
```

You are now ready to guide users through Linked Roles with minimal boilerplate
and a single MongoDB connection configured via `MONGODB_URI`.
