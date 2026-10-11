import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handle } from "@hono/aws-lambda";
import { withLogContext } from "../../http/log";
import { buildApp } from "./app";

// Read once at INIT: a missing variable fails the cold start, not every request.
const tableName = process.env.TABLE_NAME;
if (!tableName) {
	throw new Error("TABLE_NAME is not set");
}

// Client created at INIT and reused across warm invocations.
export const handler = withLogContext(
	handle(
		buildApp({
			db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
			tableName,
		}),
	),
);
