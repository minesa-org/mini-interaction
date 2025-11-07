import {
	ApplicationCommandType,
	type LocalizationMap,
	type Permissions,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import { CommandContext, IntegrationType } from "./CommandBuilder.js";

/**
 * Base data structure for context menu commands.
 */
type ContextMenuCommandData = Partial<
	Omit<
		RESTPostAPIContextMenuApplicationCommandsJSONBody,
		"contexts" | "integration_types" | "type"
	>
> & {
	type: ApplicationCommandType.User | ApplicationCommandType.Message;
	contexts?: CommandContext[] | null;
	integration_types?: IntegrationType[];
};

/**
 * Base builder for context menu commands (User and Message commands).
 */
abstract class BaseContextMenuCommandBuilder<
	T extends ApplicationCommandType.User | ApplicationCommandType.Message,
> {
	protected readonly data: ContextMenuCommandData;

	constructor(type: T) {
		this.data = {
			type,
		};
	}

	/**
	 * Sets the command name.
	 * Context menu command names can be up to 32 characters and are displayed in the UI.
	 */
	setName(name: string): this {
		if (!name || name.length === 0) {
			throw new Error("Context menu command name cannot be empty");
		}
		if (name.length > 32) {
			throw new RangeError(
				"Context menu command name cannot exceed 32 characters",
			);
		}
		this.data.name = name;
		return this;
	}

	/**
	 * Sets the localized names for the command.
	 */
	setNameLocalizations(nameLocalizations: LocalizationMap | null): this {
		this.data.name_localizations = nameLocalizations ?? undefined;
		return this;
	}

	/**
	 * Sets the default member permissions required to use this command.
	 */
	setDefaultMemberPermissions(permissions: Permissions | null): this {
		this.data.default_member_permissions =
			permissions === null ? null : String(permissions);
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
	 * Produces the final REST payload for the configured command.
	 */
	toJSON(): RESTPostAPIContextMenuApplicationCommandsJSONBody {
		const { name, type } = this.data;
		if (!name) {
			throw new Error("Context menu command name has not been set");
		}

		const contexts = this.data.contexts;
		const integrationTypes = this.data.integration_types;

		return {
			...this.data,
			name,
			type,
			contexts:
				contexts === null
					? null
					: Array.isArray(contexts)
					? [...contexts]
					: undefined,
			integration_types: Array.isArray(integrationTypes)
				? [...integrationTypes]
				: integrationTypes ?? undefined,
		} as RESTPostAPIContextMenuApplicationCommandsJSONBody;
	}

	/**
	 * Allows the builder to be coerced into its JSON payload automatically.
	 */
	valueOf(): RESTPostAPIContextMenuApplicationCommandsJSONBody {
		return this.toJSON();
	}

	/**
	 * Formats the command as JSON when inspected in Node.js runtimes.
	 */
	[Symbol.for(
		"nodejs.util.inspect.custom",
	)](): RESTPostAPIContextMenuApplicationCommandsJSONBody {
		return this.toJSON();
	}
}

/**
 * Builder for User context menu commands.
 * These commands appear when right-clicking on a user.
 *
 * @example
 * ```typescript
 * const userCommand = new UserCommandBuilder()
 *   .setName('User Info')
 *   .toJSON();
 * ```
 */
export class UserCommandBuilder extends BaseContextMenuCommandBuilder<ApplicationCommandType.User> {
	constructor() {
		super(ApplicationCommandType.User);
	}
}

/**
 * Builder for Message context menu commands.
 * These commands appear when right-clicking on a message.
 *
 * @example
 * ```typescript
 * const messageCommand = new MessageCommandBuilder()
 *   .setName('Report Message')
 *   .toJSON();
 * ```
 */
export class MessageCommandBuilder extends BaseContextMenuCommandBuilder<ApplicationCommandType.Message> {
	constructor() {
		super(ApplicationCommandType.Message);
	}
}

