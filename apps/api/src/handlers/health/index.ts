import { randomUUID } from "node:crypto";
import { handle } from "@hono/aws-lambda";
import { createApp } from "../../http/create-app";
import { proxyEvent } from "../../http/proxy-event";

// Module scope survives across invocations of a warm execution environment.
const moduleInitTime = Date.now();
const envId = randomUUID();
let invocation = 0;
let coldStart = true;

export const app = createApp().get("/health", (c) => {
	invocation++;
	const body = {
		status: "ok",
		coldStart,
		envId,
		invocation,
		sinceInitMs: Date.now() - moduleInitTime,
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
