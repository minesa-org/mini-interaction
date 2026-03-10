import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
	ApplicationCommandType,
	InteractionResponseType,
	InteractionType,
	type APIApplicationCommandInteraction,
	type APIInteraction,
	type APIInteractionResponse,
	type APIMessageComponentInteraction,
	type APIModalSubmitInteraction,
} from "discord-api-types/v10";

import type {
	AppCommandHandler,
	CommandHandler,
	ComponentInteraction,
	InteractionCommand,
	InteractionComponent,
	InteractionModal,
	MessageCommandHandler,
	SlashCommandHandler,
	UserCommandHandler,
} from "../types/Commands.js";
import { createCommandInteraction } from "../utils/CommandInteractionOptions.js";
import {
	createAppCommandInteraction,
	createMessageContextMenuInteraction,
	createUserContextMenuInteraction,
} from "../utils/ContextMenuInteraction.js";
import { createMessageComponentInteraction } from "../utils/MessageComponentInteraction.js";
import { createModalSubmitInteraction } from "../utils/ModalSubmitInteraction.js";
import { DiscordRestClient } from "../core/http/DiscordRestClient.js";
import { verifyAndParseInteraction } from "../core/interactions/InteractionVerifier.js";

type TimeoutConfig = {
	initialResponseTimeout?: number;
	autoDeferSlowOperations?: boolean;
	enableTimeoutWarnings?: boolean;
	enableResponseDebugLogging?: boolean;
};

export type MiniInteractionOptions = {
	commandsDirectory?: string;
	componentsDirectory?: string;
	utilsDirectory?: string;
	timeoutConfig?: TimeoutConfig;
	debug?: boolean;
	cwd?: string;
	publicKey?: string;
	applicationId?: string;
	token?: string;
};

type LoadedModules = {
	commands: InteractionCommand[];
	components: InteractionComponent[];
	modals: InteractionModal[];
};

type ResponseState = "pending" | "deferred" | "responded";

