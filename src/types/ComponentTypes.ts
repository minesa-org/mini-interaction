import type {
	APIComponentInActionRow,
	APIComponentInMessageActionRow,
} from "discord-api-types/v10";

/** Defines a component structure for use in ActionRow builders. */
export type ActionRowComponent = APIComponentInActionRow;

/** Defines a message component structure for use in message builders. */
export type MessageActionRowComponent = APIComponentInMessageActionRow;
