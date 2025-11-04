import {
	ComponentType,
	type APIButtonComponent,
	type APIMessageComponentEmoji,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";
import { ButtonStyle } from "../types/ButtonStyle.js";

/** Shape describing initial button data accepted by the builder. */
export type ButtonBuilderData = {
	style?: ButtonStyle;
	label?: string;
	emoji?: APIMessageComponentEmoji;
	customId?: string;
	url?: string;
	disabled?: boolean;
	skuId?: string;
};

/** Builder for Discord button components. */
export class ButtonBuilder implements JSONEncodable<APIButtonComponent> {
	private data: Required<Pick<ButtonBuilderData, "style">> &
		Omit<ButtonBuilderData, "style">;

	/**
	 * Creates a new button builder with optional seed data.
	 */
	constructor(data: ButtonBuilderData = {}) {
		this.data = {
			style: data.style ?? ButtonStyle.Secondary,
			label: data.label,
			emoji: data.emoji ? { ...data.emoji } : undefined,
			customId: data.customId,
			url: data.url,
			disabled: data.disabled,
			skuId: data.skuId,
		};
	}

	/**
	 * Sets the visual style of the button.
	 */
	setStyle(style: ButtonStyle): this {
		this.data.style = style;
		return this;
	}

	/**
	 * Sets or clears the button label text.
	 */
	setLabel(label: string | null | undefined): this {
		this.data.label = label ?? undefined;
		return this;
	}

	/**
	 * Sets or clears the emoji displayed on the button.
	 */
	setEmoji(emoji: APIMessageComponentEmoji | null | undefined): this {
		this.data.emoji = emoji ? { ...emoji } : undefined;
		return this;
	}

	/**
	 * Configures the button as an interaction component with the provided custom identifier.
	 */
	setCustomId(customId: string): this {
		this.data.customId = customId;
		if (this.data.style === ButtonStyle.Link) {
			this.data.style = ButtonStyle.Secondary;
		}

		this.data.url = undefined;
		this.data.skuId = undefined;
		return this;
	}

	/**
	 * Configures the button as a link button.
	 */
	setURL(url: string): this {
		this.data.url = url;
		this.data.customId = undefined;
		this.data.skuId = undefined;
		this.data.style = ButtonStyle.Link;
		return this;
	}

	/**
	 * Configures the button as a premium purchase button.
	 */
	setSKUId(skuId: string): this {
		this.data.skuId = skuId;
		this.data.customId = undefined;
		this.data.url = undefined;
		this.data.style = ButtonStyle.Premium;
		return this;
	}

	/**
	 * Toggles whether the button is disabled.
	 */
	setDisabled(disabled: boolean): this {
		this.data.disabled = disabled;
		return this;
	}

	/**
	 * Serialises the builder into an API compatible button payload.
	 */
	toJSON(): APIButtonComponent {
		const { style, label, emoji, disabled } = this.data;

		if (style === ButtonStyle.Link) {
			const url = this.data.url;
			if (!url) {
				throw new Error(
					"[ButtonBuilder] Link buttons must have a URL.",
				);
			}

			return {
				type: ComponentType.Button,
				style,
				label,
				emoji: emoji ? { ...emoji } : undefined,
				disabled,
				url,
			};
		}

		if (style === ButtonStyle.Premium) {
			const skuId = this.data.skuId;
			if (!skuId) {
				throw new Error(
					"[ButtonBuilder] Premium buttons must have an SKU id.",
				);
			}

			return {
				type: ComponentType.Button,
				style,
				disabled,
				sku_id: skuId,
			};
		}

		const customId = this.data.customId;
		if (!customId) {
			throw new Error(
				"[ButtonBuilder] Non-link buttons must have a custom id.",
			);
		}

		return {
			type: ComponentType.Button,
			style,
			label,
			emoji: emoji ? { ...emoji } : undefined,
			disabled,
			custom_id: customId,
		};
	}
}
