import {
	InteractionResponseType,
	type APIInteractionResponse,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIModalSubmitInteraction,
	type ModalSubmitComponent,
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
	 * Helper method to get the value of a text input component by custom_id.
	 * @param customId - The custom_id of the text input component
	 * @returns The value of the text input, or undefined if not found
	 */
	getTextInputValue: (customId: string) => string | undefined;
	/**
	 * Helper method to get all text input values as a map.
	 * @returns A map of custom_id to value for all text inputs
	 */
	getTextInputValues: () => Map<string, string>;
	/**
	 * Helper method to get the selected values of a select menu component by custom_id.
	 * @param customId - The custom_id of the select menu component
	 * @returns The selected values of the select menu, or undefined if not found
	 */
	getSelectMenuValues: (customId: string) => string[] | undefined;
};

export const ModalSubmitInteraction = {};

/**
 * Wraps a raw modal submit interaction with helper methods.
 *
 * @param interaction - The raw interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createModalSubmitInteraction(
	interaction: APIModalSubmitInteraction,
): ModalSubmitInteraction {
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
				"[MiniInteraction] Modal submit replies require response data to be provided.",
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

	const getResponse = (): APIInteractionResponse | null => capturedResponse;

	// Helper to extract text input values from modal components
	const extractTextInputs = (): Map<string, string> => {
		const textInputs = new Map<string, string>();

		for (const component of interaction.data.components) {
			// Handle action rows
			if ("components" in component && Array.isArray(component.components)) {
				for (const child of component.components) {
					if ("value" in child && "custom_id" in child) {
						textInputs.set(child.custom_id, child.value);
					}
				}
			}
			// Handle labeled components
			else if ("component" in component) {
				const labeledComponent = component.component as ModalSubmitComponent;
				if ("value" in labeledComponent && "custom_id" in labeledComponent) {
					textInputs.set(labeledComponent.custom_id, labeledComponent.value);
				}
			}
		}

		return textInputs;
	};

	// Helper to extract select menu values from modal components
	const extractSelectMenuValues = (): Map<string, string[]> => {
		const selectMenuValues = new Map<string, string[]>();

		for (const component of interaction.data.components) {
			// Handle action rows
			if ("components" in component && Array.isArray(component.components)) {
				for (const child of component.components) {
					if ("values" in child && "custom_id" in child && Array.isArray(child.values)) {
						selectMenuValues.set(child.custom_id, child.values);
					}
				}
			}
			// Handle labeled components (unlikely for select menus but good for completeness if spec allows)
			else if ("component" in component) {
				const labeledComponent = component.component as any; // Using any as ModalSubmitComponent might not cover select menus fully in types yet or strictness varies
				if ("values" in labeledComponent && "custom_id" in labeledComponent && Array.isArray(labeledComponent.values)) {
					selectMenuValues.set(labeledComponent.custom_id, labeledComponent.values);
				}
			}
		}

		return selectMenuValues;
	};

	const textInputValues = extractTextInputs();
	const selectMenuValues = extractSelectMenuValues();

	const getTextInputValue = (customId: string): string | undefined => {
		return textInputValues.get(customId);
	};

	const getTextInputValues = (): Map<string, string> => {
		return new Map(textInputValues);
	};

	return Object.assign(interaction, {
		reply,
		deferReply,
		getResponse,
		getTextInputValue,
		getTextInputValues,
		getSelectMenuValues: (customId: string) => selectMenuValues.get(customId),
	});
}

