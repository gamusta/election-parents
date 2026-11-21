/**
 * Error thrown by a Step Functions task. Lambda reports `name` as the error
 * type, so Retry/Catch in the state machine match on these codes
 * (e.g. "concurrent_update" → Retry, "voting_period_not_ended" → Catch).
 */
export class TaskError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = code;
	}
}
