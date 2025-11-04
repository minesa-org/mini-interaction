import { MessageFlags } from "discord-api-types/v10";

/** Flags available when responding directly to an interaction. */
export enum InteractionReplyFlags {
	Ephemeral = MessageFlags.Ephemeral,
	IsComponentsV2 = MessageFlags.IsComponentsV2,
}

/** Flags available when sending a follow-up message for an interaction. */
export enum InteractionFollowUpFlags {
	Ephemeral = MessageFlags.Ephemeral,
	IsComponentsV2 = MessageFlags.IsComponentsV2,
}
