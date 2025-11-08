import {
	ComponentType,
	SelectMenuDefaultValueType,
	type APIMentionableSelectComponent,
	type APISelectMenuDefaultValue,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial modal mentionable select menu data accepted by the builder. */
export type ModalMentionableSelectMenuBuilderData = {
	customId?: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
	required?: boolean;
	defaultValues?: (
		| APISelectMenuDefaultValue<SelectMenuDefaultValueType.User>
		| APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>
	)[];
};

/** Builder for Discord mentionable select menu components in modals. */
export class ModalMentionableSelectMenuBuilder
	implements JSONEncodable<APIMentionableSelectComponent>
{
	private data: ModalMentionableSelectMenuBuilderData;

	/**
	 * Creates a new modal mentionable select menu builder with optional seed data.
	 */
	constructor(data: ModalMentionableSelectMenuBuilderData = {}) {
		this.data = {
			customId: data.customId,
			placeholder: data.placeholder,
			minValues: data.minValues,
			maxValues: data.maxValues,
			disabled: data.disabled,
			required: data.required,
			defaultValues: data.defaultValues
				? [...data.defaultValues]
				: undefined,
		};
	}

	/**
	 * Sets the unique custom identifier for the select menu interaction.
	 */
	setCustomId(customId: string): this {
		this.data.customId = customId;
		return this;
	}

	/**
	 * Sets or clears the placeholder text displayed when no mentionable is selected.
	 */
	setPlaceholder(placeholder: string | null | undefined): this {
		this.data.placeholder = placeholder ?? undefined;
		return this;
	}

	/**
	 * Sets the minimum number of mentionables that must be selected.
	 */
	setMinValues(minValues: number | null | undefined): this {
		this.data.minValues = minValues ?? undefined;
		return this;
	}

	/**
	 * Sets the maximum number of mentionables that can be selected.
	 */
	setMaxValues(maxValues: number | null | undefined): this {
		this.data.maxValues = maxValues ?? undefined;
		return this;
	}

	/**
	 * Toggles whether the select menu is disabled.
	 */
	setDisabled(disabled: boolean): this {
		this.data.disabled = disabled;
		return this;
	}

	/**
	 * Marks the select menu as required in the modal.
	 */
	setRequired(required: boolean): this {
		this.data.required = required;
		return this;
	}

	/**
	 * Replaces the default mentionable selections displayed when the menu renders.
	 */
	setDefaultValues(
		defaultValues: Iterable<
			| APISelectMenuDefaultValue<SelectMenuDefaultValueType.User>
			| APISelectMenuDefaultValue<SelectMenuDefaultValueType.Role>
		>,
	): this {
		this.data.defaultValues = Array.from(defaultValues);
		return this;
	}

	/**
	 * Serialises the builder into an API compatible mentionable select menu payload.
	 */
	toJSON(): APIMentionableSelectComponent {
		const { customId } = this.data;
		if (!customId) {
			throw new Error(
				"[ModalMentionableSelectMenuBuilder] custom id is required.",
			);
		}

		return {
			type: ComponentType.MentionableSelect,
			custom_id: customId,
			placeholder: this.data.placeholder,
			min_values: this.data.minValues,
			max_values: this.data.maxValues,
			disabled: this.data.disabled,
			required: this.data.required,
			default_values: this.data.defaultValues,
		};
	}
}
