import { ElectionIdSchema } from "@election/shared";
import { handle } from "@hono/aws-lambda";
import { createApp } from "../../http/create-app";

export const app = createApp().get("/elections/:id", (c) => {
	const parsed = ElectionIdSchema.safeParse(c.req.param("id"));
	if (!parsed.success) {
		return c.json({ error: "invalid_election_id" }, 400);
	}
	// Stub until the DynamoDB repository exists.
	return c.json({ id: parsed.data, name: "Stub election", status: "draft" });
});

export const handler = handle(app);
