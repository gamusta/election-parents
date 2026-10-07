import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
	vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("GET /health", () => {
	it("reports coldStart true on first call only", async () => {
		const { app } = await import("./index");

		const first = await (await app.request("/health")).json();
		const second = await (await app.request("/health")).json();

		expect(first).toEqual({ status: "ok", coldStart: true });
		expect(second).toEqual({ status: "ok", coldStart: false });
	});
});
