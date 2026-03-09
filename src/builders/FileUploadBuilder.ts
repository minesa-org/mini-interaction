import { ComponentType, type APIFileUploadComponent } from 'discord-api-types/v10';
import { type JSONEncodable } from './shared.js';
import { assertDefined, assertRange, assertStringLength, ValidationError } from '../types/validation.js';

export type FileUploadBuilderData = { customId?: string; minValues?: number; maxValues?: number; required?: boolean };

export class FileUploadBuilder implements JSONEncodable<APIFileUploadComponent> {
  private readonly data: FileUploadBuilderData;
  constructor(data: FileUploadBuilderData = {}) { this.data = { ...data }; }
  setCustomId(customId: string): this { this.data.customId = customId; return this; }
  setMinValues(minValues: number): this { this.data.minValues = minValues; return this; }
  setMaxValues(maxValues: number): this { this.data.maxValues = maxValues; return this; }
  setRequired(required: boolean): this { this.data.required = required; return this; }

  toJSON(): APIFileUploadComponent {
    const customId = assertDefined('FileUploadBuilder', 'custom_id', this.data.customId);
    assertStringLength('FileUploadBuilder', 'custom_id', customId, 1, 100);
    if (this.data.minValues !== undefined) assertRange('FileUploadBuilder', 'min_values', this.data.minValues, 0, 10);
    if (this.data.maxValues !== undefined) assertRange('FileUploadBuilder', 'max_values', this.data.maxValues, 1, 10);
    if (this.data.minValues !== undefined && this.data.maxValues !== undefined && this.data.minValues > this.data.maxValues) {
      throw new ValidationError('FileUploadBuilder', 'min_values', 'cannot be greater than max_values');
    }
    return { type: ComponentType.FileUpload, custom_id: customId, min_values: this.data.minValues, max_values: this.data.maxValues, required: this.data.required };
  }
}
