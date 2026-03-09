import { ChannelType, ComponentType, SelectMenuDefaultValueType, type APIChannelSelectComponent, type APISelectMenuDefaultValue } from 'discord-api-types/v10';
import type { JSONEncodable } from './shared.js';
import { assertDefined, assertRange, assertStringLength, ValidationError } from '../types/validation.js';

export type ModalChannelSelectMenuBuilderData = {
  customId?: string; placeholder?: string; minValues?: number; maxValues?: number; disabled?: boolean; required?: boolean; channelTypes?: ChannelType[];
  defaultValues?: APISelectMenuDefaultValue<SelectMenuDefaultValueType.Channel>[];
};

export class ModalChannelSelectMenuBuilder implements JSONEncodable<APIChannelSelectComponent> {
  private readonly data: ModalChannelSelectMenuBuilderData;
  constructor(data: ModalChannelSelectMenuBuilderData = {}) { this.data = { ...data }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setPlaceholder(placeholder?: string): this { this.data.placeholder = placeholder; return this; }
  setMinValues(minValues?: number): this { this.data.minValues = minValues; return this; }
  setMaxValues(maxValues?: number): this { this.data.maxValues = maxValues; return this; }
  setDisabled(disabled: boolean): this { this.data.disabled = disabled; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setChannelTypes(channelTypes: ChannelType[]): this { this.data.channelTypes = [...channelTypes]; return this; }
  setDefaultValues(defaultValues: Iterable<APISelectMenuDefaultValue<SelectMenuDefaultValueType.Channel>>): this {
    this.data.defaultValues = Array.from(defaultValues, (v) => ({ ...v, type: SelectMenuDefaultValueType.Channel }));
    return this;
  }

  toJSON(): APIChannelSelectComponent {
    const customId = assertDefined('ModalChannelSelectMenuBuilder', 'custom_id', this.data.customId);
    assertStringLength('ModalChannelSelectMenuBuilder', 'custom_id', customId, 1, 100);
    if (this.data.placeholder) assertStringLength('ModalChannelSelectMenuBuilder', 'placeholder', this.data.placeholder, 1, 150);
    if (this.data.minValues !== undefined) assertRange('ModalChannelSelectMenuBuilder', 'min_values', this.data.minValues, 0, 25);
    if (this.data.maxValues !== undefined) assertRange('ModalChannelSelectMenuBuilder', 'max_values', this.data.maxValues, 1, 25);
    if (this.data.minValues !== undefined && this.data.maxValues !== undefined && this.data.minValues > this.data.maxValues) throw new ValidationError('ModalChannelSelectMenuBuilder', 'min_values', 'cannot exceed max_values');
    return { type: ComponentType.ChannelSelect, custom_id: customId, placeholder: this.data.placeholder, min_values: this.data.minValues, max_values: this.data.maxValues, disabled: this.data.disabled, required: this.data.required, channel_types: this.data.channelTypes, default_values: this.data.defaultValues };
  }
}
