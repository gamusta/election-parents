import { Metrics } from "@aws-lambda-powertools/metrics";
import { handle } from "@hono/aws-lambda";
import { withLogContext } from "../../http/log";
import { buildApp } from "./app";

// Namespace from POWERTOOLS_METRICS_NAMESPACE (set by infra).
const metrics = new Metrics({ serviceName: "election-api" });

export const handler = withLogContext(handle(buildApp({ metrics })));
