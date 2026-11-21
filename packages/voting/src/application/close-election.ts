import { err, ok, type Result } from "@election/kernel";
import type { ElectionStore } from "./ports";

export type CloseElectionOutcome = "closed" | "already_closed";
export type CloseElectionFailure =
	| "election_not_found"
	| "election_not_open"
	| "voting_period_not_ended"
	| "concurrent_update";

/**
 * Step 1 of the close workflow. Idempotent: a duplicate start or a retry
 * finds the election already closed and succeeds without writing.
 */
export const closeElection =
	(deps: { elections: ElectionStore }) =>
	async (
		electionId: string,
		now: Date,
	): Promise<Result<CloseElectionOutcome, CloseElectionFailure>> => {
		const election = await deps.elections.get(electionId);
		if (!election) return err("election_not_found");
		if (election.status === "closed") return ok("already_closed");
		if (election.status !== "open") return err("election_not_open");
		if (now < election.closesAt) return err("voting_period_not_ended");

		// The database decides, not the check above: the write only succeeds
		// if nobody changed the item since we read it (optimistic lock).
		const written = await deps.elections.markClosed(
			electionId,
			election.version,
		);
		return written ? ok("closed") : err("concurrent_update");
	};
