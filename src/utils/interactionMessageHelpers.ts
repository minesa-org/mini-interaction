import type {
        APIInteractionResponseCallbackData,
        MessageFlags,
} from "discord-api-types/v10";

import type {
        InteractionFollowUpFlags,
        InteractionReplyFlags,
} from "../types/InteractionFlags.js";

/** Union of helper flag enums and raw Discord message flags. */
export type MessageFlagLike =
        | MessageFlags
        | InteractionReplyFlags
        | InteractionFollowUpFlags;

/** Message payload accepted by helper reply/edit functions. */
export type InteractionMessageData = Omit<
        APIInteractionResponseCallbackData,
        "flags"
> & {
        flags?: MessageFlagLike;
};

/** Deferred response payload recognised by helper methods. */
export type DeferredResponseData = {
        flags: MessageFlagLike;
};

/** Options accepted when deferring a reply. */
export type DeferReplyOptions = {
        flags?: MessageFlagLike;
};

/**
 * Normalises helper flag enums into the raw Discord `MessageFlags` bitfield.
 *
 * @param flags - A flag from helper enums or raw Discord flags.
 * @returns The value coerced to a `MessageFlags` compatible bitfield.
 */
export function normaliseMessageFlags(
        flags: MessageFlagLike | undefined,
): MessageFlags | undefined {
        return flags === undefined ? undefined : (flags as MessageFlags);
}

/**
 * Ensures helper message payloads include correctly normalised message flags.
 *
 * @param data - The helper-supplied response payload.
 * @returns A payload safe to send to Discord's API.
 */
export function normaliseInteractionMessageData(
        data?: InteractionMessageData,
): APIInteractionResponseCallbackData | undefined {
        if (!data) {
                return undefined;
        }

        if (data.flags === undefined) {
                return data as APIInteractionResponseCallbackData;
        }

        const { flags, ...rest } = data;
        const normalisedFlags = normaliseMessageFlags(flags) as MessageFlags;

        if (normalisedFlags === flags) {
                return data as APIInteractionResponseCallbackData;
        }

        return {
                ...rest,
                flags: normalisedFlags,
        };
}
