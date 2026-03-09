import type { APIInteractionResponse, InteractionResponseType } from 'discord-api-types/v10';
import type { ParsedInteraction } from '../../types/discord.js';
import { DiscordRestClient } from '../http/DiscordRestClient.js';

export type InteractionContextOptions = {
  interaction: ParsedInteraction;
  rest: DiscordRestClient;
  autoAck?: { enabled: boolean; delayMs?: number };
  onDiagnostic?: (message: string) => void;
};

export class InteractionContext {
  private responded = false;
  private autoAckTimer?: NodeJS.Timeout;

  constructor(private readonly options: InteractionContextOptions) {
    if (options.autoAck?.enabled) {
      const delay = options.autoAck.delayMs ?? 2000;
      this.autoAckTimer = setTimeout(() => {
        if (!this.responded) {
          options.onDiagnostic?.(`[InteractionContext] auto-ack triggered for ${this.options.interaction.id}`);
        }
      }, delay);
    }
  }

  reply(data: APIInteractionResponse['data']): APIInteractionResponse {
    this.responded = true;
    this.clearAutoAck();
    return { type: 4 satisfies InteractionResponseType, data };
  }

  deferReply(ephemeral = false): APIInteractionResponse {
    this.responded = true;
    this.clearAutoAck();
    return { type: 5, data: ephemeral ? { flags: 64 } : undefined };
  }

  showModal(data: APIInteractionResponse['data']): APIInteractionResponse {
    this.responded = true;
    this.clearAutoAck();
    return { type: 9, data };
  }

  editReply(body: unknown): Promise<unknown> {
    return this.options.rest.editOriginal(this.options.interaction.token, body);
  }

  followUp(body: unknown): Promise<unknown> {
    return this.options.rest.createFollowup(this.options.interaction.token, body);
  }

  get hasResponded(): boolean {
    return this.responded;
  }

  private clearAutoAck(): void {
    if (this.autoAckTimer) clearTimeout(this.autoAckTimer);
  }
}
