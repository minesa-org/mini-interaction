import type { JSONEncodable } from './shared.js';
import { APICheckboxComponent, APICheckboxOption, CHECKBOX_COMPONENT_TYPE } from '../types/checkbox.js';
import { assertDefined, assertStringLength, ValidationError } from '../types/validation.js';

export type CheckboxBuilderData = { customId?: string; required?: boolean; disabled?: boolean; options?: APICheckboxOption[] };

export class CheckboxBuilder implements JSONEncodable<APICheckboxComponent> {
  private readonly data: CheckboxBuilderData;
  constructor(data: CheckboxBuilderData = {}) { this.data = { ...data, options: data.options ? [...data.options] : [] }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setDisabled(disabled: boolean): this { this.data.disabled = disabled; return this; }
  addOptions(...options: APICheckboxOption[]): this { this.data.options = [...(this.data.options ?? []), ...options]; return this; }

  toJSON(): APICheckboxComponent {
    const customId = assertDefined('CheckboxBuilder', 'custom_id', this.data.customId);
    assertStringLength('CheckboxBuilder', 'custom_id', customId, 1, 100);

    const options = [...(this.data.options ?? [])];
    if (options.length === 0 || options.length > 25) throw new ValidationError('CheckboxBuilder', 'options', 'must contain 1-25 options');

    for (const [index, option] of options.entries()) {
      assertStringLength('CheckboxBuilder', `options[${index}].label`, option.label, 1, 100);
      assertStringLength('CheckboxBuilder', `options[${index}].value`, option.value, 1, 100);
      if (option.description) assertStringLength('CheckboxBuilder', `options[${index}].description`, option.description, 1, 100);
    }

    return { type: CHECKBOX_COMPONENT_TYPE, custom_id: customId, disabled: this.data.disabled, required: this.data.required, options };
  }
}
