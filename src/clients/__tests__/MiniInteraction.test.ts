import assert from "node:assert/strict";
import test from "node:test";

import { MiniInteraction } from "../MiniInteraction.js";
import { RoleConnectionMetadataTypes } from "../../types/RoleConnectionMetadataTypes.js";

test("registerMetadata sends the Discord payload and returns the response", async () => {
	const originalAppId = process.env.DISCORD_APPLICATION_ID;
	process.env.DISCORD_APPLICATION_ID = "app_123";

	const calls: Array<{ input: string; init?: RequestInit }> = [];
	const fetchImpl: typeof fetch = (async (input, init) => {
		calls.push({ input: String(input), init });
		return new Response(
			JSON.stringify([
				{
					key: "is_miniapp",
					name: "Is Mini App?",
					description: "Is the user an assistant?",
					type: RoleConnectionMetadataTypes.BooleanEqual,
					name_localizations: { tr: "Mini Uygulama mi?" },
					description_localizations: { tr: "Kullanici bir assistant mi?" },
				},
			]),
			{ status: 200 },
		);
	}) as typeof fetch;

	try {
		const mini = new MiniInteraction({ fetchImplementation: fetchImpl });
		const metadata = await mini.registerMetadata("bot-token", [
			{
				key: "is_miniapp",
				name: "Is Mini App?",
				description: "Is the user an assistant?",
				type: RoleConnectionMetadataTypes.BooleanEqual,
				name_localizations: { tr: "Mini Uygulama mi?" },
				description_localizations: { tr: "Kullanici bir assistant mi?" },
			},
		]);

		assert.equal(calls.length, 1);
		assert.equal(
			calls[0]?.input,
			"https://discord.com/api/v10/applications/app_123/role-connections/metadata",
		);
		assert.equal(calls[0]?.init?.method, "PUT");
		assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), [
			{
				key: "is_miniapp",
				name: "Is Mini App?",
				description: "Is the user an assistant?",
				type: RoleConnectionMetadataTypes.BooleanEqual,
				name_localizations: { tr: "Mini Uygulama mi?" },
				description_localizations: { tr: "Kullanici bir assistant mi?" },
			},
		]);
		assert.deepEqual(metadata, [
			{
				key: "is_miniapp",
				name: "Is Mini App?",
				description: "Is the user an assistant?",
				type: RoleConnectionMetadataTypes.BooleanEqual,
				name_localizations: { tr: "Mini Uygulama mi?" },
				description_localizations: { tr: "Kullanici bir assistant mi?" },
			},
		]);
	} finally {
		if (originalAppId === undefined) {
			delete process.env.DISCORD_APPLICATION_ID;
		} else {
			process.env.DISCORD_APPLICATION_ID = originalAppId;
		}
	}
});

test("registerMetadata throws when metadata is empty", async () => {
	const mini = new MiniInteraction({ applicationId: "app_123" });

	await assert.rejects(
		() => mini.registerMetadata("bot-token", []),
		/\[MiniInteraction\] metadata must be a non-empty array payload/,
	);
});

test("registerMetadata throws when application id cannot be resolved", async () => {
	const originalAppId = process.env.DISCORD_APPLICATION_ID;
	delete process.env.DISCORD_APPLICATION_ID;

	try {
		const mini = new MiniInteraction();

		await assert.rejects(
			() =>
				mini.registerMetadata("bot-token", [
					{
						key: "is_miniapp",
						name: "Is Mini App?",
						description: "Is the user an assistant?",
						type: RoleConnectionMetadataTypes.BooleanEqual,
					},
				]),
			/\[MiniInteraction\] Missing Discord application ID/,
		);
	} finally {
		if (originalAppId === undefined) {
			delete process.env.DISCORD_APPLICATION_ID;
		} else {
			process.env.DISCORD_APPLICATION_ID = originalAppId;
		}
	}
});

test("registerMetadata includes the response body in thrown errors", async () => {
	const fetchImpl: typeof fetch = (async () =>
		new Response(JSON.stringify({ message: "Bad metadata" }), {
			status: 400,
		})) as typeof fetch;

	const mini = new MiniInteraction({
		applicationId: "app_123",
		fetchImplementation: fetchImpl,
	});

	await assert.rejects(
		() =>
			mini.registerMetadata("bot-token", [
				{
					key: "is_miniapp",
					name: "Is Mini App?",
					description: "Is the user an assistant?",
					type: RoleConnectionMetadataTypes.BooleanEqual,
				},
			]),
		/\[DiscordRestClient\] PUT \/applications\/app_123\/role-connections\/metadata failed: 400 {"message":"Bad metadata"}/,
	);
});
