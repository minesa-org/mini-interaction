import type {
        APIInteractionResponse,
        RESTPostAPIChatInputApplicationCommandsJSONBody,
        RESTPostAPIContextMenuApplicationCommandsJSONBody,
        RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody,
} from "discord-api-types/v10";

import type { CommandInteraction } from "../utils/CommandInteractionOptions.js";
import type {
        UserContextMenuInteraction,
        MessageContextMenuInteraction,
        AppCommandInteraction,
} from "../utils/ContextMenuInteraction.js";
import type {
        MiniInteractionComponent,
        MiniInteractionModal,
} from "../clients/MiniInteraction.js";
import type { CommandBuilder } from "../commands/CommandBuilder.js";
import type {
        MessageCommandBuilder,
        UserCommandBuilder,
        AppCommandBuilder,
} from "../commands/ContextMenuCommandBuilder.js";

/** Handler signature for slash command executions within MiniInteraction. */
export type SlashCommandHandler = (
	interaction: CommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature for user context menu command executions within MiniInteraction. */
export type UserCommandHandler = (
	interaction: UserContextMenuInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature for message context menu command executions within MiniInteraction. */
export type MessageCommandHandler = (
        interaction: MessageContextMenuInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature for primary entry point command executions within MiniInteraction. */
export type AppCommandHandler = (
        interaction: AppCommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Union of all command handler types. */
export type CommandHandler =
        | SlashCommandHandler
        | UserCommandHandler
        | MessageCommandHandler
        | AppCommandHandler;

/** Structure representing a slash command definition and its runtime handler. */
export type MiniInteractionCommand = {
        data:
                | RESTPostAPIChatInputApplicationCommandsJSONBody
                | RESTPostAPIContextMenuApplicationCommandsJSONBody
                | RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody
                | CommandBuilder
                | UserCommandBuilder
                | MessageCommandBuilder
                | AppCommandBuilder;
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
