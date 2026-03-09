import type { JSONEncodable } from './shared.js';
import { APIRadioComponent, APIRadioOption, RADIO_COMPONENT_TYPE } from '../types/radio.js';
import { assertDefined, assertStringLength, ValidationError } from '../types/validation.js';

export type RadioBuilderData = { customId?: string; required?: boolean; disabled?: boolean; options?: APIRadioOption[] };

export class RadioBuilder implements JSONEncodable<APIRadioComponent> {
  private readonly data: RadioBuilderData;
  constructor(data: RadioBuilderData = {}) { this.data = { ...data, options: data.options ? [...data.options] : [] }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }
  setDisabled(disabled: boolean): this { this.data.disabled = disabled; return this; }
  addOptions(...options: APIRadioOption[]): this { this.data.options = [...(this.data.options ?? []), ...options]; return this; }

  toJSON(): APIRadioComponent {
    const customId = assertDefined('RadioBuilder', 'custom_id', this.data.customId);
    assertStringLength('RadioBuilder', 'custom_id', customId, 1, 100);

    const options = [...(this.data.options ?? [])];
    if (options.length === 0 || options.length > 25) throw new ValidationError('RadioBuilder', 'options', 'must contain 1-25 options');

    let defaults = 0;
    for (const [index, option] of options.entries()) {
      assertStringLength('RadioBuilder', `options[${index}].label`, option.label, 1, 100);
      assertStringLength('RadioBuilder', `options[${index}].value`, option.value, 1, 100);
      if (option.description) assertStringLength('RadioBuilder', `options[${index}].description`, option.description, 1, 100);
      if (option.default) defaults += 1;
    }
    if (defaults > 1) throw new ValidationError('RadioBuilder', 'options.default', 'radio supports only one default option');

    return { type: RADIO_COMPONENT_TYPE, custom_id: customId, disabled: this.data.disabled, required: this.data.required, options };
  }
}
