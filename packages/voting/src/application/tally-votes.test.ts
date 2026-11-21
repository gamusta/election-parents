import { beforeEach, describe, expect, it } from "vitest";
import {
	InMemoryBallotCounter,
	InMemoryElectionStore,
	InMemoryResultsStore,
} from "../infrastructure/in-memory";
import { CLOSES, uuid } from "../testing/fixtures";
import { tallyVotes } from "./tally-votes";

const ID = uuid(1);
const A = uuid(101);
const B = uuid(102);

describe("tallyVotes", () => {
	let elections: InMemoryElectionStore;
	let ballots: InMemoryBallotCounter;
	let results: InMemoryResultsStore;
	let tally: ReturnType<typeof tallyVotes>;

	const putElection = (status: "open" | "closed") =>
		elections.put({
			id: ID,
			status,
			closesAt: CLOSES,
			seats: 5,
			listIds: [A, B],
			version: 4,
		});

	beforeEach(() => {
		elections = new InMemoryElectionStore();
		ballots = new InMemoryBallotCounter();
		results = new InMemoryResultsStore();
		tally = tallyVotes({ elections, ballots, results });
	});

	it("allocates seats from the ballots of a closed election and saves them", async () => {
		putElection("closed");
		ballots.set(ID, { [A]: 60, [B]: 40 });

		const outcome = await tally(ID);

		expect(outcome.ok && outcome.value.lists).toEqual([
			{ listId: A, votes: 60, seats: 3 },
			{ listId: B, votes: 40, seats: 2 },
		]);
		expect(results.saved.get(ID)?.totalVotes).toBe(100);
	});

	it("is idempotent: a retry returns the same results and keeps the first save", async () => {
		putElection("closed");
		ballots.set(ID, { [A]: 60, [B]: 40 });

		const first = await tally(ID);
		const second = await tally(ID);

		expect(second).toEqual(first);
		expect(results.saved.size).toBe(1);
	});

	it("refuses to count while the election is still open", async () => {
		putElection("open");

		expect(await tally(ID)).toEqual({
			ok: false,
			error: "election_not_closed",
		});
		expect(results.saved.size).toBe(0);
	});

	it("refuses ballots for a list that is not in the election", async () => {
		putElection("closed");
		ballots.set(ID, { [uuid(999)]: 1 });

		expect(await tally(ID)).toEqual({ ok: false, error: "unknown_list" });
	});
});
