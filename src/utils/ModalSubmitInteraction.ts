import {
	ComponentType,
	InteractionResponseType,
	type APIInteractionResponse,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIModalSubmitInteraction,
} from "discord-api-types/v10";

import {
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";

/**
 * Represents a modal submit interaction augmented with helper response methods.
 */
export type ModalSubmitInteraction = APIModalSubmitInteraction & {
	getResponse: () => APIInteractionResponse | null;
	reply: (
		data: InteractionMessageData,
	) => APIInteractionResponseChannelMessageWithSource;
	deferReply: (
		options?: DeferReplyOptions,
	) => APIInteractionResponseDeferredChannelMessageWithSource;
	/**
	 * Helper method to get the value of a text input component by its custom ID.
	 */
	getTextFieldValue: (customId: string) => string | undefined;
	/**
	 * Finalise the interaction response via a webhook follow-up.
	 * This is automatically called by reply() if the interaction is deferred.
	 */
	sendFollowUp?: (token: string, response: APIInteractionResponse) => void;
}

export const ModalSubmitInteraction = {};

/**
 * Wraps a raw modal submit interaction with helper methods mirroring Discord's expected responses.
 *
 * @param interaction - The raw interaction payload from Discord.
 * @param helpers - Optional callback to capture the final interaction response.
 * @returns A helper-augmented interaction object.
 */
export function createModalSubmitInteraction(
	interaction: APIModalSubmitInteraction,
	helpers?: {
		onAck?: (response: APIInteractionResponse) => void;
		sendFollowUp?: (token: string, response: APIInteractionResponse) => void;
	}
): ModalSubmitInteraction {
	let capturedResponse: APIInteractionResponse | null = null;
	let isDeferred = false;

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
				"[MiniInteraction] Modal replies require response data to be provided.",
			);
		}

		const response = captureResponse({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: normalisedData,
		});

		if (isDeferred && helpers?.sendFollowUp) {
			helpers.sendFollowUp(interaction.token, response);
		} else {
			helpers?.onAck?.(response);
		}

		return response;
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

		captureResponse(response);
		isDeferred = true;
		helpers?.onAck?.(response);
		return response;
	};

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	const getTextFieldValue = (customId: string): string | undefined => {
		for (const actionRow of interaction.data.components) {
			if ("components" in actionRow && Array.isArray(actionRow.components)) {
				for (const component of actionRow.components) {
					if (
						component.type === ComponentType.TextInput &&
						component.custom_id === customId
					) {
						return component.value;
					}
				}
			}
		}
		return undefined;
	};

	return Object.assign(interaction, {
		reply,
		deferReply,
		getResponse,
		getTextFieldValue,
		sendFollowUp: helpers?.sendFollowUp,
	});
}
