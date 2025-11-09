
/**
 * Configuration for MiniDatabase backend.
 */
export interface DatabaseConfig {
        mongoUri: string;
        dbName: string;
        collectionName: string;
}

/**
 * Builder for configuring MiniDatabase.
 * Provides a fluent API for easy database setup.
 *
 * @example
 * ```typescript
 * const db = new MiniDatabaseBuilder()
 *   .useMongoUriFromEnv()
 *   .setDbName("myapp")
 *   .setCollectionName("users")
 *   .build();
 * ```
 */
export class MiniDatabaseBuilder {
        private config: DatabaseConfig = {
                mongoUri: process.env.MONGODB_URI ?? "",
                dbName: "minidb",
                collectionName: "data",
        };

        /**
         * Sets the MongoDB connection URI.
         */
        setMongoUri(uri: string): this {
                this.config.mongoUri = uri;
                return this;
        }

        /**
         * Reads the MongoDB connection URI from an environment variable.
         * Defaults to `MONGODB_URI`.
         */
        useMongoUriFromEnv(variable = "MONGODB_URI"): this {
                const value = process.env[variable];
                if (!value) {
                        throw new Error(
                                `[MiniDatabaseBuilder] Environment variable "${variable}" is not set`,
                        );
                }

                this.config.mongoUri = value;
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

                if (!this.config.mongoUri) {
                        errors.push("MongoDB URI is required");
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

