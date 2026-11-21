import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { tallyVotes } from "@election/voting";
import {
	DynamoBallotCounter,
	DynamoElectionStore,
	DynamoResultsStore,
} from "@election/voting/dynamodb";
import type { Context } from "aws-lambda";
import { logger } from "../../http/log";
import { buildTask } from "./task";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is not set");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const task = buildTask({
	tally: tallyVotes({
		elections: new DynamoElectionStore(db, tableName),
		ballots: new DynamoBallotCounter(db, tableName),
		results: new DynamoResultsStore(db, tableName),
	}),
});

// Invoked by Step Functions, not API Gateway: the event is the task input.
export const handler = (event: unknown, context: Context) => {
	logger.addContext(context);
	return task(event);
};
