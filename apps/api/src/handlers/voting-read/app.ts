import { type DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
	ElectionIdSchema,
	type ElectionResponse,
	ElectionResponseSchema,
} from "@election/contracts";
import { createApp } from "../../http/create-app";

type Deps = { db: Pick<DynamoDBDocumentClient, "send">; tableName: string };

export const buildApp = ({ db, tableName }: Deps) =>
	createApp().get("/elections/:id", async (c) => {
		const parsed = ElectionIdSchema.safeParse(c.req.param("id"));
		if (!parsed.success) {
			return c.json({ error: "invalid_election_id" }, 400);
		}
		const { Item } = await db.send(
			new GetCommand({
				TableName: tableName,
				Key: { pk: `ELECTION#${parsed.data}`, sk: "META" },
			}),
		);
		if (!Item) {
			return c.json({ error: "election_not_found" }, 404);
		}
		// Explicit mapping: storage attributes (pk, gsi1*, version, schoolId…) never leak.
		const body: ElectionResponse = ElectionResponseSchema.parse({
			id: parsed.data,
			status: Item.status,
			opensAt: Item.opensAt,
			closesAt: Item.closesAt,
			seats: Item.seats,
			lists: Item.lists,
		});
		return c.json(body);
	});
