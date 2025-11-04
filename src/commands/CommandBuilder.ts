import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChannelType,
	type APIApplicationCommandAttachmentOption,
	type APIApplicationCommandBasicOption,
	type APIApplicationCommandChannelOption,
	type APIApplicationCommandMentionableOption,
	type APIApplicationCommandNumberOption,
	type APIApplicationCommandOption,
	type APIApplicationCommandOptionChoice,
	type APIApplicationCommandRoleOption,
	type APIApplicationCommandStringOption,
	type APIApplicationCommandSubcommandGroupOption,
	type APIApplicationCommandSubcommandOption,
	type APIApplicationCommandUserOption,
	type LocalizationMap,
	type Permissions,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

/** Maximum number of options allowed on a slash command or subcommand. */
const MAX_COMMAND_OPTIONS = 25;
/** Maximum number of choices allowed on choice-enabled options. */
const MAX_CHOICES = 25;
/** Maximum length of command or option names enforced by Discord. */
const MAX_NAME_LENGTH = 32;
/** Maximum description length permitted for commands and options. */
const MAX_DESCRIPTION_LENGTH = 100;
/** Maximum length of string option values supported by Discord. */
const MAX_STRING_LENGTH = 6000;
/** Minimum length of string option values. */
const MIN_STRING_LENGTH = 0;

/** Valid command and option name pattern as defined by Discord's API. */
const COMMAND_NAME_REGEX = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

/**
 * Ensures an option or command name satisfies Discord's requirements.
 */
function assertName(name: string, lowerCase = true): void {
	if (typeof name !== "string" || name.length === 0) {
		throw new TypeError("Option name must be a non-empty string");
	}

	if (name.length > MAX_NAME_LENGTH || !COMMAND_NAME_REGEX.test(name)) {
		throw new RangeError(
			`Option name "${name}" must match ${COMMAND_NAME_REGEX.source} and be at most ${MAX_NAME_LENGTH} characters long`,
		);
	}

	if (lowerCase && name !== name.toLowerCase()) {
		throw new RangeError(
			`Command and option names must be lowercase. Received "${name}"`,
		);
	}
}

/** Validates that a description string meets Discord's length constraints. */
function assertDescription(description: string): void {
	if (typeof description !== "string" || description.length === 0) {
		throw new TypeError("Description must be a non-empty string");
	}

	if (description.length > MAX_DESCRIPTION_LENGTH) {
		throw new RangeError(
			`Description must be between 1 and ${MAX_DESCRIPTION_LENGTH} characters long`,
		);
	}
}

/** Creates a deep copy of an option payload to avoid accidental mutation. */
function cloneOption<T extends APIApplicationCommandOption>(option: T): T {
	return JSON.parse(JSON.stringify(option)) as T;
}

/** Supported integration types for Discord application commands. */
export enum IntegrationType {
	GuildInstall = 0,
	UserInstall = 1,
}

/** Supported contexts where a command can be invoked. */
export enum CommandContext {
	Guild = 0,
	Bot = 1,
	DM = 2,
}

/**
 * Provides shared builder utilities for application command option definitions.
 */
abstract class BaseOptionBuilder<Data extends APIApplicationCommandOption> {
	protected readonly data: Data;

	/**
	 * Creates a new option builder wrapper around an underlying option payload.
	 */
	protected constructor(data: Data) {
		this.data = data;
	}

	/**
	 * Sets the option name while validating Discord's requirements.
	 */
	setName(name: string): this {
		assertName(name);
		this.data.name = name;
		return this;
	}

	/**
	 * Sets localized translations for the option name.
	 */
	setNameLocalizations(localizations: LocalizationMap | null): this {
		this.data.name_localizations = localizations ?? null;
		return this;
	}

	/**
	 * Sets the option description while validating Discord's length requirements.
	 */
	setDescription(description: string): this {
		assertDescription(description);
		this.data.description = description;
		return this;
	}

	/**
	 * Sets localized translations for the option description.
	 */
	setDescriptionLocalizations(localizations: LocalizationMap | null): this {
		this.data.description_localizations = localizations ?? null;
		return this;
	}

