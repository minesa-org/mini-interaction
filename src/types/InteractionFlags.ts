import { MessageFlags } from "discord-api-types/v10";

/** Flags available for interaction responses. */
export enum InteractionFlags {
	Ephemeral = MessageFlags.Ephemeral,
	IsComponentsV2 = MessageFlags.IsComponentsV2,
}

/** @deprecated Use InteractionFlags instead. */
export { InteractionFlags as InteractionReplyFlags };
/** @deprecated Use InteractionFlags instead. */
export { InteractionFlags as InteractionFollowUpFlags };
