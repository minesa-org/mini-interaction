import type {
	APIModalInteractionResponseCallbackComponent,
	APIModalInteractionResponseCallbackData,
} from "discord-api-types/v10";

import { resolveJSONEncodable } from "./shared.js";
import type { JSONEncodable } from "./shared.js";

/** Values accepted when composing modal component rows. */
export type ModalComponentLike =
	| JSONEncodable<APIModalInteractionResponseCallbackComponent>
	| APIModalInteractionResponseCallbackComponent;

/** Shape describing initial modal data accepted by the builder. */
export type ModalBuilderData = {
	customId?: string;
	title?: string;
	components?: Iterable<ModalComponentLike>;
};

/** Builder for Discord modal interaction responses. */
export class ModalBuilder
	implements JSONEncodable<APIModalInteractionResponseCallbackData>
{
	private customId?: string;
	private title?: string;
	private components: ModalComponentLike[];

	/**
	 * Creates a new modal builder with optional seed data.
	 */
	constructor(data: ModalBuilderData = {}) {
		this.customId = data.customId;
		this.title = data.title;
		this.components = data.components ? Array.from(data.components) : [];
	}

	/**
	 * Sets the custom identifier returned when the modal is submitted.
	 */
	setCustomId(customId: string): this {
		this.customId = customId;
		return this;
	}

	/**
	 * Sets the modal title displayed to users.
	 */
	setTitle(title: string): this {
		this.title = title;
		return this;
	}

	/**
	 * Appends component rows to the modal body.
	 */
	addComponents(...components: ModalComponentLike[]): this {
		this.components.push(...components);
		return this;
	}

	/**
	 * Replaces all component rows for the modal.
	 */
	setComponents(components: Iterable<ModalComponentLike>): this {
		this.components = Array.from(components);
		return this;
	}

	/**
	 * Serialises the builder into an API compatible modal response payload.
	 */
	toJSON(): APIModalInteractionResponseCallbackData {
		if (!this.customId) {
			throw new Error("[ModalBuilder] custom id is required.");
		}

		if (!this.title) {
			throw new Error("[ModalBuilder] title is required.");
		}

		if (this.components.length === 0) {
			throw new Error(
				"[ModalBuilder] at least one component is required.",
			);
		}

		if (this.components.length > 5) {
			throw new Error(
				"[ModalBuilder] no more than 5 components can be provided.",
			);
		}

		return {
			custom_id: this.customId,
			title: this.title,
			components: this.components.map((component) =>
				resolveJSONEncodable(component),
			),
		};
	}
}
