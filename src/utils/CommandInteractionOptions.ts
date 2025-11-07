import {
	ApplicationCommandOptionType,
	InteractionResponseType,
	InteractionType,
	type APIInteractionResponse,
	type APIApplicationCommandInteractionDataAttachmentOption,
	type APIApplicationCommandInteractionDataBasicOption,
	type APIApplicationCommandInteractionDataBooleanOption,
	type APIApplicationCommandInteractionDataChannelOption,
	type APIApplicationCommandInteractionDataIntegerOption,
	type APIApplicationCommandInteractionDataMentionableOption,
	type APIApplicationCommandInteractionDataNumberOption,
	type APIApplicationCommandInteractionDataOption,
	type APIApplicationCommandInteractionDataRoleOption,
	type APIApplicationCommandInteractionDataStringOption,
	type APIApplicationCommandInteractionDataSubcommandGroupOption,
	type APIApplicationCommandInteractionDataSubcommandOption,
	type APIApplicationCommandInteractionDataUserOption,
	type APIChatInputApplicationCommandInteraction,
	type APIInteractionDataResolved,
	type APIInteractionDataResolvedChannel,
	type APIInteractionDataResolvedGuildMember,
	type APIModalInteractionResponse,
	type APIModalInteractionResponseCallbackData,
	type APIInteractionResponseCallbackData,
	type APIInteractionResponseChannelMessageWithSource,
	type APIInteractionResponseDeferredChannelMessageWithSource,
	type APIInteractionResponseUpdateMessage,
	type APIRole,
	type APIUser,
	type APIAttachment,
	type MessageFlags,
} from "discord-api-types/v10";
import {
	DeferredResponseData,
	DeferReplyOptions,
	InteractionMessageData,
	normaliseInteractionMessageData,
	normaliseMessageFlags,
} from "./interactionMessageHelpers.js";
import type {
	InteractionFollowUpFlags,
	InteractionReplyFlags,
} from "../types/InteractionFlags.js";

type BasicInteractionOption =
	APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand>;

type ResolvedRecords<T> = Record<string, T> | undefined;

export type ResolvedUserOption = {
	user: APIUser;
	member?: APIInteractionDataResolvedGuildMember;
};

export type MentionableOption =
	| { type: "user"; value: ResolvedUserOption }
	| { type: "role"; value: APIRole };

type FocusedOptionsResult = {
	subcommandGroup: string | null;
	subcommand: string | null;
	options: BasicInteractionOption[];
};

/** Maps application command option types to human-readable labels for error messages. */
const OPTION_TYPE_LABEL: Record<ApplicationCommandOptionType, string> = {
	[ApplicationCommandOptionType.Subcommand]: "subcommand",
	[ApplicationCommandOptionType.SubcommandGroup]: "subcommand group",
	[ApplicationCommandOptionType.String]: "string",
	[ApplicationCommandOptionType.Integer]: "integer",
	[ApplicationCommandOptionType.Boolean]: "boolean",
	[ApplicationCommandOptionType.User]: "user",
	[ApplicationCommandOptionType.Channel]: "channel",
	[ApplicationCommandOptionType.Role]: "role",
	[ApplicationCommandOptionType.Mentionable]: "mentionable",
	[ApplicationCommandOptionType.Number]: "number",
	[ApplicationCommandOptionType.Attachment]: "attachment",
};

/**
 * Determines whether the provided option represents a subcommand.
 *
 * @param option - The option to inspect.
 */
function isSubcommandOption(
	option: APIApplicationCommandInteractionDataOption,
): option is APIApplicationCommandInteractionDataSubcommandOption {
	return option.type === ApplicationCommandOptionType.Subcommand;
}

/**
 * Determines whether the provided option represents a subcommand group.
 *
 * @param option - The option to inspect.
 */
function isSubcommandGroupOption(
	option: APIApplicationCommandInteractionDataOption,
): option is APIApplicationCommandInteractionDataSubcommandGroupOption {
	return option.type === ApplicationCommandOptionType.SubcommandGroup;
}

/**
 * Extracts the most relevant option set from the raw command options hierarchy.
 *
 * @param options - The raw options array from the interaction payload.
 * @returns The resolved subcommand context and focused options for convenience accessors.
 */
