import { ComponentType, SelectMenuDefaultValueType, type APIRoleSelectComponent, type APISelectMenuDefaultValue } from 'discord-api-types/v10';
import type { JSONEncodable } from './shared.js';
import { assertDefined, assertRange, assertStringLength, ValidationError } from '../types/validation.js';

export type ModalRoleSelectMenuBuilderData = { customId?: string; placeholder?: string; minValues?: number; maxValues?: number; disabled?: boolean; required?: boolean; defaultValues?: APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>[] };

export class ModalRoleSelectMenuBuilder implements JSONEncodable<APIRoleSelectComponent> {
  private readonly data: ModalRoleSelectMenuBuilderData;
  constructor(data: ModalRoleSelectMenuBuilderData = {}) { this.data = { ...data }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setPlaceholder(placeholder?: string): this { this.data.placeholder = placeholder; return this; }
  setMinValues(minValues?: number): this { this.data.minValues = minValues; return this; }
  setMaxValues(maxValues?: number): this { this.data.maxValues = maxValues; return this; }
  setDisabled(disabled: boolean): this { this.data.disabled = disabled; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setDefaultValues(defaultValues: Iterable<APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>>): this {
    this.data.defaultValues = Array.from(defaultValues, (v) => ({ ...v, type: SelectMenuDefaultValueType.Role }));
    return this;
  }
  toJSON(): APIRoleSelectComponent {
    const customId = assertDefined('ModalRoleSelectMenuBuilder', 'custom_id', this.data.customId);
    assertStringLength('ModalRoleSelectMenuBuilder', 'custom_id', customId, 1, 100);
    if (this.data.placeholder) assertStringLength('ModalRoleSelectMenuBuilder', 'placeholder', this.data.placeholder, 1, 150);
    if (this.data.minValues !== undefined) assertRange('ModalRoleSelectMenuBuilder', 'min_values', this.data.minValues, 0, 25);
    if (this.data.maxValues !== undefined) assertRange('ModalRoleSelectMenuBuilder', 'max_values', this.data.maxValues, 1, 25);
    if (this.data.minValues !== undefined && this.data.maxValues !== undefined && this.data.minValues > this.data.maxValues) throw new ValidationError('ModalRoleSelectMenuBuilder', 'min_values', 'cannot exceed max_values');
    return { type: ComponentType.RoleSelect, custom_id: customId, placeholder: this.data.placeholder, min_values: this.data.minValues, max_values: this.data.maxValues, disabled: this.data.disabled, required: this.data.required, default_values: this.data.defaultValues };
  }
}
