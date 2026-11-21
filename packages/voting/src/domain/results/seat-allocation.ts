import { err, ok, type Result } from "@election/kernel";
import type { SeatCount } from "../election/seat-count";

export type SeatAllocationError = "unknown_list" | "invalid_vote_count";

export interface ListResult {
	readonly listId: string;
	readonly votes: number;
	readonly seats: number;
}

/** Outcome of a tally: identifiers and counts only, never a ballot. */
export interface ElectionResults {
	readonly seats: number;
	readonly totalVotes: number;
	readonly lists: readonly ListResult[];
}

/**
 * Proportional representation, largest remainder (Hare quota).
 * - quota = totalVotes / seats; each list first gets floor(votes / quota);
 * - leftover seats go to the largest remainders;
 * - tie on remainder → more votes wins; still tied → listId order
 *   (deterministic stand-in for the legal rule: oldest candidate).
 * Integer maths only: votes × seats vs total, no floating-point quota.
 */
export const allocateSeats = (
	seats: SeatCount,
	listIds: readonly string[],
	votes: ReadonlyMap<string, number>,
): Result<ElectionResults, SeatAllocationError> => {
	for (const [listId, count] of votes) {
		if (!listIds.includes(listId)) return err("unknown_list");
		if (!Number.isSafeInteger(count) || count < 0)
			return err("invalid_vote_count");
	}

	const total = listIds.reduce((sum, id) => sum + (votes.get(id) ?? 0), 0);
	if (total === 0)
		return ok({
			seats: seats.value,
			totalVotes: 0,
			lists: listIds.map((listId) => ({ listId, votes: 0, seats: 0 })),
		});

	const rows = listIds.map((listId) => {
		const count = votes.get(listId) ?? 0;
		const scaled = count * seats.value;
		return {
			listId,
			votes: count,
			seats: Math.floor(scaled / total),
			remainder: scaled % total,
		};
	});

	let leftover = seats.value - rows.reduce((sum, r) => sum + r.seats, 0);
	const byRemainder = [...rows].sort(
		(a, b) =>
			b.remainder - a.remainder ||
			b.votes - a.votes ||
			a.listId.localeCompare(b.listId),
	);
	for (const row of byRemainder) {
		if (leftover === 0) break;
		row.seats += 1;
		leftover -= 1;
	}

	return ok({
		seats: seats.value,
		totalVotes: total,
		lists: rows.map(({ listId, votes: count, seats: won }) => ({
			listId,
			votes: count,
			seats: won,
		})),
	});
};
