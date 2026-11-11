import { BadRequestException } from '@nestjs/common';

export type Body = Record<string, unknown>;

export function asBody(value: unknown): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Der Request-Body muss ein JSON-Objekt sein.');
  }
  return value as Body;
}

export function requireString(body: Body, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestException(`Feld "${field}" ist erforderlich.`);
  }
  return value.trim();
}

export function optionalString(body: Body, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException(`Feld "${field}" muss ein Text sein.`);
  }
  return value.trim();
}

export function requireEnum<T extends string>(body: Body, field: string, allowed: readonly T[]): T {
  const value = body[field];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestException(`Feld "${field}" muss einer der Werte ${allowed.join(', ')} sein.`);
  }
  return value as T;
}

export function requireStringArray(body: Body, field: string): string[] {
  const value = body[field];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new BadRequestException(`Feld "${field}" muss eine Liste von IDs sein.`);
  }
  return [...new Set(value as string[])];
}

export function requireDate(body: Body, field: string): string {
  const value = requireString(body, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`Feld "${field}" muss ein Datum im Format YYYY-MM-DD sein.`);
  }
  return value;
}

export function requireDateTime(body: Body, field: string): string {
  const value = requireString(body, field);
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new BadRequestException(`Feld "${field}" muss ein Zeitpunkt im ISO-8601-Format sein.`);
  }
  return new Date(time).toISOString();
}

/** Liest einen optionalen Query-Parameter als nicht-negative ganze Zahl. */
export function optionalNonNegativeInteger(value: unknown, parameter: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`Parameter "${parameter}" muss eine nicht-negative ganze Zahl sein.`);
  }
  return parsed;
}
