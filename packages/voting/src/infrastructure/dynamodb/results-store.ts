import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { ResultsStore } from "../../application/ports";
import type { ElectionResults } from "../../domain/results/seat-allocation";
import { isConditionFailed, resultsKey } from "./keys";

type Db = Pick<DynamoDBDocumentClient, "send">;

export class DynamoResultsStore implements ResultsStore {
	constructor(
		private readonly db: Db,
		private readonly tableName: string,
	) {}

	async saveOnce(electionId: string, results: ElectionResults) {
		try {
			await this.db.send(
				new PutCommand({
					TableName: this.tableName,
					Item: { ...resultsKey(electionId), ...results },
					ConditionExpression: "attribute_not_exists(pk)",
				}),
			);
			return true;
		} catch (error) {
			if (isConditionFailed(error)) return false;
			throw error;
		}
	}
}
