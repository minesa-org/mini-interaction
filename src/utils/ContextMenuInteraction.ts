import {
	InteractionResponseType,
	type APIInteractionResponse,
	type APIInteractionResponseCallbackData,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIMessageApplicationCommandInteraction,
	type APIModalInteractionResponse,
	type APIModalInteractionResponseCallbackData,
	type APIUserApplicationCommandInteraction,
	type MessageFlags,
} from "discord-api-types/v10";

import {
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";

/**
 * Base helper methods for context menu interactions.
 */
type ContextMenuInteractionHelpers = {
	getResponse: () => APIInteractionResponse | null;
	reply: (
		data: InteractionMessageData,
	) => APIInteractionResponseChannelMessageWithSource;
	deferReply: (
		options?: DeferReplyOptions,
	) => APIInteractionResponseDeferredChannelMessageWithSource;
	showModal: (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	) => APIModalInteractionResponse;
};

/**
 * User context menu interaction with helper methods.
 */
export type UserContextMenuInteraction = APIUserApplicationCommandInteraction &
	ContextMenuInteractionHelpers;

/**
 * Message context menu interaction with helper methods.
 */
export type MessageContextMenuInteraction =
	APIMessageApplicationCommandInteraction & ContextMenuInteractionHelpers;

/**
 * Wraps a raw user context menu interaction with helper methods.
 *
 * @param interaction - The raw user context menu interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createUserContextMenuInteraction(
	interaction: APIUserApplicationCommandInteraction,
): UserContextMenuInteraction {
	let capturedResponse: APIInteractionResponse | null = null;

	const reply = (
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource => {
		const normalised = normaliseInteractionMessageData(data);
		if (!normalised) {
			throw new Error(
				"[MiniInteraction] Channel message responses require data to be provided.",
			);
		}
		const response: APIInteractionResponseChannelMessageWithSource = {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: normalised,
		};
		capturedResponse = response;
		return response;
	};

	const deferReply = (
		options: DeferReplyOptions = {},
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		const flags = normaliseMessageFlags(options.flags);
		const response: APIInteractionResponseDeferredChannelMessageWithSource =
			{
				type: InteractionResponseType.DeferredChannelMessageWithSource,
				data: flags ? { flags } : undefined,
			};
		capturedResponse = response;
		return response;
	};

	const showModal = (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	): APIModalInteractionResponse => {
		const modalData =
			typeof data === "object" && "toJSON" in data ? data.toJSON() : data;
		const response: APIModalInteractionResponse = {
			type: InteractionResponseType.Modal,
			data: modalData,
		};
		capturedResponse = response;
		return response;
	};

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	return Object.assign(interaction, {
		reply,
		deferReply,
		showModal,
		getResponse,
	});
}

/**
 * Wraps a raw message context menu interaction with helper methods.
 *
 * @param interaction - The raw message context menu interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createMessageContextMenuInteraction(
	interaction: APIMessageApplicationCommandInteraction,
): MessageContextMenuInteraction {
	let capturedResponse: APIInteractionResponse | null = null;

	const reply = (
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource => {
		const normalised = normaliseInteractionMessageData(data);
		if (!normalised) {
			throw new Error(
				"[MiniInteraction] Channel message responses require data to be provided.",
			);
		}
		const response: APIInteractionResponseChannelMessageWithSource = {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: normalised,
		};
		capturedResponse = response;
		return response;
	};

	const deferReply = (
		options: DeferReplyOptions = {},
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		const flags = normaliseMessageFlags(options.flags);
		const response: APIInteractionResponseDeferredChannelMessageWithSource =
			{
				type: InteractionResponseType.DeferredChannelMessageWithSource,
				data: flags ? { flags } : undefined,
			};
		capturedResponse = response;
		return response;
	};

	const showModal = (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	): APIModalInteractionResponse => {
		const modalData =
			typeof data === "object" && "toJSON" in data ? data.toJSON() : data;
		const response: APIModalInteractionResponse = {
			type: InteractionResponseType.Modal,
			data: modalData,
		};
		capturedResponse = response;
		return response;
	};

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	return Object.assign(interaction, {
		reply,
		deferReply,
		showModal,
		getResponse,
	});
}
