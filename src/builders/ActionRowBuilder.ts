import { ComponentType } from "discord-api-types/v10";
import type { APIActionRowComponent } from "discord-api-types/v10";

import { resolveJSONEncodable } from "./shared.js";
import type { JSONEncodable } from "./shared.js";
import type { MiniComponentActionRow } from "../types/ComponentTypes.js";

/** Values accepted when composing component action rows. */
export type ActionRowComponentLike<T extends MiniComponentActionRow> =
	| JSONEncodable<T>
	| T;

/** Builder for Discord action row components. */
export class ActionRowBuilder<
	T extends MiniComponentActionRow = MiniComponentActionRow,
> implements JSONEncodable<APIActionRowComponent<T>>
{
	private components: ActionRowComponentLike<T>[];

	/**
	 * Creates a new action row builder with optional seed components.
	 */
	constructor(components: Iterable<ActionRowComponentLike<T>> = []) {
		this.components = Array.from(components);
	}

	/**
	 * Appends additional components to the action row.
	 */
	addComponents(...components: ActionRowComponentLike<T>[]): this {
		this.components.push(...components);
		return this;
	}

	/**
	 * Replaces the current action row contents.
	 */
	setComponents(components: Iterable<ActionRowComponentLike<T>>): this {
		this.components = Array.from(components);
		return this;
	}

	/**
	 * Serialises the builder into an API compatible action row payload.
	 */
	toJSON(): APIActionRowComponent<T> {
		return {
			type: ComponentType.ActionRow,
			components: this.components.map((component) =>
				resolveJSONEncodable(component),
			),
		};
	}
}
