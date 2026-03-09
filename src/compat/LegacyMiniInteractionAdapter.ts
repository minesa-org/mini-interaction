import type { APIInteractionResponse } from 'discord-api-types/v10';
import { InteractionType } from 'discord-api-types/v10';
import { DiscordRestClient } from '../core/http/DiscordRestClient.js';
import { InteractionContext } from '../core/interactions/InteractionContext.js';
import { verifyAndParseInteraction } from '../core/interactions/InteractionVerifier.js';
import { InteractionRouter } from '../router/InteractionRouter.js';

export type LegacyAdapterOptions = {
  publicKey: string;
  applicationId: string;
  token: string;
};

export class LegacyMiniInteractionAdapter {
  readonly router = new InteractionRouter();
  readonly rest: DiscordRestClient;

  constructor(private readonly options: LegacyAdapterOptions) {
    this.rest = new DiscordRestClient({ applicationId: options.applicationId, token: options.token });
  }

  async handleRequest(input: { body: string; signature: string; timestamp: string }): Promise<APIInteractionResponse> {
    const interaction = await verifyAndParseInteraction({ ...input, publicKey: this.options.publicKey });
    if (interaction.type === InteractionType.Ping) {
      return { type: 1 };
    }

    const ctx = new InteractionContext({ interaction, rest: this.rest, autoAck: { enabled: true } });
    const response = await this.router.dispatch(interaction, ctx);
    return response ?? ctx.deferReply();
  }
}
