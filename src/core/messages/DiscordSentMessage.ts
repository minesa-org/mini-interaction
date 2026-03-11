import type { APIChannel, APIMessage } from "discord-api-types/v10";

import type { DiscordRestClient } from "../http/DiscordRestClient.js";
import type { DiscordStartThreadOptions } from "./message-payloads.js";

export class DiscordSentMessage {
	constructor(
		private readonly rest: DiscordRestClient,
		public readonly raw: APIMessage,
	) {}

	get id(): string {
		return this.raw.id;
	}

	get channelId(): string {
		return this.raw.channel_id;
	}

	async startThread(
		options: Omit<DiscordStartThreadOptions, "channelId" | "messageId">,
	): Promise<APIChannel> {
		return this.rest.startThread({
			channelId: this.channelId,
			messageId: this.id,
			...options,
		});
	}

	toJSON(): APIMessage {
		return this.raw;
	}
}
