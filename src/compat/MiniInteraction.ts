import { readFile, readdir } from "node:fs/promises";
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
import {
	generateOAuthUrl,
	getDiscordUser,
	getOAuthTokens,
	type DiscordUser,
	type OAuthTokens,
} from "../oauth/DiscordOAuth.js";

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
	guildId?: string;
};

type LoadedModules = {
	commands: InteractionCommand[];
	components: InteractionComponent[];
	modals: InteractionModal[];
};

type ResponseState = "pending" | "deferred" | "responded";

type OAuthPageTemplate = {
	htmlFile: string;
};

type OAuthCallbackTemplates = {
	success: OAuthPageTemplate;
	missingCode: OAuthPageTemplate;
	oauthError: OAuthPageTemplate;
	invalidState: OAuthPageTemplate;
	serverError: OAuthPageTemplate;
};

type NodeRequest = {
	body?: unknown;
	rawBody?: string | Uint8Array | Buffer;
	headers: Record<string, string | string[] | undefined> | { get(name: string): string | null };
	method?: string;
	url?: string;
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

	async registerCommands(tokenOverride?: string): Promise<unknown> {
		const modules = await this.loadModules();
		const payload = modules.commands.map((command) => this.resolveCommandPayload(command));
		const applicationId =
			this.options.applicationId ??
			process.env.DISCORD_APPLICATION_ID ??
			process.env.DISCORD_APP_ID;

		if (!applicationId) {
			throw new Error(
				"[MiniInteraction] Missing applicationId for command registration.",
			);
		}

		const token =
			tokenOverride ??
			this.options.token ??
			process.env.DISCORD_BOT_TOKEN ??
			process.env.DISCORD_TOKEN;

		if (!token) {
			throw new Error(
				"[MiniInteraction] Missing bot token for command registration.",
			);
		}

		const rest = new DiscordRestClient({ applicationId, token });
		const guildId = this.options.guildId ?? process.env.DISCORD_GUILD_ID;
		const route = guildId
			? `/applications/${applicationId}/guilds/${guildId}/commands`
			: `/applications/${applicationId}/commands`;

		if (this.options.debug) {
			console.debug(
				`[MiniInteraction] Registering ${payload.length} command(s) on ${guildId ? `guild ${guildId}` : "global"} scope.`,
			);
		}

		return rest.request(route, {
			method: "PUT",
			body: JSON.stringify(payload),
		});
	}

	discordOAuthVerificationPage(options: {
		htmlFile: string;
		scopes?: string[];
	}): (req: NodeRequest, res: NodeResponse) => Promise<void> {
		return async (_req: NodeRequest, res: NodeResponse) => {
			const oauthConfig = this.getOAuthConfig();
			const { url, state } = generateOAuthUrl(
				oauthConfig,
				options.scopes ?? [
					"applications.commands",
					"identify",
					"guilds",
					"role_connections.write",
				],
			);
			const html = await this.loadHtmlFile(options.htmlFile);
			const rendered = html.replaceAll("{{OAUTH_URL_RAW}}", url);
			res.setHeader?.(
				"Set-Cookie",
				`mini_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900`,
			);
			this.sendHtml(res, 200, rendered);
		};
	}

	connectedOAuthPage(htmlFile: string): OAuthPageTemplate {
		return { htmlFile };
	}

	failedOAuthPage(htmlFile: string): OAuthPageTemplate {
		return { htmlFile };
	}

	discordOAuthCallback(options: {
		templates: OAuthCallbackTemplates;
		onAuthorize?: (payload: {
			user: DiscordUser;
			tokens: OAuthTokens;
			req: NodeRequest;
			res: NodeResponse;
		}) => Promise<void> | void;
	}): (req: NodeRequest, res: NodeResponse) => Promise<void> {
		return async (req: NodeRequest, res: NodeResponse) => {
			try {
				const requestUrl = new URL(
					req.url ?? "/",
					process.env.DISCORD_REDIRECT_URI ?? "http://localhost",
				);
				const error = requestUrl.searchParams.get("error");
				const code = requestUrl.searchParams.get("code");
				const state = requestUrl.searchParams.get("state");
				const cookieState = this.getCookie(req, "mini_oauth_state");

				if (error) {
					await this.renderOAuthTemplate(res, options.templates.oauthError);
					return;
				}

				if (!code) {
					await this.renderOAuthTemplate(res, options.templates.missingCode);
					return;
				}

				if (state && cookieState && state !== cookieState) {
					await this.renderOAuthTemplate(res, options.templates.invalidState);
					return;
				}

				const tokens = await getOAuthTokens(code, this.getOAuthConfig());
				const user = await getDiscordUser(tokens.access_token);

				await options.onAuthorize?.({ user, tokens, req, res });

				res.setHeader?.(
					"Set-Cookie",
					"mini_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
				);
				await this.renderOAuthTemplate(res, options.templates.success);
			} catch (error) {
				if (this.options.debug) {
					console.error("[MiniInteraction] discordOAuthCallback failed", error);
				}
				await this.renderOAuthTemplate(res, options.templates.serverError);
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
		let initialResponseCommitted = false;
		const helpers = {
			// Legacy helper contracts use canRespond for both initial acknowledgements
			// and later editReply/followUp calls. The compat layer does not currently
			// track Discord token expiry, so we only block on real expiry outside of
			// this helper and allow the wrapped interaction methods to complete.
			canRespond: (_interactionId: string) => true,
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
				// If the initial interaction response has not been sent yet, collapse the
				// deferred/edit flow back into a single immediate response instead of
				// calling the webhook endpoints early.
				if (!initialResponseCommitted) {
					ackResponse = response;
					this.responseStates.set(interaction.id, "responded");
					return;
				}

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
			initialResponseCommitted = true;
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

	private resolveCommandPayload(command: InteractionCommand): Record<string, unknown> {
		const data = command.data as {
			toJSON?: () => Record<string, unknown>;
		};
		if (typeof data.toJSON === "function") {
			return data.toJSON();
		}
		return command.data as unknown as Record<string, unknown>;
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

	private async loadHtmlFile(htmlFile: string): Promise<string> {
		const absolutePath = path.resolve(this.projectRoot, htmlFile);
		return readFile(absolutePath, "utf8");
	}

	private async renderOAuthTemplate(
		res: NodeResponse,
		template: OAuthPageTemplate,
	): Promise<void> {
		const html = await this.loadHtmlFile(template.htmlFile);
		this.sendHtml(res, 200, html);
	}

	private sendHtml(res: NodeResponse, statusCode: number, html: string): void {
		if (typeof res.status === "function" && typeof res.end === "function") {
			res.status(statusCode);
		}
		res.statusCode = statusCode;
		res.setHeader?.("Content-Type", "text/html; charset=utf-8");
		res.end(html);
	}

	private getOAuthConfig(): {
		appId: string;
		appSecret: string;
		redirectUri: string;
	} {
		const appId =
			this.options.applicationId ??
			process.env.DISCORD_APPLICATION_ID ??
			process.env.DISCORD_APP_ID;
		const appSecret = process.env.DISCORD_CLIENT_SECRET ?? process.env.DISCORD_APPLICATION_SECRET;
		const redirectUri = process.env.DISCORD_REDIRECT_URI;

		if (!appId || !appSecret || !redirectUri) {
			throw new Error(
				"[MiniInteraction] Missing OAuth config. Expected DISCORD_APPLICATION_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI.",
			);
		}

		return { appId, appSecret, redirectUri };
	}

	private getCookie(req: NodeRequest, name: string): string | undefined {
		const cookieHeader = this.getHeader(req.headers, "cookie");
		if (!cookieHeader) return undefined;

		for (const rawPart of cookieHeader.split(";")) {
			const [rawKey, ...rawValue] = rawPart.trim().split("=");
			if (rawKey === name) {
				return decodeURIComponent(rawValue.join("="));
			}
		}

		return undefined;
	}
}

export const LegacyMiniInteractionAdapter = MiniInteraction;
