import type { MiniDatabase } from "../database/MiniDatabase.js";
import type { OAuthTokens } from "./DiscordOAuth.js";

/**
 * Manages OAuth token storage using MiniDatabase.
 * Handles both in-memory and persistent storage.
 */
export class OAuthTokenStorage {
	private db?: MiniDatabase;
	private inMemoryStore: Map<string, OAuthTokens> = new Map();

	constructor(db?: MiniDatabase) {
		this.db = db;
	}

	/**
	 * Stores OAuth tokens for a user.
	 */
	async storeTokens(userId: string, tokens: OAuthTokens): Promise<boolean> {
		try {
			// Always store in memory for fast access
			this.inMemoryStore.set(`oauth-${userId}`, tokens);

			// Also store in database if available
			if (this.db) {
				return await this.db.set(`oauth-${userId}`, {
					userId,
					...tokens,
				});
			}

			return true;
		} catch (err) {
			console.error(`❌ [OAuthTokenStorage] Failed to store tokens for ${userId}:`, err);
			return false;
		}
	}

	/**
	 * Retrieves OAuth tokens for a user.
	 */
	async getTokens(userId: string): Promise<OAuthTokens | null> {
		try {
			// Check in-memory store first
			const cached = this.inMemoryStore.get(`oauth-${userId}`);
			if (cached) {
				return cached;
			}

			// Check database if available
			if (this.db) {
				const data = await this.db.get(`oauth-${userId}`);
				if (data) {
					const tokens: OAuthTokens = {
						access_token: data.access_token as string,
						refresh_token: data.refresh_token as string,
						expires_at: data.expires_at as number,
						token_type: data.token_type as string,
						scope: data.scope as string,
					};
					// Cache in memory
					this.inMemoryStore.set(`oauth-${userId}`, tokens);
					return tokens;
				}
			}

			return null;
		} catch (err) {
			console.error(`❌ [OAuthTokenStorage] Failed to get tokens for ${userId}:`, err);
			return null;
		}
	}

	/**
	 * Updates OAuth tokens for a user.
	 */
	async updateTokens(userId: string, tokens: OAuthTokens): Promise<boolean> {
		try {
			// Update in-memory store
			this.inMemoryStore.set(`oauth-${userId}`, tokens);

			// Update in database if available
			if (this.db) {
				return await this.db.update(`oauth-${userId}`, {
					...tokens,
				});
			}

			return true;
		} catch (err) {
			console.error(`❌ [OAuthTokenStorage] Failed to update tokens for ${userId}:`, err);
			return false;
		}
	}

	/**
	 * Deletes OAuth tokens for a user.
	 */
	async deleteTokens(userId: string): Promise<boolean> {
		try {
			// Remove from in-memory store
			this.inMemoryStore.delete(`oauth-${userId}`);

			// Remove from database if available
			if (this.db) {
				return await this.db.delete(`oauth-${userId}`);
			}

			return true;
		} catch (err) {
			console.error(`❌ [OAuthTokenStorage] Failed to delete tokens for ${userId}:`, err);
			return false;
		}
	}

	/**
	 * Clears all in-memory tokens (useful for testing).
	 */
	clearMemory(): void {
		this.inMemoryStore.clear();
	}
}

