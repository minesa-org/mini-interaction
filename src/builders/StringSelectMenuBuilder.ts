import {
	ComponentType,
	type APISelectMenuOption,
	type APIStringSelectComponent,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/** Shape describing initial string select menu data accepted by the builder. */
export type StringSelectMenuBuilderData = {
	customId?: string;
	placeholder?: string;
	minValues?: number;
	maxValues?: number;
	disabled?: boolean;
	required?: boolean;
	options?: APISelectMenuOption[];
};

/** Builder for Discord string select menu components. */
export class StringSelectMenuBuilder
	implements JSONEncodable<APIStringSelectComponent>
{
	private data: Required<Pick<StringSelectMenuBuilderData, "options">> &
		Omit<StringSelectMenuBuilderData, "options">;

	/**
	 * Creates a new string select menu builder with optional seed data.
	 */
	constructor(data: StringSelectMenuBuilderData = {}) {
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
	 * Marks the select menu options as required.
	 */
	setRequired(required: boolean): this {
		this.data.required = required;
		return this;
	}

	/**
	 * Appends new option entries to the select menu.
	 */
	addOptions(...options: APISelectMenuOption[]): this {
		this.data.options.push(...options.map((option) => ({ ...option })));
		return this;
	}

	/**
	 * Replaces the current option set with the provided iterable.
	 */
	setOptions(options: Iterable<APISelectMenuOption>): this {
		this.data.options = Array.from(options, (option) => ({ ...option }));
		return this;
	}

	/**
	 * Serialises the builder into an API compatible string select menu payload.
	 */
	toJSON(): APIStringSelectComponent {
		const { customId, options } = this.data;
		if (!customId) {
			throw new Error("[StringSelectMenuBuilder] custom id is required.");
		}

		if (options.length === 0) {
			throw new Error(
				"[StringSelectMenuBuilder] at least one option is required.",
			);
		}

		if (options.length > 25) {
			throw new Error(
				"[StringSelectMenuBuilder] no more than 25 options can be provided.",
			);
		}

		return {
			type: ComponentType.StringSelect,
			custom_id: customId,
			placeholder: this.data.placeholder,
			min_values: this.data.minValues,
			max_values: this.data.maxValues,
			disabled: this.data.disabled,
			required: this.data.required,
			options: options.map((option) => ({ ...option })),
		};
	}
}
