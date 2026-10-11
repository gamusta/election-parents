import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { handle } from "@hono/aws-lambda";
import type { Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyEvent } from "../../http/proxy-event";
import { buildApp } from "./app";

const VALID_ID = "3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b9c";
const LIST_ID = "a1b2c3d4-0000-4000-8000-000000000001";

const storedItem = {
	pk: `ELECTION#${VALID_ID}`,
	sk: "META",
	schoolId: "school-1",
	status: "draft",
	version: 3,
	opensAt: "2026-11-02T08:00:00Z",
	closesAt: "2026-11-02T18:00:00Z",
	seats: 5,
	lists: [{ id: LIST_ID, name: "Liste A" }],
	gsi1pk: "SCHOOL#school-1",
	gsi1sk: `2026-11-02T08:00:00Z#${VALID_ID}`,
};

const fakeDb = (item?: Record<string, unknown>) => ({
	send: vi.fn(async (_command: GetCommand) => ({ Item: item })),
});

beforeEach(() => {
	vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

describe("GET /elections/:id", () => {
	it("returns 400 invalid_election_id without reading the table", async () => {
		const db = fakeDb(storedItem);
		const res = await buildApp({ db, tableName: "t" }).request(
			"/elections/not-a-uuid",
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_election_id" });
		expect(db.send).not.toHaveBeenCalled();
	});

	it("reads the META item of the election", async () => {
		const db = fakeDb(storedItem);
		await buildApp({ db, tableName: "dev-election" }).request(
			`/elections/${VALID_ID}`,
		);

		const command = db.send.mock.lastCall?.[0];
		expect(command).toBeInstanceOf(GetCommand);
		expect(command?.input).toEqual({
			TableName: "dev-election",
			Key: { pk: `ELECTION#${VALID_ID}`, sk: "META" },
		});
	});

	it("returns the election without storage attributes", async () => {
		const res = await buildApp({
			db: fakeDb(storedItem),
			tableName: "t",
		}).request(`/elections/${VALID_ID}`);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: VALID_ID,
			status: "draft",
			opensAt: "2026-11-02T08:00:00Z",
			closesAt: "2026-11-02T18:00:00Z",
			seats: 5,
			lists: [{ id: LIST_ID, name: "Liste A" }],
		});
	});

	it("returns 404 election_not_found when the item is missing", async () => {
		const res = await buildApp({ db: fakeDb(), tableName: "t" }).request(
			`/elections/${VALID_ID}`,
		);

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "election_not_found" });
	});

	it("returns 500 internal_error when DynamoDB fails", async () => {
		vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const db = { send: vi.fn().mockRejectedValue(new Error("throttled")) };
		const res = await buildApp({ db, tableName: "t" }).request(
			`/elections/${VALID_ID}`,
		);

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "internal_error" });
	});

	it("honours the API Gateway proxy v1 contract", async () => {
		const handler = handle(
			buildApp({ db: fakeDb(storedItem), tableName: "t" }),
		);
		const res = await handler(
			proxyEvent({
				path: `/elections/${VALID_ID}`,
				resource: "/elections/{id}",
				pathParameters: { id: VALID_ID },
			}),
			{} as Context,
		);

		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body)).toMatchObject({ id: VALID_ID });
	});
});