function resolveFocusedOptions(
	options: APIApplicationCommandInteractionDataOption[] | undefined,
): FocusedOptionsResult {
	if (!options || options.length === 0) {
		return { subcommandGroup: null, subcommand: null, options: [] };
	}

	const [firstOption] = options;

	if (isSubcommandGroupOption(firstOption)) {
		const [firstSubcommand] = firstOption.options ?? [];
		if (firstSubcommand && isSubcommandOption(firstSubcommand)) {
			return {
				subcommandGroup: firstOption.name,
				subcommand: firstSubcommand.name,
				options: firstSubcommand.options ?? [],
			};
		}

		return {
			subcommandGroup: firstOption.name,
			subcommand: null,
			options: [],
		};
	}

	if (isSubcommandOption(firstOption)) {
		return {
			subcommandGroup: null,
			subcommand: firstOption.name,
			options: firstOption.options ?? [],
		};
	}

	return {
		subcommandGroup: null,
		subcommand: null,
		options: options as BasicInteractionOption[],
	};
}

/**
 * Provides ergonomic helpers for extracting typed command options from Discord interactions.
 */
export class CommandInteractionOptionResolver {
	public readonly raw: ReadonlyArray<APIApplicationCommandInteractionDataOption>;

	private readonly resolved: APIInteractionDataResolved | undefined;
	private readonly focusedOptions: BasicInteractionOption[];
	private readonly subcommand: string | null;
	private readonly subcommandGroup: string | null;

	/**
	 * Creates a new resolver from raw interaction options.
	 *
	 * @param options - The raw options provided by Discord.
	 * @param resolved - The resolved data map included with the interaction payload.
	 */
	constructor(
		options: APIApplicationCommandInteractionDataOption[] | undefined,
		resolved: APIInteractionDataResolved | undefined,
	) {
		this.raw = Object.freeze([...(options ?? [])]);
		this.resolved = resolved;

		const focused = resolveFocusedOptions(options);
		this.focusedOptions = focused.options;
		this.subcommand = focused.subcommand;
		this.subcommandGroup = focused.subcommandGroup;
	}

	/**
	 * Retrieves the subcommand invoked by the user.
	 *
	 * @param required - Whether to throw when the subcommand is missing.
	 */
	getSubcommand(required = true): string | null {
		if (this.subcommand) {
			return this.subcommand;
		}

		if (required) {
			throw new Error(
				"Expected a subcommand to be present on this interaction",
			);
		}

		return null;
	}

	/**
	 * Retrieves the subcommand group invoked by the user.
	 *
	 * @param required - Whether to throw when the subcommand group is missing.
	 */
	getSubcommandGroup(required = true): string | null {
		if (this.subcommandGroup) {
			return this.subcommandGroup;
		}

		if (required) {
			throw new Error(
				"Expected a subcommand group to be present on this interaction",
			);
		}

		return null;
	}

