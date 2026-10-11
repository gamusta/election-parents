/**
 * Something that happened in the domain. Versioned from day one:
 * consumers ignore versions they don't know (AGENTS.md).
 */
export interface DomainEvent<T extends string = string> {
	readonly type: T;
	readonly version: number;
	readonly occurredAt: Date;
}
