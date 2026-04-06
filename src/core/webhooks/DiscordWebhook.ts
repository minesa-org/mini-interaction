import type { APIMessage } from "discord-api-types/v10";

import type { DiscordRestClient } from "../http/DiscordRestClient.js";
import { DiscordSentMessage } from "../messages/DiscordSentMessage.js";
import {
	createMessageRequestInit,
	type DiscordWebhookSendOptions,
} from "../messages/message-payloads.js";

export class DiscordWebhook {
	constructor(
		private readonly rest: DiscordRestClient,
		public readonly id: string,
		public readonly token: string,
	) {}

	async send(options: DiscordWebhookSendOptions): Promise<DiscordSentMessage> {
		const { threadId, username, avatarUrl, ...messageOptions } = options;
		const requestInit = createMessageRequestInit(messageOptions);
		const searchParams = new URLSearchParams({ wait: "true" });

		if (threadId) {
			searchParams.set("thread_id", threadId);
		}

		const message = await this.rest.request<APIMessage>(
			`/webhooks/${this.id}/${this.token}?${searchParams.toString()}`,
			{
				method: "POST",
				body: appendWebhookPayload(requestInit.body, {
					username,
					avatar_url: avatarUrl,
				}),
				headers: requestInit.headers,
				authenticated: false,
			},
		);

		return new DiscordSentMessage(this.rest, message);
	}
}

function appendWebhookPayload(
	body: BodyInit,
	webhookOverrides: {
		username?: string;
		avatar_url?: string;
	},
): BodyInit {
	if (body instanceof FormData) {
		const payload = JSON.parse(String(body.get("payload_json") ?? "{}")) as Record<string, unknown>;
		if (webhookOverrides.username) payload.username = webhookOverrides.username;
		if (webhookOverrides.avatar_url) payload.avatar_url = webhookOverrides.avatar_url;
		body.set("payload_json", JSON.stringify(payload));
		return body;
	}

	const payload = JSON.parse(String(body)) as Record<string, unknown>;
	if (webhookOverrides.username) payload.username = webhookOverrides.username;
	if (webhookOverrides.avatar_url) payload.avatar_url = webhookOverrides.avatar_url;
	return JSON.stringify(payload);
}
