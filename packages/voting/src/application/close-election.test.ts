import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryElectionStore } from "../infrastructure/in-memory";
import { AFTER, CLOSES, DURING, uuid } from "../testing/fixtures";
import { closeElection } from "./close-election";
import type { ElectionSnapshot } from "./ports";

const ID = uuid(1);
const snapshot = (over: Partial<ElectionSnapshot> = {}): ElectionSnapshot => ({
	id: ID,
	status: "open",
	closesAt: CLOSES,
	seats: 5,
	listIds: [uuid(101), uuid(102)],
	version: 3,
	...over,
});

describe("closeElection", () => {
	let elections: InMemoryElectionStore;
	let close: ReturnType<typeof closeElection>;

	beforeEach(() => {
		elections = new InMemoryElectionStore();
		close = closeElection({ elections });
	});

	it("closes an open election once its period has ended", async () => {
		elections.put(snapshot());

		expect(await close(ID, AFTER)).toEqual({ ok: true, value: "closed" });
		expect((await elections.get(ID))?.status).toBe("closed");
	});

	it("is idempotent: a second run succeeds without writing", async () => {
		elections.put(snapshot());
		await close(ID, AFTER);

		expect(await close(ID, AFTER)).toEqual({
			ok: true,
			value: "already_closed",
		});
		expect(elections.writes).toBe(1);
	});

	it("refuses before the end of the voting period", async () => {
		elections.put(snapshot());

		expect(await close(ID, DURING)).toEqual({
			ok: false,
			error: "voting_period_not_ended",
		});
	});

	it("refuses a draft election", async () => {
		elections.put(snapshot({ status: "draft" }));

		expect(await close(ID, AFTER)).toEqual({
			ok: false,
			error: "election_not_open",
		});
	});

	it("reports an unknown election", async () => {
		expect(await close(ID, AFTER)).toEqual({
			ok: false,
			error: "election_not_found",
		});
	});

	it("loses the race when the item changed after the read", async () => {
		elections.put(snapshot());
		// Someone else writes between our get and our conditional write.
		const racing = closeElection({
			elections: {
				get: (id) => elections.get(id),
				markClosed: async (id) => {
					elections.put(snapshot({ version: 4 }));
					return elections.markClosed(id, 3);
				},
			},
		});

		expect(await racing(ID, AFTER)).toEqual({
			ok: false,
			error: "concurrent_update",
		});
	});
});
