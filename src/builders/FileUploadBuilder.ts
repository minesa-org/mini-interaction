import {
	ComponentType,
	type APIFileUploadComponent,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial file upload data accepted by the builder. */
export type FileUploadBuilderData = {
	customId?: string;
	minValues?: number;
	maxValues?: number;
	required?: boolean;
};

/** Builder for Discord file upload components used in modals. */
export class FileUploadBuilder
	implements JSONEncodable<APIFileUploadComponent>
{
	private data: FileUploadBuilderData;

	/**
	 * Creates a new file upload builder with optional seed data.
	 */
	constructor(data: FileUploadBuilderData = {}) {
		this.data = {
			customId: data.customId,
			minValues: data.minValues,
			maxValues: data.maxValues,
			required: data.required,
		};
	}

	/**
	 * Sets the custom identifier for this file upload component.
	 */
	setCustomId(customId: string): this {
		this.data.customId = customId;
		return this;
	}

	/**
	 * Sets the minimum number of files that must be uploaded (min 0, max 10).
	 */
	setMinValues(minValues: number): this {
		this.data.minValues = minValues;
		return this;
	}

	/**
	 * Sets the maximum number of files that can be uploaded (max 10).
	 */
	setMaxValues(maxValues: number): this {
		this.data.maxValues = maxValues;
		return this;
	}

	/**
	 * Sets whether files are required before submitting the modal.
	 */
	setRequired(required: boolean): this {
		this.data.required = required;
		return this;
	}

	/**
	 * Serialises the builder into an API compatible file upload component payload.
	 */
	toJSON(): APIFileUploadComponent {
		if (!this.data.customId) {
			throw new Error("[FileUploadBuilder] custom_id is required.");
		}

		return {
			type: ComponentType.FileUpload,
			custom_id: this.data.customId,
			min_values: this.data.minValues,
			max_values: this.data.maxValues,
			required: this.data.required,
		};
	}
}

