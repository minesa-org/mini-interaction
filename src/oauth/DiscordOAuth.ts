import crypto from "crypto";

/**
 * Discord OAuth utilities for handling the OAuth2 flow.
 * Simplifies Discord authentication for mini-interaction apps.
 */

export interface OAuthConfig {
	appId: string;
	appSecret: string;
	redirectUri: string;
}

export interface OAuthTokens {
	access_token: string;
	refresh_token: string;
	expires_at: number;
	token_type: string;
	scope: string;
}

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	avatar: string | null;
	email?: string;
	verified?: boolean;
	locale?: string;
	mfa_enabled?: boolean;
}

/**
 * Generates an OAuth authorization URL for Discord.
 */
export function generateOAuthUrl(
	config: OAuthConfig,
	scopes: string[] = ["identify", "email"],
): { url: string; state: string } {
	const state = crypto.randomUUID();

	const url = new URL("https://discord.com/api/oauth2/authorize");
	url.searchParams.set("client_id", config.appId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("state", state);
	url.searchParams.set("scope", scopes.join(" "));
	url.searchParams.set("prompt", "consent");

	return { url: url.toString(), state };
}

/**
 * Exchanges an OAuth code for access tokens.
 */
export async function getOAuthTokens(
	code: string,
	config: OAuthConfig,
): Promise<OAuthTokens> {
	const url = "https://discord.com/api/v10/oauth2/token";
	const body = new URLSearchParams({
		client_id: config.appId,
		client_secret: config.appSecret,
		grant_type: "authorization_code",
		code,
		redirect_uri: config.redirectUri,
	});

	const response = await fetch(url, {
		method: "POST",
		body,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to get OAuth tokens: [${response.status}] ${response.statusText}`,
		);
	}

	const data = (await response.json()) as any;
	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires_at: Date.now() + data.expires_in * 1000,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Refreshes an expired access token.
 */
export async function refreshAccessToken(
	refreshToken: string,
	config: OAuthConfig,
): Promise<OAuthTokens> {
	const url = "https://discord.com/api/v10/oauth2/token";
	const body = new URLSearchParams({
		client_id: config.appId,
		client_secret: config.appSecret,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});

	const response = await fetch(url, {
		method: "POST",
		body,
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to refresh access token: [${response.status}] ${response.statusText}`,
		);
	}

	const data = (await response.json()) as any;
	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		expires_at: Date.now() + data.expires_in * 1000,
		token_type: data.token_type,
		scope: data.scope,
	};
}

/**
 * Gets the current user's Discord profile.
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
	const url = "https://discord.com/api/v10/oauth2/@me";
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to get Discord user: [${response.status}] ${response.statusText}`,
		);
	}

	const data = (await response.json()) as any;
	return {
		id: data.user.id,
		username: data.user.username,
		discriminator: data.user.discriminator,
		avatar: data.user.avatar,
		email: data.user.email,
		verified: data.user.verified,
		locale: data.user.locale,
		mfa_enabled: data.user.mfa_enabled,
	};
}

/**
 * Ensures the access token is valid, refreshing if necessary.
 */
export async function ensureValidToken(
	tokens: OAuthTokens,
	config: OAuthConfig,
): Promise<OAuthTokens> {
	if (Date.now() > tokens.expires_at) {
		return refreshAccessToken(tokens.refresh_token, config);
	}
	return tokens;
}

