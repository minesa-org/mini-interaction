import type {
	APIInteractionResponseCallbackData,
	APIMessageComponent,
	MessageFlags,
} from "discord-api-types/v10";
import {
	ComponentType,
	MessageFlags as RawMessageFlags,
} from "discord-api-types/v10";

import type {
	InteractionFollowUpFlags,
	InteractionReplyFlags,
} from "../types/InteractionFlags.js";

const COMPONENTS_V2_TYPES = new Set<number>([
	ComponentType.Container,
	ComponentType.Section,
	ComponentType.TextDisplay,
	ComponentType.MediaGallery,
	ComponentType.File,
	ComponentType.Separator,
	ComponentType.Thumbnail,
]);

/** Union of helper flag enums and raw Discord message flags. */
export type MessageFlagLike =
	| MessageFlags
	| InteractionReplyFlags
	| InteractionFollowUpFlags;

/** Message payload accepted by helper reply/edit functions. */
export type InteractionMessageData = Omit<
	APIInteractionResponseCallbackData,
	"flags"
> & {
	flags?: MessageFlagLike | MessageFlagLike[];
};

/** Deferred response payload recognised by helper methods. */
export type DeferredResponseData = {
	flags: MessageFlagLike | MessageFlagLike[];
};

/** Options accepted when deferring a reply. */
export type DeferReplyOptions = {
	flags?: MessageFlagLike | MessageFlagLike[];
};

/**
 * Normalises helper flag enums into the raw Discord `MessageFlags` bitfield.
 *
 * @param flags - A flag or array of flags from helper enums or raw Discord flags.
 * @returns The value coerced to a `MessageFlags` compatible bitfield.
 */
export function normaliseMessageFlags(
	flags: MessageFlagLike | MessageFlagLike[] | undefined,
): MessageFlags | undefined {
	if (flags === undefined) {
		return undefined;
	}

	if (Array.isArray(flags)) {
		if (flags.length === 0) {
			return undefined;
		}
		// Combine multiple flags using bitwise OR
		return flags.reduce<MessageFlags>(
			(acc, flag) => (acc | (flag as MessageFlags)) as MessageFlags,
			0 as MessageFlags,
		);
	}

	return flags as MessageFlags;
}

/**
 * Ensures helper message payloads include correctly normalised message flags.
 *
 * @param data - The helper-supplied response payload.
 * @returns A payload safe to send to Discord's API.
 */
export function normaliseInteractionMessageData(
	data?: InteractionMessageData,
): APIInteractionResponseCallbackData | undefined {
	if (!data) {
		return undefined;
	}

	// Auto-convert builders to JSON
	const normalisedComponents = data.components
		? data.components.map((component) => resolveComponentLike(component))
		: undefined;

	const normalisedEmbeds = data.embeds
		? data.embeds.map((embed) => resolveComponentLike(embed))
		: undefined;

	const usesComponentsV2 = Array.isArray(normalisedComponents)
		? containsComponentsV2(normalisedComponents)
		: false;
	const normalisedFlags = normaliseMessageFlags(data.flags) as
		| MessageFlags
		| undefined;
	const finalFlags = usesComponentsV2
		? (((normalisedFlags ?? 0) |
				RawMessageFlags.IsComponentsV2) as MessageFlags)
		: normalisedFlags;

	const needsNormalisation =
		finalFlags !== data.flags ||
		normalisedComponents !== data.components ||
		normalisedEmbeds !== data.embeds;

	if (!needsNormalisation) {
		return data as APIInteractionResponseCallbackData;
	}

	const {
		flags: _flags,
		components: _components,
		embeds: _embeds,
		...rest
	} = data;

	return {
		...rest,
		...(normalisedComponents !== undefined
			? { components: normalisedComponents }
			: {}),
		...(normalisedEmbeds !== undefined ? { embeds: normalisedEmbeds } : {}),
		...(finalFlags !== undefined ? { flags: finalFlags } : {}),
	} as APIInteractionResponseCallbackData;
}

function containsComponentsV2(components: readonly unknown[]): boolean {
	return components.some((component) => componentUsesComponentsV2(component));
}

function componentUsesComponentsV2(component: unknown): boolean {
	const resolved = resolveComponentLike(component);

	if (!resolved || typeof resolved !== "object") {
		return false;
	}

	const type = (resolved as Partial<APIMessageComponent>).type;

	if (typeof type !== "number") {
		return false;
	}

	if (COMPONENTS_V2_TYPES.has(type)) {
		return true;
	}

	if (type === ComponentType.ActionRow) {
		const rowComponents = (resolved as { components?: unknown }).components;
		if (Array.isArray(rowComponents)) {
			return containsComponentsV2(rowComponents);
		}
	}

	return false;
}

function resolveComponentLike(component: unknown): unknown {
	if (component && typeof component === "object" && "toJSON" in component) {
		const encoder = component as { toJSON?: unknown };
		if (typeof encoder.toJSON === "function") {
			return encoder.toJSON();
		}
	}

	return component;
}
