import { type Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import {
	CastVoteRequestSchema,
	ElectionIdSchema,
	IdempotencyKeySchema,
} from "@election/contracts";
import { createApp } from "../../http/create-app";

type Deps = { metrics: Metrics };

type Outcome = "invalid" | "not_implemented";

export const buildApp = ({ metrics }: Deps) => {
	// Counts only, no dimension tying a request to a voter or a list.
	const count = (outcome: Outcome) => {
		const metric = metrics.singleMetric();
		metric.addDimension("outcome", outcome);
		metric.addMetric("VoteRequest", MetricUnit.Count, 1);
	};

	return createApp().post("/elections/:id/votes", async (c) => {
		if (!ElectionIdSchema.safeParse(c.req.param("id")).success) {
			count("invalid");
			return c.json({ error: "invalid_election_id" }, 400);
		}
		const key = IdempotencyKeySchema.safeParse(c.req.header("Idempotency-Key"));
		if (!key.success) {
			count("invalid");
			return c.json({ error: "invalid_idempotency_key" }, 400);
		}
		const body = CastVoteRequestSchema.safeParse(
			await c.req.json().catch(() => undefined),
		);
		if (!body.success) {
			count("invalid");
			return c.json({ error: "invalid_body" }, 400);
		}
		// J3: CastVote use case (TransactWriteItems Voter + Ballot).
		count("not_implemented");
		return c.json({ error: "not_implemented" }, 501);
	});
};
