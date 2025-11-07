import {
	ComponentType,
	InteractionResponseType,
	type APIInteractionDataResolvedChannel,
	type APIInteractionDataResolvedGuildMember,
	type APIInteractionResponse,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIInteractionResponseDeferredMessageUpdate,
	type APIInteractionResponseUpdateMessage,
	type APIMessageComponentInteraction,
	type APIMessageButtonInteractionData,
	type APIMessageChannelSelectInteractionData,
	type APIMessageMentionableSelectInteractionData,
	type APIMessageRoleSelectInteractionData,
	type APIMessageStringSelectInteractionData,
	type APIMessageUserSelectInteractionData,
	type APIModalInteractionResponse,
	type APIModalInteractionResponseCallbackData,
	type APIRole,
	type APIUser,
} from "discord-api-types/v10";

import {
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";

/** Resolved user option including optional guild member data. */
export type ResolvedUserOption = {
	user: APIUser;
	member?: APIInteractionDataResolvedGuildMember;
};

/** Resolved mentionable option (either a user or role). */
export type ResolvedMentionableOption =
	| { type: "user"; value: ResolvedUserOption }
	| { type: "role"; value: APIRole };

/**
 * Base helper methods available on all component interactions.
 */
type BaseComponentInteractionHelpers = {
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
};

/**
 * Button interaction with helper methods.
 * Buttons don't have values or resolved data.
 */
export type ButtonInteraction = Omit<APIMessageComponentInteraction, "data"> & {
	data: APIMessageButtonInteractionData;
} & BaseComponentInteractionHelpers;

/**
 * String select menu interaction with helper methods.
 */
export type StringSelectInteraction = Omit<
	APIMessageComponentInteraction,
	"data"
> & {
	data: APIMessageStringSelectInteractionData;
	values: string[];
	getStringValues: () => string[];
} & BaseComponentInteractionHelpers;

/**
 * Role select menu interaction with helper methods.
 */
export type RoleSelectInteraction = Omit<
	APIMessageComponentInteraction,
	"data"
> & {
	data: APIMessageRoleSelectInteractionData;
	values: string[];
	getRoles: () => APIRole[];
} & BaseComponentInteractionHelpers;

/**
 * User select menu interaction with helper methods.
 */
export type UserSelectInteraction = Omit<
	APIMessageComponentInteraction,
	"data"
> & {
	data: APIMessageUserSelectInteractionData;
	values: string[];
	getUsers: () => ResolvedUserOption[];
} & BaseComponentInteractionHelpers;

/**
 * Channel select menu interaction with helper methods.
 */
export type ChannelSelectInteraction = Omit<
	APIMessageComponentInteraction,
	"data"
> & {
	data: APIMessageChannelSelectInteractionData;
	values: string[];
	getChannels: () => APIInteractionDataResolvedChannel[];
} & BaseComponentInteractionHelpers;

/**
 * Mentionable select menu interaction with helper methods.
 */
export type MentionableSelectInteraction = Omit<
	APIMessageComponentInteraction,
	"data"
> & {
	data: APIMessageMentionableSelectInteractionData;
	values: string[];
	getMentionables: () => ResolvedMentionableOption[];
} & BaseComponentInteractionHelpers;

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
	/**
	 * Helper method to get selected string values from a string select menu.
	 * @returns Array of selected string values, or empty array if not a string select menu
	 */
	getStringValues: () => string[];
	/**
	 * Helper method to get selected roles from a role select menu.
	 * @returns Array of resolved role objects, or empty array if not a role select menu
	 */
	getRoles: () => APIRole[];
	/**
	 * Helper method to get selected channels from a channel select menu.
	 * @returns Array of resolved channel objects, or empty array if not a channel select menu
	 */
	getChannels: () => APIInteractionDataResolvedChannel[];
	/**
	 * Helper method to get selected users from a user select menu.
	 * @returns Array of resolved user objects (with optional member data), or empty array if not a user select menu
	 */
	getUsers: () => ResolvedUserOption[];
	/**
	 * Helper method to get selected mentionables from a mentionable select menu.
	 * @returns Array of resolved mentionable objects (users or roles), or empty array if not a mentionable select menu
	 */
	getMentionables: () => ResolvedMentionableOption[];
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

	// Helper methods for select menu interactions
	const getStringValues = (): string[] => {
		return values ?? [];
	};

	const getRoles = (): APIRole[] => {
		if (!values) {
			return [];
		}
		// Type guard: check if resolved data exists
		const resolved =
			"resolved" in interaction.data
				? (interaction.data.resolved as any)
				: undefined;
		if (!resolved?.roles) {
			return [];
		}
		const roles: APIRole[] = [];
		for (const roleId of values) {
			const role = resolved.roles[roleId];
			if (role) {
				roles.push(role);
			}
		}
		return roles;
	};

	const getChannels = (): APIInteractionDataResolvedChannel[] => {
		if (!values) {
			return [];
		}
		// Type guard: check if resolved data exists
		const resolved =
			"resolved" in interaction.data
				? (interaction.data.resolved as any)
				: undefined;
		if (!resolved?.channels) {
			return [];
		}
		const channels: APIInteractionDataResolvedChannel[] = [];
		for (const channelId of values) {
			const channel = resolved.channels[channelId];
			if (channel) {
				channels.push(channel);
			}
		}
		return channels;
	};

	const getUsers = (): ResolvedUserOption[] => {
		if (!values) {
			return [];
		}
		// Type guard: check if resolved data exists
		const resolved =
			"resolved" in interaction.data
				? (interaction.data.resolved as any)
				: undefined;
		if (!resolved?.users) {
			return [];
		}
		const users: ResolvedUserOption[] = [];
		for (const userId of values) {
			const user = resolved.users[userId];
			if (user) {
				const member = resolved.members?.[userId];
				users.push({ user, member });
			}
		}
		return users;
	};

	const getMentionables = (): ResolvedMentionableOption[] => {
		if (!values) {
			return [];
		}
		// Type guard: check if resolved data exists
		const resolved =
			"resolved" in interaction.data
				? (interaction.data.resolved as any)
				: undefined;
		if (!resolved) {
			return [];
		}
		const mentionables: ResolvedMentionableOption[] = [];
		for (const id of values) {
			// Check if it's a role
			const role = resolved.roles?.[id];
			if (role) {
				mentionables.push({ type: "role", value: role });
				continue;
			}
			// Check if it's a user
			const user = resolved.users?.[id];
			if (user) {
				const member = resolved.members?.[id];
				mentionables.push({ type: "user", value: { user, member } });
			}
		}
		return mentionables;
	};

	return Object.assign(interaction, {
		reply,
		deferReply,
		update,
		deferUpdate,
		showModal,
		getResponse,
		values,
		getStringValues,
		getRoles,
		getChannels,
		getUsers,
		getMentionables,
	});
}
