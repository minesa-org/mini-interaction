import { promises as fs } from "fs";
import path from "path";
import type { MiniDataBuilder } from "./MiniDataBuilder.js";
import type { DatabaseConfig } from "./MiniDatabaseBuilder.js";

/**
 * MiniDatabase provides async data storage with support for JSON and MongoDB backends.
 * Designed to work seamlessly with Vercel and serverless environments.
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

		this.initPromise = (async () => {
			if (this.config.type === "mongodb") {
				await this.initializeMongoDB();
			} else {
				await this.initializeJSON();
			}
		})();

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

			console.log("✅ [MiniDatabase] Connected to MongoDB");
		} catch (err) {
			console.error(
				"❌ [MiniDatabase] Failed to connect to MongoDB:",
				err,
			);
			throw err;
		}
	}

	/**
	 * Initializes JSON file storage.
	 */
	private async initializeJSON(): Promise<void> {
		try {
			const dataPath = this.config.dataPath || "./data";
			await fs.mkdir(dataPath, { recursive: true });
			console.log(
				"✅ [MiniDatabase] JSON storage initialized at",
				dataPath,
			);
		} catch (err) {
			console.error(
				"❌ [MiniDatabase] Failed to initialize JSON storage:",
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
			if (this.config.type === "mongodb") {
				const doc = await this.mongoCollection.findOne({ _id: key });
				return doc ? { ...doc, _id: undefined } : null;
			} else {
				const filePath = path.join(
					this.config.dataPath || "./data",
					`${key}.json`,
				);
				try {
					const data = await fs.readFile(filePath, "utf-8");
					return JSON.parse(data);
				} catch (err: any) {
					if (err.code === "ENOENT") {
						return null;
					}
					throw err;
				}
			}
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

			if (this.config.type === "mongodb") {
				await this.mongoCollection.updateOne(
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
			} else {
				const filePath = path.join(
					this.config.dataPath || "./data",
					`${key}.json`,
				);
				await fs.writeFile(
					filePath,
					JSON.stringify(dataWithDefaults, null, 2),
				);
			}

			console.log(`✅ [MiniDatabase] Saved data for key "${key}"`);
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
			const existing = await this.get(key);
			const merged = { ...existing, ...updates };

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

			if (this.config.type === "mongodb") {
				await this.mongoCollection.updateOne(
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
			} else {
				const filePath = path.join(
					this.config.dataPath || "./data",
					`${key}.json`,
				);
				await fs.writeFile(
					filePath,
					JSON.stringify(dataWithDefaults, null, 2),
				);
			}

			console.log(`✅ [MiniDatabase] Updated data for key "${key}"`);
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
			if (this.config.type === "mongodb") {
				await this.mongoCollection.deleteOne({ _id: key });
			} else {
				const filePath = path.join(
					this.config.dataPath || "./data",
					`${key}.json`,
				);
				await fs.unlink(filePath);
			}

			console.log(`✅ [MiniDatabase] Deleted data for key "${key}"`);
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
			console.log("✅ [MiniDatabase] MongoDB connection closed");
		}
	}
}
