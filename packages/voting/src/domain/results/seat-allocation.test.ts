import { describe, expect, it } from "vitest";
import { unwrap } from "../../testing/fixtures";
import { SeatCount } from "../election/seat-count";
import { allocateSeats } from "./seat-allocation";

const seats = (n: number) => unwrap(SeatCount.create(n));
const tally = (n: number, counts: Record<string, number>) =>
	allocateSeats(seats(n), Object.keys(counts), new Map(Object.entries(counts)));
const seatsOf = (n: number, counts: Record<string, number>) =>
	Object.fromEntries(
		unwrap(tally(n, counts)).lists.map((l) => [l.listId, l.seats]),
	);

describe("allocateSeats (largest remainder)", () => {
	it("gives each list floor(votes / quota) seats when there is no remainder", () => {
		expect(seatsOf(5, { A: 60, B: 40 })).toEqual({ A: 3, B: 2 });
	});

	it("gives leftover seats to the largest remainders", () => {
		// quota 20 → A 2 (r 7), B 1 (r 11), C 0 (r 15): leftovers to C then B.
		expect(seatsOf(5, { A: 47, B: 31, C: 15, D: 7 })).toEqual({
			A: 2,
			B: 2,
			C: 1,
			D: 0,
		});
	});

	it("can give a seat to a list below the quota", () => {
		expect(seatsOf(3, { A: 70, B: 20, C: 10 })).toEqual({ A: 2, B: 1, C: 0 });
	});

	it("always allocates exactly the number of seats", () => {
		const results = unwrap(tally(7, { A: 13, B: 29, C: 41, D: 3 }));
		expect(results.lists.reduce((sum, l) => sum + l.seats, 0)).toBe(7);
	});

	it("breaks a remainder tie in favour of the list with more votes", () => {
		// 2 seats, 10 votes: A 7 → 1 seat (r 4), B 2 → 0 (r 4), C 1 → 0 (r 2).
		// A and B tie on remainder: the last seat goes to A (more votes).
		expect(seatsOf(2, { A: 7, B: 2, C: 1 })).toEqual({ A: 2, B: 0, C: 0 });
	});

	it("breaks a full tie deterministically by list id", () => {
		expect(seatsOf(1, { B: 10, A: 10 })).toEqual({ A: 1, B: 0 });
	});

	it("lists without ballots get zero seats and still appear", () => {
		const results = unwrap(
			allocateSeats(seats(2), ["A", "B"], new Map([["A", 5]])),
		);
		expect(results.lists).toEqual([
			{ listId: "A", votes: 5, seats: 2 },
			{ listId: "B", votes: 0, seats: 0 },
		]);
	});

	it("allocates no seat when nobody voted", () => {
		const results = unwrap(tally(3, { A: 0, B: 0 }));
		expect(results.totalVotes).toBe(0);
		expect(results.lists.every((l) => l.seats === 0)).toBe(true);
	});

	it("refuses votes for a list that is not in the election", () => {
		const result = allocateSeats(seats(1), ["A"], new Map([["Z", 1]]));
		expect(result).toEqual({ ok: false, error: "unknown_list" });
	});

	it("refuses negative or fractional counts", () => {
		expect(tally(1, { A: -1 })).toEqual({
			ok: false,
			error: "invalid_vote_count",
		});
		expect(tally(1, { A: 1.5 })).toEqual({
			ok: false,
			error: "invalid_vote_count",
		});
	});
});
