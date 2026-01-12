import type { MiniDataBuilder } from "./MiniDataBuilder.js";
import { MiniDatabaseBuilder } from "./MiniDatabaseBuilder.js";
import type { DatabaseConfig } from "./MiniDatabaseBuilder.js";

/**
 * MiniDatabase provides async data storage backed by MongoDB.
 * Designed to work seamlessly with Vercel and other serverless environments.
 *
 * @example
 * ```typescript
 * const db = new MiniDatabase(config, schema);
 *
 * // Get data
 * const user = await db.get("user123");
 *
 * // Set data
 * await db.set("user123", { username: "john", coins: 100 });
 *
 * // Update data
 * await db.update("user123", { coins: 150 });
 * ```
 */
export class MiniDatabase {
        private config: DatabaseConfig;
        private schema?: MiniDataBuilder;
        private mongoClient?: any;
        private mongoDb?: any;
        private mongoCollection?: any;
        private initPromise?: Promise<void>;

        /**
         * Creates a MiniDatabase instance using an environment variable for the MongoDB URI.
         * Defaults to the `MONGODB_URI` variable expected by Vercel and many hosting providers.
         */
        static fromEnv(
                schema?: MiniDataBuilder,
                options?: {
                        variable?: string;
                        dbName?: string;
                        collectionName?: string;
                },
        ): MiniDatabase {
                const variable = options?.variable ?? "MONGODB_URI";
                const uri = process.env[variable];

                if (!uri) {
                        throw new Error(
                                `[MiniDatabase] Environment variable "${variable}" is not set`,
                        );
                }

                const builder = new MiniDatabaseBuilder()
                        .setMongoUri(uri)
                        .setDbName(options?.dbName ?? "minidb")
                        .setCollectionName(options?.collectionName ?? "data");

                return new MiniDatabase(builder.build(), schema);
        }

        constructor(config: DatabaseConfig, schema?: MiniDataBuilder) {
                this.config = config;
                this.schema = schema;
        }

	/**
	 * Initializes the database connection.
	 */
        private async initialize(): Promise<void> {
                if (this.initPromise) {
                        return this.initPromise;
                }

                this.initPromise = this.initializeMongoDB();

                return this.initPromise;
        }

	/**
	 * Initializes MongoDB connection.
	 */
	private async initializeMongoDB(): Promise<void> {
		try {
			let MongoClient: any;
			try {
				// @ts-ignore - MongoDB is optional
				const mongoModule = await import("mongodb");
				MongoClient = mongoModule.MongoClient;
			} catch {
				throw new Error(
					"MongoDB driver not installed. Install it with: npm install mongodb",
				);
			}

                        if (!this.config.mongoUri) {
                                throw new Error("MongoDB URI is required");
                        }

                        this.mongoClient = new MongoClient(this.config.mongoUri, {
                                maxPoolSize: 5,
                        });

                        await this.mongoClient.connect();
                        this.mongoDb = this.mongoClient.db(this.config.dbName || "minidb");
                        this.mongoCollection = this.mongoDb.collection(
                                this.config.collectionName || "data",
                        );

                } catch (err) {
                        console.error(
				"❌ [MiniDatabase] Failed to connect to MongoDB:",
				err,
			);
			throw err;
		}
	}

	/**
	 * Gets data by key.
	 */
	async get(key: string): Promise<Record<string, unknown> | null> {
                await this.initialize();

                try {
                        const collection = this.mongoCollection;
                        if (!collection) {
                                throw new Error("MongoDB collection is not initialized");
                        }

                        const doc = await collection.findOne({ _id: key });
                        if (!doc) {
                                return null;
                        }

                        const { _id, ...rest } = doc as Record<string, unknown>;
                        return rest;
                } catch (err) {
                        console.error(
                                `❌ [MiniDatabase] Failed to get data for key "${key}":`,
				err,
			);
			return null;
		}
	}

	/**
	 * Sets data by key (overwrites existing data).
	 */
	async set(key: string, data: Record<string, unknown>): Promise<boolean> {
                await this.initialize();

                try {
                        const collection = this.mongoCollection;
                        if (!collection) {
                                throw new Error("MongoDB collection is not initialized");
                        }

                        // Validate against schema if provided
                        if (this.schema) {
                                const validation = this.schema.validate(data);
                                if (!validation.valid) {
                                        throw new Error(
						`Validation failed: ${validation.errors.join(", ")}`,
					);
				}
			}

                        const dataWithDefaults = this.schema
                                ? this.schema.applyDefaults(data)
                                : data;

                        await collection.updateOne(
                                { _id: key },
                                {
                                        $set: {
                                                ...dataWithDefaults,
                                                _id: key,
                                                updatedAt: new Date(),
                                        },
                                        $setOnInsert: {
                                                createdAt: new Date(),
                                        },
                                },
                                { upsert: true },
                        );

			return true;
		} catch (err) {
			console.error(
				`❌ [MiniDatabase] Failed to set data for key "${key}":`,
				err,
			);
			return false;
		}
	}

	/**
	 * Updates specific fields in data (merges with existing data).
	 */
	async update(
		key: string,
		updates: Record<string, unknown>,
	): Promise<boolean> {
                await this.initialize();

                try {
                        const collection = this.mongoCollection;
                        if (!collection) {
                                throw new Error("MongoDB collection is not initialized");
                        }

                        const existing = await this.get(key);
                        const merged = { ...(existing ?? {}), ...updates };

                        // Validate merged data against schema if provided
			if (this.schema) {
				const validation = this.schema.validate(merged);
				if (!validation.valid) {
					throw new Error(
						`Validation failed: ${validation.errors.join(", ")}`,
					);
				}
			}

                        const dataWithDefaults = this.schema
                                ? this.schema.applyDefaults(merged)
                                : merged;

                        await collection.updateOne(
                                { _id: key },
                                {
                                        $set: {
                                                ...dataWithDefaults,
                                                updatedAt: new Date(),
                                        },
                                        $setOnInsert: {
                                                createdAt: new Date(),
                                        },
                                },
                                { upsert: true },
                        );

			return true;
		} catch (err) {
			console.error(
				`❌ [MiniDatabase] Failed to update data for key "${key}":`,
				err,
			);
			return false;
		}
	}

	/**
	 * Deletes data by key.
	 */
	async delete(key: string): Promise<boolean> {
                await this.initialize();

                try {
                        const collection = this.mongoCollection;
                        if (!collection) {
                                throw new Error("MongoDB collection is not initialized");
                        }

                        await collection.deleteOne({ _id: key });

			return true;
		} catch (err) {
			console.error(
				`❌ [MiniDatabase] Failed to delete data for key "${key}":`,
				err,
			);
			return false;
		}
	}

	/**
	 * Closes the database connection (for MongoDB).
	 */
	async close(): Promise<void> {
		if (this.mongoClient) {
			await this.mongoClient.close();
		}
	}
}
