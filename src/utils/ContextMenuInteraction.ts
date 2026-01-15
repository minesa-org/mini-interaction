import {
	InteractionResponseType,
	type APIInteractionResponse,
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
export type ContextMenuInteractionHelpers = {
	getResponse: () => APIInteractionResponse | null;
	reply: (
		data: InteractionMessageData,
	) => APIInteractionResponseChannelMessageWithSource;
	followUp: (
		data: InteractionMessageData,
	) => Promise<APIInteractionResponseChannelMessageWithSource>;
	editReply: (
		data?: InteractionMessageData,
	) => Promise<APIInteractionResponseUpdateMessage>;
	deferReply: (
		options?: DeferReplyOptions,
	) => APIInteractionResponseDeferredChannelMessageWithSource;
	showModal: (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	) => APIModalInteractionResponse;
	onAck?: (response: APIInteractionResponse) => void;
	sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
	canRespond?: (interactionId: string) => boolean;
	trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
};

/**
 * User context menu interaction with helper methods.
 */
export type UserContextMenuInteraction = APIUserApplicationCommandInteraction &
	ContextMenuInteractionHelpers & {
		/** Resolved user targeted by this user context menu command. */
		targetUser?: APIUser;
	};

export const UserContextMenuInteraction = {};

/**
 * Message context menu interaction with helper methods.
 */
export type MessageContextMenuInteraction = APIMessageApplicationCommandInteraction &
	ContextMenuInteractionHelpers & {
		/** Resolved message targeted by this message context menu command. */
		targetMessage?: APIMessage;
	};

export const MessageContextMenuInteraction = {};

/**
 * Primary entry point interaction with helper methods.
 */
export type AppCommandInteraction = APIPrimaryEntryPointCommandInteraction &
	ContextMenuInteractionHelpers;

export const AppCommandInteraction = {};

function createContextMenuInteractionHelpers(
	interaction:
		| APIUserApplicationCommandInteraction
		| APIMessageApplicationCommandInteraction
		| APIPrimaryEntryPointCommandInteraction,
	helpers?: {
		onAck?: (response: APIInteractionResponse) => void;
		sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
		canRespond?: (interactionId: string) => boolean;
		trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
	}
): ContextMenuInteractionHelpers {
	let capturedResponse: APIInteractionResponse | null = null;
	let isDeferred = false;
	let hasResponded = false;

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
	): APIInteractionResponseChannelMessageWithSource => {
		const response = createMessageResponse(
			InteractionResponseType.ChannelMessageWithSource,
			data,
		);
		hasResponded = true;
		helpers?.onAck?.(response);
		return response;
	};

	const followUp = async (
		data: InteractionMessageData,
	): Promise<APIInteractionResponseChannelMessageWithSource> => {
		const response = createMessageResponse(
			InteractionResponseType.ChannelMessageWithSource,
			data,
		);
		if (helpers?.sendFollowUp) {
			await helpers.sendFollowUp(interaction.token, response, '');
		}
		return response;
	};

	const editReply = async (
		data?: InteractionMessageData,
	): Promise<APIInteractionResponseUpdateMessage> => {
		const response = createMessageResponse(
			InteractionResponseType.UpdateMessage,
			data,
		);
		if (helpers?.sendFollowUp && (isDeferred || hasResponded)) {
			await helpers.sendFollowUp(interaction.token, response, '@original');
			return capturedResponse as APIInteractionResponseUpdateMessage;
		}
		hasResponded = true;
		return response;
	};

	const deferReply = (
		options: DeferReplyOptions = {},
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		const flags = normaliseMessageFlags(options.flags);
		const response = captureResponse({
			type: InteractionResponseType.DeferredChannelMessageWithSource,
			data: flags ? { flags } : undefined,
		});
		isDeferred = true;
		helpers?.onAck?.(response);
		return response;
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
			data: modalData as APIModalInteractionResponseCallbackData,
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
		onAck: helpers?.onAck,
		sendFollowUp: helpers?.sendFollowUp,
		canRespond: helpers?.canRespond,
		trackResponse: helpers?.trackResponse,
	};
}

/**
 * Wraps a raw user context menu interaction with helper methods.
 *
 * @param interaction - The raw user context menu interaction payload from Discord.
 * @param helpers - Optional callback helpers.
 * @returns A helper-augmented interaction object.
 */
export function createUserContextMenuInteraction(
	interaction: APIUserApplicationCommandInteraction,
	helpers?: {
		onAck?: (response: APIInteractionResponse) => void;
		sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
		canRespond?: (interactionId: string) => boolean;
		trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
	}
): UserContextMenuInteraction {
	return Object.assign(
		interaction,
		createContextMenuInteractionHelpers(interaction, helpers),
		{
			targetUser: resolveTargetUser(interaction),
		}
	);
}

/**
 * Wraps a raw message context menu interaction with helper methods.
 *
 * @param interaction - The raw message context menu interaction payload from Discord.
 * @param helpers - Optional callback helpers.
 * @returns A helper-augmented interaction object.
 */
export function createMessageContextMenuInteraction(
	interaction: APIMessageApplicationCommandInteraction,
	helpers?: {
		onAck?: (response: APIInteractionResponse) => void;
		sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
		canRespond?: (interactionId: string) => boolean;
		trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
	}
): MessageContextMenuInteraction {
	return Object.assign(
		interaction,
		createContextMenuInteractionHelpers(interaction, helpers),
		{
			targetMessage: resolveTargetMessage(interaction),
		}
	);
}

/**
 * Wraps a raw primary entry point interaction with helper methods.
 *
 * @param interaction - The raw primary entry point interaction payload from Discord.
 * @param helpers - Optional callback helpers.
 * @returns A helper-augmented interaction object.
 */
export function createAppCommandInteraction(
	interaction: APIPrimaryEntryPointCommandInteraction,
	helpers?: {
		onAck?: (response: APIInteractionResponse) => void;
		sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
		canRespond?: (interactionId: string) => boolean;
		trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
	}
): AppCommandInteraction {
	return Object.assign(
		interaction,
		createContextMenuInteractionHelpers(interaction, helpers)
	);
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
