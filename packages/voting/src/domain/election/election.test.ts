import { describe, expect, it } from "vitest";
import {
	AFTER,
	DURING,
	draftElection,
	openElection,
	uuid,
} from "../../testing/fixtures";
import { Election } from "./election";

// Event payloads and recording rules; lifecycle behaviour lives in election.feature.
describe("Election events", () => {
	it("records ElectionOpened with identifiers only, stamped with the given time", () => {
		const election = openElection();

		expect(election.pullEvents()).toEqual([
			{
				type: "ElectionOpened",
				version: 1,
				occurredAt: DURING,
				electionId: uuid(1),
			},
		]);
	});

	it("records ElectionClosed with identifiers only, stamped with the given time", () => {
		const election = openElection();
		election.pullEvents();

		election.close(AFTER);

		expect(election.pullEvents()).toEqual([
			{
				type: "ElectionClosed",
				version: 1,
				occurredAt: AFTER,
				electionId: uuid(1),
			},
		]);
	});

	it("drains events: a second pull returns nothing", () => {
		const election = openElection();

		election.pullEvents();

		expect(election.pullEvents()).toEqual([]);
	});

	it("records nothing on creation", () => {
		expect(draftElection().pullEvents()).toEqual([]);
	});

	it("records nothing when reconstituted from storage", () => {
		const stored = openElection();

		const election = Election.reconstitute({
			id: stored.id,
			period: stored.period,
			seats: stored.seats,
			status: "open",
			lists: [],
		});

		expect(election.pullEvents()).toEqual([]);
	});
});
