import {
	InteractionResponseType,
	type APIInteractionResponse,
        type APIInteractionResponseCallbackData,
        type APIInteractionResponseChannelMessageWithSource,
        type APIInteractionResponseDeferredChannelMessageWithSource,
        type APIInteractionResponseUpdateMessage,
        type APIMessage,
        type APIMessageApplicationCommandInteraction,
        type APIModalInteractionResponse,
        type APIModalInteractionResponseCallbackData,
        type APIPrimaryEntryPointCommandInteraction,
        type APIUser,
        type APIUserApplicationCommandInteraction,
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
	followUp: (
		data: InteractionMessageData,
	) => APIInteractionResponseChannelMessageWithSource;
	editReply: (
		data?: InteractionMessageData,
	) => APIInteractionResponseUpdateMessage;
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
export type UserContextMenuInteraction =
	APIUserApplicationCommandInteraction &
		ContextMenuInteractionHelpers & {
			/** Resolved user targeted by this user context menu command. */
			targetUser?: APIUser;
		};

/**
 * Message context menu interaction with helper methods.
 */
export type MessageContextMenuInteraction =
        APIMessageApplicationCommandInteraction &
                ContextMenuInteractionHelpers & {
                        /** Resolved message targeted by this message context menu command. */
                        targetMessage?: APIMessage;
                };

/**
 * Primary entry point interaction with helper methods.
 */
export type AppCommandInteraction =
        APIPrimaryEntryPointCommandInteraction &
                ContextMenuInteractionHelpers;

function createContextMenuInteractionHelpers(): ContextMenuInteractionHelpers {
	let capturedResponse: APIInteractionResponse | null = null;

	const captureResponse = <T extends APIInteractionResponse>(
		response: T,
	): T => {
		capturedResponse = response;
		return response;
	};

	function createMessageResponse(
		type: InteractionResponseType.ChannelMessageWithSource,
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource;
	function createMessageResponse(
		type: InteractionResponseType.UpdateMessage,
		data?: InteractionMessageData,
	): APIInteractionResponseUpdateMessage;
	function createMessageResponse(
		type:
			| InteractionResponseType.ChannelMessageWithSource
			| InteractionResponseType.UpdateMessage,
		data?: InteractionMessageData,
	):
		| APIInteractionResponseChannelMessageWithSource
		| APIInteractionResponseUpdateMessage {
		const normalised = normaliseInteractionMessageData(data);

		if (type === InteractionResponseType.ChannelMessageWithSource) {
			if (!normalised) {
				throw new Error(
					"[MiniInteraction] Channel message responses require data to be provided.",
				);
			}

			return captureResponse({
				type,
				data: normalised,
			});
		}

		if (normalised) {
			return captureResponse({ type, data: normalised });
		}

		return captureResponse({ type });
	}

	const reply = (
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource =>
		createMessageResponse(
			InteractionResponseType.ChannelMessageWithSource,
			data,
		);

	const followUp = (
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource =>
		createMessageResponse(
			InteractionResponseType.ChannelMessageWithSource,
			data,
		);

	const editReply = (
		data?: InteractionMessageData,
	): APIInteractionResponseUpdateMessage =>
		createMessageResponse(InteractionResponseType.UpdateMessage, data);

	const deferReply = (
		options: DeferReplyOptions = {},
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		const flags = normaliseMessageFlags(options.flags);
		return captureResponse({
			type: InteractionResponseType.DeferredChannelMessageWithSource,
			data: flags ? { flags } : undefined,
		});
	};

	const showModal = (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	): APIModalInteractionResponse => {
		const modalData =
			typeof data === "object" && "toJSON" in data ? data.toJSON() : data;
		return captureResponse({
			type: InteractionResponseType.Modal,
			data: modalData,
		});
	};

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	return {
		getResponse,
		reply,
		followUp,
		editReply,
		deferReply,
		showModal,
	};
}

/**
 * Wraps a raw user context menu interaction with helper methods.
 *
 * @param interaction - The raw user context menu interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createUserContextMenuInteraction(
	interaction: APIUserApplicationCommandInteraction,
): UserContextMenuInteraction {
	return Object.assign(interaction, createContextMenuInteractionHelpers(), {
		targetUser: resolveTargetUser(interaction),
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
        return Object.assign(interaction, createContextMenuInteractionHelpers(), {
                targetMessage: resolveTargetMessage(interaction),
        });
}

/**
 * Wraps a raw primary entry point interaction with helper methods.
 *
 * @param interaction - The raw primary entry point interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createAppCommandInteraction(
        interaction: APIPrimaryEntryPointCommandInteraction,
): AppCommandInteraction {
        return Object.assign(interaction, createContextMenuInteractionHelpers());
}

function resolveTargetMessage(
	interaction: APIMessageApplicationCommandInteraction,
): APIMessage | undefined {
	const targetId = interaction.data?.target_id;
	if (!targetId) {
		return undefined;
	}
	return interaction.data?.resolved?.messages?.[targetId];
}

function resolveTargetUser(
	interaction: APIUserApplicationCommandInteraction,
): APIUser | undefined {
	const targetId = interaction.data?.target_id;
	if (!targetId) {
		return undefined;
	}
	return interaction.data?.resolved?.users?.[targetId];
}
