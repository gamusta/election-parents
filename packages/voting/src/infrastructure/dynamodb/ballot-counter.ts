import {
	type DynamoDBDocumentClient,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BallotCounter } from "../../application/ports";
import { ballotsPk } from "./keys";

type Db = Pick<DynamoDBDocumentClient, "send">;

export class DynamoBallotCounter implements BallotCounter {
	constructor(
		private readonly db: Db,
		private readonly tableName: string,
	) {}

	async countByList(electionId: string) {
		const counts = new Map<string, number>();
		let startKey: Record<string, unknown> | undefined;
		// 1 MB per page: loop until DynamoDB stops returning LastEvaluatedKey.
		do {
			const page = await this.db.send(
				new QueryCommand({
					TableName: this.tableName,
					KeyConditionExpression: "pk = :pk",
					ExpressionAttributeValues: { ":pk": ballotsPk(electionId) },
					ProjectionExpression: "listId",
					// A GSI or eventual read could miss the last ballots (AP9).
					ConsistentRead: true,
					ExclusiveStartKey: startKey,
				}),
			);
			for (const { listId } of page.Items ?? []) {
				counts.set(listId, (counts.get(listId) ?? 0) + 1);
			}
			startKey = page.LastEvaluatedKey;
		} while (startKey);
		return counts;
	}
}
