import { tallyVotes } from "@election/voting";
import {
	InMemoryBallotCounter,
	InMemoryElectionStore,
	InMemoryResultsStore,
} from "@election/voting/in-memory";
import { describe, expect, it } from "vitest";
import { buildTask } from "./task";

const ID = "00000000-0000-4000-8000-000000000001";

const setup = (status: "open" | "closed") => {
	const elections = new InMemoryElectionStore();
	elections.put({
		id: ID,
		status,
		closesAt: new Date("2026-10-17T12:00:00Z"),
		seats: 2,
		listIds: ["a", "b"],
		version: 2,
	});
	const ballots = new InMemoryBallotCounter();
	ballots.set(ID, { a: 3, b: 1 });
	const results = new InMemoryResultsStore();
	return buildTask({ tally: tallyVotes({ elections, ballots, results }) });
};

describe("tally-votes task", () => {
	it("returns the total only, results stay in the table", async () => {
		expect(await setup("closed")({ electionId: ID })).toEqual({
			electionId: ID,
			totalVotes: 4,
		});
	});

	it("refuses an election that is not closed", async () => {
		await expect(setup("open")({ electionId: ID })).rejects.toMatchObject({
			name: "election_not_closed",
		});
	});
});
