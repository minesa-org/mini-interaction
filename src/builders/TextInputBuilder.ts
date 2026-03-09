import { ComponentType, TextInputStyle, type APITextInputComponent } from 'discord-api-types/v10';
import { type JSONEncodable } from './shared.js';
import { assertDefined, assertRange, assertStringLength } from '../types/validation.js';

export type TextInputBuilderData = {
  customId?: string; style?: TextInputStyle; minLength?: number; maxLength?: number; required?: boolean; value?: string; placeholder?: string;
};

export class TextInputBuilder implements JSONEncodable<APITextInputComponent> {
  private readonly data: TextInputBuilderData;
  constructor(data: TextInputBuilderData = {}) { this.data = { style: TextInputStyle.Short, ...data }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setStyle(style: TextInputStyle): this { this.data.style = style; return this; }
  setMinLength(minLength: number): this { this.data.minLength = minLength; return this; }
  setMaxLength(maxLength: number): this { this.data.maxLength = maxLength; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setValue(value: string): this { this.data.value = value; return this; }
  setPlaceholder(placeholder: string): this { this.data.placeholder = placeholder; return this; }

  toJSON(): APITextInputComponent {
    const customId = assertDefined('TextInputBuilder', 'custom_id', this.data.customId);
    assertStringLength('TextInputBuilder', 'custom_id', customId, 1, 100);
    if (this.data.minLength !== undefined) assertRange('TextInputBuilder', 'min_length', this.data.minLength, 0, 4000);
    if (this.data.maxLength !== undefined) assertRange('TextInputBuilder', 'max_length', this.data.maxLength, 1, 4000);
    if (this.data.placeholder) assertStringLength('TextInputBuilder', 'placeholder', this.data.placeholder, 1, 100);
    if (this.data.value) assertStringLength('TextInputBuilder', 'value', this.data.value, 0, 4000);

    return { type: ComponentType.TextInput, custom_id: customId, style: this.data.style ?? TextInputStyle.Short, min_length: this.data.minLength, max_length: this.data.maxLength, required: this.data.required, value: this.data.value, placeholder: this.data.placeholder };
  }
}
