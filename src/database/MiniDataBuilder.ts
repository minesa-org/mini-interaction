import type { JSONEncodable } from "../builders/shared.js";

/**
 * Represents a field in the data schema.
 */
export interface DataField {
	name: string;
	type: "string" | "number" | "boolean" | "object" | "array";
	required?: boolean;
	default?: unknown;
	description?: string;
}

/**
 * Builder for defining data schemas in MiniDatabase.
 * Provides a fluent API for developers to define their data structure.
 *
 * @example
 * ```typescript
 * const userSchema = new MiniDataBuilder()
 *   .addField("userId", "string", { required: true })
 *   .addField("username", "string", { required: true })
 *   .addField("coins", "number", { default: 0 })
 *   .addField("metadata", "object", { default: {} });
 * ```
 */
export class MiniDataBuilder implements JSONEncodable<Record<string, DataField>> {
	private fields: Map<string, DataField> = new Map();

	/**
	 * Adds a field to the data schema.
	 */
	addField(
		name: string,
		type: "string" | "number" | "boolean" | "object" | "array",
		options?: {
			required?: boolean;
			default?: unknown;
			description?: string;
		},
	): this {
		this.fields.set(name, {
			name,
			type,
			required: options?.required ?? false,
			default: options?.default,
			description: options?.description,
		});
		return this;
	}

	/**
	 * Removes a field from the schema.
	 */
	removeField(name: string): this {
		this.fields.delete(name);
		return this;
	}

	/**
	 * Gets a specific field definition.
	 */
	getField(name: string): DataField | undefined {
		return this.fields.get(name);
	}

	/**
	 * Gets all fields in the schema.
	 */
	getFields(): DataField[] {
		return Array.from(this.fields.values());
	}

	/**
	 * Validates data against the schema.
	 */
	validate(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		for (const field of this.fields.values()) {
			const value = data[field.name];

			// Check required fields
			if (field.required && (value === undefined || value === null)) {
				errors.push(`Field "${field.name}" is required`);
				continue;
			}

			// Check type if value exists
			if (value !== undefined && value !== null) {
				const actualType = Array.isArray(value) ? "array" : typeof value;
				if (actualType !== field.type) {
					errors.push(
						`Field "${field.name}" must be of type "${field.type}", got "${actualType}"`,
					);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Applies default values to data.
	 */
	applyDefaults(data: Record<string, unknown>): Record<string, unknown> {
		const result = { ...data };

		for (const field of this.fields.values()) {
			if (result[field.name] === undefined && field.default !== undefined) {
				result[field.name] =
					typeof field.default === "object"
						? JSON.parse(JSON.stringify(field.default))
						: field.default;
			}
		}

		return result;
	}

	/**
	 * Serializes the schema to JSON.
	 */
	toJSON(): Record<string, DataField> {
		const result: Record<string, DataField> = {};
		for (const [key, field] of this.fields) {
			result[key] = field;
		}
		return result;
	}
}

