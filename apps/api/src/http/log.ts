import { Logger } from "@aws-lambda-powertools/logger";
import type { LambdaContext, LambdaEvent } from "@hono/aws-lambda";
import type { Context } from "aws-lambda";

// Shared structured JSON logger. Writes to stdout/stderr itself (not the global
// console), so its fields stay top-level even with Lambda logFormat JSON.
export const logger = new Logger({ serviceName: "election-api" });

type ProxyHandler<R> = (event: LambdaEvent, context?: LambdaContext) => R;

// Adds request id, function name and cold_start to every line of the invocation.
export const withLogContext =
	<R>(handler: ProxyHandler<R>): ProxyHandler<R> =>
	(event, context) => {
		if (context) logger.addContext(context as unknown as Context);
		return handler(event, context);
	};
