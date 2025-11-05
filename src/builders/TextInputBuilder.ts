import {
	ComponentType,
	TextInputStyle,
	type APITextInputComponent,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial text input data accepted by the builder. */
export type TextInputBuilderData = {
	customId?: string;
	label?: string;
	style?: TextInputStyle;
	minLength?: number;
	maxLength?: number;
	required?: boolean;
	value?: string;
	placeholder?: string;
};

/** Builder for Discord text input components used in modals. */
export class TextInputBuilder
	implements JSONEncodable<APITextInputComponent>
{
	private data: TextInputBuilderData;

	/**
	 * Creates a new text input builder with optional seed data.
	 */
	constructor(data: TextInputBuilderData = {}) {
		this.data = {
			customId: data.customId,
			label: data.label,
			style: data.style ?? TextInputStyle.Short,
			minLength: data.minLength,
			maxLength: data.maxLength,
			required: data.required,
			value: data.value,
			placeholder: data.placeholder,
		};
	}

	/**
	 * Sets the custom identifier for this text input.
	 */
	setCustomId(customId: string): this {
		this.data.customId = customId;
		return this;
	}

	/**
	 * Sets the label displayed above the text input.
	 */
	setLabel(label: string): this {
		this.data.label = label;
		return this;
	}

	/**
	 * Sets the style of the text input (Short or Paragraph).
	 */
	setStyle(style: TextInputStyle): this {
		this.data.style = style;
		return this;
	}

	/**
	 * Sets the minimum length of the input text.
	 */
	setMinLength(minLength: number): this {
		this.data.minLength = minLength;
		return this;
	}

	/**
	 * Sets the maximum length of the input text.
	 */
	setMaxLength(maxLength: number): this {
		this.data.maxLength = maxLength;
		return this;
	}

	/**
	 * Sets whether this text input is required.
	 */
	setRequired(required: boolean): this {
		this.data.required = required;
		return this;
	}

	/**
	 * Sets the pre-filled value for this text input.
	 */
	setValue(value: string): this {
		this.data.value = value;
		return this;
	}

	/**
	 * Sets the placeholder text shown when the input is empty.
	 */
	setPlaceholder(placeholder: string): this {
		this.data.placeholder = placeholder;
		return this;
	}

	/**
	 * Serialises the builder into an API compatible text input payload.
	 */
	toJSON(): APITextInputComponent {
		if (!this.data.customId) {
			throw new Error("[TextInputBuilder] custom_id is required.");
		}

		if (!this.data.label) {
			throw new Error("[TextInputBuilder] label is required.");
		}

		return {
			type: ComponentType.TextInput,
			custom_id: this.data.customId,
			label: this.data.label,
			style: this.data.style ?? TextInputStyle.Short,
			min_length: this.data.minLength,
			max_length: this.data.maxLength,
			required: this.data.required,
			value: this.data.value,
			placeholder: this.data.placeholder,
		};
	}
}

