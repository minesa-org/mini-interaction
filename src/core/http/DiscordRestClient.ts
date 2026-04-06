import { setTimeout as sleep } from 'node:timers/promises';
import type {
  RESTPutAPIApplicationRoleConnectionMetadataJSONBody,
  RESTPutAPIApplicationRoleConnectionMetadataResult,
} from 'discord-api-types/v10';

type FetchLike = typeof fetch;

export type DiscordRestClientOptions = {
  token: string;
  applicationId: string;
  apiBaseUrl?: string;
  maxRetries?: number;
  fetchImplementation?: FetchLike;
};

export class DiscordRestClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor(private readonly options: DiscordRestClientOptions) {
    this.fetchImpl = options.fetchImplementation ?? fetch;
    this.baseUrl = options.apiBaseUrl ?? 'https://discord.com/api/v10';
    this.maxRetries = options.maxRetries ?? 3;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bot ${this.options.token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '1');
        await sleep(Math.ceil(retryAfter * 1000));
        continue;
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const responseText = await response.text();
        if (!responseText) return undefined as T;
        return JSON.parse(responseText) as T;
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await sleep(150 * (attempt + 1));
        continue;
      }

      const errorBody = await response.text();
      lastError = new Error(
        `[DiscordRestClient] ${init.method ?? 'GET'} ${path} failed: ${response.status}${errorBody ? ` ${errorBody}` : ''}`,
      );
      break;
    }
    throw lastError instanceof Error ? lastError : new Error('[DiscordRestClient] unknown request failure');
  }

  createFollowup(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  editOriginal(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  putApplicationRoleConnectionMetadata(
    body: RESTPutAPIApplicationRoleConnectionMetadataJSONBody,
  ): Promise<RESTPutAPIApplicationRoleConnectionMetadataResult> {
    return this.request(`/applications/${this.options.applicationId}/role-connections/metadata`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
}
