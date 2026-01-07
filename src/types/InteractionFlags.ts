import { MessageFlags } from "discord-api-types/v10";

export enum InteractionFlags {
	Ephemeral = MessageFlags.Ephemeral,
	IsComponentsV2 = MessageFlags.IsComponentsV2,
	SuppressEmbeds = MessageFlags.SuppressEmbeds,
}

/** @deprecated Use InteractionFlags instead. */
export { InteractionFlags as InteractionReplyFlags };
/** @deprecated Use InteractionFlags instead. */
export { InteractionFlags as InteractionFollowUpFlags };