	/**
	 * Looks up a string option by name.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing.
	 */
	getString(name: string, required = false): string | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataStringOption>(
				name,
				ApplicationCommandOptionType.String,
				required,
			);
		return option ? option.value : null;
	}

	/**
	 * Looks up an integer option by name.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing.
	 */
	getInteger(name: string, required = false): number | null {
		const option = this.extractOption<
			APIApplicationCommandInteractionDataIntegerOption<InteractionType.ApplicationCommand>
		>(name, ApplicationCommandOptionType.Integer, required);
		return option ? option.value : null;
	}

	/**
	 * Looks up a numeric option by name.
	 *
	 * @param name - The option name to resolve.
	 */
	getNumber(name: string, required = false): number | null {
		const option = this.extractOption<
			APIApplicationCommandInteractionDataNumberOption<InteractionType.ApplicationCommand>
		>(name, ApplicationCommandOptionType.Number, required);
		return option ? option.value : null;
	}

	/**
	 * Looks up a boolean option by name.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing.
	 */
	getBoolean(name: string, required = false): boolean | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataBooleanOption>(
				name,
				ApplicationCommandOptionType.Boolean,
				required,
			);
		return option ? option.value : null;
	}

	/**
	 * Resolves a user option, including any guild member payload.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing or cannot be resolved.
	 */
	getUser(name: string, required = false): ResolvedUserOption | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataUserOption>(
				name,
				ApplicationCommandOptionType.User,
				required,
			);

		if (!option) {
			return null;
		}

		const resolvedUser = this.resolveUser(option.value);
		if (!resolvedUser) {
			if (required) {
				throw new Error(
					`Resolved data for user option "${name}" is missing`,
				);
			}

			return null;
		}

		return resolvedUser;
	}

	/**
	 * Resolves a role option to its resolved payload.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing or cannot be resolved.
	 */
	getRole(name: string, required = false): APIRole | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataRoleOption>(
				name,
				ApplicationCommandOptionType.Role,
				required,
			);

		if (!option) {
			return null;
		}

		const role = this.resolveRole(option.value);
		if (!role && required) {
			throw new Error(
				`Resolved data for role option "${name}" is missing`,
			);
		}

		return role ?? null;
	}

	/**
	 * Resolves a channel option to its resolved payload.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing or cannot be resolved.
	 */
	getChannel(
		name: string,
		required = false,
	): APIInteractionDataResolvedChannel | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataChannelOption>(
				name,
				ApplicationCommandOptionType.Channel,
				required,
			);

		if (!option) {
			return null;
		}

		const channel = this.resolveChannel(option.value);
		if (!channel && required) {
			throw new Error(
				`Resolved data for channel option "${name}" is missing`,
			);
		}

		return channel ?? null;
	}

	/**
	 * Resolves an attachment option to its resolved payload.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing or cannot be resolved.
	 */
	getAttachment(name: string, required = false): APIAttachment | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataAttachmentOption>(
				name,
				ApplicationCommandOptionType.Attachment,
				required,
			);

		if (!option) {
			return null;
		}

		const attachment = this.resolveAttachment(option.value);
		if (!attachment && required) {
			throw new Error(
				`Resolved data for attachment option "${name}" is missing`,
			);
		}

		return attachment ?? null;
	}

	/**
	 * Resolves a mentionable option to either a role or user payload.
	 *
	 * @param name - The option name to resolve.
	 * @param required - Whether to throw when the option is missing or cannot be resolved.
	 */
	getMentionable(name: string, required = false): MentionableOption | null {
		const option =
			this.extractOption<APIApplicationCommandInteractionDataMentionableOption>(
				name,
				ApplicationCommandOptionType.Mentionable,
				required,
			);

		if (!option) {
			return null;
		}

		const role = this.resolveRole(option.value);
		if (role) {
			return { type: "role", value: role };
		}

		const user = this.resolveUser(option.value);
		if (user) {
			return { type: "user", value: user };
		}

		if (required) {
			throw new Error(
				`Resolved data for mentionable option "${name}" is missing`,
			);
		}

		return null;
	}

	/**
	 * Returns the raw option payload, bypassing type checks and casting.
	 *
	 * @param name - The option name to look up.
	 */
	getRawOption(
		name: string,
	): APIApplicationCommandInteractionDataOption | null {
		return (
			this.focusedOptions.find((option) => option.name === name) ?? null
		);
	}

	/**
	 * Extracts a strongly typed option, ensuring it exists and matches the expected type.
	 */
	private extractOption<Option extends BasicInteractionOption>(
		name: string,
		type: ApplicationCommandOptionType,
		required: boolean,
	): Option | null {
		const option = this.focusedOptions.find(
			(candidate) => candidate.name === name,
		);

		if (!option) {
			if (required) {
				throw new Error(
					`Required ${OPTION_TYPE_LABEL[type]} option "${name}" is missing`,
				);
			}

			return null;
		}

		if (option.type !== type) {
			throw new Error(
				`Option "${name}" is a ${
					OPTION_TYPE_LABEL[option.type]
				}, expected ${OPTION_TYPE_LABEL[type]}`,
			);
		}

		return option as Option;
	}

	/**
	 * Resolves an attachment by identifier from the interaction's resolved payloads.
	 */
	private resolveAttachment(id: string): APIAttachment | undefined {
		return this.getResolvedRecord(this.resolved?.attachments, id);
	}

	/**
	 * Resolves a channel by identifier from the interaction's resolved payloads.
	 */
	private resolveChannel(
		id: string,
	): APIInteractionDataResolvedChannel | undefined {
		return this.getResolvedRecord(this.resolved?.channels, id);
	}

	/**
	 * Resolves a role by identifier from the interaction's resolved payloads.
	 */
	private resolveRole(id: string): APIRole | undefined {
		return this.getResolvedRecord(this.resolved?.roles, id);
	}

	/**
	 * Resolves a user and optional member by identifier from the interaction's resolved payloads.
	 */
	private resolveUser(id: string): ResolvedUserOption | null {
		const user = this.getResolvedRecord(this.resolved?.users, id);
		if (!user) {
			return null;
		}

		const member = this.getResolvedRecord(this.resolved?.members, id);
		return { user, member: member ?? undefined };
	}

	/**
	 * Retrieves a record from a resolved payload map by identifier.
	 */
	private getResolvedRecord<T>(
		records: ResolvedRecords<T>,
		id: string,
	): T | undefined {
		return records?.[id];
	}
}

