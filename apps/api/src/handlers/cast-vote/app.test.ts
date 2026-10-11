import { Metrics } from "@aws-lambda-powertools/metrics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app";

const ELECTION_ID = "3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b9c";
const KEY = "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const LIST_ID = "a1b2c3d4-0000-4000-8000-000000000001";

let stdout: ReturnType<typeof spyStdout>;

const spyStdout = () =>
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);

beforeEach(() => {
	vi.restoreAllMocks();
	stdout = spyStdout();
});

// EMF lines are JSON with an "_aws" envelope.
const emitted = (): Record<string, unknown>[] =>
	stdout.mock.calls
		.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
		.filter((line) => line._aws);

const vote = (
	body: unknown,
	{ id = ELECTION_ID, key = KEY }: { id?: string; key?: string | null } = {},
) =>
	buildApp({ metrics: new Metrics({ namespace: "test" }) }).request(
		`/elections/${id}/votes`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(key !== null && { "Idempotency-Key": key }),
			},
			body: typeof body === "string" ? body : JSON.stringify(body),
		},
	);

describe("POST /elections/:id/votes", () => {
	it("returns 400 invalid_election_id for a non-UUID id", async () => {
		const res = await vote({ listId: LIST_ID }, { id: "nope" });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_election_id" });
	});

	it.each([null, "", "not-a-uuid"])(
		"returns 400 invalid_idempotency_key for key %j",
		async (key) => {
			const res = await vote({ listId: LIST_ID }, { key });

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: "invalid_idempotency_key" });
		},
	);

	it.each([
		["malformed JSON", "{"],
		["missing listId", {}],
		["non-UUID listId", { listId: "a" }],
		[
			"extra field (no voter id in a ballot)",
			{ listId: LIST_ID, voterId: "v" },
		],
	])("returns 400 invalid_body for %s", async (_case, body) => {
		const res = await vote(body);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_body" });
	});

	it("returns 501 not_implemented for a valid request", async () => {
		const res = await vote({ listId: LIST_ID });

		expect(res.status).toBe(501);
		expect(await res.json()).toEqual({ error: "not_implemented" });
	});

	it("emits one VoteRequest count per request, by outcome", async () => {
		await vote({ listId: LIST_ID });
		await vote({}, {});

		const outcomes = emitted().map((m) => [m.outcome, m.VoteRequest]);
		expect(outcomes).toEqual([
			["not_implemented", 1],
			["invalid", 1],
		]);
	});

	it("never puts the list or the key in metrics or logs", async () => {
		await vote({ listId: LIST_ID });

		const written = stdout.mock.calls.flat().join("\n");
		expect(written).not.toContain(LIST_ID);
		expect(written).not.toContain(KEY);
	});
});
