import { existsSync, readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
	APIApplicationCommandInteraction,
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
	RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody,
} from "discord-api-types/v10";
import { verifyKey } from "discord-interactions";

import { resolveJSONEncodable } from "../builders/shared.js";
import { DISCORD_BASE_URL } from "../utils/constants.js";
import type { InteractionCommand } from "../types/Commands.js";
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
	createAppCommandInteraction,
	type UserContextMenuInteraction,
	type MessageContextMenuInteraction,
	type AppCommandInteraction,
} from "../utils/ContextMenuInteraction.js";
import {
	generateOAuthUrl,
	getOAuthTokens,
	getDiscordUser,
	type OAuthConfig,
	type OAuthTokens,
	type DiscordUser,
} from "../oauth/DiscordOAuth.js";

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
export type InteractionClientOptions = {
	applicationId: string;
	publicKey: string;
	commandsDirectory?: string | false;
	componentsDirectory?: string | false;
	utilsDirectory?: string | false;
	fetchImplementation?: typeof fetch;
	verifyKeyImplementation?: VerifyKeyFunction;
	timeoutConfig?: InteractionTimeoutConfig;
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
export type InteractionRequest = {
	body: string | Uint8Array;
	signature?: string;
	timestamp?: string;
};

/** Result payload returned by request handlers when processing an interaction. */
export type InteractionHandlerResult = {
	status: number;
	body: APIInteractionResponse | { error: string };
};

/** Configuration for interaction timeout handling. */
export type InteractionTimeoutConfig = {
	/** Maximum time in milliseconds to wait for initial response (default: 2800ms) */
	initialResponseTimeout?: number;
	/** Whether to enable timeout warnings (default: true) */
	enableTimeoutWarnings?: boolean;
	/** Whether to force deferReply for slow operations (default: true) */
	autoDeferSlowOperations?: boolean;
	/** Whether to enable debug logging for interaction responses (default: false) */
	enableResponseDebugLogging?: boolean;
};

/** Handler signature invoked for Discord button interactions. */
export type ButtonComponentHandler = (
	interaction: ButtonInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord string select menu interactions. */
export type StringSelectComponentHandler = (
	interaction: StringSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord role select menu interactions. */
export type RoleSelectComponentHandler = (
	interaction: RoleSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord user select menu interactions. */
export type UserSelectComponentHandler = (
	interaction: UserSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord channel select menu interactions. */
export type ChannelSelectComponentHandler = (
	interaction: ChannelSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord mentionable select menu interactions. */
export type MentionableSelectComponentHandler = (
	interaction: MentionableSelectInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord message component interactions (generic). */
export type ComponentHandler = (
	interaction: MessageComponentInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Handler signature invoked for Discord modal submit interactions. */
export type ModalHandler = (
	interaction: ModalSubmitInteraction,
) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void;

/** Unified handler signature that accepts any component or modal interaction. */
export type InteractionHandler =
	| ButtonComponentHandler
	| StringSelectComponentHandler
	| RoleSelectComponentHandler
	| UserSelectComponentHandler
	| ChannelSelectComponentHandler
	| MentionableSelectComponentHandler
	| ComponentHandler
	| ModalHandler;

type CommandDataPayload =
	| RESTPostAPIChatInputApplicationCommandsJSONBody
	| RESTPostAPIContextMenuApplicationCommandsJSONBody
	| RESTPostAPIPrimaryEntryPointApplicationCommandJSONBody;

type RegisteredInteractionCommand = Omit<InteractionCommand, "data"> & {
	data: CommandDataPayload;
};

/**
 * Structure describing a component or modal handler mapped to a custom id.
 * When auto-loading from the components directory:
 * - Files in `components/modals/` are treated as modal handlers
 * - Other files are treated as component handlers
 * You can use this type for both - the system will figure out which one it is.
 */
export type ComponentCommand = {
	customId: string;
	handler: InteractionHandler;
};

/** Structure describing a modal handler mapped to a custom id. */
export type ModalCommand = {
	customId: string;
	handler: ModalHandler;
};

/** Node.js HTTP handler compatible with frameworks like Express or Next.js API routes. */
export type InteractionNodeHandler = (
	request: IncomingMessage,
	response: ServerResponse,
) => void;

/** Web Fetch API compatible request handler for platforms such as Cloudflare Workers. */
export type InteractionFetchHandler = (
	request: Request,
) => Promise<Response>;

/** Context passed to OAuth success handlers and templates. */
export type DiscordOAuthAuthorizeContext = {
	tokens: OAuthTokens;
	user: DiscordUser;
	state: string | null;
	request: IncomingMessage;
	response: ServerResponse;
};

/** Context provided to templates that only need access to the state value. */
export type DiscordOAuthStateTemplateContext = {
	state: string | null;
};

/** Context provided to templates that display OAuth error messages. */
export type DiscordOAuthErrorTemplateContext =
	DiscordOAuthStateTemplateContext & {
		error: string;
	};

/** Context provided to templates used for successful authorisation messages. */
export type DiscordOAuthSuccessTemplateContext =
	DiscordOAuthStateTemplateContext & {
		user: DiscordUser;
		tokens: OAuthTokens;
	};

/** Context provided to templates that handle server side failures. */
export type DiscordOAuthServerErrorTemplateContext =
	DiscordOAuthStateTemplateContext;

/** Template functions used to render HTML responses during the OAuth flow. */
export type DiscordOAuthCallbackTemplates = {
	success: (context: DiscordOAuthSuccessTemplateContext) => string;
	missingCode: (context: DiscordOAuthStateTemplateContext) => string;
	oauthError: (context: DiscordOAuthErrorTemplateContext) => string;
	invalidState: (context: DiscordOAuthStateTemplateContext) => string;
	serverError: (context: DiscordOAuthServerErrorTemplateContext) => string;
};

/** Options accepted by {@link MiniInteraction.discordOAuthCallback}. */
export type DiscordOAuthCallbackOptions = {
	oauth?: OAuthConfig;
	onAuthorize?: (
		context: DiscordOAuthAuthorizeContext,
	) => Promise<void> | void;
	validateState?: (
		state: string | null,
		request: IncomingMessage,
	) => Promise<boolean> | boolean;
	successRedirect?:
		| string
		| ((
				context: DiscordOAuthAuthorizeContext,
		  ) => string | null | undefined);
	templates?: Partial<DiscordOAuthCallbackTemplates>;
};

/** Options accepted by {@link MiniInteraction.discordOAuthVerificationPage}. */
export type DiscordOAuthVerificationPageOptions = {
	oauth?: OAuthConfig;
	scopes?: string[];
	/**
	 * Path to the HTML file to load. Relative paths resolve from {@link process.cwd}.
	 *
	 * @defaultValue "index.html"
	 */
	htmlFile?: string;
	/**
	 * Placeholder token (with or without the `{{ }}` wrapper) that will be replaced with the generated OAuth URL.
	 *
	 * @defaultValue "OAUTH_URL"
	 */
	placeholder?: string;
};

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
	private readonly fetchImpl: typeof fetch;
	private readonly verifyKeyImpl: VerifyKeyFunction;
	private readonly commandsDirectory: string | null;
	private readonly componentsDirectory: string | null;
	public readonly utilsDirectory: string | null;
	private readonly timeoutConfig: Required<InteractionTimeoutConfig>;
	private readonly commands = new Map<
		string,
		RegisteredInteractionCommand
	>();
	private readonly componentHandlers = new Map<
		string,
		ComponentHandler
	>();
	private readonly modalHandlers = new Map<
		string,
		ModalHandler
	>();
	private readonly htmlTemplateCache = new Map<string, string>();
	private readonly interactionStates = new Map<string, {
		state: 'pending' | 'deferred' | 'responded' | 'expired';
		timestamp: number;
		token: string;
	}>();
	private commandsLoaded = false;
	private loadCommandsPromise: Promise<void> | null = null;
	private componentsLoaded = false;
	private loadComponentsPromise: Promise<void> | null = null;
	private registerCommandsPromise: Promise<unknown> | null = null;
	private registerCommandsSignature: string | null = null;

	/**
	 * Creates a new MiniInteraction client with optional command auto-loading and custom runtime hooks.
	 */
	constructor({
		applicationId,
		publicKey,
		commandsDirectory,
		componentsDirectory,
		utilsDirectory,
		fetchImplementation,
		verifyKeyImplementation,
		timeoutConfig,
	}: InteractionClientOptions) {
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
		this.utilsDirectory =
			utilsDirectory === false
				? null
				: this.resolveUtilsDirectory(utilsDirectory);
		this.timeoutConfig = {
			initialResponseTimeout: 2800, // Leave 200ms buffer before Discord's 3s limit
			enableTimeoutWarnings: true,
			autoDeferSlowOperations: true,
			enableResponseDebugLogging: false,
			...timeoutConfig,
		};
	}

	private trackInteractionState(interactionId: string, token: string, state: 'pending' | 'deferred' | 'responded' | 'expired'): void {
		const now = Date.now();
		this.interactionStates.set(interactionId, {
			state,
			timestamp: now,
			token,
		});
	}


	/**
	 * Checks if an interaction can still respond (not expired and not already responded).
	 */
	private canRespond(interactionId: string): boolean {
		const state = this.getInteractionState(interactionId);
		if (!state) return true; // New interaction

		// Check if expired (15 minutes)
		if (Date.now() - state.timestamp > 900000) {
			this.trackInteractionState(interactionId, state.token, 'expired');
			return false;
		}

		// Check if already responded
		if (state.state === 'responded') {
			return false;
		}

		return true;
	}




	/**
	 * Gets the current state of an interaction.
	 */
	private getInteractionState(interactionId: string) {
		return this.interactionStates.get(interactionId);
	}


	/**
	 * Clears expired interaction states to prevent memory leaks.
	 * Call this periodically to clean up old interaction data.
	 */
	cleanupExpiredInteractions(): number {
		const now = Date.now();
		let cleaned = 0;

		for (const [id, state] of this.interactionStates.entries()) {
			// Remove interactions older than 15 minutes
			if (now - state.timestamp > 900000) {
				this.interactionStates.delete(id);
				cleaned++;
			}
		}

		return cleaned;
	}
	private normalizeCommandData(
		data: InteractionCommand["data"],
	): CommandDataPayload {
		if (typeof data === "object" && data !== null) {
			return resolveJSONEncodable(data) as CommandDataPayload;
		}

		return data as CommandDataPayload;
	}

	private registerCommand(command: InteractionCommand): void {
		const normalizedData = this.normalizeCommandData(command.data);
		const commandName = normalizedData?.name;
		if (!commandName) {
			throw new Error("[MiniInteraction] command.data.name is required");
		}

		if (this.commands.has(commandName)) {
			console.warn(
				`[MiniInteraction] Command "${commandName}" already exists and will be overwritten.`,
			);
		}

		const normalizedCommand: RegisteredInteractionCommand = {
			...command,
			data: normalizedData,
		};

		this.commands.set(commandName, normalizedCommand);


	}

	/**
	 * Registers a single command handler with the client.
	 *
	 * @param command - The command definition to register.
	 */
	useCommand(command: InteractionCommand): this {
		this.registerCommand(command);
		return this;
	}

	/**
	 * Registers multiple command handlers with the client.
	 *
	 * @param commands - The command definitions to register.
	 */
	useCommands(commands: InteractionCommand[]): this {
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
	useComponent(component: ComponentCommand): this {
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
			component.handler as ComponentHandler,
		);
		return this;
	}

	/**
	 * Registers multiple component handlers in a single call.
	 *
	 * @param components - The component definitions to register.
	 */
	useComponents(components: ComponentCommand[]): this {
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
	useModal(modal: ModalCommand): this {
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
	useModals(modals: ModalCommand[]): this {
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

			this.registerCommand(command);
		}

		this.commandsLoaded = true;

		return this;
	}

	/**
	 * Lists the raw command data payloads for registration with Discord.
	 */
	listCommandData(): CommandDataPayload[] {
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
		commands?: CommandDataPayload[],
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

		const signature = JSON.stringify(resolvedCommands);
		if (this.registerCommandsPromise) {
			if (this.registerCommandsSignature === signature) {
				console.warn(
					"[MiniInteraction] Command registration already in progress. Reusing the in-flight request.",
				);
				return this.registerCommandsPromise;
			}

			console.warn(
				"[MiniInteraction] Command registration already in progress. Waiting for it to finish before continuing.",
			);
			await this.registerCommandsPromise.catch(() => undefined);
		}

		const url = `${DISCORD_BASE_URL}/applications/${this.applicationId}/commands`;

		const requestPromise = (async () => {
			try {
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
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				if (message.startsWith("[MiniInteraction]")) {
					throw error;
				}

				throw new Error(
					`[MiniInteraction] Failed to register commands: ${message}`,
				);
			}
		})();

		this.registerCommandsSignature = signature;
		this.registerCommandsPromise = requestPromise.finally(() => {
			this.registerCommandsPromise = null;
			this.registerCommandsSignature = null;
		});

		return this.registerCommandsPromise;
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

		const url = `${DISCORD_BASE_URL}/applications/${this.applicationId}/role-connections/metadata`;

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
		request: InteractionRequest,
	): Promise<InteractionHandlerResult> {
		const requestStartTime = Date.now();
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
			// Track interaction start
			this.trackInteractionState(interaction.id, interaction.token, 'pending');
			return this.handleApplicationCommand(interaction);
		}

		if (interaction.type === InteractionType.MessageComponent) {
			// Track interaction start
			this.trackInteractionState(interaction.id, interaction.token, 'pending');
			return this.handleMessageComponent(
				interaction as APIMessageComponentInteraction,
			);
		}

		if (interaction.type === InteractionType.ModalSubmit) {
			// Track interaction start
			this.trackInteractionState(interaction.id, interaction.token, 'pending');
			return this.handleModalSubmit(
				interaction as APIModalSubmitInteraction,
			);
		}

		// Check total processing time and log potential timeout issues
		const totalProcessingTime = Date.now() - requestStartTime;
		if (
			this.timeoutConfig.enableTimeoutWarnings &&
			totalProcessingTime >
				this.timeoutConfig.initialResponseTimeout * 0.9
		) {
			console.warn(
				`[MiniInteraction] CRITICAL: Interaction processing took ${totalProcessingTime}ms ` +
					`(${Math.round(
						(totalProcessingTime / 3000) * 100,
					)}% of Discord's 3-second limit). ` +
					`This may cause "didn't respond in time" errors. ` +
					`Consider optimizing or using deferReply() for slow operations.`,
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
	 * Creates a Node.js style request handler compatible with Express, Next.js API routes,
	 * Vercel serverless functions, and any runtime that expects a `(req, res)` listener.
	 */
	createNodeHandler(): InteractionNodeHandler {
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
	 * Generates a lightweight verification handler that serves an HTML page with an embedded OAuth link.
	 *
	 * This is primarily used when Discord asks for a verification URL while setting up Linked Roles.
	 * Provide an HTML file that contains the `{{OAUTH_URL}}` placeholder (or a custom placeholder defined in options)
	 * and this helper will replace the token with a freshly generated OAuth link on every request.
	 *
	 * Available placeholders:
	 * - `{{OAUTH_URL}}` - HTML-escaped OAuth URL for links/buttons.
	 * - `{{OAUTH_URL_RAW}}` - raw OAuth URL, ideal for `<script>` usage.
	 * - `{{OAUTH_STATE}}` - HTML-escaped OAuth state value.
	 * - Custom placeholder name (from {@link DiscordOAuthVerificationPageOptions.placeholder}) and its `_RAW` variant.
	 */
	discordOAuthVerificationPage(
		options: DiscordOAuthVerificationPageOptions = {},
	): InteractionNodeHandler {
		const scopes = options.scopes ?? ["identify", "role_connections.write"];
		const htmlFile = options.htmlFile ?? "index.html";
		const placeholderKey = this.normalizeTemplateKey(
			options.placeholder ?? "OAUTH_URL",
		);
		const template = this.loadHtmlTemplate(htmlFile);
		const oauthConfig = resolveOAuthConfig(options.oauth);

		return (_request, response) => {
			try {
				const { url, state } = generateOAuthUrl(oauthConfig, scopes);
				const values: Record<string, string | null | undefined> = {
					OAUTH_URL: url,
					OAUTH_URL_RAW: url,
					OAUTH_STATE: state,
				};

				const rawKeys = new Set<string>(["OAUTH_URL_RAW"]);

				if (placeholderKey !== "OAUTH_URL") {
					values[placeholderKey] = url;
					const rawVariant = `${placeholderKey}_RAW`;
					values[rawVariant] = url;
					rawKeys.add(rawVariant);
				}

				const html = this.renderHtmlTemplate(template, values, {
					rawKeys,
				});

				sendHtml(response, html);
			} catch (error) {
				console.error(
					"[MiniInteraction] Failed to render OAuth verification page:",
					error,
				);
				sendHtml(response, DEFAULT_VERIFICATION_ERROR_HTML, 500);
			}
		};
	}

	/**
	 * Loads an HTML file and returns a success template that replaces useful placeholders.
	 *
	 * The following placeholders are available in the HTML file:
	 * - `{{username}}`, `{{discriminator}}`, `{{user_id}}`, `{{user_tag}}`
	 * - `{{access_token}}`, `{{refresh_token}}`, `{{token_type}}`, `{{scope}}`, `{{expires_at}}`
	 * - `{{state}}`
	 */
	connectedOAuthPage(
		filePath: string,
	): DiscordOAuthCallbackTemplates["success"] {
		const template = this.loadHtmlTemplate(filePath);

		return ({ user, tokens, state }) => {
			const discriminator = user.discriminator;
			const userTag =
				discriminator && discriminator !== "0"
					? `${user.username}#${discriminator}`
					: user.username;

			return this.renderHtmlTemplate(template, {
				username: user.username,
				discriminator,
				user_id: user.id,
				user_tag: userTag,
				access_token: tokens.access_token,
				refresh_token: tokens.refresh_token,
				token_type: tokens.token_type,
				scope: tokens.scope,
				expires_at: tokens.expires_at.toString(),
				state,
			});
		};
	}

	/**
	 * Loads an HTML file and returns an error template that can be reused for all failure cases.
	 *
	 * The following placeholders are available in the HTML file:
	 * - `{{error}}`
	 * - `{{state}}`
	 */
	failedOAuthPage(
		filePath: string,
	): ((context: DiscordOAuthErrorTemplateContext) => string) &
		((context: DiscordOAuthStateTemplateContext) => string) {
		const template = this.loadHtmlTemplate(filePath);

		const renderer = (context: {
			error?: string | null;
			state: string | null;
		}) =>
			this.renderHtmlTemplate(template, {
				error: context.error,
				state: context.state,
			});

		return renderer as unknown as ((
			context: DiscordOAuthErrorTemplateContext,
		) => string) &
			((context: DiscordOAuthStateTemplateContext) => string);
	}

	/**
	 * Resolves an HTML template from disk and caches the result for reuse.
	 */
	private loadHtmlTemplate(filePath: string): string {
		const resolvedPath = path.isAbsolute(filePath)
			? filePath
			: path.join(process.cwd(), filePath);

		const cached = this.htmlTemplateCache.get(resolvedPath);
		if (cached) {
			return cached;
		}

		if (!existsSync(resolvedPath)) {
			throw new Error(
				`[MiniInteraction] HTML template not found: ${resolvedPath}`,
			);
		}

		const fileContents = readFileSync(resolvedPath, "utf8");
		this.htmlTemplateCache.set(resolvedPath, fileContents);
		return fileContents;
	}

	/**
	 * Replaces placeholder tokens in a template with escaped HTML values.
	 */
	private renderHtmlTemplate(
		template: string,
		values: Record<string, string | null | undefined>,
		options?: HtmlTemplateRenderOptions,
	): string {
		const rawKeys =
			options?.rawKeys instanceof Set
				? options.rawKeys
				: new Set(options?.rawKeys ?? []);

		return template.replace(
			/\{\{\s*(\w+)\s*\}\}/g,
			(match, key: string) => {
				const value = values[key];
				if (value === undefined || value === null) {
					return "";
				}

				const stringValue = String(value);
				return rawKeys.has(key) ? stringValue : escapeHtml(stringValue);
			},
		);
	}

	/**
	 * Normalizes placeholder tokens to the bare key the HTML renderer expects.
	 */
	private normalizeTemplateKey(token: string): string {
		if (!token) {
			return "OAUTH_URL";
		}

		const trimmed = token.trim();
		const match = trimmed.match(/^\{\{\s*(\w+)\s*\}\}$/);
		if (match) {
			return match[1];
		}

		return trimmed || "OAUTH_URL";
	}

	/**
	 * Creates a minimal Discord OAuth callback handler that renders helpful HTML responses.
	 *
	 * This helper keeps the user-side implementation tiny while still exposing hooks for
	 * storing metadata or validating the OAuth state value.
	 */
	discordOAuthCallback(
		options: DiscordOAuthCallbackOptions,
	): InteractionNodeHandler {
		const templates: DiscordOAuthCallbackTemplates = {
			...DEFAULT_DISCORD_OAUTH_TEMPLATES,
			...options.templates,
		};

		const oauthConfig = resolveOAuthConfig(options.oauth);

		return async (request, response) => {
			if (request.method !== "GET") {
				response.statusCode = 405;
				response.setHeader("content-type", "application/json");
				response.end(
					JSON.stringify({
						error: "[MiniInteraction] Only GET is supported",
					}),
				);
				return;
			}

			let state: string | null = null;

			try {
				const host = request.headers.host ?? "localhost";
				const url = new URL(request.url ?? "", `http://${host}`);
				const code = url.searchParams.get("code");
				state = url.searchParams.get("state");
				const error = url.searchParams.get("error");

				if (error) {
					sendHtml(
						response,
						templates.oauthError({
							error,
							state,
						}),
						400,
					);
					return;
				}

				if (!code) {
					sendHtml(
						response,
						templates.missingCode({
							state,
						}),
						400,
					);
					return;
				}

				if (options.validateState) {
					const isValid = await options.validateState(state, request);
					if (!isValid) {
						sendHtml(
							response,
							templates.invalidState({
								state,
							}),
							400,
						);
						return;
					}
				}

				const tokens = await getOAuthTokens(code, oauthConfig);
				const user = await getDiscordUser(tokens.access_token);

				const authorizeContext: DiscordOAuthAuthorizeContext = {
					tokens,
					user,
					state,
					request,
					response,
				};

				if (options.onAuthorize) {
					await options.onAuthorize(authorizeContext);
					if (response.writableEnded || response.headersSent) {
						return;
					}
				}

				if (options.successRedirect) {
					const location =
						typeof options.successRedirect === "function"
							? options.successRedirect(authorizeContext)
							: options.successRedirect;

					if (
						location &&
						!response.headersSent &&
						!response.writableEnded
					) {
						response.statusCode = 302;
						response.setHeader("location", location);
						response.end();
						return;
					}
				}

				sendHtml(
					response,
					templates.success({
						user,
						tokens,
						state,
					}),
				);
			} catch (error) {
				console.error(
					"[MiniInteraction] Discord OAuth callback failed:",
					error,
				);

				if (!response.headersSent && !response.writableEnded) {
					sendHtml(
						response,
						templates.serverError({
							state,
						}),
						500,
					);
				}
			}
		};
	}

	/**
	 * Creates a Fetch API compatible handler for runtimes like Workers or Deno.
	 */
	createFetchHandler(): InteractionFetchHandler {
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
	): Promise<InteractionCommand | null> {
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

			const { data, handler } =
				candidate as InteractionCommand;
			const normalizedData = this.normalizeCommandData(data);

			if (!normalizedData || typeof normalizedData.name !== "string") {
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

			return { data: normalizedData, handler };
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
	): Promise<ComponentCommand[]> {
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

			const components: ComponentCommand[] = [];

			// Check if this file is in a "modals" subdirectory
			const isModalFile =
				absolutePath.includes(path.sep + "modals" + path.sep) ||
				absolutePath.includes("/modals/");

			for (const item of candidates) {
				if (!item || typeof item !== "object") {
					continue;
				}

				const { customId, handler } = item as ComponentCommand;

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
							handler as unknown as ModalHandler,
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
	 * Resolves the absolute utilities directory path from configuration.
	 */
	private resolveUtilsDirectory(utilsDirectory?: string): string {
		return this.resolveDirectory("utils", utilsDirectory);
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
	): Promise<InteractionHandlerResult> {
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
			// Create an acknowledgment promise that resolves when the handler calls reply() or deferReply()
			let ackResolver: ((response: APIInteractionResponse) => void) | null = null;
			const ackPromise = new Promise<APIInteractionResponse>((resolve) => {
				ackResolver = resolve;
			});

			// Helper to send follow-up responses via webhooks
			const sendFollowUp = (token: string, data: APIInteractionResponse) =>
				this.sendFollowUp(token, data);

			const interactionWithHelpers =
				createMessageComponentInteraction(interaction, {
					onAck: (response) => ackResolver?.(response),
					sendFollowUp,
				});

			// Wrap component handler with timeout and acknowledgment
			const timeoutWrapper = createTimeoutWrapper(
				async () => {
					const response = await handler(interactionWithHelpers);
					const resolvedResponse =
						response ?? interactionWithHelpers.getResponse();

					if (!resolvedResponse) {
						throw new Error(
							`Component "${customId}" did not return a response. ` +
								"Return an APIInteractionResponse to acknowledge the interaction.",
						);
					}

					return resolvedResponse;
				},
				this.timeoutConfig.initialResponseTimeout,
				`Component "${customId}"`,
				this.timeoutConfig.enableTimeoutWarnings,
				ackPromise,
			);

			const resolvedResponse = await timeoutWrapper();

			return {
				status: 200,
				body: resolvedResponse,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("Handler timeout")) {
				console.error(
					`[MiniInteraction] CRITICAL: Component "${customId}" timed out. ` +
						`This will result in "didn't respond in time" errors for users.`,
				);
			}

			return {
				status: 500,
				body: {
					error: `[MiniInteraction] Component "${customId}" failed: ${errorMessage}`,
				},
			};
		}
	}

	/**
	 * Handles execution of a modal submit interaction.
	 */
	private async handleModalSubmit(
		interaction: APIModalSubmitInteraction,
	): Promise<InteractionHandlerResult> {
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
			// Create an acknowledgment promise for modals
			let ackResolver: ((response: APIInteractionResponse) => void) | null = null;
			const ackPromise = new Promise<APIInteractionResponse>((resolve) => {
				ackResolver = resolve;
			});

			// Helper to send follow-up responses via webhooks
			const sendFollowUp = (token: string, data: APIInteractionResponse) => 
				this.sendFollowUp(token, data);

			const interactionWithHelpers =
				createModalSubmitInteraction(interaction, {
					onAck: (response) => ackResolver?.(response),
					sendFollowUp,
				});

			// Wrap modal handler with timeout and acknowledgment
			const timeoutWrapper = createTimeoutWrapper(
				async () => {
					const response = await handler(interactionWithHelpers);
					const resolvedResponse =
						response ?? interactionWithHelpers.getResponse();

					if (!resolvedResponse) {
						throw new Error(
							`Modal "${customId}" did not return a response. ` +
								"Return an APIInteractionResponse to acknowledge the interaction.",
						);
					}

					return resolvedResponse;
				},
				this.timeoutConfig.initialResponseTimeout,
				`Modal "${customId}"`,
				this.timeoutConfig.enableTimeoutWarnings,
				ackPromise,
			);

			const resolvedResponse = await timeoutWrapper();

			return {
				status: 200,
				body: resolvedResponse,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("Handler timeout")) {
				console.error(
					`[MiniInteraction] CRITICAL: Modal "${customId}" timed out. ` +
						`This will result in "didn't respond in time" errors for users.`,
				);
			}

			return {
				status: 500,
				body: {
					error: `[MiniInteraction] Modal "${customId}" failed: ${errorMessage}`,
				},
			};
		}
	}

	/**
	 * Handles execution of an application command interaction.
	 */
	private async handleApplicationCommand(
		interaction: APIInteraction,
	): Promise<InteractionHandlerResult> {
		await this.ensureCommandsLoaded();

		const commandInteraction =
			interaction as APIApplicationCommandInteraction;

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

			// Create an acknowledgment promise for application commands
			let ackResolver: ((response: APIInteractionResponse) => void) | null = null;
			const ackPromise = new Promise<APIInteractionResponse>((resolve) => {
				ackResolver = resolve;
			});

			// Helper to send follow-up responses via webhooks
			const sendFollowUp = (token: string, data: APIInteractionResponse) =>
				this.sendFollowUp(token, data);

			// Create a timeout wrapper for the command handler
			const timeoutWrapper = createTimeoutWrapper(
				async () => {
					// Check if it's a chat input (slash) command
					if (
						commandInteraction.data.type ===
						ApplicationCommandType.ChatInput
					) {
						const interactionWithHelpers = createCommandInteraction(
							commandInteraction as APIChatInputApplicationCommandInteraction,
							{
								canRespond: (id) => this.canRespond(id),
								trackResponse: (id, token, state) => this.trackInteractionState(id, token, state),
								onAck: (response) => ackResolver?.(response),
								sendFollowUp,
							}
						);
						response = await command.handler(
							interactionWithHelpers as any,
						);
						resolvedResponse =
							response ?? interactionWithHelpers.getResponse();
					} else if (
						commandInteraction.data.type ===
						ApplicationCommandType.User
					) {
						// User context menu command
						const interactionWithHelpers =
							createUserContextMenuInteraction(
								commandInteraction as any,
								{
									onAck: (response) => ackResolver?.(response),
								}
							);
						response = await command.handler(
							interactionWithHelpers as any,
						);
						resolvedResponse =
							response ?? interactionWithHelpers.getResponse();
					} else if (
						commandInteraction.data.type ===
						ApplicationCommandType.PrimaryEntryPoint
					) {
						const interactionWithHelpers =
							createAppCommandInteraction(
								commandInteraction as AppCommandInteraction,
								{
									onAck: (response) => ackResolver?.(response),
								}
							);
						response = await command.handler(
							interactionWithHelpers as any,
						);
						resolvedResponse =
							response ?? interactionWithHelpers.getResponse();
					} else if (
						commandInteraction.data.type ===
						ApplicationCommandType.Message
					) {
						// Message context menu command
						const interactionWithHelpers =
							createMessageContextMenuInteraction(
								commandInteraction as any,
								{
									onAck: (response) => ackResolver?.(response),
								}
							);
						response = await command.handler(
							interactionWithHelpers as any,
						);
						resolvedResponse =
							response ?? interactionWithHelpers.getResponse();
					} else {
						// Unknown command type
						response = await command.handler(
							commandInteraction as any,
						);
						resolvedResponse = response ?? null;
					}

					return resolvedResponse as APIInteractionResponse;
				},
				this.timeoutConfig.initialResponseTimeout,
				`Command "${commandName}"`,
				this.timeoutConfig.enableTimeoutWarnings,
				ackPromise,
			);

			const finalResponse = await timeoutWrapper();

			if (!finalResponse) {
				console.error(
					`[MiniInteraction] Command "${commandName}" did not return a response. ` +
						"This indicates the handler completed but no response was generated. " +
						"Check that deferReply(), reply(), showModal(), or a direct response is returned.",
				);
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
				body: finalResponse,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			// Check if this was a timeout error
			if (errorMessage.includes("Handler timeout")) {
				console.error(
					`[MiniInteraction] CRITICAL: Command "${commandName}" timed out before responding to Discord. ` +
						`This will result in "didn't respond in time" errors for users. ` +
						`Handler took longer than ${this.timeoutConfig.initialResponseTimeout}ms to complete. ` +
						`Consider using deferReply() for operations that take more than 3 seconds.`,
				);
			}

			return {
				status: 500,
				body: {
					error: `[MiniInteraction] Command "${commandName}" failed: ${errorMessage}`,
				},
			};
		}
	}

	/**
	 * Sends a follow-up response or edits an existing response via Discord's interaction webhooks.
	 * This is used for interactions that have already been acknowledged (e.g., via deferReply).
	 */
	private async sendFollowUp(
		token: string,
		response: APIInteractionResponse,
	): Promise<void> {
		const url = `${DISCORD_BASE_URL}/webhooks/${this.applicationId}/${token}/messages/@original`;
		
		// Only send follow-up if there is data to send
		if (!('data' in response) || !response.data) {
			return;
		}

		try {
			const fetchResponse = await this.fetchImpl(url, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(response.data),
			});

			if (!fetchResponse.ok) {
				const errorBody = await fetchResponse.text();
				console.error(
					`[MiniInteraction] Failed to send follow-up response: [${fetchResponse.status}] ${errorBody}`,
				);
			}
		} catch (error) {
			console.error(
				`[MiniInteraction] Error sending follow-up response: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
}

type HtmlTemplateRenderOptions = {
	rawKeys?: Iterable<string>;
};

const DEFAULT_DISCORD_OAUTH_TEMPLATES: DiscordOAuthCallbackTemplates = {
	success: ({ user }) => {
		const username = escapeHtml(user.username ?? "Discord User");
		const discriminator =
			user.discriminator && user.discriminator !== "0"
				? `#${escapeHtml(user.discriminator)}`
				: "";

		return `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>Linked Role Connected</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .success { color: #2e7d32; background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                h1 { color: #5865f2; }
                .user-info { margin: 10px 0; font-size: 18px; }
        </style>
</head>
<body>
        <h1>✅ Successfully Connected!</h1>
        <div class="success">
                <p><strong>Your Discord account has been linked!</strong></p>
                <div class="user-info">
                        <p>👤 ${username}${discriminator}</p>
                </div>
        </div>
        <div class="info">
                <p>Your linked role metadata has been updated.</p>
                <p>You can now close this window and return to Discord.</p>
        </div>
</body>
</html>`;
	},
	missingCode: () => `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>Missing Authorization Code</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
        </style>
</head>
<body>
        <h1>Missing Authorization Code</h1>
        <div class="error">
                <p>No authorization code was provided.</p>
        </div>
</body>
</html>`,
	oauthError: ({ error }) => `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>OAuth Error</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
        </style>
</head>
<body>
        <h1>OAuth Error</h1>
        <div class="error">
                <p>Authorization failed: ${escapeHtml(error)}</p>
                <p>Please try again.</p>
        </div>
</body>
</html>`,
	invalidState: () => `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>Invalid Session</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
        </style>
</head>
<body>
        <h1>Invalid Session</h1>
        <div class="error">
                <p>The provided state value did not match an active session.</p>
                <p>Please restart the linking process.</p>
        </div>
</body>
</html>`,
	serverError: () => `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>Server Error</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; }
        </style>
</head>
<body>
        <h1>Server Error</h1>
        <div class="error">
                <p>An error occurred while processing your request.</p>
                <p>Please try again later.</p>
        </div>
</body>
</html>`,
};

const DEFAULT_VERIFICATION_ERROR_HTML = `<!DOCTYPE html>
<html>
<head>
        <meta charset="utf-8" />
        <title>Server Error</title>
        <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 5px; display: inline-block; }
        </style>
</head>
<body>
        <div class="error">
                <p>We were unable to load the Discord verification page. Please try again later.</p>
        </div>
</body>
</html>`;

function sendHtml(
	response: ServerResponse,
	body: string,
	statusCode = 200,
): void {
	if (response.headersSent || response.writableEnded) {
		return;
	}

	response.statusCode = statusCode;
	response.setHeader("content-type", "text/html; charset=utf-8");
	response.end(body);
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
			default:
				return character;
		}
	});
}

function resolveOAuthConfig(provided?: OAuthConfig): OAuthConfig {
	if (provided) {
		return provided;
	}

	const appId =
		process.env.DISCORD_APPLICATION_ID ?? process.env.DISCORD_CLIENT_ID;
	const appSecret = process.env.DISCORD_CLIENT_SECRET;
	const redirectUri = process.env.DISCORD_REDIRECT_URI;

	if (!appId || !appSecret || !redirectUri) {
		throw new Error(
			"[MiniInteraction] Missing OAuth configuration. Provide options.oauth or set DISCORD_APPLICATION_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI environment variables.",
		);
	}

	return {
		appId,
		appSecret,
		redirectUri,
	};
}

/**
 * Wraps a handler function with timeout detection and error handling.
 */
function createTimeoutWrapper<T extends any[], R>(
	handler: (...args: T) => Promise<R> | R,
	timeoutMs: number,
	handlerName: string,
	enableWarnings: boolean = true,
	ackPromise?: Promise<R>,
): (...args: T) => Promise<R> {
	return async (...args: T): Promise<R> => {
		const startTime = Date.now();
		let timeoutId: NodeJS.Timeout | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => {
				const elapsed = Date.now() - startTime;
				console.error(
					`[MiniInteraction] ${handlerName} timed out after ${elapsed}ms (limit: ${timeoutMs}ms)`,
				);
				reject(
					new Error(
						`Handler timeout: ${handlerName} exceeded ${timeoutMs}ms limit`,
					),
				);
			}, timeoutMs);
		});

		try {
			const promises: Promise<R>[] = [
				Promise.resolve(handler(...args)),
				timeoutPromise,
			];

			if (ackPromise) {
				promises.push(ackPromise);
			}

			const result = await Promise.race(promises);

			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			const elapsed = Date.now() - startTime;
			if (enableWarnings && elapsed > timeoutMs * 0.8) {
				console.warn(
					`[MiniInteraction] ${handlerName} completed in ${elapsed}ms (${Math.round(
						(elapsed / timeoutMs) * 100,
					)}% of timeout limit)`,
				);
			}

			return result;
		} catch (error) {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			// Re-throw the error with additional context
			if (
				error instanceof Error &&
				error.message.includes("Handler timeout")
			) {
				throw error;
			}

			console.error(`[MiniInteraction] ${handlerName} failed:`, error);
			throw error;
		}
	};
}
