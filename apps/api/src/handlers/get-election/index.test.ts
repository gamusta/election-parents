import type { Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyEvent } from "../../http/proxy-event";
import { app, handler } from "./index";

const VALID_ID = "3f2b8c1e-7a4d-4e9b-9c2a-1d5e6f7a8b9c";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
});

const electionEvent = (path: string) =>
	proxyEvent({
		path,
		resource: "/elections/{id}",
		pathParameters: { id: path.split("/").at(-1) ?? "" },
	});

describe("GET /elections/:id", () => {
	it("returns 400 invalid_election_id for a non-UUID id", async () => {
		const res = await app.request("/elections/not-a-uuid");

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_election_id" });
	});

	it("returns the draft stub for a valid id", async () => {
		const res = await app.request(`/elections/${VALID_ID}`);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: VALID_ID,
			name: "Stub election",
			status: "draft",
		});
	});

	it("honours the API Gateway proxy v1 contract", async () => {
		const res = await handler(
			electionEvent(`/elections/${VALID_ID}`),
			{} as Context,
		);

		expect(typeof res.statusCode).toBe("number");
		expect(res.statusCode).toBe(200);
		expect(typeof res.body).toBe("string");
		expect(JSON.parse(res.body)).toMatchObject({ id: VALID_ID });
	});

	it("maps validation errors to 400 through the proxy contract", async () => {
		const res = await handler(electionEvent("/elections/nope"), {} as Context);

		expect(res.statusCode).toBe(400);
		expect(JSON.parse(res.body)).toEqual({ error: "invalid_election_id" });
	});
});
