import type { ElectionStatus } from "../domain/election/election";
import type { ElectionResults } from "../domain/results/seat-allocation";

/** What closing and tallying need from the Election item: no candidates, no PII. */
export interface ElectionSnapshot {
	readonly id: string;
	readonly status: ElectionStatus;
	readonly closesAt: Date;
	readonly seats: number;
	readonly listIds: readonly string[];
	readonly version: number;
}

export interface ElectionStore {
	get(electionId: string): Promise<ElectionSnapshot | undefined>;
	/**
	 * Conditional write: status = open AND version = expectedVersion.
	 * false = the condition failed (someone else changed the item first).
	 */
	markClosed(electionId: string, expectedVersion: number): Promise<boolean>;
}

export interface BallotCounter {
	/** Consistent read of every ballot of the election, counted by listId. */
	countByList(electionId: string): Promise<ReadonlyMap<string, number>>;
}

export interface ResultsStore {
	/** Conditional put (attribute_not_exists): false = results already stored. */
	saveOnce(electionId: string, results: ElectionResults): Promise<boolean>;
}
