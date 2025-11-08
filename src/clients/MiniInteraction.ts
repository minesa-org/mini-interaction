import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
	APIChatInputApplicationCommandInteraction,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
} from "discord-api-types/v10";
import {
	APIInteraction,
	APIInteractionResponse,
	ApplicationCommandType,
	InteractionResponseType,
	InteractionType,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { verifyKey } from "discord-interactions";

import { DISCORD_BASE_URL } from "../utils/constants.js";
import type { MiniInteractionCommand } from "../types/Commands.js";
import { RoleConnectionMetadataTypes } from "../types/RoleConnectionMetadataTypes.js";
import { createCommandInteraction } from "../utils/CommandInteractionOptions.js";
import {
	createMessageComponentInteraction,
	type MessageComponentInteraction,
	type ButtonInteraction,
	type StringSelectInteraction,
	type RoleSelectInteraction,
	type UserSelectInteraction,
	type ChannelSelectInteraction,
	type MentionableSelectInteraction,
} from "../utils/MessageComponentInteraction.js";
import {
	createModalSubmitInteraction,
	type ModalSubmitInteraction,
} from "../utils/ModalSubmitInteraction.js";
import {
	createUserContextMenuInteraction,
	createMessageContextMenuInteraction,
	type UserContextMenuInteraction,
	type MessageContextMenuInteraction,
} from "../utils/ContextMenuInteraction.js";

/** File extensions that are treated as loadable modules when auto-loading. */
const SUPPORTED_MODULE_EXTENSIONS = new Set([
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
	componentsDirectory?: string | false;
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

/** Handler signature invoked for Discord button interactions. */
export type MiniInteractionButtonHandler = (
	interaction: ButtonInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord string select menu interactions. */
export type MiniInteractionStringSelectHandler = (
	interaction: StringSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord role select menu interactions. */
export type MiniInteractionRoleSelectHandler = (
	interaction: RoleSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord user select menu interactions. */
export type MiniInteractionUserSelectHandler = (
	interaction: UserSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord channel select menu interactions. */
export type MiniInteractionChannelSelectHandler = (
	interaction: ChannelSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord mentionable select menu interactions. */
export type MiniInteractionMentionableSelectHandler = (
	interaction: MentionableSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord message component interactions (generic). */
export type MiniInteractionComponentHandler = (
	interaction: MessageComponentInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord modal submit interactions. */
export type MiniInteractionModalHandler = (
	interaction: ModalSubmitInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Unified handler signature that accepts any component or modal interaction. */
export type MiniInteractionHandler =
	| MiniInteractionButtonHandler
	| MiniInteractionStringSelectHandler
	| MiniInteractionRoleSelectHandler
	| MiniInteractionUserSelectHandler
	| MiniInteractionChannelSelectHandler
	| MiniInteractionMentionableSelectHandler
	| MiniInteractionComponentHandler
	| MiniInteractionModalHandler;

/**
 * Structure describing a component or modal handler mapped to a custom id.
 * When auto-loading from the components directory:
 * - Files in `components/modals/` are treated as modal handlers
 * - Other files are treated as component handlers
 * You can use this type for both - the system will figure out which one it is.
 */
export type MiniInteractionComponent = {
	customId: string;
	handler: MiniInteractionHandler;
};

/** Structure describing a modal handler mapped to a custom id. */
export type MiniInteractionModal = {
	customId: string;
	handler: MiniInteractionModalHandler;
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
	private readonly componentsDirectory: string | null;
	private readonly commands = new Map<string, MiniInteractionCommand>();
	private readonly componentHandlers = new Map<
		string,
		MiniInteractionComponentHandler
	>();
	private readonly modalHandlers = new Map<
		string,
		MiniInteractionModalHandler
	>();
	private commandsLoaded = false;
	private loadCommandsPromise: Promise<void> | null = null;
	private componentsLoaded = false;
	private loadComponentsPromise: Promise<void> | null = null;

	/**
	 * Creates a new MiniInteraction client with optional command auto-loading and custom runtime hooks.
	 */
	constructor({
		applicationId,
		publicKey,
		commandsDirectory,
		componentsDirectory,
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
		this.componentsDirectory =
			componentsDirectory === false
				? null
				: this.resolveComponentsDirectory(componentsDirectory);
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

		// Register components exported with the command
		if (command.components && Array.isArray(command.components)) {
			for (const component of command.components) {
				this.useComponent(component);
			}
		}

		// Register modals exported with the command
		if (command.modals && Array.isArray(command.modals)) {
			for (const modal of command.modals) {
				this.useModal(modal);
			}
		}

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

		this.componentHandlers.set(
			customId,
			component.handler as MiniInteractionComponentHandler,
		);
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
	 * Registers a single modal handler mapped to a custom identifier.
	 *
	 * @param modal - The modal definition to register.
	 */
	useModal(modal: MiniInteractionModal): this {
		const customId = modal?.customId;
		if (!customId) {
			throw new Error("[MiniInteraction] modal.customId is required");
		}

		if (typeof modal.handler !== "function") {
			throw new Error(
				"[MiniInteraction] modal.handler must be a function",
			);
		}

		if (this.modalHandlers.has(customId)) {
			console.warn(
				`[MiniInteraction] Modal "${customId}" already exists and will be overwritten.`,
			);
		}

		this.modalHandlers.set(customId, modal.handler);
		return this;
	}

	/**
	 * Registers multiple modal handlers in a single call.
	 *
	 * @param modals - The modal definitions to register.
	 */
	useModals(modals: MiniInteractionModal[]): this {
		for (const modal of modals) {
			this.useModal(modal);
		}

		return this;
	}

	/**
	 * Recursively loads components from the configured components directory.
	 *
	 * @param directory - Optional directory override for component discovery.
	 */
	async loadComponentsFromDirectory(directory?: string): Promise<this> {
		const targetDirectory =
			directory !== undefined
				? this.resolveComponentsDirectory(directory)
				: this.componentsDirectory;

		if (!targetDirectory) {
			throw new Error(
				"[MiniInteraction] Components directory support disabled. Provide a directory path.",
			);
		}

		const exists = await this.pathExists(targetDirectory);
		if (!exists) {
			this.componentsLoaded = true;
			console.warn(
				`[MiniInteraction] Components directory "${targetDirectory}" does not exist. Skipping component auto-load.`,
			);
			return this;
		}

		const files = await this.collectModuleFiles(targetDirectory);

		if (files.length === 0) {
			this.componentsLoaded = true;
			console.warn(
				`[MiniInteraction] No component files found under "${targetDirectory}".`,
			);
			return this;
		}

		for (const file of files) {
			const components = await this.importComponentModule(file);
			if (components.length === 0) {
				continue;
			}

			for (const component of components) {
				this.useComponent(component);
			}
		}

		this.componentsLoaded = true;

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

		const files = await this.collectModuleFiles(targetDirectory);

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

			// Register components exported from the command file
			if (command.components && Array.isArray(command.components)) {
				for (const component of command.components) {
					this.useComponent(component);
				}
			}

			// Register modals exported from the command file
			if (command.modals && Array.isArray(command.modals)) {
				for (const modal of command.modals) {
					this.useModal(modal);
				}
			}
		}

		this.commandsLoaded = true;

		return this;
	}

	/**
	 * Lists the raw command data payloads for registration with Discord.
	 */
	listCommandData(): (
		| RESTPostAPIChatInputApplicationCommandsJSONBody
		| RESTPostAPIContextMenuApplicationCommandsJSONBody
	)[] {
		return Array.from(this.commands.values(), (command) => command.data);
	}

	/**
	 * Registers commands with Discord's REST API.
	 *
	 * @param botToken - The bot token authorising the registration request.
	 * @param commands - Optional command list to register instead of auto-loaded commands.
	 */
	async registerCommands(
		botToken: string,
		commands?: (
			| RESTPostAPIChatInputApplicationCommandsJSONBody
			| RESTPostAPIContextMenuApplicationCommandsJSONBody
		)[],
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

		if (interaction.type === InteractionType.ModalSubmit) {
			return this.handleModalSubmit(
				interaction as APIModalSubmitInteraction,
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
	private async collectModuleFiles(directory: string): Promise<string[]> {
		const entries = await readdir(directory, { withFileTypes: true });
		const files: string[] = [];

		for (const entry of entries) {
			if (entry.name.startsWith(".")) {
				continue;
			}

			const fullPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				const nestedFiles = await this.collectModuleFiles(fullPath);
				files.push(...nestedFiles);
				continue;
			}

			if (entry.isFile() && this.isSupportedModuleFile(fullPath)) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Determines whether the provided file path matches a supported command file extension.
	 */
	private isSupportedModuleFile(filePath: string): boolean {
		return SUPPORTED_MODULE_EXTENSIONS.has(
			path.extname(filePath).toLowerCase(),
		);
	}

	/**
	 * Dynamically imports and validates a command module from disk.
	 * Supports multiple export patterns:
	 * - export default { data, handler }
	 * - export const command = { data, handler }
	 * - export const ping_command = { data, handler }
	 * - export const data = ...; export const handler = ...;
	 */
	private async importCommandModule(
		absolutePath: string,
	): Promise<MiniInteractionCommand | null> {
		try {
			const moduleUrl = pathToFileURL(absolutePath).href;
			const imported = await import(moduleUrl);

			// Try to find a command object from various export patterns
			let candidate =
				imported.default ??
				imported.command ??
				imported.commandDefinition;

			// If not found, look for named exports ending with "_command"
			if (!candidate) {
				for (const [key, value] of Object.entries(imported)) {
					if (
						key.endsWith("_command") &&
						typeof value === "object" &&
						value !== null
					) {
						candidate = value;
						break;
					}
				}
			}

			// If still not found, try to construct from separate data/handler exports
			if (!candidate) {
				if (imported.data && imported.handler) {
					candidate = {
						data: imported.data,
						handler: imported.handler,
					};
				} else {
					// Last resort: use the entire module
					candidate = imported;
				}
			}

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
	 * Dynamically imports and validates a component module from disk.
	 * Also handles modal components if they're in a "modals" subdirectory.
	 * Supports multiple export patterns:
	 * - export default { customId, handler }
	 * - export const component = { customId, handler }
	 * - export const ping_button = { customId, handler }
	 * - export const customId = "..."; export const handler = ...;
	 * - export const components = [{ customId, handler }, ...]
	 */
	private async importComponentModule(
		absolutePath: string,
	): Promise<MiniInteractionComponent[]> {
		try {
			const moduleUrl = pathToFileURL(absolutePath).href;
			const imported = await import(moduleUrl);

			// Collect all potential component candidates
			const candidates: unknown[] = [];

			// Try standard exports first
			const standardExport =
				imported.default ??
				imported.component ??
				imported.components ??
				imported.componentDefinition ??
				imported.modal ??
				imported.modals;

			if (standardExport) {
				if (Array.isArray(standardExport)) {
					candidates.push(...standardExport);
				} else {
					candidates.push(standardExport);
				}
			}

			// Look for named exports ending with "_button", "_select", "_modal", etc.
			for (const [key, value] of Object.entries(imported)) {
				if (
					(key.endsWith("_button") ||
						key.endsWith("_select") ||
						key.endsWith("_modal") ||
						key.endsWith("_component")) &&
					typeof value === "object" &&
					value !== null &&
					!candidates.includes(value)
				) {
					candidates.push(value);
				}
			}

			// If no candidates found, try to construct from separate customId/handler exports
			if (candidates.length === 0) {
				if (imported.customId && imported.handler) {
					candidates.push({
						customId: imported.customId,
						handler: imported.handler,
					});
				}
			}

			const components: MiniInteractionComponent[] = [];

			// Check if this file is in a "modals" subdirectory
			const isModalFile =
				absolutePath.includes(path.sep + "modals" + path.sep) ||
				absolutePath.includes("/modals/");

			for (const item of candidates) {
				if (!item || typeof item !== "object") {
					continue;
				}

				const { customId, handler } = item as MiniInteractionComponent;

				if (typeof customId !== "string") {
					console.warn(
						`[MiniInteraction] Component module "${absolutePath}" is missing "customId". Skipping.`,
					);
					continue;
				}

				if (typeof handler !== "function") {
					console.warn(
						`[MiniInteraction] Component module "${absolutePath}" is missing a "handler" function. Skipping.`,
					);
					continue;
				}

				// If it's in a modals directory, register it as a modal
				if (isModalFile) {
					this.useModal({
						customId,
						handler:
							handler as unknown as MiniInteractionModalHandler,
					});
				} else {
					components.push({ customId, handler });
				}
			}

			if (components.length === 0 && !isModalFile) {
				console.warn(
					`[MiniInteraction] Component module "${absolutePath}" did not export any valid components. Skipping.`,
				);
			}

			return components;
		} catch (error) {
			console.error(
				`[MiniInteraction] Failed to load component module "${absolutePath}":`,
				error,
			);
			return [];
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
	 * Ensures components have been loaded from disk once before being accessed.
	 */
	private async ensureComponentsLoaded(): Promise<void> {
		if (this.componentsLoaded || this.componentsDirectory === null) {
			return;
		}

		if (!this.loadComponentsPromise) {
			this.loadComponentsPromise =
				this.loadComponentsFromDirectory().then(() => {
					this.loadComponentsPromise = null;
				});
		}

		await this.loadComponentsPromise;
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
		return this.resolveDirectory("commands", commandsDirectory);
	}

	/**
	 * Resolves the absolute components directory path from configuration.
	 */
	private resolveComponentsDirectory(componentsDirectory?: string): string {
		return this.resolveDirectory("components", componentsDirectory);
	}

	/**
	 * Resolves a directory relative to the project "src" or "dist" folders with optional overrides.
	 */
	private resolveDirectory(
		defaultFolder: string,
		overrideDirectory?: string,
	): string {
		const projectRoot = process.cwd();
		const allowedRoots = ["src", "dist"].map((folder) =>
			path.resolve(projectRoot, folder),
		);
		const candidates: string[] = [];

		const isWithin = (parent: string, child: string): boolean => {
			const relative = path.relative(parent, child);
			return (
				relative === "" ||
				(!relative.startsWith("..") && !path.isAbsolute(relative))
			);
		};

		const pushCandidate = (candidate: string): void => {
			if (!candidates.includes(candidate)) {
				candidates.push(candidate);
			}
		};

		const ensureWithinAllowedRoots = (absolutePath: string): void => {
			if (!allowedRoots.some((root) => isWithin(root, absolutePath))) {
				throw new Error(
					`[MiniInteraction] Directory overrides must be located within "${path.join(
						projectRoot,
						"src",
					)}" or "${path.join(
						projectRoot,
						"dist",
					)}". Received: ${absolutePath}`,
				);
			}

			pushCandidate(absolutePath);
		};

		const addOverrideCandidates = (overridePath: string): void => {
			const trimmed = overridePath.trim();
			if (!trimmed) {
				return;
			}

			if (path.isAbsolute(trimmed)) {
				ensureWithinAllowedRoots(trimmed);
				return;
			}

			const normalised = trimmed.replace(/^[./\\]+/, "");
			if (!normalised) {
				return;
			}

			if (normalised.startsWith("src") || normalised.startsWith("dist")) {
				const absolutePath = path.resolve(projectRoot, normalised);
				ensureWithinAllowedRoots(absolutePath);
				return;
			}

			for (const root of allowedRoots) {
				ensureWithinAllowedRoots(path.resolve(root, normalised));
			}
		};

		if (overrideDirectory) {
			addOverrideCandidates(overrideDirectory);
		}

		for (const root of allowedRoots) {
			pushCandidate(path.resolve(root, defaultFolder));
		}

		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}

		return candidates[0];
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

		await this.ensureComponentsLoaded();

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
	 * Handles execution of a modal submit interaction.
	 */
	private async handleModalSubmit(
		interaction: APIModalSubmitInteraction,
	): Promise<MiniInteractionHandlerResult> {
		const customId = interaction?.data?.custom_id;
		if (!customId) {
			return {
				status: 400,
				body: {
					error: "[MiniInteraction] Modal submit interaction is missing a custom_id",
				},
			};
		}

		await this.ensureComponentsLoaded();

		const handler = this.modalHandlers.get(customId);
		if (!handler) {
			return {
				status: 404,
				body: {
					error: `[MiniInteraction] No handler registered for modal "${customId}"`,
				},
			};
		}

		try {
			const interactionWithHelpers =
				createModalSubmitInteraction(interaction);
			const response = await handler(interactionWithHelpers);
			const resolvedResponse =
				response ?? interactionWithHelpers.getResponse();

			if (!resolvedResponse) {
				return {
					status: 500,
					body: {
						error:
							`[MiniInteraction] Modal "${customId}" did not return a response. ` +
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
					error: `[MiniInteraction] Modal "${customId}" failed: ${String(
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

		try {
			let response: APIInteractionResponse | void;
			let resolvedResponse: APIInteractionResponse | null = null;

			// Check if it's a chat input (slash) command
			if (
				commandInteraction.data.type ===
				ApplicationCommandType.ChatInput
			) {
				const interactionWithHelpers =
					createCommandInteraction(commandInteraction);
				response = await command.handler(interactionWithHelpers as any);
				resolvedResponse =
					response ?? interactionWithHelpers.getResponse();
			} else if (
				commandInteraction.data.type === ApplicationCommandType.User
			) {
				// User context menu command
				const interactionWithHelpers = createUserContextMenuInteraction(
					commandInteraction as any,
				);
				response = await command.handler(interactionWithHelpers as any);
				resolvedResponse =
					response ?? interactionWithHelpers.getResponse();
			} else if (
				commandInteraction.data.type === ApplicationCommandType.Message
			) {
				// Message context menu command
				const interactionWithHelpers =
					createMessageContextMenuInteraction(
						commandInteraction as any,
					);
				response = await command.handler(interactionWithHelpers as any);
				resolvedResponse =
					response ?? interactionWithHelpers.getResponse();
			} else {
				// Unknown command type
				response = await command.handler(commandInteraction as any);
				resolvedResponse = response ?? null;
			}

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