	/**
	 * Produces a deep copy of the built option payload for safe reuse.
	 */
	toJSON(): Data {
		return cloneOption(this.data);
	}
}

/**
 * Extends {@link BaseOptionBuilder} with helpers specific to basic command options.
 */
abstract class BaseCommandOptionBuilder<
	Data extends APIApplicationCommandBasicOption,
> extends BaseOptionBuilder<Data> {
	/**
	 * Marks the option as required within its parent context.
	 */
	setRequired(required = true): this {
		this.data.required = required;
		return this;
	}
}

/** Builder for attachment command options. */
class AttachmentOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandAttachmentOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Attachment,
			name: "",
			description: "",
		});
	}
}

/** Builder for user command options. */
class UserOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandUserOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.User,
			name: "",
			description: "",
		});
	}
}

/** Builder for role command options. */
class RoleOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandRoleOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Role,
			name: "",
			description: "",
		});
	}
}

/** Builder for mentionable command options. */
class MentionableOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandMentionableOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Mentionable,
			name: "",
			description: "",
		});
	}
}

/** Builder for channel command options with channel type filtering support. */
class ChannelOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandChannelOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Channel,
			name: "",
			description: "",
		});
	}

	/**
	 * Limits selectable channels to the provided channel types.
	 */
	addChannelTypes(...channelTypes: ChannelType[]): this {
		if (channelTypes.length === 0) {
			delete this.data.channel_types;
			return this;
		}

		this.data.channel_types = [
			...channelTypes,
		] as APIApplicationCommandChannelOption["channel_types"];
		return this;
	}
}

/** Builder for string command options, including choice and autocomplete support. */
class StringOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandStringOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.String,
			name: "",
			description: "",
		});
	}

	/**
	 * Adds a single choice option for the string command option.
	 */
	addChoice(name: string, value: string): this {
		return this.addChoices({ name, value });
	}

	/**
	 * Adds multiple choice entries for the string command option.
	 */
	addChoices(...choices: APIApplicationCommandOptionChoice<string>[]): this {
		if (choices.length === 0) {
			return this;
		}

		if (this.data.autocomplete) {
			throw new Error("Cannot set choices when autocomplete is enabled");
		}

		this.data.choices ??= [];

		if (this.data.choices.length + choices.length > MAX_CHOICES) {
			throw new RangeError(
				`A maximum of ${MAX_CHOICES} choices can be set for an option`,
			);
		}

		for (const choice of choices) {
			assertName(choice.name, false);
			this.data.choices.push({ ...choice });
		}

		return this;
	}

	/**
	 * Replaces the existing choice set with the provided entries.
	 */
	setChoices(...choices: APIApplicationCommandOptionChoice<string>[]): this {
		this.data.choices = [];
		return this.addChoices(...choices);
	}

	/**
	 * Enables or disables autocomplete for the string option.
	 */
	setAutocomplete(autocomplete = true): this {
		if (autocomplete && this.data.choices?.length) {
			throw new Error(
				"Cannot enable autocomplete when choices are already set",
			);
		}

		this.data.autocomplete = autocomplete;
		if (autocomplete) {
			this.data.choices = [];
		}

		return this;
	}

	/**
	 * Sets the minimum string length accepted for the option value.
	 */
	setMinLength(minLength: number): this {
		if (minLength < MIN_STRING_LENGTH || minLength > MAX_STRING_LENGTH) {
			throw new RangeError(
				`minLength must be between ${MIN_STRING_LENGTH} and ${MAX_STRING_LENGTH}`,
			);
		}

		this.data.min_length = minLength;
		return this;
	}

	/**
	 * Sets the maximum string length accepted for the option value.
	 */
	setMaxLength(maxLength: number): this {
		if (maxLength < 1 || maxLength > MAX_STRING_LENGTH) {
			throw new RangeError(
				`maxLength must be between 1 and ${MAX_STRING_LENGTH}`,
			);
		}

		this.data.max_length = maxLength;
		return this;
	}
}

