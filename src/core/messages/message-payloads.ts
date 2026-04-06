import { MessageFlags } from "discord-api-types/v10";

import type { APIAllowedMentions } from "discord-api-types/v10";

import {
	normaliseInteractionMessageData,
	type InteractionMessageData,
	type MessageFlagLike,
} from "../../utils/interactionMessageHelpers.js";

export type DiscordMessageFile = {
	name: string;
	data: ArrayBuffer | Blob | Buffer | Uint8Array;
	contentType?: string;
};

export type BaseDiscordMessageOptions = Omit<InteractionMessageData, "flags"> & {
	flags?: MessageFlagLike | MessageFlagLike[];
	allowedMentions?: APIAllowedMentions;
	attachments?: Array<Record<string, unknown>>;
	stickerIds?: string[];
	files?: DiscordMessageFile[];
};

export type DiscordSendMessageOptions = BaseDiscordMessageOptions & {
	channelId: string;
};

export type DiscordStartThreadOptions = {
	channelId: string;
	messageId: string;
	name: string;
	autoArchiveDuration?: number;
	rateLimitPerUser?: number;
	reason?: string;
};

export type DiscordWebhookSendOptions = BaseDiscordMessageOptions & {
	threadId?: string;
	username?: string;
	avatarUrl?: string;
};

export type DiscordReaction =
	| string
	| {
			name: string;
			id?: string;
			animated?: boolean;
	  };

export function normaliseDiscordMessagePayload(
	options: BaseDiscordMessageOptions,
): Record<string, unknown> {
	const payload = normaliseInteractionMessageData({
		content: options.content,
		components: options.components,
		embeds: options.embeds,
		flags: options.flags,
	}) as Record<string, unknown> | undefined;

	const resolvedPayload: Record<string, unknown> = payload ? { ...payload } : {};

	const flags = resolvedPayload.flags;
	if (typeof flags === "number" && (flags & MessageFlags.Ephemeral) === MessageFlags.Ephemeral) {
		throw new Error(
			"[MiniInteraction] Ephemeral flags are not supported for regular channel or webhook messages.",
		);
	}

	if (options.allowedMentions) {
		resolvedPayload.allowed_mentions = options.allowedMentions;
	}

	if (options.stickerIds && options.stickerIds.length > 0) {
		resolvedPayload.sticker_ids = options.stickerIds;
	}

	const files = options.files ?? [];
	if (options.attachments && options.attachments.length > 0) {
		resolvedPayload.attachments = options.attachments;
	} else if (files.length > 0) {
		resolvedPayload.attachments = files.map((file, index) => ({
			id: String(index),
			filename: file.name,
		}));
	}

	return resolvedPayload;
}

export function createMessageRequestInit(
	options: BaseDiscordMessageOptions,
): {
	body: BodyInit;
	headers?: HeadersInit;
} {
	const payload = normaliseDiscordMessagePayload(options);
	const files = options.files ?? [];

	if (files.length === 0) {
		return {
			body: JSON.stringify(payload),
			headers: {
				"Content-Type": "application/json",
			},
		};
	}

	const formData = new FormData();
	formData.set("payload_json", JSON.stringify(payload));

	files.forEach((file, index) => {
		formData.append(`files[${index}]`, toBlob(file), file.name);
	});

	return { body: formData };
}

function toBlob(file: DiscordMessageFile): Blob {
	if (file.data instanceof Blob) {
		return file.data;
	}

	if (file.data instanceof ArrayBuffer) {
		return new Blob(
			[file.data],
			file.contentType ? { type: file.contentType } : undefined,
		);
	}

	const bytes = Uint8Array.from(file.data as ArrayLike<number>);

	return new Blob([bytes.buffer], file.contentType ? { type: file.contentType } : undefined);
}
