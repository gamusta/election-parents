import { LabCpuWorkSchema, LabSleepMsSchema } from "@election/shared";
import type { Context } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyEvent } from "../../http/proxy-event";

type Health = {
	status: string;
	coldStart: boolean;
	envId: string;
	invocation: number;
	sinceInitMs: number;
	durationMs: number;
	seenTags?: string[];
	cpuMs?: number;
};

const getHealth = async (query = ""): Promise<Health> => {
	const { app } = await import("./index");
	return (await app.request(`/health${query}`)).json() as Promise<Health>;
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

	it.each(["-1", "5001", "abc", "1.5", "", " ", "1e3", "0x10"])(
		"rejects sleepMs=%j with 400 and leaves counters untouched",
		async (value) => {
			const { app } = await import("./index");

			const res = await app.request(
				`/health?sleepMs=${encodeURIComponent(value)}`,
			);

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: "invalid_sleep_ms" });
			expect(await getHealth()).toMatchObject({
				coldStart: true,
				invocation: 1,
			});
		},
	);

	it.each(["0", "5000"])("accepts sleepMs=%s", async (value) => {
		vi.useFakeTimers();
		try {
			const { app } = await import("./index");
			const pending = app.request(`/health?sleepMs=${value}`);
			await vi.advanceTimersByTimeAsync(Number(value));

			expect((await pending).status).toBe(200);
		} finally {
			vi.useRealTimers();
		}
	});

	it("waits sleepMs before responding and reports durationMs", async () => {
		vi.useFakeTimers();
		try {
			const { app } = await import("./index");
			let settled = false;
			const pending = Promise.resolve(app.request("/health?sleepMs=1000")).then(
				(res) => {
					settled = true;
					return res;
				},
			);

			await vi.advanceTimersByTimeAsync(999);
			expect(settled).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			expect(settled).toBe(true);

			expect(await (await pending).json()).toMatchObject({
				status: "ok",
				coldStart: true,
				invocation: 1,
				durationMs: 1000,
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports durationMs 0 without sleepMs", async () => {
		vi.useFakeTimers();
		try {
			expect((await getHealth()).durationMs).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("GET /health lab mode (LAB_MODE=1)", () => {
	// Stubbed before each dynamic import: LAB_MODE is read once at INIT.
	beforeEach(() => {
		vi.stubEnv("LAB_MODE", "1");
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	const backgroundLogs = () =>
		vi
			.mocked(console.log)
			.mock.calls.map(([line]) => JSON.parse(String(line)))
			.filter((line) => line.msg === "background_done");

	describe("?tag", () => {
		it("accumulates tags across requests of one environment", async () => {
			const first = await getHealth("?tag=a");
			const second = await getHealth("?tag=b");

			expect(first.seenTags).toEqual(["a"]);
			expect(second.seenTags).toEqual(["a", "b"]);
		});

		it("starts with empty seenTags in a new environment", async () => {
			await getHealth("?tag=a");
			vi.resetModules();

			expect((await getHealth("?tag=b")).seenTags).toEqual(["b"]);
		});

		it("omits seenTags when no tag is given", async () => {
			await getHealth("?tag=a");

			expect(await getHealth()).not.toHaveProperty("seenTags");
		});

		it("never logs the tag", async () => {
			await getHealth("?tag=secretTag42");

			const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
			expect(logged).not.toContain("secretTag42");
		});

		it.each(["", " ", "a-b", "é", "a".repeat(21)])(
			"rejects tag=%j with 400 and leaves counters untouched",
			async (value) => {
				const { app } = await import("./index");

				const res = await app.request(
					`/health?tag=${encodeURIComponent(value)}`,
				);

				expect(res.status).toBe(400);
				expect(await res.json()).toEqual({ error: "invalid_tag" });
				expect(await getHealth("?tag=ok")).toMatchObject({
					invocation: 1,
					seenTags: ["ok"],
				});
			},
		);

		it("accepts a 20-char alphanumeric tag", async () => {
			const tag = "aZ09".repeat(5);

			expect((await getHealth(`?tag=${tag}`)).seenTags).toEqual([tag]);
		});
	});

	describe("?bg", () => {
		// Fake timers prove the timer is NOT awaited (response before log). They
		// cannot show the freeze: locally the process keeps running. On Lambda the
		// environment freezes after the response, so the log only appears after
		// the next thaw — that is what the lab on AWS demonstrates.
		it("responds before the background log fires", async () => {
			vi.useFakeTimers();
			try {
				const res = await (await import("./index")).app.request("/health?bg=1");

				expect(res.status).toBe(200);
				expect(backgroundLogs()).toEqual([]);
				await vi.advanceTimersByTimeAsync(999);
				expect(backgroundLogs()).toEqual([]);
				await vi.advanceTimersByTimeAsync(1);
				expect(backgroundLogs()).toEqual([
					{ msg: "background_done", startedAtInvocation: 1 },
				]);
			} finally {
				vi.useRealTimers();
			}
		});

		it("tags each background log with the invocation that started it", async () => {
			vi.useFakeTimers();
			try {
				await getHealth("?bg=1");
				await getHealth("?bg=1");
				await vi.advanceTimersByTimeAsync(1000);

				expect(backgroundLogs()).toEqual([
					{ msg: "background_done", startedAtInvocation: 1 },
					{ msg: "background_done", startedAtInvocation: 2 },
				]);
			} finally {
				vi.useRealTimers();
			}
		});

		it.each(["0", "true", ""])(
			"rejects bg=%j with 400 and leaves counters untouched",
			async (value) => {
				const { app } = await import("./index");

				const res = await app.request(`/health?bg=${value}`);

				expect(res.status).toBe(400);
				expect(await res.json()).toEqual({ error: "invalid_bg" });
				expect((await getHealth()).invocation).toBe(1);
			},
		);
	});

	describe("?cpuWork", () => {
		it.each(["0", "200001", "", " ", "abc", "1.5", "1e3", "0x10", "-1"])(
			"rejects cpuWork=%j with 400 and leaves counters untouched",
			async (value) => {
				const { app } = await import("./index");

				const res = await app.request(
					`/health?cpuWork=${encodeURIComponent(value)}`,
				);

				expect(res.status).toBe(400);
				expect(await res.json()).toEqual({ error: "invalid_cpu_work" });
				expect((await getHealth()).invocation).toBe(1);
			},
		);

		// Upper bound checked on the schema only: running 200000 iterations would
		// cost ~300 ms per test run.
		it.each(["1", "200000"])("schema accepts cpuWork=%s", (value) => {
			expect(LabCpuWorkSchema.safeParse(value).success).toBe(true);
		});

		it.each(["1", "1000"])(
			"runs cpuWork=%s and reports cpuMs",
			async (value) => {
				const body = await getHealth(`?cpuWork=${value}`);

				expect(body).toMatchObject({ status: "ok", invocation: 1 });
				expect(body.cpuMs).toBeTypeOf("number");
				expect(body.cpuMs).toBeGreaterThanOrEqual(0);
			},
		);

		it("omits cpuMs when no cpuWork is given", async () => {
			expect(await getHealth()).not.toHaveProperty("cpuMs");
		});
	});

	describe("?sleepMs (lab bound)", () => {
		// Bounds checked on the schema only: never actually wait up to 40 s.
		it.each(["0", "5001", "40000"])("schema accepts sleepMs=%s", (value) => {
			expect(LabSleepMsSchema.safeParse(value).success).toBe(true);
		});

		it.each(["40001", "100000", "-1", "1.5", "", " ", "1e3", "0x10"])(
			"schema rejects sleepMs=%j",
			(value) => {
				expect(LabSleepMsSchema.safeParse(value).success).toBe(false);
			},
		);

		it("rejects sleepMs=40001 with 400 and leaves counters untouched", async () => {
			const { app } = await import("./index");

			const res = await app.request("/health?sleepMs=40001");

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: "invalid_sleep_ms" });
			expect((await getHealth()).invocation).toBe(1);
		});
	});
});

describe("GET /health without LAB_MODE", () => {
	it("keeps the 5000 sleepMs cap (40000 is lab-only)", async () => {
		const { app } = await import("./index");

		const res = await app.request("/health?sleepMs=40000");

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_sleep_ms" });
	});

	it("ignores tag, bg and cpuWork, responding exactly as usual", async () => {
		vi.useFakeTimers();
		try {
			const res = await (await import("./index")).app.request(
				"/health?tag=a-b-invalid&bg=nope&cpuWork=0",
			);
			await vi.advanceTimersByTimeAsync(1000);

			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body).not.toHaveProperty("seenTags");
			expect(body).not.toHaveProperty("cpuMs");
			expect(vi.getTimerCount()).toBe(0);
			const logged = vi.mocked(console.log).mock.calls.flat().join("\n");
			expect(logged).not.toContain("background_done");
		} finally {
			vi.useRealTimers();
		}
	});
});
