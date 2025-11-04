import type {
	APIComponentInActionRow,
	APIComponentInMessageActionRow,
} from "discord-api-types/v10";

/** * Components that can appear inside a Discord action row container. */
export type MiniComponentMessageActionRow = APIComponentInMessageActionRow;

/** Components that are valid inside message action rows. */
export type MiniComponentActionRow = APIComponentInActionRow;