/**
 * Represents a command interaction augmented with helper methods for easy responses.
 */
export interface CommandInteraction
	extends Omit<APIChatInputApplicationCommandInteraction, "data"> {
	data: Omit<APIChatInputApplicationCommandInteraction["data"], "options"> & {
		options: CommandInteractionOptionResolver;
	};
	options: CommandInteractionOptionResolver;
	getResponse(): APIInteractionResponse | null;
	reply(
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource;
	followUp(
		data: InteractionMessageData,
	): APIInteractionResponseChannelMessageWithSource;
	edit(data?: InteractionMessageData): APIInteractionResponseUpdateMessage;
	deferReply(
		options?: DeferReplyOptions,
	): APIInteractionResponseDeferredChannelMessageWithSource;
	showModal(
		data:
			| APIModalInteractionResponseCallbackData
			| { toJSON(): APIModalInteractionResponseCallbackData },
	): APIModalInteractionResponse;
}

/**
 * Wraps a raw application command interaction with helper methods and option resolvers.
 *
 * @param interaction - The raw interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createCommandInteraction(
	interaction: APIChatInputApplicationCommandInteraction,
): CommandInteraction {
	const options = new CommandInteractionOptionResolver(
		interaction.data.options,
		interaction.data.resolved,
	);

	let capturedResponse: APIInteractionResponse | null = null;

	/**
	 * Stores the most recent response helper payload for later retrieval.
	 */
	const captureResponse = <T extends APIInteractionResponse>(
		response: T,
	): T => {
		capturedResponse = response;
		return response;
	};

	/**
	 * Creates a channel message or update response with normalised payload data.
	 */
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
		const normalisedData = normaliseInteractionMessageData(data);

		if (type === InteractionResponseType.ChannelMessageWithSource) {
			if (!normalisedData) {
				throw new Error(
					"[MiniInteraction] Channel message responses require data to be provided.",
				);
			}

			return captureResponse({
				type,
				data: normalisedData,
			});
		}

		if (normalisedData) {
			return captureResponse({ type, data: normalisedData });
		}

		return captureResponse({ type });
	}

	/**
	 * Creates a deferred response while normalising any helper flag values.
	 */
	const createDeferredResponse = (
		data?: DeferredResponseData,
	): APIInteractionResponseDeferredChannelMessageWithSource => {
		if (!data) {
			return captureResponse({
				type: InteractionResponseType.DeferredChannelMessageWithSource,
			});
		}

		return captureResponse({
			type: InteractionResponseType.DeferredChannelMessageWithSource,
			data: { flags: normaliseMessageFlags(data.flags) as MessageFlags },
		});
	};

	const commandInteraction: CommandInteraction = {
		...interaction,
		data: {
			...interaction.data,
			options,
		},
		options,
		getResponse() {
			return capturedResponse;
		},
		reply(data) {
			return createMessageResponse(
				InteractionResponseType.ChannelMessageWithSource,
				data,
			);
		},
		followUp(data) {
			return createMessageResponse(
				InteractionResponseType.ChannelMessageWithSource,
				data,
			);
		},
		edit(data) {
			return createMessageResponse(
				InteractionResponseType.UpdateMessage,
				data,
			);
		},
		deferReply(options) {
			return createDeferredResponse(
				options?.flags !== undefined
					? { flags: options.flags }
					: undefined,
			);
		},
		showModal(data) {
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
		},
	};

	return commandInteraction;
}
