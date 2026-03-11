import assert from "node:assert/strict";
import test from "node:test";

import { MessageFlags } from "discord-api-types/v10";

import { ContainerBuilder, TextDisplayBuilder } from "../../../builders/index.js";
import { DiscordRestClient } from "../DiscordRestClient.js";

test("sendMessage sends channel messages and returns a thread-capable wrapper", async () => {
	const calls: Array<{ input: string; init: RequestInit }> = [];
	const fetchImpl: typeof fetch = (async (input, init) => {
		calls.push({ input: String(input), init: init ?? {} });

		if (calls.length === 1) {
			return new Response(
				JSON.stringify({ id: "msg_1", channel_id: "chan_1" }),
				{ status: 200 },
			);
		}

		return new Response(
			JSON.stringify({ id: "thread_1", type: 11, parent_id: "chan_1" }),
			{ status: 200 },
		);
	}) as typeof fetch;

	const rest = new DiscordRestClient({
		token: "token",
		applicationId: "app",
		fetchImplementation: fetchImpl,
	});

	const container = new ContainerBuilder().addComponent(
		new TextDisplayBuilder().setContent("Hello"),
	);

	const sentMessage = await rest.send({
		channelId: "chan_1",
		components: [container],
		flags: MessageFlags.IsComponentsV2,
	});

	assert.equal(sentMessage.id, "msg_1");

	await sentMessage.startThread({
		name: "Thread name",
		autoArchiveDuration: 60,
		reason: "Testing",
	});

	assert.equal(calls.length, 2);
	assert.match(calls[0].input, /\/channels\/chan_1\/messages$/);
	assert.match(calls[1].input, /\/channels\/chan_1\/messages\/msg_1\/threads$/);
	assert.match(String(calls[0].init.body), /payload|components|flags/);
});

test("sentMessage.react supports custom emoji strings and emoji objects", async () => {
	const calls: Array<{ input: string; init: RequestInit }> = [];
	const fetchImpl: typeof fetch = (async (input, init) => {
		calls.push({ input: String(input), init: init ?? {} });

		if (calls.length === 1) {
			return new Response(
				JSON.stringify({ id: "msg_react", channel_id: "chan_react" }),
				{ status: 200 },
			);
		}

		return new Response(null, { status: 204 });
	}) as typeof fetch;

	const rest = new DiscordRestClient({
		token: "token",
		applicationId: "app",
		fetchImplementation: fetchImpl,
	});

	const sentMessage = await rest.sendMessage({
		channelId: "chan_react",
		content: "React to me",
	});

	await sentMessage.react("<:wave:1234567890>");
	await sentMessage.react({ name: "thumbsup", id: "999" });

	assert.equal(calls.length, 3);
	assert.match(
		calls[1].input,
		/\/channels\/chan_react\/messages\/msg_react\/reactions\/wave%3A1234567890\/@me$/,
	);
	assert.match(
		calls[2].input,
		/\/channels\/chan_react\/messages\/msg_react\/reactions\/thumbsup%3A999\/@me$/,
	);
});

test("sendMessage uses multipart form-data when files are provided", async () => {
	let capturedBody: BodyInit | null | undefined;
	const fetchImpl: typeof fetch = (async (_input, init) => {
		capturedBody = init?.body;
		return new Response(
			JSON.stringify({ id: "msg_file", channel_id: "chan_file" }),
			{ status: 200 },
		);
	}) as typeof fetch;

	const rest = new DiscordRestClient({
		token: "token",
		applicationId: "app",
		fetchImplementation: fetchImpl,
	});

	await rest.sendMessage({
		channelId: "chan_file",
		content: "with file",
		files: [
			{
				name: "hello.txt",
				data: new TextEncoder().encode("hello world"),
				contentType: "text/plain",
			},
		],
	});

	assert.ok(capturedBody instanceof FormData);
	const payloadJson = capturedBody.get("payload_json");
	assert.equal(typeof payloadJson, "string");
	assert.match(String(payloadJson), /hello\.txt/);
});

test("webhook.send returns a sent message wrapper", async () => {
	const calls: Array<{ input: string; init: RequestInit }> = [];
	const fetchImpl: typeof fetch = (async (input, init) => {
		calls.push({ input: String(input), init: init ?? {} });
		return new Response(
			JSON.stringify({ id: "msg_hook", channel_id: "chan_hook" }),
			{ status: 200 },
		);
	}) as typeof fetch;

	const rest = new DiscordRestClient({
		token: "token",
		applicationId: "app",
		fetchImplementation: fetchImpl,
	});

	const webhook = rest.webhook("wh_1", "wh_token");
	const sentMessage = await webhook.send({
		content: "hello",
		threadId: "thread_123",
		username: "Mini",
	});

	assert.equal(sentMessage.id, "msg_hook");
	assert.match(calls[0].input, /\/webhooks\/wh_1\/wh_token\?wait=true&thread_id=thread_123$/);
	assert.match(String(calls[0].init.body), /"username":"Mini"/);
});

test("sendMessage rejects ephemeral flags for regular messages", async () => {
	const rest = new DiscordRestClient({
		token: "token",
		applicationId: "app",
		fetchImplementation: (async () =>
			new Response(JSON.stringify({ id: "x", channel_id: "y" }), {
				status: 200,
			})) as typeof fetch,
	});

	await assert.rejects(
		() =>
			rest.sendMessage({
				channelId: "chan",
				content: "nope",
				flags: MessageFlags.Ephemeral,
			}),
		/regular channel or webhook messages/,
	);
});
