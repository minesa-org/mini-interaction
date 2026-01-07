import { ComponentType } from "discord-api-types/v10";
import type { APIActionRowComponent } from "discord-api-types/v10";

import { resolveJSONEncodable } from "./shared.js";
import type { JSONEncodable } from "./shared.js";
import type { ActionRowComponent } from "../types/ComponentTypes.js";

/** Values accepted when composing component action rows. */
export type ActionRowComponentLike<T extends ActionRowComponent> =
	| JSONEncodable<T>
	| T;

/** Builder for creating Action Row components. */
export class ActionRowBuilder<T extends ActionRowComponent>
	implements JSONEncodable<APIActionRowComponent<T>>
{
	private components: T[] = [];

	constructor(data: Partial<APIActionRowComponent<T>> = {}) {
		this.components = [...(data.components ?? [])];
	}

	/**
	 * Adds components to this action row.
	 *
	 * @param components - The components to add (can be builders or raw objects).
	 */
	public addComponents(
		...components: (T | JSONEncodable<T>)[]
	): this {
		this.components.push(
			...components.map((c) => resolveJSONEncodable(c)),
		);
		return this;
	}

	/**
	 * Sets the components for this action row, replacing any existing ones.
	 *
	 * @param components - The new components to set.
	 */
	public setComponents(
		...components: (T | JSONEncodable<T>)[]
	): this {
		this.components = components.map((c) => resolveJSONEncodable(c));
		return this;
	}

	public toJSON(): APIActionRowComponent<T> {
		return {
			type: ComponentType.ActionRow,
			components: [...this.components],
		};
	}
}
