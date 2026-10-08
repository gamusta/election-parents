import type { Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyEvent } from "../../http/proxy-event";

type Health = {
	status: string;
	coldStart: boolean;
	envId: string;
	invocation: number;
	sinceInitMs: number;
};

const getHealth = async (): Promise<Health> => {
	const { app } = await import("./index");
	return (await app.request("/health")).json() as Promise<Health>;
};

// Spy is installed before each dynamic import, so INIT-time logs are captured.
beforeEach(() => {
	vi.resetModules();
	vi.restoreAllMocks();
	vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("GET /health", () => {
	it("reports coldStart true on first call only", async () => {
		const first = await getHealth();
		const second = await getHealth();

		expect(first).toMatchObject({ status: "ok", coldStart: true });
		expect(second).toMatchObject({ status: "ok", coldStart: false });
	});

	it("keeps envId stable and increments invocation within one environment", async () => {
		const first = await getHealth();
		const second = await getHealth();

		expect(first.envId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(second.envId).toBe(first.envId);
		expect(first.invocation).toBe(1);
		expect(second.invocation).toBe(2);
	});

	it("measures sinceInitMs from module evaluation", async () => {
		vi.useFakeTimers();
		try {
			await import("./index");
			vi.advanceTimersByTime(1500);

			expect((await getHealth()).sinceInitMs).toBe(1500);
		} finally {
			vi.useRealTimers();
		}
	});

	it("gets a new envId and resets counters in a new environment", async () => {
		const a = await getHealth();
		vi.resetModules();
		const b = await getHealth();

		expect(b.envId).not.toBe(a.envId);
		expect(b.invocation).toBe(1);
		expect(b.coldStart).toBe(true);
	});

	it("primes during INIT with a 404 that leaves /health state untouched", async () => {
		const log = vi.mocked(console.log);
		const { handler } = await import("./index");

		const initLines = log.mock.calls.map(([line]) => JSON.parse(String(line)));
		expect(initLines).toContainEqual(
			expect.objectContaining({ msg: "access", status: 404, routePath: null }),
		);

		const res = await handler(
			proxyEvent({ path: "/health", resource: "/health" }),
			{} as Context,
		);
		expect(res.statusCode).toBe(200);
		expect(JSON.parse(res.body)).toMatchObject({
			coldStart: true,
			invocation: 1,
		});
	});
});
