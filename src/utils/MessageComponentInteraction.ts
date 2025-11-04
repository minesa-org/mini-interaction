import {
        InteractionResponseType,
        type APIInteractionResponse,
        type APIInteractionResponseChannelMessageWithSource,
        type APIInteractionResponseDeferredChannelMessageWithSource,
        type APIInteractionResponseDeferredMessageUpdate,
        type APIInteractionResponseUpdateMessage,
        type APIMessageComponentInteraction,
} from "discord-api-types/v10";

import {
        DeferReplyOptions,
        InteractionMessageData,
        normaliseInteractionMessageData,
        normaliseMessageFlags,
} from "./interactionMessageHelpers.js";

/**
 * Represents a component interaction augmented with helper response methods.
 */
export type MessageComponentInteraction = APIMessageComponentInteraction & {
        getResponse: () => APIInteractionResponse | null;
        reply: (
                data: InteractionMessageData,
        ) => APIInteractionResponseChannelMessageWithSource;
        deferReply: (
                options?: DeferReplyOptions,
        ) => APIInteractionResponseDeferredChannelMessageWithSource;
        update: (
                data?: InteractionMessageData,
        ) => APIInteractionResponseUpdateMessage;
        deferUpdate: () => APIInteractionResponseDeferredMessageUpdate;
};

/**
 * Wraps a raw component interaction with helper methods mirroring Discord's expected responses.
 *
 * @param interaction - The raw interaction payload from Discord.
 * @returns A helper-augmented interaction object.
 */
export function createMessageComponentInteraction(
        interaction: APIMessageComponentInteraction,
): MessageComponentInteraction {
        let capturedResponse: APIInteractionResponse | null = null;

        const captureResponse = <T extends APIInteractionResponse>(response: T): T => {
                capturedResponse = response;
                return response;
        };

        const reply = (
                data: InteractionMessageData,
        ): APIInteractionResponseChannelMessageWithSource => {
                const normalisedData = normaliseInteractionMessageData(data);
                if (!normalisedData) {
                        throw new Error(
                                "[MiniInteraction] Component replies require response data to be provided.",
                        );
                }

                return captureResponse({
                        type: InteractionResponseType.ChannelMessageWithSource,
                        data: normalisedData,
                } satisfies APIInteractionResponseChannelMessageWithSource);
        };

        const deferReply = (
                options?: DeferReplyOptions,
        ): APIInteractionResponseDeferredChannelMessageWithSource => {
                const flags = normaliseMessageFlags(options?.flags);

                const response: APIInteractionResponseDeferredChannelMessageWithSource =
                        flags !== undefined
                                ? {
                                          type: InteractionResponseType.DeferredChannelMessageWithSource,
                                          data: { flags },
                                  }
                                : {
                                          type: InteractionResponseType.DeferredChannelMessageWithSource,
                                  };

                return captureResponse(response);
        };

        const update = (
                data?: InteractionMessageData,
        ): APIInteractionResponseUpdateMessage => {
                const normalisedData = normaliseInteractionMessageData(data);

                const response: APIInteractionResponseUpdateMessage = normalisedData
                        ? {
                                  type: InteractionResponseType.UpdateMessage,
                                  data: normalisedData,
                          }
                        : {
                                  type: InteractionResponseType.UpdateMessage,
                          };

                return captureResponse(response);
        };

        const deferUpdate = (): APIInteractionResponseDeferredMessageUpdate =>
                captureResponse({
                        type: InteractionResponseType.DeferredMessageUpdate,
                });

        const getResponse = (): APIInteractionResponse | null => capturedResponse;

        return Object.assign(interaction, {
                reply,
                deferReply,
                update,
                deferUpdate,
                getResponse,
        });
}
