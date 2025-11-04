import "dotenv/config";

/** Discord application's public key used for request signature verification. */
const DISCORD_APP_PUBLIC_KEY = process.env.DISCORD_APP_PUBLIC_KEY as string;
/** Discord application identifier used for REST requests. */
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID as string;
/** Bot token used when registering commands against Discord's API. */
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN as string;
/** Guild identifier used for guild-scoped command registration. */
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID as string;
/** Whether commands should be registered globally instead of per guild. */
const DISCORD_GLOBAL =
	(process.env.DISCORD_GLOBAL ?? "false").toLowerCase() === "true";

/** Local development port for the example interaction server. */
const DISCORD_APP_PORT = process.env.DISCORD_PORT as string;

/** Discord REST API base URL used for all network requests. */
const DISCORD_BASE_URL = "https://discord.com/api/v10";

export {
	DISCORD_APPLICATION_ID,
	DISCORD_APP_PORT,
	DISCORD_APP_PUBLIC_KEY,
	DISCORD_BASE_URL,
	DISCORD_BOT_TOKEN,
	DISCORD_GLOBAL,
	DISCORD_GUILD_ID,
};
