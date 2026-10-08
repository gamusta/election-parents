import { randomUUID } from "node:crypto";
import { SleepMsSchema } from "@election/shared";
import { handle } from "@hono/aws-lambda";
import { createApp } from "../../http/create-app";
import { proxyEvent } from "../../http/proxy-event";

// Module scope survives across invocations of a warm execution environment.
const moduleInitTime = Date.now();
const envId = randomUUID();
let invocation = 0;
let coldStart = true;

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

	invocation++;
	const body = {
		status: "ok",
		coldStart,
		envId,
		invocation,
		sinceInitMs: Date.now() - moduleInitTime,
		durationMs: Date.now() - start,
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
