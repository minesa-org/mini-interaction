import { ComponentType, type APIModalInteractionResponseCallbackData, type APIModalInteractionResponseCallbackComponent } from 'discord-api-types/v10';
import { resolveJSONEncodable, type JSONEncodable } from './shared.js';
import { ValidationError, assertDefined, assertStringLength } from '../types/validation.js';

export type ModalComponentLike = JSONEncodable<APIModalInteractionResponseCallbackComponent> | APIModalInteractionResponseCallbackComponent;

export type ModalBuilderData = {
  customId?: string;
  title?: string;
  components?: Iterable<ModalComponentLike>;
};

export class ModalBuilder implements JSONEncodable<APIModalInteractionResponseCallbackData> {
  private readonly data: ModalBuilderData;

  constructor(data: ModalBuilderData = {}) {
    this.data = { ...data, components: data.components ? Array.from(data.components) : [] };
  }

  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setTitle(title: string): this { this.data.title = title; return this; }
  addComponents(...components: ModalComponentLike[]): this {
    this.data.components = [...(this.data.components ?? []), ...components];
    return this;
  }

  toJSON(): APIModalInteractionResponseCallbackData {
    const customId = assertDefined('ModalBuilder', 'custom_id', this.data.customId);
    const title = assertDefined('ModalBuilder', 'title', this.data.title);
    assertStringLength('ModalBuilder', 'custom_id', customId, 1, 100);
    assertStringLength('ModalBuilder', 'title', title, 1, 45);

    const components = Array.from(this.data.components ?? []).map((c) => resolveJSONEncodable(c));
    if (components.length === 0 || components.length > 5) {
      throw new ValidationError('ModalBuilder', 'components', 'must contain between 1 and 5 components');
    }

    for (const component of components) {
      if (component.type !== ComponentType.ActionRow && component.type !== ComponentType.Label) {
        throw new ValidationError('ModalBuilder', 'components', `invalid modal top-level component type ${component.type}`);
      }
    }

    return { custom_id: customId, title, components };
  }
}
