import {
	InteractionResponseType,
	type APIInteractionResponse,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIModalSubmitInteraction,
	type APIRole,
	type APIUser,
	type APIInteractionDataResolvedChannel,
	type APIInteractionDataResolvedGuildMember,
	type APIAttachment,
} from "discord-api-types/v10";

import {
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";
import type { ResolvedUserOption } from "./MessageComponentInteraction.js";

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
	 * Helper method to get selected roles from a role select menu in the modal.
	 */
	getRoles: (customId: string) => APIRole[];
	getRole: (customId: string) => APIRole | undefined;
	/**
	 * Helper method to get selected users from a user select menu in the modal.
	 */
	getUsers: (customId: string) => ResolvedUserOption[];
	getUser: (customId: string) => ResolvedUserOption | undefined;
	/**
	 * Helper method to get selected channels from a channel select menu in the modal.
	 */
	getChannels: (customId: string) => APIInteractionDataResolvedChannel[];
	getChannel: (customId: string) => APIInteractionDataResolvedChannel | undefined;
	/**
	 * Helper method to get an attachment value (e.g. from FileUpload component).
	 */
	getAttachment: (customId: string) => APIAttachment | undefined;
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
		const findValue = (components: any[]): string | undefined => {
			for (const component of components) {
				if (
					component?.custom_id === customId &&
					typeof component.value === "string"
				) {
					return component.value;
				}
				// Nested Label wrapper: single child in .component
				if (component?.component) {
					const found = findValue([component.component]);
					if (found) return found;
				}
			}
			return undefined;
		};

		for (const top of interaction.data.components) {
			if ("components" in top && Array.isArray(top.components)) {
				const result = findValue(top.components);
				if (result) return result;
			}
			if ("component" in top && top.component) {
				const result = findValue([top.component]);
				if (result) return result;
			}
		}
		return undefined;
	};

	/**
	 * Helper method to get the value(s) of a select menu component by its custom ID.
	 * Handles the nested structure of modal components (Action Rows -> Components,
	 * and Label -> single component). Select menus in modals are typically inside
	 * Label components, not Action Rows.
	 */
	const getSelectMenuValues = (customId: string): string[] | undefined => {
		const findValues = (components: any[]): string[] | undefined => {
			for (const component of components) {
				if (
					component?.custom_id === customId &&
					Array.isArray(component.values)
				) {
					return component.values;
				}
				// Nested Label wrapper: single child in .component
				if (component?.component) {
					const found = findValues([component.component]);
					if (found) return found;
				}
			}
			return undefined;
		};

		for (const top of interaction.data.components) {
			// Action Row: multiple components in .components
			if ("components" in top && Array.isArray(top.components)) {
				const result = findValues(top.components);
				if (result) return result;
			}
			// Label: select menu (and other modal components) wrapped in .component
			if ("component" in top && top.component) {
				const result = findValues([top.component]);
				if (result) return result;
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

	const getRoles = (customId: string): APIRole[] => {
		const values = getSelectMenuValues(customId);
		if (!values || !interaction.data.resolved?.roles) return [];
		return values
			.map((id) => (interaction.data.resolved as any).roles[id])
			.filter(Boolean);
	};

	const getRole = (customId: string): APIRole | undefined => getRoles(customId)[0];

	const getUsers = (customId: string): ResolvedUserOption[] => {
		const values = getSelectMenuValues(customId);
		if (!values || !interaction.data.resolved?.users) return [];
		return values
			.map((id) => {
				const user = (interaction.data.resolved as any).users[id];
				const member = (interaction.data.resolved as any).members?.[id];
				return user ? { user, member } : undefined;
			})
			.filter((u): u is ResolvedUserOption => !!u);
	};

	const getUser = (customId: string): ResolvedUserOption | undefined =>
		getUsers(customId)[0];

	const getChannels = (customId: string): APIInteractionDataResolvedChannel[] => {
		const values = getSelectMenuValues(customId);
		if (!values || !interaction.data.resolved?.channels) return [];
		return values
			.map((id) => (interaction.data.resolved as any).channels[id])
			.filter(Boolean);
	};

	const getChannel = (customId: string): APIInteractionDataResolvedChannel | undefined =>
		getChannels(customId)[0];

	const getAttachment = (customId: string): APIAttachment | undefined => {
		const value = getComponentValue(customId);
		if (!value || Array.isArray(value)) return undefined;
		return (interaction.data.resolved as any)?.attachments?.[value];
	};

	return Object.assign(interaction, {
		reply,
		deferReply,
		editReply,
		getResponse,
		getTextFieldValue,
		getSelectMenuValues,
		getComponentValue,
		getRoles,
		getRole,
		getUsers,
		getUser,
		getChannels,
		getChannel,
		getAttachment,
		sendFollowUp: helpers?.sendFollowUp,
		canRespond: helpers?.canRespond,
		trackResponse: helpers?.trackResponse,
	});
}
