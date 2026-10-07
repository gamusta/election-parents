import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./create-app";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createApp", () => {
	it("returns 404 not_found for unknown routes", async () => {
		const res = await createApp().request("/nope");

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "not_found" });
	});

	it("returns 500 internal_error without leaking the error", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const app = createApp().get("/boom", () => {
			throw new Error("secret detail");
		});

		const res = await app.request("/boom");
		const text = await res.text();

		expect(res.status).toBe(500);
		expect(JSON.parse(text)).toEqual({ error: "internal_error" });
		expect(text).not.toMatch(/secret detail|stack|at /);
		expect(error.mock.calls.flat().join()).not.toContain("secret detail");
	});

	it("logs the route template, not the URL", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const app = createApp().get("/items/:id", (c) => c.text("ok"));

		await app.request("/items/abc?token=xyz");
		await app.request("/missing");

		const [hit, miss] = log.mock.calls.map(([line]) => JSON.parse(line));
		expect(hit).toMatchObject({
			msg: "access",
			method: "GET",
			routePath: "/items/:id",
			status: 200,
		});
		expect(miss).toMatchObject({ routePath: null, status: 404 });
		expect(log.mock.calls.flat().join()).not.toMatch(/abc|xyz/);
	});
});
