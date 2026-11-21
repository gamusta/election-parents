import type {
	BallotCounter,
	ElectionSnapshot,
	ElectionStore,
	ResultsStore,
} from "../../application/ports";
import type { ElectionResults } from "../../domain/results/seat-allocation";

/** Fakes for tests: same conditional semantics as the DynamoDB adapters. */
export class InMemoryElectionStore implements ElectionStore {
	private readonly items = new Map<string, ElectionSnapshot>();
	writes = 0;

	put(election: ElectionSnapshot): void {
		this.items.set(election.id, election);
	}

	async get(electionId: string): Promise<ElectionSnapshot | undefined> {
		return this.items.get(electionId);
	}

	async markClosed(electionId: string, expectedVersion: number) {
		const current = this.items.get(electionId);
		if (current?.status !== "open" || current.version !== expectedVersion)
			return false;
		this.items.set(electionId, {
			...current,
			status: "closed",
			version: current.version + 1,
		});
		this.writes += 1;
		return true;
	}
}

export class InMemoryBallotCounter implements BallotCounter {
	private readonly counts = new Map<string, ReadonlyMap<string, number>>();

	set(electionId: string, counts: Record<string, number>): void {
		this.counts.set(electionId, new Map(Object.entries(counts)));
	}

	async countByList(electionId: string) {
		return this.counts.get(electionId) ?? new Map<string, number>();
	}
}

export class InMemoryResultsStore implements ResultsStore {
	readonly saved = new Map<string, ElectionResults>();

	async saveOnce(electionId: string, results: ElectionResults) {
		if (this.saved.has(electionId)) return false;
		this.saved.set(electionId, results);
		return true;
	}
}
