import {
	ComponentType,
	type APILabelComponent,
	type APIComponentInLabel,
} from "discord-api-types/v10";

import type { JSONEncodable } from "./shared.js";
import { resolveJSONEncodable } from "./shared.js";

/** Values accepted when composing label components. */
export type LabelComponentLike =
	| JSONEncodable<APIComponentInLabel>
	| APIComponentInLabel;

/** Shape describing initial label data accepted by the builder. */
export type LabelBuilderData = {
	label?: string;
	description?: string;
	component?: LabelComponentLike;
};

/** Builder for Discord label components used in modals. */
export class LabelBuilder implements JSONEncodable<APILabelComponent> {
	private data: LabelBuilderData;

	/**
	 * Creates a new label builder with optional seed data.
	 */
	constructor(data: LabelBuilderData = {}) {
		this.data = {
			label: data.label,
			description: data.description,
			component: data.component,
		};
	}

	/**
	 * Sets the label text (max 45 characters).
	 */
	setLabel(label: string): this {
		this.data.label = label;
		return this;
	}

	/**
	 * Sets the optional description text (max 100 characters).
	 */
	setDescription(description: string): this {
		this.data.description = description;
		return this;
	}

	/**
	 * Sets the component within the label.
	 * Can be a TextInput, SelectMenu, or FileUpload component.
	 */
	setComponent(component: LabelComponentLike): this {
		this.data.component = component;
		return this;
	}

	/**
	 * Serialises the builder into an API compatible label component payload.
	 */
	toJSON(): APILabelComponent {
		if (!this.data.label) {
			throw new Error("[LabelBuilder] label is required.");
		}

		if (!this.data.component) {
			throw new Error("[LabelBuilder] component is required.");
		}

		return {
			type: ComponentType.Label,
			label: this.data.label,
			description: this.data.description,
			component: resolveJSONEncodable(this.data.component),
		};
	}
}

