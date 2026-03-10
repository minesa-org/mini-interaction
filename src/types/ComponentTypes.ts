import type {
	APIComponentInActionRow,
	APIComponentInMessageActionRow,
	APIModalInteractionResponseCallbackComponent,
} from "discord-api-types/v10";
import type { APIRadioComponent } from "./radio.js";
import type { APICheckboxComponent } from "./checkbox.js";

/** Defines a component structure for use in ActionRow builders. */
export type ActionRowComponent = 
	| APIComponentInActionRow 
	| APIRadioComponent 
	| APICheckboxComponent;

/** Defines a message component structure for use in message builders. */
export type MessageActionRowComponent = 
	| APIComponentInMessageActionRow 
	| APIRadioComponent 
	| APICheckboxComponent;

/** Structure for an action row containing mini-interaction components. */
export interface MiniActionRow<T extends ActionRowComponent = ActionRowComponent> {
	type: 1; // ComponentType.ActionRow
	components: T[];
}

/** Structure for a message action row containing mini-interaction components. */
export interface MessageMiniActionRow<T extends MessageActionRowComponent = MessageActionRowComponent> {
	type: 1; // ComponentType.ActionRow
	components: T[];
}

/** Generic type for any supported interaction component data. */
export type InteractionComponentData = 
	| MessageActionRowComponent 
	| APIModalInteractionResponseCallbackComponent;
