import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { matchedRoutes } from "hono/route";

const accessLog = createMiddleware(async (c, next) => {
	const start = performance.now();
	await next();
	// Route template only (e.g. /elections/:id): never the raw URL, which may carry ids or tokens.
	const route = matchedRoutes(c)[c.req.routeIndex];
	console.log(
		JSON.stringify({
			level: "info",
			msg: "access",
			method: c.req.method,
			routePath: route && route.handler !== accessLog ? route.path : null,
			status: c.res.status,
			durationMs: Math.round(performance.now() - start),
		}),
	);
});

export const createApp = () => {
	const app = new Hono();
	app.use("*", accessLog);
	app.notFound((c) => c.json({ error: "not_found" }, 404));
	app.onError((err, c) => {
		// Error name only: messages may embed user input.
		console.error(
			JSON.stringify({ level: "error", msg: "unhandled", errorName: err.name }),
		);
		return c.json({ error: "internal_error" }, 500);
	});
	return app;
};
