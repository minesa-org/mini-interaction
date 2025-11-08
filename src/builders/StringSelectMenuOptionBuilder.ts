import type {
	APIMessageComponentEmoji,
	APISelectMenuOption,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";

/**
 * Parses an emoji string into an APIMessageComponentEmoji object.
 * Supports:
 * - Unicode emojis: "😀"
 * - Custom emojis: "<:name:id>" or "<a:name:id>"
 * - Emoji objects: { name: "😀" } or { name: "name", id: "id" }
 */
function parseEmoji(
	emoji: string | APIMessageComponentEmoji,
): APIMessageComponentEmoji {
	if (typeof emoji === "object") {
		return emoji;
	}

	// Check for custom emoji format: <:name:id> or <a:name:id>
	const customEmojiMatch = emoji.match(/^<(a)?:([^:]+):(\d+)>$/);
	if (customEmojiMatch) {
		return {
			name: customEmojiMatch[2],
			id: customEmojiMatch[3],
			animated: customEmojiMatch[1] === "a",
		};
	}

	// Treat as unicode emoji
	return { name: emoji };
}

/** Shape describing initial string select menu option data accepted by the builder. */
export type StringSelectMenuOptionBuilderData = {
	label?: string;
	value?: string;
	description?: string;
	emoji?: string | APIMessageComponentEmoji;
	default?: boolean;
};

/** Builder for Discord string select menu option components. */
export class StringSelectMenuOptionBuilder
	implements JSONEncodable<APISelectMenuOption>
{
	private data: {
		label?: string;
		value?: string;
		description?: string;
		emoji?: APIMessageComponentEmoji;
		default?: boolean;
	};

	/**
	 * Creates a new string select menu option builder with optional seed data.
	 */
	constructor(data: StringSelectMenuOptionBuilderData = {}) {
		this.data = {
			label: data.label,
			value: data.value,
			description: data.description,
			emoji: data.emoji ? parseEmoji(data.emoji) : undefined,
			default: data.default,
		};
	}

	/**
	 * Sets the user-facing name of the option (max 100 characters).
	 */
	setLabel(label: string): this {
		this.data.label = label;
		return this;
	}

	/**
	 * Sets the dev-defined value of the option (max 100 characters).
	 */
	setValue(value: string): this {
		this.data.value = value;
		return this;
	}

	/**
	 * Sets an additional description of the option (max 100 characters).
	 */
	setDescription(description: string | null | undefined): this {
		this.data.description = description ?? undefined;
		return this;
	}

	/**
	 * Sets the emoji to display to the left of the option.
	 * Accepts:
	 * - Unicode emoji: "😀"
	 * - Custom emoji string: "<:name:id>" or "<a:name:id>"
	 * - Emoji object: { name: "😀" } or { name: "name", id: "id", animated: true }
	 */
	setEmoji(
		emoji: string | APIMessageComponentEmoji | null | undefined,
	): this {
		this.data.emoji = emoji ? parseEmoji(emoji) : undefined;
		return this;
	}

	/**
	 * Sets whether this option should be already-selected by default.
	 */
	setDefault(isDefault: boolean): this {
		this.data.default = isDefault;
		return this;
	}

	/**
	 * Serialises the builder into an API compatible select menu option payload.
	 */
	toJSON(): APISelectMenuOption {
		const { label, value } = this.data;

		if (!label) {
			throw new Error(
				"[StringSelectMenuOptionBuilder] label is required.",
			);
		}

		if (!value) {
			throw new Error(
				"[StringSelectMenuOptionBuilder] value is required.",
			);
		}

		if (label.length > 100) {
			throw new Error(
				"[StringSelectMenuOptionBuilder] label must be 100 characters or less.",
			);
		}

		if (value.length > 100) {
			throw new Error(
				"[StringSelectMenuOptionBuilder] value must be 100 characters or less.",
			);
		}

		if (this.data.description && this.data.description.length > 100) {
			throw new Error(
				"[StringSelectMenuOptionBuilder] description must be 100 characters or less.",
			);
		}

		return {
			label,
			value,
			description: this.data.description,
			emoji: this.data.emoji ? { ...this.data.emoji } : undefined,
			default: this.data.default,
		};
	}
}
