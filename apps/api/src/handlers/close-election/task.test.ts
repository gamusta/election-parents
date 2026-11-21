import { closeElection } from "@election/voting";
import { InMemoryElectionStore } from "@election/voting/in-memory";
import { describe, expect, it } from "vitest";
import { buildTask } from "./task";

const ID = "00000000-0000-4000-8000-000000000001";
const AFTER = new Date("2026-10-18T00:00:00Z");

const setup = (status: "open" | "draft" = "open") => {
	const elections = new InMemoryElectionStore();
	elections.put({
		id: ID,
		status,
		closesAt: new Date("2026-10-17T12:00:00Z"),
		seats: 5,
		listIds: [],
		version: 1,
	});
	return buildTask({ close: closeElection({ elections }), now: () => AFTER });
};

describe("close-election task", () => {
	it("returns identifiers only for the next state", async () => {
		expect(await setup()({ electionId: ID })).toEqual({
			electionId: ID,
			outcome: "closed",
		});
	});

	it("throws an error named after the refusal, for Retry/Catch", async () => {
		await expect(setup("draft")({ electionId: ID })).rejects.toMatchObject({
			name: "election_not_open",
		});
	});

	it("rejects malformed input", async () => {
		await expect(setup()({ electionId: "nope" })).rejects.toMatchObject({
			name: "invalid_input",
		});
	});
});
