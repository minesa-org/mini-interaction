import type {
	APIApplicationRoleConnectionMetadata,
	Locale,
	RESTPutAPIApplicationRoleConnectionMetadataResult,
} from "discord-api-types/v10";

import type { RoleConnectionMetadataTypes } from "./RoleConnectionMetadataTypes.js";

export type DiscordLocale = `${Locale}`;

export type LocalizationMap = Partial<Record<DiscordLocale, string>>;

export type RoleConnectionMetadataInput = {
	key: string;
	name: string;
	description: string;
	type: RoleConnectionMetadataTypes;
	name_localizations?: LocalizationMap;
	description_localizations?: LocalizationMap;
};

export type RoleConnectionMetadata = APIApplicationRoleConnectionMetadata;

export type RegisterMetadataResult = RESTPutAPIApplicationRoleConnectionMetadataResult;
