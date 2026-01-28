import {
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
	) => Promise<APIInteractionResponseChannelMessageWithSource>;
	deferReply: (
		options?: DeferReplyOptions,
	) => APIInteractionResponseDeferredChannelMessageWithSource;
	/**
	 * Helper method to get the value of a text input component by its custom ID.
	 */
	/**
	 * Helper method to get the value of a text input component by its custom ID.
	 */
	getTextFieldValue: (customId: string) => string | undefined;
	/**
	 * Helper method to get the value(s) of a select menu component by its custom ID.
	 */
	getSelectMenuValues: (customId: string) => string[] | undefined;
	/**
	 * Helper method to get the value of any component by its custom ID.
	 * Returns string for text inputs, string[] for select menus, or undefined.
	 */
	getComponentValue: (customId: string) => string | string[] | undefined;
	/**
	 * Finalise the interaction response via a webhook follow-up.
	 * This is automatically called by reply() if the interaction is deferred.
	 */
	sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
	/**
	 * Optional state management helpers.
	 */
	canRespond?: (interactionId: string) => boolean;
	trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
	/**
	 * Edit the initial interaction response.
	 */
	editReply: (
		data?: InteractionMessageData,
	) => Promise<APIInteractionResponseChannelMessageWithSource>;
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
		sendFollowUp?: (token: string, response: APIInteractionResponse, messageId?: string) => Promise<void>;
		canRespond?: (interactionId: string) => boolean;
		trackResponse?: (interactionId: string, token: string, state: 'responded' | 'deferred') => void;
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

	const reply = async (
		data: InteractionMessageData,
	): Promise<APIInteractionResponseChannelMessageWithSource> => {
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
			await helpers.sendFollowUp(interaction.token, response, '@original');
		} else {
			helpers?.onAck?.(response);
		}

		return response;
	};

	const editReply = async (
		data?: InteractionMessageData,
	): Promise<APIInteractionResponseChannelMessageWithSource> => {
		const normalisedData = normaliseInteractionMessageData(data);
		const response = captureResponse({
			type: InteractionResponseType.ChannelMessageWithSource,
			data: normalisedData ?? { content: "" },
		});

		if (helpers?.sendFollowUp) {
			await helpers.sendFollowUp(interaction.token, response, '@original');
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
				for (const rawComponent of actionRow.components) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const component = rawComponent as any;
					if (
						component.custom_id === customId &&
						typeof component.value === "string"
					) {
						return component.value;
					}
				}
			}
		}
		return undefined;
	};

	const getSelectMenuValues = (customId: string): string[] | undefined => {
		for (const actionRow of interaction.data.components) {
			if ("components" in actionRow && Array.isArray(actionRow.components)) {
				for (const rawComponent of actionRow.components) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const component = rawComponent as any;
					if (
						component.custom_id === customId &&
						Array.isArray(component.values)
					) {
						return component.values;
					}
				}
			}
		}
		return undefined;
	};

	const getComponentValue = (
		customId: string,
	): string | string[] | undefined => {
		const textValue = getTextFieldValue(customId);
		if (textValue !== undefined) {
			return textValue;
		}

		return getSelectMenuValues(customId);
	};

	return Object.assign(interaction, {
		reply,
		deferReply,
		editReply,
		getResponse,
		getTextFieldValue,
		getSelectMenuValues,
		getComponentValue,
		sendFollowUp: helpers?.sendFollowUp,
		canRespond: helpers?.canRespond,
		trackResponse: helpers?.trackResponse,
	});
}
