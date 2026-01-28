import {
        type APIEmbed,
        type APIEmbedAuthor,
        type APIEmbedField,
        type APIEmbedFooter,
        type APIEmbedImage,
        type APIEmbedThumbnail,
} from "discord-api-types/v10";

import { type JSONEncodable, resolveJSONEncodable } from "./shared.js";

/** Shape describing data used to seed an embed builder instance. */
export type EmbedBuilderData = Partial<APIEmbed>;

/** Builder for Discord embed payloads. */
export class EmbedBuilder implements JSONEncodable<APIEmbed> {
        private data: EmbedBuilderData;

        constructor(data: EmbedBuilderData = {}) {
                this.data = {
                        ...data,
                        footer: data.footer ? { ...data.footer } : undefined,
                        image: data.image ? { ...data.image } : undefined,
                        thumbnail: data.thumbnail ? { ...data.thumbnail } : undefined,
                        author: data.author ? { ...data.author } : undefined,
                        fields: data.fields ? data.fields.map((field) => ({ ...field })) : [],
                };
        }

        /** Sets or clears the embed title. */
        setTitle(title: string | null | undefined): this {
                this.data.title = title ?? undefined;
                return this;
        }

        /** Sets or clears the embed description. */
        setDescription(description: string | null | undefined): this {
                this.data.description = description ?? undefined;
                return this;
        }

        /** Sets or clears the embed URL. */
        setURL(url: string | null | undefined): this {
                this.data.url = url ?? undefined;
                return this;
        }

        /** Sets or clears the embed color. */
        setColor(color: number | null | undefined): this {
                this.data.color = color ?? undefined;
                return this;
        }

        /** Sets the timestamp value using either a Date or ISO string. */
        setTimestamp(timestamp: Date | number | string | null | undefined): this {
                if (timestamp === null || timestamp === undefined) {
                        this.data.timestamp = undefined;
                } else if (timestamp instanceof Date) {
                        this.data.timestamp = timestamp.toISOString();
                } else if (typeof timestamp === "number") {
                        this.data.timestamp = new Date(timestamp).toISOString();
                } else {
                        this.data.timestamp = new Date(timestamp).toISOString();
                }

                return this;
        }

        /** Sets or clears the footer. */
        setFooter(footer: APIEmbedFooter | null | undefined): this {
                this.data.footer = footer ? { ...footer } : undefined;
                return this;
        }

        /** Sets or clears the image. */
        setImage(image: APIEmbedImage | null | undefined): this {
                this.data.image = image ? { ...image } : undefined;
                return this;
        }

        /** Sets or clears the thumbnail. */
        setThumbnail(thumbnail: APIEmbedThumbnail | null | undefined): this {
                this.data.thumbnail = thumbnail ? { ...thumbnail } : undefined;
                return this;
        }

        /** Sets or clears the author. */
        setAuthor(author: APIEmbedAuthor | null | undefined): this {
                this.data.author = author ? { ...author } : undefined;
                return this;
        }

        /** Replaces the embed fields with the provided values. */
        setFields(fields: APIEmbedField[]): this {
                this.data.fields = fields.map((field) => ({ ...field }));
                return this;
        }

        /** Appends fields to the embed. */
        addFields(...fields: APIEmbedField[]): this {
                if (!this.data.fields) {
                        this.data.fields = [];
                }

                this.data.fields.push(...fields.map((field) => ({ ...field })));
                return this;
        }

        /** Serialises the builder into an API compatible embed payload. */
        toJSON(): APIEmbed {
                return {
                        ...this.data,
                        footer: this.data.footer
                                ? resolveJSONEncodable(this.data.footer)
                                : undefined,
                        image: this.data.image
                                ? resolveJSONEncodable(this.data.image)
                                : undefined,
                        thumbnail: this.data.thumbnail
                                ? resolveJSONEncodable(this.data.thumbnail)
                                : undefined,
                        author: this.data.author
                                ? resolveJSONEncodable(this.data.author)
                                : undefined,
                        fields: this.data.fields?.map((field) =>
                                resolveJSONEncodable(field),
                        ),
                };
        }
}
