/** Enumerates available role connection metadata comparison types supported by Discord. */
export enum RoleConnectionMetadataTypes {
	IntegerLessThanOrEqual = 1,
	IntegerGreaterThanOrEqual = 2,
	IntegerEqual = 3,
	IntegerNotEqual = 4,
	DateTimeLessThanOrEqual = 5,
	DateTimeGreaterThanOrEqual = 6,
	BooleanEqual = 7,
	BooleanNotEqual = 8,
}
