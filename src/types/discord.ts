import type {
  APIInteraction,
  APIInteractionResponse,
  APIModalInteractionResponseCallbackData,
  APIMessageComponent,
  InteractionResponseType,
} from 'discord-api-types/v10';

export type DiscordApiVersion = '10';

export type JsonRecord = Record<string, unknown>;

export type InteractionResponseLike = APIInteractionResponse | { type: InteractionResponseType; data?: JsonRecord };

export type ModalPayload = APIModalInteractionResponseCallbackData;

export type ComponentPayload = APIMessageComponent;

export type ParsedInteraction = APIInteraction;

export type Snowflake = string;
