import type { APIInteraction, APIInteractionResponse, APIMessageComponentInteraction, APIModalSubmitInteraction, APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { InteractionType } from 'discord-api-types/v10';
import { InteractionContext } from '../core/interactions/InteractionContext.js';

export type RouterHandler<T extends APIInteraction> = (interaction: T, ctx: InteractionContext) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

export class InteractionRouter {
  private readonly commandHandlers = new Map<string, RouterHandler<APIChatInputApplicationCommandInteraction>>();
  private readonly componentHandlers = new Map<string, RouterHandler<APIMessageComponentInteraction>>();
  private readonly modalHandlers = new Map<string, RouterHandler<APIModalSubmitInteraction>>();

  onCommand(name: string, handler: RouterHandler<APIChatInputApplicationCommandInteraction>): this {
    this.commandHandlers.set(name, handler);
    return this;
  }

  onComponent(customId: string, handler: RouterHandler<APIMessageComponentInteraction>): this {
    this.componentHandlers.set(customId, handler);
    return this;
  }

  onModal(customId: string, handler: RouterHandler<APIModalSubmitInteraction>): this {
    this.modalHandlers.set(customId, handler);
    return this;
  }

  async dispatch(interaction: APIInteraction, ctx: InteractionContext): Promise<APIInteractionResponse | void> {
    if (interaction.type === InteractionType.ApplicationCommand) {
      const i = interaction as APIChatInputApplicationCommandInteraction;
      return this.commandHandlers.get(i.data.name)?.(i, ctx);
    }
    if (interaction.type === InteractionType.MessageComponent) {
      const i = interaction as APIMessageComponentInteraction;
      return this.componentHandlers.get(i.data.custom_id)?.(i, ctx);
    }
    if (interaction.type === InteractionType.ModalSubmit) {
      const i = interaction as APIModalSubmitInteraction;
      return this.modalHandlers.get(i.data.custom_id)?.(i, ctx);
    }
    return undefined;
  }
}