/** Builder for numeric command options with choice and range support. */
class NumberOptionBuilder extends BaseCommandOptionBuilder<APIApplicationCommandNumberOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Number,
			name: "",
			description: "",
		});
	}

	/**
	 * Adds a single numeric choice for the option.
	 */
	addChoice(name: string, value: number): this {
		return this.addChoices({ name, value });
	}

	/**
	 * Adds multiple numeric choice entries for the option.
	 */
	addChoices(...choices: APIApplicationCommandOptionChoice<number>[]): this {
		if (choices.length === 0) {
			return this;
		}

		if (this.data.autocomplete) {
			throw new Error("Cannot set choices when autocomplete is enabled");
		}

		this.data.choices ??= [];

		if (this.data.choices.length + choices.length > MAX_CHOICES) {
			throw new RangeError(
				`A maximum of ${MAX_CHOICES} choices can be set for an option`,
			);
		}

		for (const choice of choices) {
			assertName(choice.name, false);
			this.data.choices.push({ ...choice });
		}

		return this;
	}

	/**
	 * Replaces the current choice set with the provided entries.
	 */
	setChoices(...choices: APIApplicationCommandOptionChoice<number>[]): this {
		this.data.choices = [];
		return this.addChoices(...choices);
	}

	/**
	 * Enables or disables autocomplete for the numeric option.
	 */
	setAutocomplete(autocomplete = true): this {
		if (autocomplete && this.data.choices?.length) {
			throw new Error(
				"Cannot enable autocomplete when choices are already set",
			);
		}

		this.data.autocomplete = autocomplete;
		if (autocomplete) {
			this.data.choices = [];
		}

		return this;
	}

	/**
	 * Sets the minimum numeric value allowed for the option.
	 */
	setMinValue(minValue: number): this {
		this.data.min_value = minValue;
		return this;
	}

	/**
	 * Sets the maximum numeric value allowed for the option.
	 */
	setMaxValue(maxValue: number): this {
		this.data.max_value = maxValue;
		return this;
	}
}

/** Callback type accepted by option builder helper methods for customization. */
type OptionBuilderCallback<Builder> = (builder: Builder) => Builder | void;

/**
 * Resolves the JSON payload for a builder, allowing callback overrides to return custom builders.
 */
function resolveBuilder<
	Builder extends { toJSON(): APIApplicationCommandOption },
>(
	builder: Builder,
	callback?: OptionBuilderCallback<Builder>,
): APIApplicationCommandOption {
	const result = callback?.(builder);
	if (result && result !== builder) {
		return result.toJSON();
	}

	return builder.toJSON();
}

