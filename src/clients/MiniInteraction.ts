import type {
	ApplicationRoleConnectionMetadataType,
	RESTPutAPIApplicationRoleConnectionMetadataJSONBody,
} from "discord-api-types/v10";

import { DiscordRestClient, type DiscordRestClientOptions } from "../core/http/DiscordRestClient.js";
import type {
	RegisterMetadataResult,
	RoleConnectionMetadataInput,
} from "../types/RoleConnectionMetadata.js";

export type MiniInteractionOptions = {
	applicationId?: string;
	apiBaseUrl?: DiscordRestClientOptions["apiBaseUrl"];
	maxRetries?: DiscordRestClientOptions["maxRetries"];
	fetchImplementation?: DiscordRestClientOptions["fetchImplementation"];
};

export class MiniInteraction {
	private readonly options: MiniInteractionOptions;

	constructor(options: MiniInteractionOptions = {}) {
		this.options = options;

		const fetchImpl = options.fetchImplementation ?? globalThis.fetch;
		if (typeof fetchImpl !== "function") {
			throw new Error(
				"[MiniInteraction] fetch is not available. Provide a global fetch implementation.",
			);
		}
	}

	public get applicationId(): string {
		const resolvedApplicationId =
			this.options.applicationId ??
			(typeof process !== "undefined"
				? process.env.DISCORD_APPLICATION_ID
				: undefined);

		if (!resolvedApplicationId) {
			throw new Error(
				"[MiniInteraction] Missing Discord application ID. Set options.applicationId or DISCORD_APPLICATION_ID.",
			);
		}

		return resolvedApplicationId;
	}

	public async registerMetadata(
		botToken: string,
		metadata: RoleConnectionMetadataInput[],
	): Promise<RegisterMetadataResult> {
		if (!botToken) {
			throw new Error("[MiniInteraction] botToken is required");
		}

		if (!Array.isArray(metadata) || metadata.length === 0) {
			throw new Error(
				"[MiniInteraction] metadata must be a non-empty array payload",
			);
		}

		const rest = new DiscordRestClient({
			token: botToken,
			applicationId: this.applicationId,
			apiBaseUrl: this.options.apiBaseUrl,
			maxRetries: this.options.maxRetries,
			fetchImplementation: this.options.fetchImplementation,
		});

		const payload: RESTPutAPIApplicationRoleConnectionMetadataJSONBody =
			metadata.map((field) => ({
				...field,
				type: field.type as unknown as ApplicationRoleConnectionMetadataType,
			}));

		return rest.putApplicationRoleConnectionMetadata(
			payload,
		);
	}
}
