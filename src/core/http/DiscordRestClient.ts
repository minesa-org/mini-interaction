import { setTimeout as sleep } from 'node:timers/promises';

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

  async request<T>(
    path: string,
    init: RequestInit & { authenticated?: boolean } = {},
  ): Promise<T> {
    let lastError: unknown;
    const { authenticated = true, ...requestInit } = init;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...requestInit,
          headers: {
            ...(authenticated ? { Authorization: `Bot ${this.options.token}` } : {}),
            'Content-Type': 'application/json',
            ...(requestInit.headers ?? {}),
          },
        });
      } catch (error) {
        lastError = this.createRequestError(path, requestInit.method, error);
        if (attempt < this.maxRetries) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        break;
      }

      if (response.status === 429) {
        if (attempt < this.maxRetries) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '1');
          await sleep(Math.ceil(retryAfter * 1000));
          continue;
        }

        lastError = new Error(
          `[DiscordRestClient] ${requestInit.method ?? 'GET'} ${path} failed: 429`,
        );
        break;
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await sleep(150 * (attempt + 1));
        continue;
      }

      lastError = new Error(`[DiscordRestClient] ${requestInit.method ?? 'GET'} ${path} failed: ${response.status}`);
      break;
    }
    throw lastError instanceof Error ? lastError : new Error('[DiscordRestClient] unknown request failure');
  }

  private createRequestError(path: string, method: string | undefined, error: unknown): Error {
    const message =
      error instanceof Error ? error.message : String(error);

    return new Error(
      `[DiscordRestClient] ${method ?? 'GET'} ${path} failed: ${message}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  createFollowup(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}`, {
      method: 'POST',
      body: JSON.stringify(body),
      authenticated: false,
    });
  }

  editOriginal(interactionToken: string, body: unknown): Promise<unknown> {
    return this.request(`/webhooks/${this.options.applicationId}/${interactionToken}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      authenticated: false,
    });
  }
}
