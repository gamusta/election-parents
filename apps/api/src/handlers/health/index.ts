import { handle } from "@hono/aws-lambda";
import { createApp } from "../../http/create-app";

// Module scope survives across invocations of a warm execution environment.
let coldStart = true;

export const app = createApp().get("/health", (c) => {
	const body = { status: "ok", coldStart };
	coldStart = false;
	return c.json(body);
});

export const handler = handle(app);
