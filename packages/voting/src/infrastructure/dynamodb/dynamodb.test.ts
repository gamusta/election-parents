import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoBallotCounter } from "./ballot-counter";
import { DynamoElectionStore } from "./election-store";
import { DynamoResultsStore } from "./results-store";

const conditionFailed = () =>
	Object.assign(new Error("The conditional request failed"), {
		name: "ConditionalCheckFailedException",
	});
const dbReturning = (...outputs: unknown[]) => {
	const send = vi.fn();
	for (const output of outputs)
		output instanceof Error
			? send.mockRejectedValueOnce(output)
			: send.mockResolvedValueOnce(output);
	return { send } as unknown as Pick<DynamoDBDocumentClient, "send"> & {
		send: ReturnType<typeof vi.fn>;
	};
};
const input = (db: { send: ReturnType<typeof vi.fn> }, call = 0) =>
	db.send.mock.calls[call]?.[0].input;

describe("DynamoElectionStore", () => {
	it("reads the META item with a strongly consistent read", async () => {
		const db = dbReturning({
			Item: {
				status: "open",
				closesAt: "2026-10-17T12:00:00Z",
				seats: 5,
				version: 3,
				lists: [{ id: "a", name: "Liste A" }],
			},
		});

		const election = await new DynamoElectionStore(db, "t").get("e1");

		expect(input(db)).toMatchObject({
			Key: { pk: "ELECTION#e1", sk: "META" },
			ConsistentRead: true,
		});
		expect(election).toMatchObject({
			status: "open",
			listIds: ["a"],
			version: 3,
		});
	});

	it("closes with a condition on status and version", async () => {
		const db = dbReturning({});

		expect(await new DynamoElectionStore(db, "t").markClosed("e1", 3)).toBe(
			true,
		);
		expect(input(db)).toMatchObject({
			ConditionExpression: "#status = :open AND #version = :expected",
			ExpressionAttributeValues: { ":expected": 3, ":next": 4 },
		});
	});

	it("maps a failed condition to false, and rethrows anything else", async () => {
		const store = new DynamoElectionStore(
			dbReturning(conditionFailed(), new Error("throttled")),
			"t",
		);

		expect(await store.markClosed("e1", 3)).toBe(false);
		await expect(store.markClosed("e1", 3)).rejects.toThrow("throttled");
	});
});

describe("DynamoBallotCounter", () => {
	it("counts every page of the ballots partition", async () => {
		const db = dbReturning(
			{
				Items: [{ listId: "a" }, { listId: "b" }],
				LastEvaluatedKey: { pk: "x" },
			},
			{ Items: [{ listId: "a" }] },
		);

		const counts = await new DynamoBallotCounter(db, "t").countByList("e1");

		expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 });
		expect(input(db, 1)).toMatchObject({
			ExpressionAttributeValues: { ":pk": "ELECTION#e1#BALLOTS" },
			ConsistentRead: true,
			ExclusiveStartKey: { pk: "x" },
		});
	});
});

describe("DynamoResultsStore", () => {
	const results = { seats: 1, totalVotes: 1, lists: [] };

	it("puts the RESULTS item only if it does not exist", async () => {
		const db = dbReturning({});

		expect(await new DynamoResultsStore(db, "t").saveOnce("e1", results)).toBe(
			true,
		);
		expect(input(db)).toMatchObject({
			Item: { pk: "ELECTION#e1", sk: "RESULTS" },
			ConditionExpression: "attribute_not_exists(pk)",
		});
	});

	it("returns false when results are already stored", async () => {
		const db = dbReturning(conditionFailed());

		expect(await new DynamoResultsStore(db, "t").saveOnce("e1", results)).toBe(
			false,
		);
	});
});
