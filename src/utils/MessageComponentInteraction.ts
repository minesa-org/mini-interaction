import {
	InteractionResponseType,
	type APIInteractionResponse,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIInteractionResponseDeferredMessageUpdate,
	type APIInteractionResponseUpdateMessage,
	type APIMessageComponentInteraction,
	type APIModalInteractionResponse,
	type APIModalInteractionResponseCallbackData,
} from "discord-api-types/v10";

import {
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";

/**
 * Represents a component interaction augmented with helper response methods.
 *
 * Note: The `values` property is available on select menu interactions (data.values).
 * For button interactions, this property will be undefined.
 */
export type MessageComponentInteraction = APIMessageComponentInteraction & {
	getResponse: () => APIInteractionResponse | null;
	reply: (
		data: InteractionMessageData,
	) => APIInteractionResponseChannelMessageWithSource;
	deferReply: (
		options?: DeferReplyOptions,
	) => APIInteractionResponseDeferredChannelMessageWithSource;
	update: (
		data?: InteractionMessageData,
	) => APIInteractionResponseUpdateMessage;
	deferUpdate: () => APIInteractionResponseDeferredMessageUpdate;
	showModal: (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	) => APIModalInteractionResponse;
	/**
	 * The selected values from a select menu interaction.
	 * This property is only present for select menu interactions.
	 * For button interactions, this will be undefined.
	 */
	values?: string[];
};

/**
 * Wraps a raw component interaction with helper methods mirroring Discord's expected responses.
 *
 * @param interaction - The raw interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createMessageComponentInteraction(
	interaction: APIMessageComponentInteraction,
): MessageComponentInteraction {
	let capturedResponse: APIInteractionResponse | null = null;

	const captureResponse = <T extends APIInteractionResponse>(
		response: T,
	): T => {
		capturedResponse = response;
		return response;
	};

	const reply = (
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource => {
		const normalisedData = normaliseInteractionMessageData(data);
		if (!normalisedData) {
			throw new Error(
				"[MiniInteraction] Component replies require response data to be provided.",
			);
		}

		return captureResponse({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: normalisedData,
		} satisfies APIInteractionResponseChannelMessageWithSource);
	};

	const deferReply = (
		options?: DeferReplyOptions,
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		const flags = normaliseMessageFlags(options?.flags);

		const response: APIInteractionResponseDeferredChannelMessageWithSource =
			flags !== undefined
				? {
						type: InteractionResponseType.DeferredChannelMessageWithSource,
						data: { flags },
				  }
				: {
						type: InteractionResponseType.DeferredChannelMessageWithSource,
				  };

		return captureResponse(response);
	};

	const update = (
		data?: InteractionMessageData,
	): APIInteractionResponseUpdateMessage => {
		const normalisedData = normaliseInteractionMessageData(data);

		const response: APIInteractionResponseUpdateMessage = normalisedData
			? {
					type: InteractionResponseType.UpdateMessage,
					data: normalisedData,
			  }
			: {
					type: InteractionResponseType.UpdateMessage,
			  };

		return captureResponse(response);
	};

	const deferUpdate = (): APIInteractionResponseDeferredMessageUpdate =>
		captureResponse({
			type: InteractionResponseType.DeferredMessageUpdate,
		});

	const showModal = (
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	): APIModalInteractionResponse => {
		const resolvedData: APIModalInteractionResponseCallbackData =
			typeof data === "object" &&
			"toJSON" in data &&
			typeof data.toJSON === "function"
				? data.toJSON()
				: (data as APIModalInteractionResponseCallbackData);
		return captureResponse({
			type: InteractionResponseType.Modal,
			data: resolvedData,
		});
	};

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	// Extract values from select menu interactions
	const values =
		"values" in interaction.data ? interaction.data.values : undefined;

	return Object.assign(interaction, {
		reply,
		deferReply,
		update,
		deferUpdate,
		showModal,
		getResponse,
		values,
	});
}
