import { err, ok, type Result } from "@election/kernel";
import { isUuid } from "../uuid";

export type CandidateListIdError = "invalid_candidate_list_id";

export class CandidateListId {
	private constructor(readonly value: string) {}

	static create(raw: string): Result<CandidateListId, CandidateListIdError> {
		const value = raw.toLowerCase();
		return isUuid(value)
			? ok(new CandidateListId(value))
			: err("invalid_candidate_list_id");
	}

	equals(other: CandidateListId): boolean {
		return this.value === other.value;
	}

	toString(): string {
		return this.value;
	}
}
