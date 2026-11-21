import { err, type Result } from "@election/kernel";
import type { SeatCountError } from "../domain/election/seat-count";
import { SeatCount } from "../domain/election/seat-count";
import {
	allocateSeats,
	type ElectionResults,
	type SeatAllocationError,
} from "../domain/results/seat-allocation";
import type { BallotCounter, ElectionStore, ResultsStore } from "./ports";

export type TallyVotesFailure =
	| "election_not_found"
	| "election_not_closed"
	| SeatCountError
	| SeatAllocationError;

/**
 * Step 2 of the close workflow. Idempotent: ballots no longer change once
 * the election is closed and allocateSeats is deterministic, so a retry
 * computes the same results; saveOnce keeps the first write.
 */
export const tallyVotes =
	(deps: {
		elections: ElectionStore;
		ballots: BallotCounter;
		results: ResultsStore;
	}) =>
	async (
		electionId: string,
	): Promise<Result<ElectionResults, TallyVotesFailure>> => {
		const election = await deps.elections.get(electionId);
		if (!election) return err("election_not_found");
		// Counting while still open could miss the last ballots.
		if (election.status !== "closed") return err("election_not_closed");

		const seats = SeatCount.create(election.seats);
		if (!seats.ok) return seats;

		const counts = await deps.ballots.countByList(electionId);
		const results = allocateSeats(seats.value, election.listIds, counts);
		if (!results.ok) return results;

		// false = a previous attempt already saved them: same input, same output.
		await deps.results.saveOnce(electionId, results.value);
		return results;
	};
