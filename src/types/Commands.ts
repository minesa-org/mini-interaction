import type {
	APIInteractionResponse,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";

import type { CommandInteraction } from "../utils/CommandInteractionOptions.js";

/** Handler signature for slash command executions within MiniInteraction. */
export type SlashCommandHandler = (
	interaction: CommandInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Structure representing a slash command definition and its runtime handler. */
export type MiniInteractionCommand = {
	data: RESTPostAPIChatInputApplicationCommandsJSONBody;
	handler: SlashCommandHandler;
};

/** Map of command names to their registered MiniInteraction command definitions. */
export type MiniInteractionCommandsMap = Map<string, MiniInteractionCommand>;
