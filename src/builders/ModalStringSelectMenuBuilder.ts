import {
	ComponentType,
	type APISelectMenuOption,
	type APIStringSelectComponent,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial modal string select menu data accepted by the builder. */
export type ModalStringSelectMenuBuilderData = {
	customId?: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
	required?: boolean;
	options?: APISelectMenuOption[];
};

/** Builder for Discord string select menu components in modals. */
export class ModalStringSelectMenuBuilder
	implements JSONEncodable<APIStringSelectComponent>
{
	private data: Required<Pick<ModalStringSelectMenuBuilderData, "options">> &
		Omit<ModalStringSelectMenuBuilderData, "options">;

	/**
	 * Creates a new modal string select menu builder with optional seed data.
	 */
	constructor(data: ModalStringSelectMenuBuilderData = {}) {
		this.data = {
			customId: data.customId,
			placeholder: data.placeholder,
			minValues: data.minValues,
			maxValues: data.maxValues,
			disabled: data.disabled,
			required: data.required,
			options: data.options ? [...data.options] : [],
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
	 * Sets or clears the placeholder text displayed when no option is selected.
	 */
	setPlaceholder(placeholder: string | null | undefined): this {
		this.data.placeholder = placeholder ?? undefined;
		return this;
	}

	/**
	 * Sets the minimum number of options that must be selected.
	 */
	setMinValues(minValues: number | null | undefined): this {
		this.data.minValues = minValues ?? undefined;
		return this;
	}

	/**
	 * Sets the maximum number of options that can be selected.
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
	 * Adds an option to the select menu.
	 */
	addOption(option: APISelectMenuOption): this {
		this.data.options.push(option);
		return this;
	}

	/**
	 * Replaces all options in the select menu.
	 */
	setOptions(options: Iterable<APISelectMenuOption>): this {
		this.data.options = Array.from(options);
		return this;
	}

	/**
	 * Serialises the builder into an API compatible string select menu payload.
	 */
	toJSON(): APIStringSelectComponent {
		const { customId } = this.data;
		if (!customId) {
			throw new Error("[ModalStringSelectMenuBuilder] custom id is required.");
		}

		return {
			type: ComponentType.StringSelect,
			custom_id: customId,
			placeholder: this.data.placeholder,
			min_values: this.data.minValues,
			max_values: this.data.maxValues,
			disabled: this.data.disabled,
			required: this.data.required,
			options: this.data.options,
		};
	}
}

