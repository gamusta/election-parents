import {
	type DynamoDBDocumentClient,
	GetCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import type { ElectionSnapshot, ElectionStore } from "../../application/ports";
import { electionKey, isConditionFailed } from "./keys";

type Db = Pick<DynamoDBDocumentClient, "send">;

// Stored data is still parsed: a corrupt item fails loudly (platform error).
const StoredElection = z.object({
	status: z.enum(["draft", "open", "closed"]),
	closesAt: z.iso.datetime(),
	seats: z.number().int(),
	version: z.number().int(),
	lists: z.array(z.object({ id: z.string() })),
});

export class DynamoElectionStore implements ElectionStore {
	constructor(
		private readonly db: Db,
		private readonly tableName: string,
	) {}

	async get(electionId: string): Promise<ElectionSnapshot | undefined> {
		const { Item } = await this.db.send(
			new GetCommand({
				TableName: this.tableName,
				Key: electionKey(electionId),
				ConsistentRead: true,
			}),
		);
		if (!Item) return undefined;
		const item = StoredElection.parse(Item);
		return {
			id: electionId,
			status: item.status,
			closesAt: new Date(item.closesAt),
			seats: item.seats,
			listIds: item.lists.map((l) => l.id),
			version: item.version,
		};
	}

	async markClosed(electionId: string, expectedVersion: number) {
		try {
			await this.db.send(
				new UpdateCommand({
					TableName: this.tableName,
					Key: electionKey(electionId),
					UpdateExpression: "SET #status = :closed, #version = :next",
					ConditionExpression: "#status = :open AND #version = :expected",
					ExpressionAttributeNames: {
						"#status": "status",
						"#version": "version",
					},
					ExpressionAttributeValues: {
						":open": "open",
						":closed": "closed",
						":expected": expectedVersion,
						":next": expectedVersion + 1,
					},
				}),
			);
			return true;
		} catch (error) {
			if (isConditionFailed(error)) return false;
			throw error;
		}
	}
}
