// Single-table keys (docs/data-model.md). Results share the election partition.
export const electionKey = (electionId: string) => ({
	pk: `ELECTION#${electionId}`,
	sk: "META",
});
export const resultsKey = (electionId: string) => ({
	pk: `ELECTION#${electionId}`,
	sk: "RESULTS",
});
export const ballotsPk = (electionId: string) =>
	`ELECTION#${electionId}#BALLOTS`;

export const isConditionFailed = (error: unknown): boolean =>
	error instanceof Error && error.name === "ConditionalCheckFailedException";
