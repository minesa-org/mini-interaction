import type { MiniDataBuilder } from "./MiniDataBuilder.js";

/**
 * Configuration for MiniDatabase backend.
 */
export interface DatabaseConfig {
	type: "json" | "mongodb";
	dataPath?: string; // For JSON backend
	mongoUri?: string; // For MongoDB backend
	dbName?: string; // MongoDB database name
	collectionName?: string; // MongoDB collection name
}

/**
 * Builder for configuring MiniDatabase.
 * Provides a fluent API for easy database setup.
 *
 * @example
 * ```typescript
 * // Using JSON (default)
 * const db = new MiniDatabaseBuilder()
 *   .setType("json")
 *   .setDataPath("./data")
 *   .build();
 *
 * // Using MongoDB
 * const db = new MiniDatabaseBuilder()
 *   .setType("mongodb")
 *   .setMongoUri(process.env.MONGO_URI)
 *   .setDbName("myapp")
 *   .setCollectionName("users")
 *   .build();
 * ```
 */
export class MiniDatabaseBuilder {
	private config: DatabaseConfig = {
		type: "json",
		dataPath: "./data",
		dbName: "minidb",
		collectionName: "data",
	};

	/**
	 * Sets the database type (json or mongodb).
	 */
	setType(type: "json" | "mongodb"): this {
		this.config.type = type;
		return this;
	}

	/**
	 * Sets the data path for JSON backend.
	 * Default: "./data"
	 */
	setDataPath(path: string): this {
		this.config.dataPath = path;
		return this;
	}

	/**
	 * Sets the MongoDB connection URI.
	 */
	setMongoUri(uri: string): this {
		this.config.mongoUri = uri;
		return this;
	}

	/**
	 * Sets the MongoDB database name.
	 * Default: "minidb"
	 */
	setDbName(name: string): this {
		this.config.dbName = name;
		return this;
	}

	/**
	 * Sets the MongoDB collection name.
	 * Default: "data"
	 */
	setCollectionName(name: string): this {
		this.config.collectionName = name;
		return this;
	}

	/**
	 * Gets the current configuration.
	 */
	getConfig(): DatabaseConfig {
		return { ...this.config };
	}

	/**
	 * Validates the configuration.
	 */
	validate(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (this.config.type === "mongodb") {
			if (!this.config.mongoUri) {
				errors.push("MongoDB URI is required when using mongodb backend");
			}
		}

		if (this.config.type === "json") {
			if (!this.config.dataPath) {
				errors.push("Data path is required when using json backend");
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Builds and returns the configuration.
	 */
	build(): DatabaseConfig {
		const validation = this.validate();
		if (!validation.valid) {
			throw new Error(
				`Invalid database configuration: ${validation.errors.join(", ")}`,
			);
		}
		return this.getConfig();
	}
}

