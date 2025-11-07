import type {
	APIInteractionResponse,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
	APIUserApplicationCommandInteraction,
	APIMessageApplicationCommandInteraction,
} from "discord-api-types/v10";

import type { CommandInteraction } from "../utils/CommandInteractionOptions.js";
import type {
	MiniInteractionComponent,
	MiniInteractionModal,
} from "../clients/MiniInteraction.js";

/** Handler signature for slash command executions within MiniInteraction. */
export type SlashCommandHandler = (
	interaction: CommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature for user context menu command executions within MiniInteraction. */
export type UserCommandHandler = (
	interaction: APIUserApplicationCommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature for message context menu command executions within MiniInteraction. */
export type MessageCommandHandler = (
	interaction: APIMessageApplicationCommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Union of all command handler types. */
export type CommandHandler =
	| SlashCommandHandler
	| UserCommandHandler
	| MessageCommandHandler;

/** Structure representing a slash command definition and its runtime handler. */
export type MiniInteractionCommand = {
	data:
		| RESTPostAPIChatInputApplicationCommandsJSONBody
		| RESTPostAPIContextMenuApplicationCommandsJSONBody;
	handler: CommandHandler;
	/**
	 * Optional array of component handlers related to this command.
	 * These will be automatically registered when the command is loaded.
	 */
	components?: MiniInteractionComponent[];
	/**
	 * Optional array of modal handlers related to this command.
	 * These will be automatically registered when the command is loaded.
	 */
	modals?: MiniInteractionModal[];
};

/** Map of command names to their registered MiniInteraction command definitions. */
export type MiniInteractionCommandsMap = Map<string, MiniInteractionCommand>;
