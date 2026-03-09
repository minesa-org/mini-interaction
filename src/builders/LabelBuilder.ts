import { ComponentType, type APIComponentInLabel, type APILabelComponent } from 'discord-api-types/v10';
import { resolveJSONEncodable, type JSONEncodable } from './shared.js';
import { ValidationError, assertDefined, assertStringLength } from '../types/validation.js';

export type LabelComponentLike = JSONEncodable<APIComponentInLabel> | APIComponentInLabel;
export type LabelBuilderData = { label?: string; description?: string; component?: LabelComponentLike };

export class LabelBuilder implements JSONEncodable<APILabelComponent> {
  private readonly data: LabelBuilderData;
  constructor(data: LabelBuilderData = {}) { this.data = { ...data }; }
  setLabel(label: string): this { this.data.label = label; return this; }
  setDescription(description: string): this { this.data.description = description; return this; }
  setComponent(component: LabelComponentLike): this { this.data.component = component; return this; }

  toJSON(): APILabelComponent {
    const label = assertDefined('LabelBuilder', 'label', this.data.label);
    const component = assertDefined('LabelBuilder', 'component', this.data.component);
    assertStringLength('LabelBuilder', 'label', label, 1, 45);
    if (this.data.description) assertStringLength('LabelBuilder', 'description', this.data.description, 1, 100);

    const resolved = resolveJSONEncodable(component);
    if (!('type' in resolved)) throw new ValidationError('LabelBuilder', 'component', 'must contain a valid component payload');

    return { type: ComponentType.Label, label, description: this.data.description, component: resolved };
  }
}