type NodeRequest = {
	body?: unknown;
	rawBody?: string | Uint8Array | Buffer;
	headers: Record<string, string | string[] | undefined> | { get(name: string): string | null };
	method?: string;
	[Symbol.asyncIterator]?: () => AsyncIterableIterator<Uint8Array>;
	on?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type NodeResponse = {
	statusCode?: number;
	setHeader?: (name: string, value: string) => void;
	end: (body?: string) => void;
	status?: (code: number) => NodeResponse;
	json?: (body: unknown) => void;
};

export class MiniInteraction {
	private readonly options: MiniInteractionOptions;
	private readonly projectRoot: string;
	private readonly rest: DiscordRestClient;
	private readonly responseStates = new Map<string, ResponseState>();
	private loadedModulesPromise?: Promise<LoadedModules>;

	constructor(options: MiniInteractionOptions = {}) {
		this.options = options;
		this.projectRoot = path.resolve(options.cwd ?? process.cwd());

		const applicationId =
			options.applicationId ??
			process.env.DISCORD_APPLICATION_ID ??
			process.env.DISCORD_APP_ID;
		const token =
			options.token ??
			process.env.DISCORD_BOT_TOKEN ??
			process.env.DISCORD_TOKEN;

		if (!applicationId || !token) {
			throw new Error(
				"[MiniInteraction] Missing Discord REST credentials. Set applicationId/token or DISCORD_APPLICATION_ID + DISCORD_BOT_TOKEN.",
			);
		}

		this.rest = new DiscordRestClient({ applicationId, token });
	}

	createNodeHandler() {
		return async (req: NodeRequest, res: NodeResponse): Promise<void> => {
			try {
				const body = await this.readRawBody(req);
				const signature = this.getHeader(req.headers, "x-signature-ed25519");
				const timestamp = this.getHeader(req.headers, "x-signature-timestamp");
				const publicKey = this.options.publicKey ?? process.env.DISCORD_PUBLIC_KEY;

				if (!publicKey) {
					this.sendJson(res, 500, {
						error: "[MiniInteraction] Missing DISCORD_PUBLIC_KEY.",
					});
					return;
				}

				if (!signature || !timestamp) {
					this.sendJson(res, 401, {
						error: "[MiniInteraction] Missing Discord signature headers.",
					});
					return;
				}

				const interaction = await verifyAndParseInteraction({
					body,
					signature,
					timestamp,
					publicKey,
				});

				if (interaction.type === InteractionType.Ping) {
					this.sendJson(res, 200, { type: InteractionResponseType.Pong });
					return;
				}

				const response = await this.dispatch(interaction);
				this.sendJson(
					res,
					200,
					response ?? {
						type: InteractionResponseType.DeferredChannelMessageWithSource,
					},
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "[MiniInteraction] Unknown error";
				if (this.options.debug) {
					console.error("[MiniInteraction] createNodeHandler failed", error);
				}
				this.sendJson(res, 500, { error: message });
			}
		};
	}

	private async dispatch(
		interaction: APIInteraction,
	): Promise<APIInteractionResponse | void> {
		const modules = await this.loadModules();

		if (interaction.type === InteractionType.ApplicationCommand) {
			const command = modules.commands.find(
				(candidate) => this.getCommandName(candidate) === interaction.data.name,
			);
			if (!command) return undefined;
			return this.executeCommandHandler(command.handler, interaction);
		}

		if (interaction.type === InteractionType.MessageComponent) {
			const component = modules.components.find(
				(candidate) => candidate.customId === interaction.data.custom_id,
			);
			if (!component) return undefined;
			return this.executeComponentHandler(component.handler, interaction);
		}

		if (interaction.type === InteractionType.ModalSubmit) {
			const modal = modules.modals.find(
				(candidate) => candidate.customId === interaction.data.custom_id,
			);
			if (!modal) return undefined;
			return this.executeModalHandler(modal.handler, interaction);
		}

		return undefined;
	}

	private async executeCommandHandler(
		handler: CommandHandler,
		interaction: APIApplicationCommandInteraction,
	): Promise<APIInteractionResponse | void> {
		return this.runWithResponseLifecycle(interaction, async (helpers) => {
			switch (interaction.data.type) {
				case ApplicationCommandType.ChatInput:
					return (handler as SlashCommandHandler)(
						createCommandInteraction(interaction as never, helpers),
					);
				case ApplicationCommandType.User:
					return (handler as UserCommandHandler)(
						createUserContextMenuInteraction(interaction as never, helpers),
					);
				case ApplicationCommandType.Message:
					return (handler as MessageCommandHandler)(
						createMessageContextMenuInteraction(interaction as never, helpers),
					);
				default:
					if ((interaction.data as { type?: number }).type === ApplicationCommandType.PrimaryEntryPoint) {
						return (handler as AppCommandHandler)(
							createAppCommandInteraction(interaction as never, helpers),
						);
					}
					throw new Error(
						`[MiniInteraction] Unsupported application command type: ${String((interaction.data as { type?: number }).type)}`,
					);
			}
		});
	}

	private async executeComponentHandler(
		handler: InteractionComponent["handler"],
		interaction: APIMessageComponentInteraction,
	): Promise<APIInteractionResponse | void> {
		return this.runWithResponseLifecycle(interaction, async (helpers) =>
			handler(
				createMessageComponentInteraction(
					interaction,
					helpers,
				) as ComponentInteraction,
			),
		);
	}

	private async executeModalHandler(
		handler: InteractionModal["handler"],
		interaction: APIModalSubmitInteraction,
	): Promise<APIInteractionResponse | void> {
		return this.runWithResponseLifecycle(interaction, async (helpers) =>
			handler(createModalSubmitInteraction(interaction, helpers)),
		);
	}

	private async runWithResponseLifecycle<T extends APIInteraction>(
		interaction: T,
		executor: (
			helpers: {
				canRespond: (interactionId: string) => boolean;
				trackResponse: (
					interactionId: string,
					token: string,
					state: "deferred" | "responded",
				) => void;
				onAck: (response: APIInteractionResponse) => void;
				sendFollowUp: (
					token: string,
					response: APIInteractionResponse,
					messageId?: string,
				) => Promise<void>;
			},
		) => Promise<APIInteractionResponse | void> | APIInteractionResponse | void,
	): Promise<APIInteractionResponse | void> {
		let ackResponse: APIInteractionResponse | undefined;
		const helpers = {
			canRespond: (interactionId: string) =>
				(this.responseStates.get(interactionId) ?? "pending") === "pending",
			trackResponse: (
				interactionId: string,
				_token: string,
				state: "deferred" | "responded",
			) => {
				this.responseStates.set(interactionId, state);
			},
			onAck: (response: APIInteractionResponse) => {
				ackResponse = response;
			},
			sendFollowUp: async (
				token: string,
				response: APIInteractionResponse,
				messageId?: string,
			) => {
				const responseData = "data" in response ? response.data ?? {} : {};
				if (messageId === "@original") {
					await this.rest.editOriginal(token, responseData);
					return;
				}
				await this.rest.createFollowup(token, responseData);
			},
		};

		const autoDeferMs = Math.min(
			2500,
			this.options.timeoutConfig?.initialResponseTimeout ?? 2500,
		);
		const autoDeferTimer =
			this.options.timeoutConfig?.autoDeferSlowOperations === true
				? setTimeout(() => {
						if (!helpers.canRespond(interaction.id)) return;
						if (this.options.debug || this.options.timeoutConfig?.enableResponseDebugLogging) {
							console.warn(
								`[MiniInteraction] Auto-deferred interaction ${interaction.id} after ${autoDeferMs}ms.`,
							);
						}
						ackResponse = {
							type: InteractionResponseType.DeferredChannelMessageWithSource,
						};
						helpers.trackResponse(interaction.id, interaction.token, "deferred");
					}, autoDeferMs)
				: undefined;

		const timeoutWarningMs = this.options.timeoutConfig?.initialResponseTimeout;
		const timeoutWarningTimer =
			this.options.timeoutConfig?.enableTimeoutWarnings && timeoutWarningMs
				? setTimeout(() => {
						if (this.responseStates.get(interaction.id)) return;
						console.warn(
							`[MiniInteraction] Interaction ${interaction.id} exceeded ${timeoutWarningMs}ms without a response.`,
						);
					}, timeoutWarningMs)
				: undefined;

		try {
			const result = await executor(helpers);
			if (this.options.debug || this.options.timeoutConfig?.enableResponseDebugLogging) {
				console.debug(
					`[MiniInteraction] Interaction ${interaction.id} completed with ${result ? "explicit" : "fallback"} response.`,
				);
			}
			return result ?? ackResponse;
		} finally {
			if (autoDeferTimer) clearTimeout(autoDeferTimer);
			if (timeoutWarningTimer) clearTimeout(timeoutWarningTimer);
		}
	}

	private async loadModules(): Promise<LoadedModules> {
		if (!this.loadedModulesPromise) {
			this.loadedModulesPromise = this.discoverModules();
		}
		return this.loadedModulesPromise;
	}

	private async discoverModules(): Promise<LoadedModules> {
		const commands = this.options.commandsDirectory
			? await this.loadDirectory(this.options.commandsDirectory)
			: [];
		const components = this.options.componentsDirectory
			? await this.loadDirectory(this.options.componentsDirectory)
			: [];

		const loaded: LoadedModules = {
			commands: [],
			components: [],
			modals: [],
		};

		for (const { filePath, value } of commands) {
			if (this.isInteractionCommand(value)) {
				loaded.commands.push(value);
			} else if (this.options.debug) {
				console.warn(`[MiniInteraction] Ignored non-command module: ${filePath}`);
			}
		}

		for (const { filePath, value } of components) {
			if (!this.isCustomIdHandler(value)) {
				if (this.options.debug) {
					console.warn(`[MiniInteraction] Ignored non-component module: ${filePath}`);
				}
				continue;
			}

			if (this.looksLikeModalFile(filePath)) {
				loaded.modals.push(value as InteractionModal);
			} else {
				loaded.components.push(value as InteractionComponent);
			}
		}

		return loaded;
	}

	private async loadDirectory(directory: string): Promise<Array<{ filePath: string; value: unknown }>> {
		const absoluteDirectory = path.resolve(this.projectRoot, directory);
		const files = await this.walkFiles(absoluteDirectory);
		const loaded = await Promise.all(
			files
				.filter((filePath) => this.isImportableModule(filePath))
				.map(async (filePath) => ({
					filePath,
					values: this.normalizeModuleExports(
						await import(pathToFileURL(filePath).href),
					),
				})),
		);

		return loaded.flatMap(({ filePath, values }) =>
			values.map((value) => ({ filePath, value })),
		);
	}

	private normalizeModuleExports(moduleValue: Record<string, unknown>): unknown[] {
		const values: unknown[] = [];
		if ("default" in moduleValue) {
			values.push(...this.normalizeExportValue(moduleValue.default));
		}

		for (const [key, value] of Object.entries(moduleValue)) {
			if (key === "default") continue;
			values.push(...this.normalizeExportValue(value));
		}

		return values;
	}

	private normalizeExportValue(value: unknown): unknown[] {
		if (Array.isArray(value)) return value;
		return [value];
	}

	private async walkFiles(directory: string): Promise<string[]> {
		const entries = await readdir(directory, { withFileTypes: true });
		const results = await Promise.all(
			entries.map(async (entry) => {
				const resolvedPath = path.join(directory, entry.name);
				if (entry.isDirectory()) {
					return this.walkFiles(resolvedPath);
				}
				return [resolvedPath];
			}),
		);

		return results.flat();
	}

	private isImportableModule(filePath: string): boolean {
		if (filePath.endsWith(".d.ts")) return false;
		return /\.(ts|mts|js|mjs|cjs)$/i.test(filePath);
	}

	private isInteractionCommand(value: unknown): value is InteractionCommand {
		return (
			typeof value === "object" &&
			value !== null &&
			"data" in value &&
			"handler" in value &&
			typeof (value as { handler: unknown }).handler === "function"
		);
	}

	private getCommandName(command: InteractionCommand): string | undefined {
		const data = command.data as { name?: string; toJSON?: () => { name?: string } };
		if (typeof data.toJSON === "function") {
			return data.toJSON().name;
		}
		return data.name;
	}

	private isCustomIdHandler(
		value: unknown,
	): value is InteractionComponent | InteractionModal {
		return (
			typeof value === "object" &&
			value !== null &&
			"customId" in value &&
			"handler" in value &&
			typeof (value as { customId: unknown }).customId === "string" &&
			typeof (value as { handler: unknown }).handler === "function"
		);
	}

	private looksLikeModalFile(filePath: string): boolean {
		const normalized = filePath.toLowerCase();
		return (
			normalized.includes(`${path.sep}modals${path.sep}`) ||
			normalized.endsWith(".modal.ts") ||
			normalized.endsWith(".modal.js") ||
			normalized.includes("_modal.") ||
			normalized.includes("-modal.")
		);
	}

	private async readRawBody(req: NodeRequest): Promise<string> {
		if (typeof req.rawBody === "string") return req.rawBody;
		if (req.rawBody instanceof Uint8Array) {
			return Buffer.from(req.rawBody).toString("utf8");
		}
		if (typeof req.body === "string") return req.body;
		if (req.body instanceof Uint8Array) {
			return Buffer.from(req.body).toString("utf8");
		}
		if (req.body && typeof req.body === "object") {
			return JSON.stringify(req.body);
		}
		if (typeof req[Symbol.asyncIterator] === "function") {
			const chunks: Buffer[] = [];
			for await (const chunk of req as AsyncIterable<Uint8Array>) {
				chunks.push(Buffer.from(chunk));
			}
			return Buffer.concat(chunks).toString("utf8");
		}
		return "";
	}

	private getHeader(headers: NodeRequest["headers"], name: string): string | undefined {
		if (typeof (headers as { get?: unknown }).get === "function") {
			return (headers as { get(name: string): string | null }).get(name) ?? undefined;
		}

		const recordHeaders = headers as Record<string, string | string[] | undefined>;
		const direct =
			recordHeaders[name] ??
			recordHeaders[name.toLowerCase()] ??
			recordHeaders[name.toUpperCase()];

		if (Array.isArray(direct)) return direct[0];
		return direct;
	}

	private sendJson(res: NodeResponse, statusCode: number, body: unknown): void {
		if (typeof res.status === "function" && typeof res.json === "function") {
			const response = res.status(statusCode);
			response.json?.(body);
			return;
		}

		res.statusCode = statusCode;
		res.setHeader?.("Content-Type", "application/json; charset=utf-8");
		res.end(JSON.stringify(body));
	}
}

export const LegacyMiniInteractionAdapter = MiniInteraction;