/** Builder used to compose individual slash command subcommands. */
class SubcommandBuilder extends BaseOptionBuilder<APIApplicationCommandSubcommandOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.Subcommand,
			name: "",
			description: "",
			options: [],
		});
	}

	/**
	 * Ensures the subcommand does not exceed Discord's option limit.
	 */
	private assertOptionLimit(additional = 1): void {
		const current = this.data.options?.length ?? 0;
		if (current + additional > MAX_COMMAND_OPTIONS) {
			throw new RangeError(
				`A subcommand can only contain up to ${MAX_COMMAND_OPTIONS} options`,
			);
		}
	}

	/**
	 * Adds a string option configured through the supplied callback.
	 */
	addStringOption(
		callback: OptionBuilderCallback<StringOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new StringOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds a number option configured through the supplied callback.
	 */
	addNumberOption(
		callback: OptionBuilderCallback<NumberOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new NumberOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds an attachment option configured through the supplied callback.
	 */
	addAttachmentOption(
		callback: OptionBuilderCallback<AttachmentOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new AttachmentOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds a user option configured through the supplied callback.
	 */
	addUserOption(callback: OptionBuilderCallback<UserOptionBuilder>): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new UserOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds a role option configured through the supplied callback.
	 */
	addRoleOption(callback: OptionBuilderCallback<RoleOptionBuilder>): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new RoleOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds a mentionable option configured through the supplied callback.
	 */
	addMentionableOption(
		callback: OptionBuilderCallback<MentionableOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new MentionableOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Adds a channel option configured through the supplied callback.
	 */
	addChannelOption(
		callback: OptionBuilderCallback<ChannelOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new ChannelOptionBuilder(),
			callback,
		) as APIApplicationCommandBasicOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Produces a serialisable representation of the subcommand configuration.
	 */
	toJSON(): APIApplicationCommandSubcommandOption {
		return {
			...this.data,
			options:
				this.data.options?.map((option) => cloneOption(option)) ?? [],
		};
	}
}

/** Builder used to compose groups of subcommands. */
class SubcommandGroupBuilder extends BaseOptionBuilder<APIApplicationCommandSubcommandGroupOption> {
	constructor() {
		super({
			type: ApplicationCommandOptionType.SubcommandGroup,
			name: "",
			description: "",
			options: [],
		});
	}

	/**
	 * Ensures the group does not exceed Discord's subcommand limit.
	 */
	private assertSubcommandLimit(additional = 1): void {
		const current = this.data.options?.length ?? 0;
		if (current + additional > MAX_COMMAND_OPTIONS) {
			throw new RangeError(
				`A subcommand group can only contain up to ${MAX_COMMAND_OPTIONS} subcommands`,
			);
		}
	}

	/**
	 * Adds a subcommand configured through the supplied callback.
	 */
	addSubcommand(callback: OptionBuilderCallback<SubcommandBuilder>): this {
		this.assertSubcommandLimit();
		const option = resolveBuilder(
			new SubcommandBuilder(),
			callback,
		) as APIApplicationCommandSubcommandOption;
		this.data.options?.push(option);
		return this;
	}

	/**
	 * Produces a serialisable representation of the subcommand group configuration.
	 */
	toJSON(): APIApplicationCommandSubcommandGroupOption {
		return {
			...this.data,
			options:
				this.data.options?.map((option) => cloneOption(option)) ?? [],
		};
	}
}

type CommandData = Partial<
	Omit<
		RESTPostAPIChatInputApplicationCommandsJSONBody,
		"contexts" | "integration_types"
	>
> & {
	type: ApplicationCommandType.ChatInput;
	contexts?: CommandContext[] | null;
	integration_types?: IntegrationType[];
};

/** Fluent builder for constructing Discord chat input command payloads. */
export class CommandBuilder {
	private readonly data: CommandData = {
		type: ApplicationCommandType.ChatInput,
	};

	/**
	 * Ensures the command does not exceed Discord's option limit.
	 */
	private assertOptionLimit(additional = 1): void {
		const current = this.data.options?.length ?? 0;
		if (current + additional > MAX_COMMAND_OPTIONS) {
			throw new RangeError(
				`A command can only contain up to ${MAX_COMMAND_OPTIONS} options`,
			);
		}
	}

	/**
	 * Sets the command name while validating Discord's requirements.
	 */
	setName(name: string): this {
		assertName(name);
		this.data.name = name;
		return this;
	}

	/**
	 * Sets localized translations for the command name.
	 */
	setNameLocalizations(localizations: LocalizationMap | null): this {
		this.data.name_localizations = localizations ?? null;
		return this;
	}

	/**
	 * Sets the command description while enforcing Discord's length rules.
	 */
	setDescription(description: string): this {
		assertDescription(description);
		this.data.description = description;
		return this;
	}

	/**
	 * Sets localized translations for the command description.
	 */
	setDescriptionLocalizations(localizations: LocalizationMap | null): this {
		this.data.description_localizations = localizations ?? null;
		return this;
	}

	/**
	 * Configures the default member permissions required to use the command.
	 */
	setDefaultMemberPermissions(
		permissions: Permissions | bigint | number | string | null,
	): this {
		if (permissions === null) {
			this.data.default_member_permissions = null;
			return this;
		}

		if (typeof permissions === "bigint") {
			this.data.default_member_permissions = permissions.toString();
			return this;
		}

		if (typeof permissions === "number") {
			this.data.default_member_permissions =
				Math.floor(permissions).toString();
			return this;
		}

		this.data.default_member_permissions = permissions as Permissions;
		return this;
	}

	/**
	 * Sets whether the command is available in direct messages.
	 */
	setDMPermission(dmPermission: boolean): this {
		this.data.dm_permission = dmPermission;
		return this;
	}

	/**
	 * Marks the command as not safe for work.
	 */
	setNSFW(nsfw: boolean): this {
		this.data.nsfw = nsfw;
		return this;
	}

	/**
	 * Limits the contexts in which the command can appear.
	 */
	setContexts(contexts: CommandContext[] | null): this {
		this.data.contexts = contexts ? [...contexts] : null;
		return this;
	}

	/**
	 * Specifies the integration types supported by the command.
	 */
	setIntegrationTypes(integrationTypes: IntegrationType[]): this {
		this.data.integration_types = [...integrationTypes];
		return this;
	}

	/**
	 * Adds a subcommand to the command definition.
	 */
	addSubcommand(callback: OptionBuilderCallback<SubcommandBuilder>): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new SubcommandBuilder(),
			callback,
		) as APIApplicationCommandOption;
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a subcommand group to the command definition.
	 */
	addSubcommandGroup(
		callback: OptionBuilderCallback<SubcommandGroupBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(
			new SubcommandGroupBuilder(),
			callback,
		) as APIApplicationCommandOption;
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a string option to the command definition.
	 */
	addStringOption(
		callback: OptionBuilderCallback<StringOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new StringOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a number option to the command definition.
	 */
	addNumberOption(
		callback: OptionBuilderCallback<NumberOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new NumberOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds an attachment option to the command definition.
	 */
	addAttachmentOption(
		callback: OptionBuilderCallback<AttachmentOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new AttachmentOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a user option to the command definition.
	 */
	addUserOption(callback: OptionBuilderCallback<UserOptionBuilder>): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new UserOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a role option to the command definition.
	 */
	addRoleOption(callback: OptionBuilderCallback<RoleOptionBuilder>): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new RoleOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a mentionable option to the command definition.
	 */
	addMentionableOption(
		callback: OptionBuilderCallback<MentionableOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new MentionableOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Adds a channel option to the command definition.
	 */
	addChannelOption(
		callback: OptionBuilderCallback<ChannelOptionBuilder>,
	): this {
		this.assertOptionLimit();
		const option = resolveBuilder(new ChannelOptionBuilder(), callback);
		this.data.options ??= [];
		this.data.options.push(option);
		return this;
	}

	/**
	 * Produces the final REST payload for the configured command.
	 */
	toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody {
		const { name, description } = this.data;
		if (!name) {
			throw new Error("Command name has not been set");
		}

		if (!description) {
			throw new Error("Command description has not been set");
		}

		const contexts = this.data.contexts;
		const integrationTypes = this.data.integration_types;

		return {
			...this.data,
			name,
			description,
			contexts:
				contexts === null
					? null
					: Array.isArray(contexts)
					? [...contexts]
					: undefined,
			integration_types: Array.isArray(integrationTypes)
				? [...integrationTypes]
				: integrationTypes ?? undefined,
			options:
				this.data.options?.map((option) => cloneOption(option)) ?? [],
		} as RESTPostAPIChatInputApplicationCommandsJSONBody;
	}

	/**
	 * Allows the builder to be coerced into its JSON payload automatically.
	 */
	valueOf(): RESTPostAPIChatInputApplicationCommandsJSONBody {
		return this.toJSON();
	}

	/**
	 * Formats the command as JSON when inspected in Node.js runtimes.
	 */
	[Symbol.for(
		"nodejs.util.inspect.custom",
	)](): RESTPostAPIChatInputApplicationCommandsJSONBody {
		return this.toJSON();
	}
}

export type {
	AttachmentOptionBuilder,
	ChannelOptionBuilder,
	MentionableOptionBuilder,
	NumberOptionBuilder,
	RoleOptionBuilder,
	StringOptionBuilder,
	SubcommandBuilder,
	SubcommandGroupBuilder,
	UserOptionBuilder,
};
