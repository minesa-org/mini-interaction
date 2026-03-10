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

/** Generic type for any supported interaction component data. */
export type InteractionComponentData = 
	| MessageActionRowComponent 
	| APIModalInteractionResponseCallbackComponent;
