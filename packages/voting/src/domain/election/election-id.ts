import { err, ok, type Result } from "@election/kernel";
import { isUuid } from "../uuid";

export type ElectionIdError = "invalid_election_id";

export class ElectionId {
	private constructor(readonly value: string) {}

	static create(raw: string): Result<ElectionId, ElectionIdError> {
		const value = raw.toLowerCase();
		return isUuid(value)
			? ok(new ElectionId(value))
			: err("invalid_election_id");
	}

	equals(other: ElectionId): boolean {
		return this.value === other.value;
	}

	toString(): string {
		return this.value;
	}
}
