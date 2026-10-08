import { pbkdf2Sync, randomUUID } from "node:crypto";
import {
	LabBgSchema,
	LabCpuWorkSchema,
	LabTagSchema,
	SleepMsSchema,
} from "@election/shared";
import { handle } from "@hono/aws-lambda";
import { createApp } from "../../http/create-app";
import { proxyEvent } from "../../http/proxy-event";

// Module scope survives across invocations of a warm execution environment.
const moduleInitTime = Date.now();
const envId = randomUUID();
let invocation = 0;
let coldStart = true;

// Read once at INIT: changing a Lambda env var publishes a new configuration
// and AWS discards every existing environment, so it cannot change mid-life.
const labMode = process.env.LAB_MODE === "1";
// Lab 4: deliberately never cleared. Tags leak across requests and memory grows
// until the environment is recycled — in prod, this pattern drives
// maxMemoryUsed up to an out-of-memory error.
const seenTags: string[] = [];

// Global setTimeout (not node:timers/promises) so Vitest fake timers control it.
const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export const app = createApp().get("/health", async (c) => {
	const start = Date.now();
	const rawSleepMs = c.req.query("sleepMs");
	if (rawSleepMs !== undefined) {
		const parsed = SleepMsSchema.safeParse(rawSleepMs);
		if (!parsed.success) {
			return c.json({ error: "invalid_sleep_ms" }, 400);
		}
		// Holds the environment busy so concurrent requests force new environments.
		await sleep(parsed.data);
	}

	// Outside lab mode, tag/bg are ignored: no 400 that would reveal a hidden mode.
	let tag: string | undefined;
	let bg = false;
	let cpuWork: number | undefined;
	if (labMode) {
		const rawTag = c.req.query("tag");
		if (rawTag !== undefined) {
			const parsed = LabTagSchema.safeParse(rawTag);
			if (!parsed.success) {
				return c.json({ error: "invalid_tag" }, 400);
			}
			tag = parsed.data;
		}
		const rawBg = c.req.query("bg");
		if (rawBg !== undefined) {
			if (!LabBgSchema.safeParse(rawBg).success) {
				return c.json({ error: "invalid_bg" }, 400);
			}
			bg = true;
		}
		const rawCpuWork = c.req.query("cpuWork");
		if (rawCpuWork !== undefined) {
			const parsed = LabCpuWorkSchema.safeParse(rawCpuWork);
			if (!parsed.success) {
				return c.json({ error: "invalid_cpu_work" }, 400);
			}
			cpuWork = parsed.data;
		}
	}

	// Lab 5: Lambda allocates CPU in proportion to memorySize (~1 vCPU at 1769 MB).
	// Pure synchronous CPU work on the main thread, so cpuMs tracks the CPU share.
	let cpuMs: number | undefined;
	if (cpuWork !== undefined) {
		const cpuStart = performance.now();
		pbkdf2Sync("lab", "salt", cpuWork, 32, "sha256");
		cpuMs = Math.round((performance.now() - cpuStart) * 100) / 100;
	}

	invocation++;
	if (bg) {
		const startedAtInvocation = invocation;
		// Not awaited: on Lambda the environment freezes after the response, so this
		// fires during a later invocation (after thaw) — or never if it is recycled.
		setTimeout(() => {
			console.log(
				JSON.stringify({ msg: "background_done", startedAtInvocation }),
			);
		}, 1000);
	}
	if (tag !== undefined) {
		seenTags.push(tag);
	}

	const body = {
		status: "ok",
		coldStart,
		envId,
		invocation,
		sinceInitMs: Date.now() - moduleInitTime,
		durationMs: Date.now() - start,
		...(tag !== undefined && { seenTags: [...seenTags] }),
		...(cpuMs !== undefined && { cpuMs }),
	};
	coldStart = false;
	return c.json(body);
});

export const handler = handle(app);

// Priming during INIT: loads Fetch classes and warms the adapter and router.
// Unknown route → 404 (access log line visible between platform.initStart and platform.start);
// /health state untouched. A failure is logged but never fails INIT.
await handler(proxyEvent({ path: "/__prime", resource: "/__prime" })).catch(
	(err: Error) =>
		console.warn(JSON.stringify({ msg: "prime_failed", name: err.name })),
);
