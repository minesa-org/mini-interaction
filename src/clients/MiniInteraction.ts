import { readdir, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
	APIChatInputApplicationCommandInteraction,
	APIMessageComponentInteraction,
} from "discord-api-types/v10";
import {
	APIInteraction,
	APIInteractionResponse,
	InteractionResponseType,
	InteractionType,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { verifyKey } from "discord-interactions";

import { DISCORD_BASE_URL } from "../utils/constants.js";
import type { MiniInteractionCommand } from "../types/Commands.js";
import { RoleConnectionMetadataTypes } from "../types/RoleConnectionMetadataTypes.js";
import { createCommandInteraction } from "../utils/CommandInteractionOptions.js";
import {
	createMessageComponentInteraction,
	type MessageComponentInteraction,
} from "../utils/MessageComponentInteraction.js";

/** File extensions that are treated as command modules when auto-loading. */
const SUPPORTED_COMMAND_EXTENSIONS = new Set([
	".js",
	".mjs",
	".cjs",
	".ts",
	".mts",
	".cts",
]);

/** Configuration parameters for the MiniInteraction client. */
export type MiniInteractionOptions = {
	applicationId: string;
	publicKey: string;
	commandsDirectory?: string | false;
	fetchImplementation?: typeof fetch;
	verifyKeyImplementation?: VerifyKeyFunction;
};

/** Payload structure for role connection metadata registration. */
export type RoleConnectionMetadataField = {
	key: string;
	name: string;
	description: string;
	type: RoleConnectionMetadataTypes;
};

/**
 * HTTP request information needed to validate and handle Discord interaction payloads.
 */
export type MiniInteractionRequest = {
	body: string | Uint8Array;
	signature?: string;
	timestamp?: string;
};

/** Result payload returned by request handlers when processing an interaction. */
export type MiniInteractionHandlerResult = {
	status: number;
	body: APIInteractionResponse | { error: string };
};

/** Handler signature invoked for Discord message component interactions. */
export type MiniInteractionComponentHandler = (
	interaction: MessageComponentInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Structure describing a component handler mapped to a custom id. */
export type MiniInteractionComponent = {
	customId: string;
	handler: MiniInteractionComponentHandler;
};

/** Node.js HTTP handler compatible with frameworks like Express or Next.js API routes. */
export type MiniInteractionNodeHandler = (
	request: IncomingMessage,
	response: ServerResponse,
) => void;

/** Web Fetch API compatible request handler for platforms such as Cloudflare Workers. */
export type MiniInteractionFetchHandler = (
	request: Request,
) => Promise<Response>;

/**
 * Minimal interface describing a function capable of verifying Discord interaction signatures.
 */
type VerifyKeyFunction = (
	message: string | Uint8Array,
	signature: string,
	timestamp: string,
	publicKey: string,
) => boolean | Promise<boolean>;

/**
 * Lightweight client for registering, loading, and handling Discord slash command interactions.
 */
export class MiniInteraction {
	public readonly applicationId: string;
	public readonly publicKey: string;
	private readonly baseUrl: string;
	private readonly fetchImpl: typeof fetch;
	private readonly verifyKeyImpl: VerifyKeyFunction;
	private readonly commandsDirectory: string | null;
	private readonly commands = new Map<string, MiniInteractionCommand>();
	private readonly componentHandlers = new Map<
		string,
		MiniInteractionComponentHandler
	>();
	private commandsLoaded = false;
	private loadCommandsPromise: Promise<void> | null = null;

	/**
	 * Creates a new MiniInteraction client with optional command auto-loading and custom runtime hooks.
	 */
	constructor({
		applicationId,
		publicKey,
		commandsDirectory,
		fetchImplementation,
		verifyKeyImplementation,
	}: MiniInteractionOptions) {
		if (!applicationId) {
			throw new Error("[MiniInteraction] applicationId is required");
		}

		if (!publicKey) {
			throw new Error("[MiniInteraction] publicKey is required");
		}

		const fetchImpl = fetchImplementation ?? globalThis.fetch;
		if (typeof fetchImpl !== "function") {
			throw new Error(
				"[MiniInteraction] fetch is not available. Provide a global fetch implementation.",
			);
		}

		this.applicationId = applicationId;
		this.publicKey = publicKey;
		this.baseUrl = DISCORD_BASE_URL;
		this.fetchImpl = fetchImpl;
		this.verifyKeyImpl = verifyKeyImplementation ?? verifyKey;
		this.commandsDirectory =
			commandsDirectory === false
				? null
				: this.resolveCommandsDirectory(commandsDirectory);
	}

	/**
	 * Registers a single command handler with the client.
	 *
	 * @param command - The command definition to register.
	 */
	useCommand(command: MiniInteractionCommand): this {
		const commandName = command?.data?.name;
		if (!commandName) {
			throw new Error("[MiniInteraction] command.data.name is required");
		}

		if (this.commands.has(commandName)) {
			console.warn(
				`[MiniInteraction] Command "${commandName}" already exists and will be overwritten.`,
			);
		}

		this.commands.set(commandName, command);
		return this;
	}

	/**
	 * Registers multiple command handlers with the client.
	 *
	 * @param commands - The command definitions to register.
	 */
	useCommands(commands: MiniInteractionCommand[]): this {
		for (const command of commands) {
			this.useCommand(command);
		}

		return this;
	}

	/**
	 * Registers a single component handler mapped to a custom identifier.
	 *
	 * @param component - The component definition to register.
	 */
	useComponent(component: MiniInteractionComponent): this {
		const customId = component?.customId;
		if (!customId) {
			throw new Error("[MiniInteraction] component.customId is required");
		}

		if (typeof component.handler !== "function") {
			throw new Error(
				"[MiniInteraction] component.handler must be a function",
			);
		}

		if (this.componentHandlers.has(customId)) {
			console.warn(
				`[MiniInteraction] Component "${customId}" already exists and will be overwritten.`,
			);
		}

		this.componentHandlers.set(customId, component.handler);
		return this;
	}

	/**
	 * Registers multiple component handlers in a single call.
	 *
	 * @param components - The component definitions to register.
	 */
	useComponents(components: MiniInteractionComponent[]): this {
		for (const component of components) {
			this.useComponent(component);
		}

		return this;
	}

	/**
	 * Recursively loads commands from the configured commands directory.
	 *
	 * @param directory - Optional directory override for command discovery.
	 */
	async loadCommandsFromDirectory(directory?: string): Promise<this> {
		const targetDirectory =
			directory !== undefined
				? this.resolveCommandsDirectory(directory)
				: this.commandsDirectory;

		if (!targetDirectory) {
			throw new Error(
				"[MiniInteraction] Commands directory support disabled. Provide a directory path.",
			);
		}

		const exists = await this.pathExists(targetDirectory);
		if (!exists) {
			this.commandsLoaded = true;
			console.warn(
				`[MiniInteraction] Commands directory "${targetDirectory}" does not exist. Skipping command auto-load.`,
			);
			return this;
		}

		const files = await this.collectCommandFiles(targetDirectory);

		if (files.length === 0) {
			this.commandsLoaded = true;
			console.warn(
				`[MiniInteraction] No command files found under "${targetDirectory}".`,
			);
			return this;
		}

		for (const file of files) {
			const command = await this.importCommandModule(file);
			if (!command) {
				continue;
			}

			this.commands.set(command.data.name, command);
		}

		this.commandsLoaded = true;

		return this;
	}

	/**
	 * Lists the raw command data payloads for registration with Discord.
	 */
	listCommandData(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
		return Array.from(this.commands.values(), (command) => command.data);
	}

	/**
	 * Registers slash commands with Discord's REST API.
	 *
	 * @param botToken - The bot token authorising the registration request.
	 * @param commands - Optional command list to register instead of auto-loaded commands.
	 */
	async registerCommands(
		botToken: string,
		commands?: RESTPostAPIChatInputApplicationCommandsJSONBody[],
	): Promise<unknown> {
		if (!botToken) {
			throw new Error("[MiniInteraction] botToken is required");
		}

		let resolvedCommands = commands;
		if (!resolvedCommands || resolvedCommands.length === 0) {
			await this.ensureCommandsLoaded();
			resolvedCommands = this.listCommandData();
		}

		if (!Array.isArray(resolvedCommands) || resolvedCommands.length === 0) {
			throw new Error(
				"[MiniInteraction] commands must be a non-empty array payload",
			);
		}

		const url = `${this.baseUrl}/applications/${this.applicationId}/commands`;

		const response = await this.fetchImpl(url, {
			method: "PUT",
			headers: {
				Authorization: `Bot ${botToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(resolvedCommands),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(
				`[MiniInteraction] Failed to register commands: [${response.status}] ${errorBody}`,
			);
		}

		return response.json();
	}

	/**
	 * Registers role connection metadata with Discord's REST API.
	 *
	 * @param botToken - The bot token authorising the request.
	 * @param metadata - The metadata collection to register.
	 */
	async registerMetadata(
		botToken: string,
		metadata: RoleConnectionMetadataField[],
	): Promise<unknown> {
		if (!botToken) {
			throw new Error("[MiniInteraction] botToken is required");
		}

		if (!Array.isArray(metadata) || metadata.length === 0) {
			throw new Error(
				"[MiniInteraction] metadata must be a non-empty array payload",
			);
		}

		const url = `${this.baseUrl}/applications/${this.applicationId}/role-connections/metadata`;

		const response = await this.fetchImpl(url, {
			method: "PUT",
			headers: {
				Authorization: `Bot ${botToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(metadata),
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(
				`[MiniInteraction] Failed to register metadata: [${response.status}] ${errorBody}`,
			);
		}

		return response.json();
	}

	/**
	 * Validates and handles a single Discord interaction request.
	 *
	 * @param request - The request payload containing headers and body data.
	 */
	async handleRequest(
		request: MiniInteractionRequest,
	): Promise<MiniInteractionHandlerResult> {
		const { body, signature, timestamp } = request;

		if (!signature || !timestamp) {
			return {
				status: 401,
				body: { error: "[MiniInteraction] Missing signature headers" },
			};
		}

		const rawBody = this.normalizeBody(body);

		const verified = await this.verifyKeyImpl(
			rawBody,
			signature,
			timestamp,
			this.publicKey,
		);
		if (!verified) {
			return {
				status: 401,
				body: {
					error: "[MiniInteraction] Signature verification failed",
				},
			};
		}

		let interaction: APIInteraction;

		try {
			interaction = JSON.parse(rawBody) as APIInteraction;
		} catch {
			return {
				status: 400,
				body: {
					error: "[MiniInteraction] Invalid interaction payload",
				},
			};
		}

		if (interaction.type === InteractionType.Ping) {
			return {
				status: 200,
				body: { type: InteractionResponseType.Pong },
			};
		}

		if (interaction.type === InteractionType.ApplicationCommand) {
			return this.handleApplicationCommand(interaction);
		}

		if (interaction.type === InteractionType.MessageComponent) {
			return this.handleMessageComponent(
				interaction as APIMessageComponentInteraction,
			);
		}

		return {
			status: 400,
			body: {
				error: `[MiniInteraction] Unsupported interaction type: ${interaction.type}`,
			},
		};
	}

	/**
	 * Creates a Node.js style request handler that validates and processes interactions.
	 */
	createNodeHandler(): MiniInteractionNodeHandler {
		return (request, response) => {
			if (request.method !== "POST") {
				response.statusCode = 405;
				response.setHeader("content-type", "application/json");
				response.end(
					JSON.stringify({
						error: "[MiniInteraction] Only POST is supported",
					}),
				);
				return;
			}

			const chunks: Uint8Array[] = [];

			request.on("data", (chunk: Uint8Array) => {
				chunks.push(chunk);
			});

			request.on("error", (error) => {
				response.statusCode = 500;
				response.setHeader("content-type", "application/json");
				response.end(
					JSON.stringify({
						error: `[MiniInteraction] Failed to read request: ${String(
							error,
						)}`,
					}),
				);
			});

			request.on("end", async () => {
				const rawBody = Buffer.concat(chunks);
				const signatureHeader = request.headers["x-signature-ed25519"];
				const timestampHeader =
					request.headers["x-signature-timestamp"];

				const signature = Array.isArray(signatureHeader)
					? signatureHeader[0]
					: signatureHeader;
				const timestamp = Array.isArray(timestampHeader)
					? timestampHeader[0]
					: timestampHeader;

				try {
					const result = await this.handleRequest({
						body: rawBody,
						signature,
						timestamp,
					});
					response.statusCode = result.status;
					response.setHeader("content-type", "application/json");
					response.end(JSON.stringify(result.body));
				} catch (error) {
					response.statusCode = 500;
					response.setHeader("content-type", "application/json");
					response.end(
						JSON.stringify({
							error: `[MiniInteraction] Handler failed: ${String(
								error,
							)}`,
						}),
					);
				}
			});
		};
	}

	/**
	 * Alias for {@link createNodeHandler} for frameworks expecting a listener function.
	 */
	createNodeListener(): MiniInteractionNodeHandler {
		return this.createNodeHandler();
	}

	/**
	 * Convenience alias for {@link createNodeHandler} tailored to Vercel serverless functions.
	 */
	createVercelHandler(): MiniInteractionNodeHandler {
		return this.createNodeHandler();
	}

	/**
	 * Creates a Fetch API compatible handler for runtimes like Workers or Deno.
	 */
	createFetchHandler(): MiniInteractionFetchHandler {
		return async (request) => {
			if (request.method !== "POST") {
				return new Response(
					JSON.stringify({
						error: "[MiniInteraction] Only POST is supported",
					}),
					{
						status: 405,
						headers: { "content-type": "application/json" },
					},
				);
			}

			const signature =
				request.headers.get("x-signature-ed25519") ?? undefined;
			const timestamp =
				request.headers.get("x-signature-timestamp") ?? undefined;
			const bodyArrayBuffer = await request.arrayBuffer();
			const body = new Uint8Array(bodyArrayBuffer);

			try {
				const result = await this.handleRequest({
					body,
					signature,
					timestamp,
				});

				return new Response(JSON.stringify(result.body), {
					status: result.status,
					headers: { "content-type": "application/json" },
				});
			} catch (error) {
				return new Response(
					JSON.stringify({
						error: `[MiniInteraction] Handler failed: ${String(
							error,
						)}`,
					}),
					{
						status: 500,
						headers: { "content-type": "application/json" },
					},
				);
			}
		};
	}

	/**
	 * Checks if the provided directory path exists on disk.
	 */
	private async pathExists(targetPath: string): Promise<boolean> {
		try {
			const stats = await stat(targetPath);
			return stats.isDirectory();
		} catch {
			return false;
		}
	}

	/**
	 * Recursively collects all command module file paths from the target directory.
	 */
	private async collectCommandFiles(directory: string): Promise<string[]> {
		const entries = await readdir(directory, { withFileTypes: true });
		const files: string[] = [];

		for (const entry of entries) {
			if (entry.name.startsWith(".")) {
				continue;
			}

			const fullPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				const nestedFiles = await this.collectCommandFiles(fullPath);
				files.push(...nestedFiles);
				continue;
			}

			if (entry.isFile() && this.isSupportedCommandFile(fullPath)) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Determines whether the provided file path matches a supported command file extension.
	 */
	private isSupportedCommandFile(filePath: string): boolean {
		return SUPPORTED_COMMAND_EXTENSIONS.has(
			path.extname(filePath).toLowerCase(),
		);
	}

	/**
	 * Dynamically imports and validates a command module from disk.
	 */
	private async importCommandModule(
		absolutePath: string,
	): Promise<MiniInteractionCommand | null> {
		try {
			const moduleUrl = pathToFileURL(absolutePath).href;
			const imported = await import(moduleUrl);
			const candidate =
				imported.default ??
				imported.command ??
				imported.commandDefinition ??
				imported;

			if (!candidate || typeof candidate !== "object") {
				console.warn(
					`[MiniInteraction] Command module "${absolutePath}" does not export a command object. Skipping.`,
				);
				return null;
			}

			const { data, handler } = candidate as MiniInteractionCommand;

			if (!data || typeof data.name !== "string") {
				console.warn(
					`[MiniInteraction] Command module "${absolutePath}" is missing "data.name". Skipping.`,
				);
				return null;
			}

			if (typeof handler !== "function") {
				console.warn(
					`[MiniInteraction] Command module "${absolutePath}" is missing a "handler" function. Skipping.`,
				);
				return null;
			}

			return { data, handler };
		} catch (error) {
			console.error(
				`[MiniInteraction] Failed to load command module "${absolutePath}":`,
				error,
			);
			return null;
		}
	}

	/**
	 * Normalises the request body into a UTF-8 string for signature validation and parsing.
	 */
	private normalizeBody(body: string | Uint8Array): string {
		if (typeof body === "string") {
			return body;
		}

		return Buffer.from(body).toString("utf8");
	}

	/**
	 * Ensures commands have been loaded from disk once before being accessed.
	 */
	private async ensureCommandsLoaded(): Promise<void> {
		if (this.commandsLoaded || this.commandsDirectory === null) {
			return;
		}

		if (!this.loadCommandsPromise) {
			this.loadCommandsPromise = this.loadCommandsFromDirectory().then(
				() => {
					this.loadCommandsPromise = null;
				},
			);
		}

		await this.loadCommandsPromise;
	}

	/**
	 * Resolves the absolute commands directory path from configuration.
	 */
	private resolveCommandsDirectory(commandsDirectory?: string): string {
		if (!commandsDirectory) {
			return path.resolve(process.cwd(), "src/commands");
		}

		return path.isAbsolute(commandsDirectory)
			? commandsDirectory
			: path.resolve(process.cwd(), commandsDirectory);
	}

	/**
	 * Handles execution of a message component interaction.
	 */
	private async handleMessageComponent(
		interaction: APIMessageComponentInteraction,
	): Promise<MiniInteractionHandlerResult> {
		const customId = interaction?.data?.custom_id;
		if (!customId) {
			return {
				status: 400,
				body: {
					error: "[MiniInteraction] Message component interaction is missing a custom_id",
				},
			};
		}

		const handler = this.componentHandlers.get(customId);
		if (!handler) {
			return {
				status: 404,
				body: {
					error: `[MiniInteraction] No handler registered for component "${customId}"`,
				},
			};
		}

		try {
			const interactionWithHelpers =
				createMessageComponentInteraction(interaction);
			const response = await handler(interactionWithHelpers);
			const resolvedResponse =
				response ?? interactionWithHelpers.getResponse();

			if (!resolvedResponse) {
				return {
					status: 500,
					body: {
						error:
							`[MiniInteraction] Component "${customId}" did not return a response. ` +
							"Return an APIInteractionResponse to acknowledge the interaction.",
					},
				};
			}

			return {
				status: 200,
				body: resolvedResponse,
			};
		} catch (error) {
			return {
				status: 500,
				body: {
					error: `[MiniInteraction] Component "${customId}" failed: ${String(
						error,
					)}`,
				},
			};
		}
	}

	/**
	 * Handles execution of an application command interaction.
	 */
	private async handleApplicationCommand(
		interaction: APIInteraction,
	): Promise<MiniInteractionHandlerResult> {
		await this.ensureCommandsLoaded();

		const commandInteraction =
			interaction as APIChatInputApplicationCommandInteraction;

		if (!commandInteraction.data || !commandInteraction.data.name) {
			return {
				status: 400,
				body: {
					error: "[MiniInteraction] Invalid application command interaction",
				},
			};
		}

		const commandName = commandInteraction.data.name;

		const command = this.commands.get(commandName);

		if (!command) {
			return {
				status: 404,
				body: {
					error: `[MiniInteraction] No handler registered for "${commandName}"`,
				},
			};
		}

		const interactionWithHelpers =
			createCommandInteraction(commandInteraction);

		try {
			const response = await command.handler(interactionWithHelpers);
			const resolvedResponse =
				response ?? interactionWithHelpers.getResponse();

			if (!resolvedResponse) {
				return {
					status: 500,
					body: {
						error:
							`[MiniInteraction] Command "${commandName}" did not return a response. ` +
							"Call interaction.reply(), interaction.deferReply(), interaction.showModal(), " +
							"or return an APIInteractionResponse.",
					},
				};
			}

			return {
				status: 200,
				body: resolvedResponse,
			};
		} catch (error) {
			return {
				status: 500,
				body: {
					error: `[MiniInteraction] Command "${commandName}" failed: ${String(
						error,
					)}`,
				},
			};
		}
	}
}
