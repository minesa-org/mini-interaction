import { MessageFlags } from "discord-api-types/v10";

export enum InteractionFlags {
	Ephemeral = MessageFlags.Ephemeral,
	IsComponentsV2 = 32768,
	SuppressEmbeds = MessageFlags.SuppressEmbeds,
}

