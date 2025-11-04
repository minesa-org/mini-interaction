/** Interface describing objects capable of encoding themselves as JSON payloads. */
export interface JSONEncodable<T> {
	toJSON(): T;
}

/** Type guard that checks whether a value provides a `toJSON` method. */
export function isJSONEncodable<T>(
	value: JSONEncodable<T> | unknown,
): value is JSONEncodable<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"toJSON" in value &&
		typeof (value as { toJSON?: unknown }).toJSON === "function"
	);
}

/** Normalises a value that might either be a JSON encodable object or plain payload. */
export function resolveJSONEncodable<T>(value: JSONEncodable<T> | T): T {
	return isJSONEncodable<T>(value) ? value.toJSON() : value;
}
