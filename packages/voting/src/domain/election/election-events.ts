import type { DomainEvent } from "@election/kernel";

/**
 * Election lifecycle events. Identifiers only (no list names, no PII):
 * they may leave the Voting context once published (AGENTS.md).
 * `electionId` is a plain string so the event serialises as is.
 */
export interface ElectionOpened extends DomainEvent<"ElectionOpened"> {
	readonly version: 1;
	readonly electionId: string;
}

export interface ElectionClosed extends DomainEvent<"ElectionClosed"> {
	readonly version: 1;
	readonly electionId: string;
}

export type ElectionEvent = ElectionOpened | ElectionClosed;
