export class ValidationError extends Error {
  constructor(readonly builder: string, readonly field: string, message: string) {
    super(`[${builder}] ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

export function assertStringLength(builder: string, field: string, value: string, min: number, max: number): void {
  if (value.length < min || value.length > max) {
    throw new ValidationError(builder, field, `expected length between ${min} and ${max}, got ${value.length}`);
  }
}

export function assertRange(builder: string, field: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(builder, field, `expected integer between ${min} and ${max}, got ${value}`);
  }
}

export function assertDefined<T>(builder: string, field: string, value: T | null | undefined): T {
  if (value === undefined || value === null) {
    throw new ValidationError(builder, field, 'is required');
  }
  return value;
}
